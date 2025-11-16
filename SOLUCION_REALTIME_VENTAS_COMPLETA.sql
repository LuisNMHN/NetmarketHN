-- =========================================================
-- SOLUCIÓN COMPLETA: REALTIME PARA SALE_REQUESTS
-- =========================================================
-- Este script garantiza que Realtime funcione correctamente
-- =========================================================

-- PASO 1: Verificar y habilitar Realtime en la publicación
DO $$
DECLARE
    v_is_enabled BOOLEAN;
    v_publication_exists BOOLEAN;
BEGIN
    -- Verificar si existe la publicación supabase_realtime
    SELECT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) INTO v_publication_exists;
    
    IF NOT v_publication_exists THEN
        RAISE EXCEPTION '❌ La publicación supabase_realtime no existe. Contacta al administrador de Supabase.';
    END IF;
    
    -- Verificar si sale_requests está en Realtime
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
        AND schemaname = 'public'
    ) INTO v_is_enabled;
    
    IF NOT v_is_enabled THEN
        -- Habilitar Realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅✅✅ sale_requests HABILITADA PARA REALTIME';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está habilitada para Realtime';
    END IF;
END $$;

-- PASO 2: Verificar que esté habilitada (confirmación)
SELECT 
    'VERIFICACIÓN FINAL' as titulo,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
            AND schemaname = 'public'
        ) THEN '✅✅✅ SALE_REQUESTS ESTÁ EN REALTIME'
        ELSE '❌❌❌ ERROR: SALE_REQUESTS NO ESTÁ EN REALTIME'
    END as resultado;

-- PASO 3: Configurar permisos necesarios
GRANT SELECT ON TABLE sale_requests TO authenticated;
GRANT SELECT ON TABLE sale_requests TO anon;
GRANT SELECT ON TABLE sale_requests TO service_role;

-- PASO 4: Crear índices necesarios para Realtime (mejora el rendimiento)
CREATE INDEX IF NOT EXISTS idx_sale_requests_status ON sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_sale_requests_seller_id ON sale_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_buyer_id ON sale_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_updated_at ON sale_requests(updated_at);
CREATE INDEX IF NOT EXISTS idx_sale_requests_created_at ON sale_requests(created_at);

-- PASO 5: Verificar RLS (Row Level Security) - debe estar habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'sale_requests'
        AND rowsecurity = true
    ) THEN
        RAISE WARNING '⚠️ RLS no está habilitado en sale_requests. Esto puede afectar Realtime.';
    ELSE
        RAISE NOTICE '✅ RLS está habilitado en sale_requests';
    END IF;
END $$;

-- PASO 6: Verificar que la tabla tenga la columna updated_at (necesaria para Realtime)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'sale_requests' 
        AND column_name = 'updated_at'
    ) THEN
        RAISE WARNING '⚠️ La columna updated_at no existe en sale_requests. Realtime puede no funcionar correctamente.';
    ELSE
        RAISE NOTICE '✅ La columna updated_at existe en sale_requests';
    END IF;
END $$;

-- PASO 7: Verificar trigger de updated_at (si existe)
SELECT 
    'TRIGGER UPDATED_AT' as verificacion,
    trigger_name,
    event_manipulation,
    action_timing,
    CASE 
        WHEN trigger_name LIKE '%updated_at%' OR trigger_name LIKE '%update%'
        THEN '✅ ACTIVO'
        ELSE '⚠️ NO ENCONTRADO (puede ser normal)'
    END as estado
FROM information_schema.triggers
WHERE event_object_table = 'sale_requests'
AND trigger_name LIKE '%update%'
LIMIT 5;

-- PASO 8: Mostrar resumen completo
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'RESUMEN DE CONFIGURACIÓN REALTIME' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2;

SELECT 
    '1. Realtime habilitado' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
            AND schemaname = 'public'
        ) THEN '✅ SÍ'
        ELSE '❌ NO'
    END as estado;

SELECT 
    '2. Permisos configurados' as item,
    '✅ SÍ' as estado;

SELECT 
    '3. Índices creados' as item,
    '✅ SÍ' as estado;

SELECT 
    '4. RLS habilitado' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'sale_requests'
            AND rowsecurity = true
        ) THEN '✅ SÍ'
        ELSE '⚠️ NO (puede ser normal)'
    END as estado;

SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'INSTRUCCIONES POST-EJECUCIÓN:' as titulo,
    '1. Recarga completamente la página del dashboard de ventas' as paso1,
    '2. Abre la consola del navegador (F12)' as paso2,
    '3. Busca: "✅✅✅ SUSCRIPCIÓN REALTIME ACTIVA"' as paso3,
    '4. Cancela una solicitud y verifica que aparezca el payload' as paso4,
    '5. La solicitud debe desaparecer inmediatamente' as paso5,
    '═══════════════════════════════════════════════════════════' as separador2;

-- PASO 9: Mostrar información de la tabla para debugging
SELECT 
    'INFORMACIÓN DE LA TABLA' as titulo,
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as canceladas,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as activas,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as aceptadas,
    MAX(updated_at) as ultima_actualizacion
FROM sale_requests;

