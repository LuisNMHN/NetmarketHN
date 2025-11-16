-- =========================================================
-- VERIFICAR CONFIGURACIÓN DE REALTIME PARA SALE_REQUESTS
-- =========================================================
-- Este script verifica que la tabla sale_requests esté
-- correctamente configurada para Realtime
-- =========================================================

-- Paso 1: Verificar que sale_requests esté en la publicación de Realtime
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'sale_requests';

-- Si no aparece, ejecutar automáticamente:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅ Tabla sale_requests agregada a supabase_realtime';
    ELSE
        RAISE NOTICE '✅ Tabla sale_requests ya está en supabase_realtime';
    END IF;
END $$;

-- Paso 2: Verificar que la tabla exista y tenga las columnas necesarias
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'sale_requests'
AND column_name IN ('id', 'status', 'seller_id', 'buyer_id', 'updated_at')
ORDER BY ordinal_position;

-- Paso 3: Verificar que haya índices en las columnas usadas para filtros
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'sale_requests'
AND schemaname = 'public';

-- Paso 4: Verificar que el trigger de cancelación esté activo
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_sale_request_cancelled'
AND event_object_table = 'sale_requests';

-- Paso 5: Verificar permisos de Realtime
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'sale_requests'
AND grantee IN ('authenticated', 'anon', 'service_role');

-- =========================================================
-- CORRECCIONES NECESARIAS (ejecutar si es necesario)
-- =========================================================

-- Crear índices si no existen (para mejor rendimiento de Realtime):
CREATE INDEX IF NOT EXISTS idx_sale_requests_status ON sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_sale_requests_seller_id ON sale_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_buyer_id ON sale_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_updated_at ON sale_requests(updated_at);

-- Verificar que los índices se crearon:
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'sale_requests'
AND schemaname = 'public'
AND indexname LIKE 'idx_sale_requests%';

-- =========================================================
-- RESUMEN
-- =========================================================
-- ✅ Verificar que sale_requests esté en supabase_realtime
-- ✅ Verificar que las columnas necesarias existan
-- ✅ Verificar que los índices estén creados
-- ✅ Verificar que el trigger esté activo
-- ✅ Verificar permisos de Realtime
-- =========================================================

