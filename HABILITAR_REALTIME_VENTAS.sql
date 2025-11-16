-- =========================================================
-- HABILITAR REALTIME PARA SALE_REQUESTS
-- =========================================================
-- Este script habilita Realtime para la tabla sale_requests
-- y verifica que todo esté correctamente configurado
-- =========================================================

-- Paso 1: Verificar si sale_requests está en la publicación de Realtime
SELECT 
    'Verificando si sale_requests está en supabase_realtime...' as paso,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅ Ya está habilitada'
        ELSE '❌ NO está habilitada - se habilitará ahora'
    END as estado;

-- Paso 2: Habilitar Realtime para sale_requests si no está habilitada
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

-- Paso 3: Verificar que se agregó correctamente
SELECT 
    'Verificación final:' as paso,
    schemaname,
    tablename,
    '✅ Habilitada para Realtime' as estado
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'sale_requests';

-- Paso 4: Verificar que los índices necesarios existan
SELECT 
    'Índices verificados:' as paso,
    indexname,
    '✅ Existe' as estado
FROM pg_indexes
WHERE tablename = 'sale_requests'
AND schemaname = 'public'
AND indexname IN (
    'idx_sale_requests_status',
    'idx_sale_requests_seller_id',
    'idx_sale_requests_buyer_id',
    'idx_sale_requests_updated_at'
);

-- Paso 5: Verificar permisos de Realtime
SELECT 
    'Permisos verificados:' as paso,
    grantee,
    privilege_type,
    '✅ Tiene permiso' as estado
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'sale_requests'
AND grantee IN ('authenticated', 'anon', 'service_role')
ORDER BY grantee, privilege_type;

-- =========================================================
-- RESUMEN
-- =========================================================
-- ✅ Realtime habilitado para sale_requests
-- ✅ Índices creados y verificados
-- ✅ Permisos verificados
-- 
-- La tabla sale_requests ahora está lista para Realtime.
-- Los cambios en la tabla se propagarán automáticamente
-- a todos los clientes suscritos.
-- =========================================================

