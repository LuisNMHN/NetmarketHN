-- =========================================================
-- FIX: Corregir función create_prediction_market
-- Problema: "cannot extract elements from a scalar"
-- Solución: Mejorar el manejo de JSONB y calcular count fuera del loop
-- =========================================================

CREATE OR REPLACE FUNCTION create_prediction_market(
    p_creator_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_question TEXT,
    p_category VARCHAR(100),
    p_market_type VARCHAR(50) DEFAULT 'binary',
    p_resolution_source TEXT DEFAULT NULL,
    p_resolution_date TIMESTAMPTZ DEFAULT NULL,
    p_outcomes JSONB DEFAULT NULL -- [{"name": "Sí", "description": ""}, {"name": "No", "description": ""}]
)
RETURNS UUID AS $$
DECLARE
    v_market_id UUID;
    v_outcome JSONB;
    v_outcome_count INTEGER;
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
        INSERT INTO market_outcomes (market_id, name, description, order_index, current_price)
        VALUES
            (v_market_id, 'Sí', 'Opción afirmativa', 0, 0.5000),
            (v_market_id, 'No', 'Opción negativa', 1, 0.5000);
    ELSIF p_outcomes IS NOT NULL AND jsonb_typeof(p_outcomes) = 'array' THEN
        -- Verificar que p_outcomes es un array JSONB válido
        -- Calcular el número de outcomes una sola vez
        v_outcome_count := jsonb_array_length(p_outcomes);
        
        -- Crear outcomes personalizados
        FOR v_outcome IN SELECT * FROM jsonb_array_elements(p_outcomes)
        LOOP
            INSERT INTO market_outcomes (market_id, name, description, order_index, current_price)
            VALUES (
                v_market_id,
                COALESCE(v_outcome->>'name', ''),
                COALESCE(v_outcome->>'description', ''),
                COALESCE((v_outcome->>'order_index')::INTEGER, 0),
                CASE 
                    WHEN v_outcome_count > 0 THEN 1.0 / v_outcome_count 
                    ELSE 0.5 
                END -- Precio inicial igual para todas
            );
        END LOOP;
    ELSE
        -- Si p_outcomes no es válido, crear outcomes por defecto
        INSERT INTO market_outcomes (market_id, name, description, order_index, current_price)
        VALUES
            (v_market_id, 'Sí', 'Opción afirmativa', 0, 0.5000),
            (v_market_id, 'No', 'Opción negativa', 1, 0.5000);
    END IF;
    
    -- Actualizar estadísticas del creador
    UPDATE market_creator_permissions
    SET total_markets_created = total_markets_created + 1,
        updated_at = NOW()
    WHERE user_id = p_creator_id;
    
    RETURN v_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


