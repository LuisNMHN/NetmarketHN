-- =========================================================
-- FUNCIONES PARA VERIFICAR ROLES EN MERCADOS
-- =========================================================
-- Estas funciones permiten verificar si un usuario es
-- creador o participante de un mercado de predicción
-- =========================================================

-- =========================================================
-- FUNCIÓN: Verificar si usuario es creador del mercado
-- =========================================================
CREATE OR REPLACE FUNCTION is_market_creator(
    p_user_id UUID,
    p_market_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_creator_id UUID;
BEGIN
    SELECT creator_id INTO v_creator_id
    FROM prediction_markets
    WHERE id = p_market_id;
    
    IF v_creator_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN v_creator_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Verificar si usuario es participante del mercado
-- =========================================================
CREATE OR REPLACE FUNCTION is_market_participant(
    p_user_id UUID,
    p_market_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_bet BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM market_bets
        WHERE user_id = p_user_id
        AND market_id = p_market_id
    ) INTO v_has_bet;
    
    RETURN v_has_bet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Obtener rol del usuario en un mercado
-- =========================================================
CREATE OR REPLACE FUNCTION get_user_market_role(
    p_user_id UUID,
    p_market_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_is_creator BOOLEAN;
    v_is_participant BOOLEAN;
BEGIN
    -- Verificar si es creador
    SELECT is_market_creator(p_user_id, p_market_id) INTO v_is_creator;
    
    -- Verificar si es participante
    SELECT is_market_participant(p_user_id, p_market_id) INTO v_is_participant;
    
    -- Determinar rol
    IF v_is_creator AND v_is_participant THEN
        RETURN 'creator_and_participant';
    ELSIF v_is_creator THEN
        RETURN 'creator';
    ELSIF v_is_participant THEN
        RETURN 'participant';
    ELSE
        RETURN 'viewer';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Obtener estadísticas del creador para un mercado
-- =========================================================
CREATE OR REPLACE FUNCTION get_market_creator_stats(
    p_market_id UUID
)
RETURNS TABLE (
    total_bets INTEGER,
    total_participants INTEGER,
    total_pool NUMERIC,
    total_bets_by_outcome JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT mb.id)::INTEGER as total_bets,
        COUNT(DISTINCT mb.user_id)::INTEGER as total_participants,
        COALESCE(pm.total_pool_hnld, 0) as total_pool,
        COALESCE(
            jsonb_agg(
                DISTINCT jsonb_build_object(
                    'outcome_id', mo.id,
                    'outcome_name', mo.name,
                    'total_bet_amount', mo.total_bet_amount,
                    'bet_count', (
                        SELECT COUNT(*)::INTEGER 
                        FROM market_bets 
                        WHERE outcome_id = mo.id AND market_id = p_market_id
                    )
                )
            ) FILTER (WHERE mo.id IS NOT NULL),
            '[]'::jsonb
        ) as total_bets_by_outcome
    FROM prediction_markets pm
    LEFT JOIN market_bets mb ON mb.market_id = pm.id
    LEFT JOIN market_outcomes mo ON mo.market_id = pm.id
    WHERE pm.id = p_market_id
    GROUP BY pm.id, pm.total_pool_hnld;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Obtener estadísticas del participante para un mercado
-- =========================================================
CREATE OR REPLACE FUNCTION get_market_participant_stats(
    p_user_id UUID,
    p_market_id UUID
)
RETURNS TABLE (
    total_bets INTEGER,
    total_bet_amount NUMERIC,
    bets_by_outcome JSONB,
    potential_total_payout NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_bets,
        COALESCE(SUM(mb.bet_amount), 0) as total_bet_amount,
        COALESCE(
            jsonb_agg(
                DISTINCT jsonb_build_object(
                    'outcome_id', mb.outcome_id,
                    'outcome_name', mo.name,
                    'bet_amount', mb.bet_amount,
                    'probability_at_bet', mb.probability_at_bet,
                    'potential_payout', mb.potential_payout,
                    'is_winner', mb.is_winner,
                    'payout_received', mb.payout_received
                )
            ) FILTER (WHERE mb.id IS NOT NULL),
            '[]'::jsonb
        ) as bets_by_outcome,
        COALESCE(SUM(mb.potential_payout), 0) as potential_total_payout
    FROM market_bets mb
    LEFT JOIN market_outcomes mo ON mo.id = mb.outcome_id
    WHERE mb.user_id = p_user_id
    AND mb.market_id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- COMENTARIOS
-- =========================================================
COMMENT ON FUNCTION is_market_creator IS 'Verifica si un usuario es el creador de un mercado';
COMMENT ON FUNCTION is_market_participant IS 'Verifica si un usuario ha apostado en un mercado';
COMMENT ON FUNCTION get_user_market_role IS 'Obtiene el rol del usuario en un mercado (creator, participant, creator_and_participant, viewer)';
COMMENT ON FUNCTION get_market_creator_stats IS 'Obtiene estadísticas del mercado para el creador';
COMMENT ON FUNCTION get_market_participant_stats IS 'Obtiene estadísticas del mercado para un participante';
