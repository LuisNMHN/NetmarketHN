-- =========================================================
-- FIX: Inicialización correcta de probabilidades en mercados múltiples
-- =========================================================
-- Problema: Las probabilidades en mercados múltiples deben inicializarse
-- equitativamente (100% / número de opciones) y luego ser dinámicas
-- según las participaciones
-- =========================================================

-- 1. Actualizar la función create_prediction_market para inicializar probabilidades
CREATE OR REPLACE FUNCTION create_prediction_market(
    p_creator_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_question TEXT,
    p_category VARCHAR(100),
    p_market_type VARCHAR(50) DEFAULT 'binary',
    p_resolution_source TEXT DEFAULT NULL,
    p_resolution_date TIMESTAMPTZ DEFAULT NULL,
    p_outcomes JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_market_id UUID;
    v_outcome JSONB;
    v_outcome_count INTEGER;
    v_initial_probability NUMERIC;
BEGIN
    -- Verificar permisos
    IF NOT can_create_market(p_creator_id) THEN
        RAISE EXCEPTION 'Usuario no tiene permisos para crear mercados o ha excedido los límites';
    END IF;
    
    -- Crear el mercado
    INSERT INTO prediction_markets (
        creator_id, title, description, question, category,
        market_type, resolution_source, resolution_date
    ) VALUES (
        p_creator_id, p_title, p_description, p_question, p_category,
        p_market_type, p_resolution_source, p_resolution_date
    ) RETURNING id INTO v_market_id;
    
    -- Crear outcomes por defecto para mercados binarios
    IF p_market_type = 'binary' AND (p_outcomes IS NULL OR jsonb_array_length(COALESCE(p_outcomes, '[]'::jsonb)) = 0) THEN
        -- Para binarios: 50% cada uno
        v_initial_probability := 0.5;
        INSERT INTO market_outcomes (market_id, name, description, order_index, current_price, probability)
        VALUES
            (v_market_id, 'Sí', 'Opción afirmativa', 0, v_initial_probability, v_initial_probability),
            (v_market_id, 'No', 'Opción negativa', 1, v_initial_probability, v_initial_probability);
    ELSIF p_outcomes IS NOT NULL AND jsonb_typeof(p_outcomes) = 'array' THEN
        -- Calcular el número de outcomes
        v_outcome_count := jsonb_array_length(p_outcomes);
        
        -- Calcular probabilidad inicial: 1 / número de opciones
        v_initial_probability := 1.0 / v_outcome_count;
        
        -- Crear outcomes personalizados con probabilidad inicial equitativa
        FOR v_outcome IN SELECT * FROM jsonb_array_elements(p_outcomes)
        LOOP
            INSERT INTO market_outcomes (market_id, name, description, order_index, current_price, probability)
            VALUES (
                v_market_id,
                COALESCE(v_outcome->>'name', ''),
                COALESCE(v_outcome->>'description', ''),
                COALESCE((v_outcome->>'order_index')::INTEGER, 0),
                v_initial_probability, -- current_price para compatibilidad
                v_initial_probability  -- probability inicial equitativa
            );
        END LOOP;
    ELSE
        -- Si p_outcomes no es válido, crear outcomes por defecto
        v_initial_probability := 0.5;
        INSERT INTO market_outcomes (market_id, name, description, order_index, current_price, probability)
        VALUES
            (v_market_id, 'Sí', 'Opción afirmativa', 0, v_initial_probability, v_initial_probability),
            (v_market_id, 'No', 'Opción negativa', 1, v_initial_probability, v_initial_probability);
    END IF;
    
    -- Asegurar que las probabilidades estén correctamente inicializadas
    -- (esto es redundante pero asegura consistencia)
    PERFORM calculate_parimutuel_probabilities(v_market_id);
    
    -- Actualizar estadísticas del creador
    UPDATE market_creator_permissions
    SET total_markets_created = total_markets_created + 1,
        updated_at = NOW()
    WHERE user_id = p_creator_id;
    
    RETURN v_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Mejorar la función calculate_parimutuel_probabilities para manejar mejor el caso inicial
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
        
        -- Si el pool es 0 después de calcular (caso edge), distribuir equitativamente
        IF v_total_pool = 0 THEN
            v_probability := 1.0 / v_outcome_count;
        END IF;
        
        UPDATE market_outcomes
        SET probability = v_probability
        WHERE id = v_outcome.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Recalcular probabilidades para todos los mercados activos sin pool
-- Esto asegura que las probabilidades estén correctamente distribuidas
-- (100% / número de opciones para cada mercado)
DO $$
DECLARE
    v_market RECORD;
BEGIN
    FOR v_market IN 
        SELECT id 
        FROM prediction_markets 
        WHERE status = 'active' 
        AND COALESCE(total_pool_hnld, 0) = 0
    LOOP
        PERFORM calculate_parimutuel_probabilities(v_market.id);
    END LOOP;
    
    RAISE NOTICE '✅ Probabilidades recalculadas para mercados activos sin pool';
END $$;

-- Comentarios
COMMENT ON FUNCTION create_prediction_market IS 'Crea un mercado de predicción e inicializa probabilidades equitativamente';
COMMENT ON FUNCTION calculate_parimutuel_probabilities IS 'Calcula probabilidades Parimutuel dinámicamente. Si no hay pool, distribuye equitativamente entre todas las opciones';
