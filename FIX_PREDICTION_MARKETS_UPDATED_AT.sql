-- =========================================================
-- FIX: Agregar columna updated_at a prediction_markets
-- =========================================================
-- Este script agrega la columna updated_at que falta en la tabla
-- prediction_markets y crea un trigger para actualizarla automáticamente

-- Paso 1: Agregar la columna updated_at si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prediction_markets' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE prediction_markets 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Actualizar todos los registros existentes con la fecha de creación
        UPDATE prediction_markets 
        SET updated_at = created_at 
        WHERE updated_at IS NULL;
        
        RAISE NOTICE '✅ Columna updated_at agregada a prediction_markets';
    ELSE
        RAISE NOTICE '✅ La columna updated_at ya existe en prediction_markets';
    END IF;
END $$;

-- Paso 2: Crear o reemplazar la función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_prediction_markets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Paso 3: Crear el trigger si no existe
DROP TRIGGER IF EXISTS update_prediction_markets_updated_at_trigger ON prediction_markets;

CREATE TRIGGER update_prediction_markets_updated_at_trigger
    BEFORE UPDATE ON prediction_markets
    FOR EACH ROW
    EXECUTE FUNCTION update_prediction_markets_updated_at();

-- Paso 4: Verificar que todo esté correcto
DO $$
DECLARE
    column_exists BOOLEAN;
    trigger_exists BOOLEAN;
BEGIN
    -- Verificar columna
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prediction_markets' 
        AND column_name = 'updated_at'
    ) INTO column_exists;
    
    -- Verificar trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_prediction_markets_updated_at_trigger'
    ) INTO trigger_exists;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE updated_at';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Columna updated_at existe: %', column_exists;
    RAISE NOTICE 'Trigger existe: %', trigger_exists;
    RAISE NOTICE '========================================';
    
    IF column_exists AND trigger_exists THEN
        RAISE NOTICE '✅ updated_at configurado correctamente';
    ELSE
        RAISE WARNING '⚠️ Algo falló en la configuración de updated_at';
    END IF;
END $$;

-- Comentario para documentación
COMMENT ON COLUMN prediction_markets.updated_at IS 'Fecha y hora de última actualización del mercado. Se actualiza automáticamente mediante trigger.';
