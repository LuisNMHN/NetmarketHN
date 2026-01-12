-- =========================================================
-- AGREGAR COLUMNA cancelled_at A prediction_markets
-- =========================================================
-- Este script agrega la columna cancelled_at para registrar
-- la fecha y hora en que se canceló un mercado de predicción

-- Agregar la columna cancelled_at si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prediction_markets' 
        AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE prediction_markets 
        ADD COLUMN cancelled_at TIMESTAMPTZ;
        
        RAISE NOTICE '✅ Columna cancelled_at agregada a prediction_markets';
    ELSE
        RAISE NOTICE '✅ La columna cancelled_at ya existe en prediction_markets';
    END IF;
END $$;

-- Verificar que la columna fue agregada correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'prediction_markets' 
AND column_name = 'cancelled_at';
