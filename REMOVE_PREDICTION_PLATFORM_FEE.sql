-- =========================================================
-- ELIMINAR COMISIÓN DE PLATAFORMA EN PREDICCIONES
-- =========================================================
-- Este script elimina la comisión del 1% (o cualquier porcentaje)
-- de la plataforma al momento de hacer una predicción
-- =========================================================

-- 1. Actualizar valor por defecto de platform_fee_percent a 0
ALTER TABLE prediction_markets 
ALTER COLUMN platform_fee_percent SET DEFAULT 0;

-- Actualizar todos los mercados existentes a 0% de comisión
UPDATE prediction_markets 
SET platform_fee_percent = 0 
WHERE platform_fee_percent > 0;

-- =========================================================
-- FUNCIÓN: Realizar apuesta Parimutuel (SIN COMISIÓN)
-- =========================================================
CREATE OR REPLACE FUNCTION place_parimutuel_bet(
    p_user_id UUID,
    p_market_id UUID,
    p_outcome_id UUID,
    p_bet_amount NUMERIC
)
RETURNS UUID AS $$
DECLARE
    v_bet_id UUID;
    v_market RECORD;
    v_outcome RECORD;
    v_user_balance NUMERIC;
    v_total_pool_before NUMERIC;
    v_total_pool_after NUMERIC;
    v_probability_at_bet NUMERIC;
    v_potential_payout NUMERIC;
BEGIN
    -- Obtener información del mercado y outcome
    SELECT * INTO v_market FROM prediction_markets WHERE id = p_market_id;
    SELECT * INTO v_outcome FROM market_outcomes WHERE id = p_outcome_id AND market_id = p_market_id;
    
    IF v_market IS NULL OR v_outcome IS NULL THEN
        RAISE EXCEPTION 'Mercado o opción no encontrada';
    END IF;
    
    IF v_market.status != 'active' THEN
        RAISE EXCEPTION 'El mercado no está activo';
    END IF;
    
    -- Verificar monto mínimo
    IF p_bet_amount < v_market.min_trade_amount THEN
        RAISE EXCEPTION 'El monto mínimo de apuesta es %.2f HNLD', v_market.min_trade_amount;
    END IF;
    
    -- Verificar monto máximo si existe
    IF v_market.max_trade_amount IS NOT NULL AND p_bet_amount > v_market.max_trade_amount THEN
        RAISE EXCEPTION 'El monto máximo por apuesta es %.2f HNLD', v_market.max_trade_amount;
    END IF;
    
    -- NO SE CALCULA NI DEDUCE COMISIÓN - El monto completo va al pool
    -- v_platform_fee := 0;
    -- v_net_bet_amount := p_bet_amount; (sin deducir fee)
    
    -- Verificar balance del usuario
    SELECT available_balance INTO v_user_balance
    FROM user_balances
    WHERE user_id = p_user_id;
    
    IF v_user_balance IS NULL OR v_user_balance < p_bet_amount THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: %.2f HNLD, Requerido: %.2f HNLD', 
            COALESCE(v_user_balance, 0), p_bet_amount;
    END IF;
    
    -- Obtener pool total antes de la apuesta
    SELECT COALESCE(total_pool_hnld, 0) INTO v_total_pool_before
    FROM prediction_markets
    WHERE id = p_market_id;
    
    -- Calcular probabilidad actual antes de agregar esta apuesta
    PERFORM calculate_parimutuel_probabilities(p_market_id);
    SELECT probability INTO v_probability_at_bet
    FROM market_outcomes
    WHERE id = p_outcome_id;
    
    -- Descontar balance del usuario (monto completo, sin deducir fee)
    UPDATE user_balances
    SET available_balance = available_balance - p_bet_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Registrar transacción de balance
    INSERT INTO balance_transactions (
        user_id, transaction_type, amount, balance_after, description
    ) VALUES (
        p_user_id, 'market_bet', -p_bet_amount, v_user_balance - p_bet_amount,
        format('Apuesta de %.2f HNLD en mercado "%s"', p_bet_amount, v_market.title)
    );
    
    -- Actualizar outcome: agregar apuesta al total (monto completo, sin deducir fee)
    UPDATE market_outcomes
    SET total_bet_amount = COALESCE(total_bet_amount, 0) + p_bet_amount
    WHERE id = p_outcome_id;
    
    -- Actualizar pool total del mercado (monto completo, sin deducir fee)
    UPDATE prediction_markets
    SET total_pool_hnld = COALESCE(total_pool_hnld, 0) + p_bet_amount
    WHERE id = p_market_id;
    
    -- Obtener pool total después de la apuesta
    SELECT COALESCE(total_pool_hnld, 0) INTO v_total_pool_after
    FROM prediction_markets
    WHERE id = p_market_id;
    
    -- Recalcular probabilidades después de agregar la apuesta
    PERFORM calculate_parimutuel_probabilities(p_market_id);
    
    -- Calcular ganancia potencial (sin deducir fee de plataforma)
    -- Ganancia potencial = (apuesta / total apostado en esta opción) * pool total
    SELECT 
        CASE 
            WHEN COALESCE(total_bet_amount, 0) > 0 THEN
                (p_bet_amount / total_bet_amount) * v_total_pool_after
            ELSE 0
        END
    INTO v_potential_payout
    FROM market_outcomes
    WHERE id = p_outcome_id;
    
    -- Crear registro de apuesta (bet_amount es el monto completo, sin deducir fee)
    INSERT INTO market_bets (
        user_id, market_id, outcome_id, bet_amount, 
        probability_at_bet, potential_payout
    ) VALUES (
        p_user_id, p_market_id, p_outcome_id, p_bet_amount,
        v_probability_at_bet, v_potential_payout
    ) RETURNING id INTO v_bet_id;
    
    -- Registrar en historial (sin platform_fee_hnld o con 0)
    INSERT INTO market_bets_history (
        market_id, outcome_id, user_id, bet_id, bet_amount,
        probability_at_bet, total_pool_before, total_pool_after,
        platform_fee_hnld, balance_after_hnld
    ) VALUES (
        p_market_id, p_outcome_id, p_user_id, v_bet_id, p_bet_amount,
        v_probability_at_bet, v_total_pool_before, v_total_pool_after,
        0, v_user_balance - p_bet_amount
    );
    
    RETURN v_bet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Resolver mercado Parimutuel (SIN COMISIÓN)
-- =========================================================
CREATE OR REPLACE FUNCTION resolve_parimutuel_market(
    p_market_id UUID,
    p_winning_outcome_id UUID,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_market RECORD;
    v_winning_outcome RECORD;
    v_bet RECORD;
    v_total_pool NUMERIC;
    v_payout_pool NUMERIC; -- Pool completo sin deducir fees
    v_user_payout NUMERIC;
    v_user_balance NUMERIC;
    v_total_bet_on_winner NUMERIC;
BEGIN
    -- Obtener mercado
    SELECT * INTO v_market FROM prediction_markets WHERE id = p_market_id;
    
    IF v_market IS NULL THEN
        RAISE EXCEPTION 'Mercado no encontrado';
    END IF;
    
    IF v_market.status != 'active' AND v_market.status != 'closed' THEN
        RAISE EXCEPTION 'El mercado ya fue resuelto o cancelado';
    END IF;
    
    -- Verificar que el outcome pertenece al mercado
    SELECT * INTO v_winning_outcome
    FROM market_outcomes
    WHERE id = p_winning_outcome_id AND market_id = p_market_id;
    
    IF v_winning_outcome IS NULL THEN
        RAISE EXCEPTION 'La opción ganadora no pertenece a este mercado';
    END IF;
    
    -- Obtener pool total
    SELECT COALESCE(total_pool_hnld, 0) INTO v_total_pool
    FROM prediction_markets
    WHERE id = p_market_id;
    
    -- NO SE DEDUCE COMISIÓN - El pool completo se distribuye entre ganadores
    v_payout_pool := v_total_pool;
    
    -- Obtener total apostado en la opción ganadora
    SELECT COALESCE(total_bet_amount, 0) INTO v_total_bet_on_winner
    FROM market_outcomes
    WHERE id = p_winning_outcome_id;
    
    -- Marcar outcome como ganador
    UPDATE market_outcomes
    SET is_winner = TRUE
    WHERE id = p_winning_outcome_id;
    
    -- Resolver mercado
    UPDATE prediction_markets
    SET 
        status = 'resolved',
        winning_outcome_id = p_winning_outcome_id,
        resolution_notes = p_resolution_notes,
        resolved_at = NOW()
    WHERE id = p_market_id;
    
    -- Distribuir ganancias entre los ganadores proporcionalmente (pool completo)
    IF v_total_bet_on_winner > 0 THEN
        FOR v_bet IN 
            SELECT * FROM market_bets
            WHERE market_id = p_market_id AND outcome_id = p_winning_outcome_id
        LOOP
            -- Calcular pago proporcional: (apuesta del usuario / total apostado en ganador) * pool completo
            v_user_payout := (v_bet.bet_amount / v_total_bet_on_winner) * v_payout_pool;
            
            -- Obtener balance actual
            SELECT available_balance INTO v_user_balance
            FROM user_balances
            WHERE user_id = v_bet.user_id;
            
            -- Acreditar balance
            UPDATE user_balances
            SET available_balance = available_balance + v_user_payout,
                updated_at = NOW()
            WHERE user_id = v_bet.user_id;
            
            -- Registrar transacción
            INSERT INTO balance_transactions (
                user_id, transaction_type, amount, balance_after, description
            ) VALUES (
                v_bet.user_id, 'market_resolution', v_user_payout,
                COALESCE(v_user_balance, 0) + v_user_payout,
                format('Resolución de mercado "%s" - Ganancia: %.2f HNLD', v_market.title, v_user_payout)
            );
            
            -- Actualizar apuesta como ganadora
            UPDATE market_bets
            SET 
                is_winner = TRUE,
                payout_received = v_user_payout,
                updated_at = NOW()
            WHERE id = v_bet.id;
        END LOOP;
    END IF;
    
    -- Las apuestas perdedoras ya no tienen valor (se mantienen para historial)
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- COMENTARIOS
-- =========================================================
COMMENT ON FUNCTION place_parimutuel_bet IS 'Realiza una apuesta Parimutuel SIN comisión de plataforma - el monto completo va al pool';
COMMENT ON FUNCTION resolve_parimutuel_market IS 'Resuelve un mercado Parimutuel y distribuye el pool completo entre ganadores SIN deducir comisión';
