-- =========================================================
-- SISTEMA DE PREDICCIÓN PARIMUTUEL
-- =========================================================
-- Este sistema permite a usuarios autorizados crear mercados
-- de predicción donde otros usuarios pueden apostar usando HNLD
-- usando el modelo matemático Parimutuel simple
-- =========================================================

-- =========================================================
-- MIGRACIÓN: Cambiar de sistema de acciones a Parimutuel
-- =========================================================

-- 1. Agregar columnas necesarias para Parimutuel
ALTER TABLE prediction_markets 
ADD COLUMN IF NOT EXISTS total_pool_hnld NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5, 2) DEFAULT 5.00;

-- 2. Modificar market_outcomes para Parimutuel
ALTER TABLE market_outcomes
ADD COLUMN IF NOT EXISTS total_bet_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS probability NUMERIC(5, 4) DEFAULT 0.5000; -- Probabilidad calculada dinámicamente

-- 3. Renombrar y modificar market_positions a market_bets
-- Primero crear la nueva tabla
CREATE TABLE IF NOT EXISTS market_bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES prediction_markets(id) ON DELETE CASCADE,
    outcome_id UUID NOT NULL REFERENCES market_outcomes(id) ON DELETE CASCADE,
    
    -- Apuesta Parimutuel
    bet_amount NUMERIC(15, 2) NOT NULL, -- Cantidad apostada en HNLD
    probability_at_bet NUMERIC(5, 4) NOT NULL, -- Probabilidad al momento de la apuesta
    
    -- Potencial ganancia (calculada al momento de la apuesta)
    potential_payout NUMERIC(15, 2) DEFAULT 0, -- Ganancia potencial si gana
    
    -- Resolución
    is_winner BOOLEAN DEFAULT FALSE, -- Si esta apuesta ganó
    payout_received NUMERIC(15, 2) DEFAULT 0, -- Ganancia recibida al resolver
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_bet_amount CHECK (bet_amount > 0),
    CONSTRAINT valid_probability CHECK (probability_at_bet >= 0 AND probability_at_bet <= 1)
);

-- Índices para market_bets
CREATE INDEX IF NOT EXISTS idx_market_bets_user ON market_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_market_bets_market ON market_bets(market_id);
CREATE INDEX IF NOT EXISTS idx_market_bets_outcome ON market_bets(outcome_id);
CREATE INDEX IF NOT EXISTS idx_market_bets_created ON market_bets(created_at DESC);

-- 4. Renombrar market_trades a market_bets_history (para mantener historial)
CREATE TABLE IF NOT EXISTS market_bets_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES prediction_markets(id) ON DELETE CASCADE,
    outcome_id UUID NOT NULL REFERENCES market_outcomes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bet_id UUID NOT NULL REFERENCES market_bets(id) ON DELETE CASCADE,
    
    -- Detalles de la apuesta
    bet_amount NUMERIC(15, 2) NOT NULL,
    probability_at_bet NUMERIC(5, 4) NOT NULL,
    total_pool_before NUMERIC(15, 2) NOT NULL, -- Pool total antes de esta apuesta
    total_pool_after NUMERIC(15, 2) NOT NULL, -- Pool total después de esta apuesta
    
    -- Fees
    platform_fee_hnld NUMERIC(15, 2) DEFAULT 0,
    
    -- Balance después de la apuesta
    balance_after_hnld NUMERIC(15, 2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para market_bets_history
CREATE INDEX IF NOT EXISTS idx_market_bets_history_user ON market_bets_history(user_id);
CREATE INDEX IF NOT EXISTS idx_market_bets_history_market ON market_bets_history(market_id);
CREATE INDEX IF NOT EXISTS idx_market_bets_history_outcome ON market_bets_history(outcome_id);
CREATE INDEX IF NOT EXISTS idx_market_bets_history_created ON market_bets_history(created_at DESC);

-- =========================================================
-- FUNCIÓN: Calcular probabilidades Parimutuel
-- =========================================================
CREATE OR REPLACE FUNCTION calculate_parimutuel_probabilities(p_market_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_pool NUMERIC;
    v_outcome RECORD;
    v_probability NUMERIC;
    v_outcome_count INTEGER;
BEGIN
    -- Obtener el pool total del mercado
    SELECT COALESCE(total_pool_hnld, 0) INTO v_total_pool
    FROM prediction_markets
    WHERE id = p_market_id;
    
    -- Contar el número de outcomes
    SELECT COUNT(*) INTO v_outcome_count
    FROM market_outcomes
    WHERE market_id = p_market_id;
    
    -- Si no hay outcomes, no hacer nada
    IF v_outcome_count = 0 THEN
        RETURN;
    END IF;
    
    -- Si no hay pool (mercado nuevo sin apuestas), todas las probabilidades son iguales
    IF v_total_pool = 0 OR v_total_pool IS NULL THEN
        v_probability := 1.0 / v_outcome_count;
        UPDATE market_outcomes
        SET probability = v_probability
        WHERE market_id = p_market_id;
        RETURN;
    END IF;
    
    -- Calcular probabilidad para cada outcome basada en el monto apostado
    FOR v_outcome IN 
        SELECT id, COALESCE(total_bet_amount, 0) as bet_amount
        FROM market_outcomes
        WHERE market_id = p_market_id
    LOOP
        -- Probabilidad = (monto apostado en esta opción) / (pool total)
        v_probability := v_outcome.bet_amount / v_total_pool;
        
        -- Asegurar que la probabilidad esté entre 0 y 1
        IF v_probability < 0 THEN
            v_probability := 0;
        ELSIF v_probability > 1 THEN
            v_probability := 1;
        END IF;
        
        UPDATE market_outcomes
        SET probability = v_probability
        WHERE id = v_outcome.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- FUNCIÓN: Realizar apuesta Parimutuel
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
    v_platform_fee NUMERIC;
    v_net_bet_amount NUMERIC;
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
    
    -- Calcular fees
    v_platform_fee := p_bet_amount * (v_market.platform_fee_percent / 100);
    v_net_bet_amount := p_bet_amount - v_platform_fee;
    
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
    
    -- Descontar balance del usuario
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
    
    -- Actualizar outcome: agregar apuesta al total
    UPDATE market_outcomes
    SET total_bet_amount = COALESCE(total_bet_amount, 0) + v_net_bet_amount
    WHERE id = p_outcome_id;
    
    -- Actualizar pool total del mercado
    UPDATE prediction_markets
    SET total_pool_hnld = COALESCE(total_pool_hnld, 0) + v_net_bet_amount
    WHERE id = p_market_id;
    
    -- Obtener pool total después de la apuesta
    SELECT COALESCE(total_pool_hnld, 0) INTO v_total_pool_after
    FROM prediction_markets
    WHERE id = p_market_id;
    
    -- Recalcular probabilidades después de agregar la apuesta
    PERFORM calculate_parimutuel_probabilities(p_market_id);
    
    -- Calcular ganancia potencial (simplificado: si gana, recibe su parte proporcional del pool)
    -- Ganancia potencial = (apuesta / total apostado en esta opción) * (pool total * (1 - fee))
    SELECT 
        CASE 
            WHEN COALESCE(total_bet_amount, 0) > 0 THEN
                (v_net_bet_amount / total_bet_amount) * (v_total_pool_after * (1 - v_market.platform_fee_percent / 100))
            ELSE 0
        END
    INTO v_potential_payout
    FROM market_outcomes
    WHERE id = p_outcome_id;
    
    -- Crear registro de apuesta
    INSERT INTO market_bets (
        user_id, market_id, outcome_id, bet_amount, 
        probability_at_bet, potential_payout
    ) VALUES (
        p_user_id, p_market_id, p_outcome_id, v_net_bet_amount,
        v_probability_at_bet, v_potential_payout
    ) RETURNING id INTO v_bet_id;
    
    -- Registrar en historial
    INSERT INTO market_bets_history (
        market_id, outcome_id, user_id, bet_id, bet_amount,
        probability_at_bet, total_pool_before, total_pool_after,
        platform_fee_hnld, balance_after_hnld
    ) VALUES (
        p_market_id, p_outcome_id, p_user_id, v_bet_id, v_net_bet_amount,
        v_probability_at_bet, v_total_pool_before, v_total_pool_after,
        v_platform_fee, v_user_balance - p_bet_amount
    );
    
    RETURN v_bet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- FUNCIÓN: Resolver mercado Parimutuel
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
    v_platform_fee NUMERIC;
    v_payout_pool NUMERIC; -- Pool después de deducir fees
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
    
    -- Calcular fee de plataforma
    v_platform_fee := v_total_pool * (v_market.platform_fee_percent / 100);
    v_payout_pool := v_total_pool - v_platform_fee;
    
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
    
    -- Distribuir ganancias entre los ganadores proporcionalmente
    IF v_total_bet_on_winner > 0 THEN
        FOR v_bet IN 
            SELECT * FROM market_bets
            WHERE market_id = p_market_id AND outcome_id = p_winning_outcome_id
        LOOP
            -- Calcular pago proporcional: (apuesta del usuario / total apostado en ganador) * pool de pago
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
-- ROW LEVEL SECURITY (RLS) para nuevas tablas
-- =========================================================

ALTER TABLE market_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_bets_history ENABLE ROW LEVEL SECURITY;

-- Políticas para market_bets
CREATE POLICY "Users can view their own bets"
    ON market_bets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view bets of active markets"
    ON market_bets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prediction_markets
            WHERE id = market_bets.market_id
            AND status IN ('active', 'closed', 'resolved')
        )
    );

-- Políticas para market_bets_history
CREATE POLICY "Users can view their own bet history"
    ON market_bets_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view bet history of active markets"
    ON market_bets_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prediction_markets
            WHERE id = market_bets_history.market_id
            AND status IN ('active', 'closed', 'resolved')
        )
    );

-- =========================================================
-- COMENTARIOS
-- =========================================================
COMMENT ON TABLE market_bets IS 'Apuestas Parimutuel de usuarios en mercados de predicción';
COMMENT ON TABLE market_bets_history IS 'Historial de apuestas Parimutuel';
COMMENT ON FUNCTION calculate_parimutuel_probabilities IS 'Calcula probabilidades Parimutuel dinámicamente basadas en el pool total';
COMMENT ON FUNCTION place_parimutuel_bet IS 'Realiza una apuesta Parimutuel y actualiza probabilidades';
COMMENT ON FUNCTION resolve_parimutuel_market IS 'Resuelve un mercado Parimutuel y distribuye ganancias proporcionalmente';
