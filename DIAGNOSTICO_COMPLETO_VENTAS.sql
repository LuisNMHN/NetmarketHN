-- =========================================================
-- DIAGNÓSTICO COMPLETO: SISTEMA DE VENTAS
-- =========================================================
-- Verifica trigger, Realtime y configuración
-- =========================================================

-- PASO 1: Verificar que el trigger existe y está activo
SELECT 
    'VERIFICACIÓN DE TRIGGER' as titulo,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement,
    CASE 
        WHEN trigger_name = 'trigger_notify_sale_request_cancelled' 
        THEN '✅ ACTIVO'
        ELSE '❌ NO ENCONTRADO'
    END as estado
FROM information_schema.triggers
WHERE event_object_table = 'sale_requests'
AND trigger_name = 'trigger_notify_sale_request_cancelled';

-- PASO 2: Verificar que la función del trigger existe
SELECT 
    'VERIFICACIÓN DE FUNCIÓN' as titulo,
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name = 'trigger_notify_sale_request_cancelled' 
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'trigger_notify_sale_request_cancelled';

-- PASO 3: Verificar que notify_sale_request_cancelled existe
SELECT 
    'VERIFICACIÓN DE FUNCIÓN NOTIFY' as titulo,
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name = 'notify_sale_request_cancelled' 
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'notify_sale_request_cancelled';

-- PASO 4: Verificar Realtime
SELECT 
    'VERIFICACIÓN DE REALTIME' as titulo,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
            AND schemaname = 'public'
        ) THEN '✅ HABILITADO'
        ELSE '❌ NO HABILITADO'
    END as estado;

-- PASO 5: Habilitar Realtime si no está habilitado
DO $$
DECLARE
    v_is_enabled BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
        AND schemaname = 'public'
    ) INTO v_is_enabled;
    
    IF NOT v_is_enabled THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅✅✅ sale_requests HABILITADA PARA REALTIME';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está habilitada para Realtime';
    END IF;
END $$;

-- PASO 6: Verificar que la columna updated_at existe y tiene trigger
SELECT 
    'VERIFICACIÓN DE UPDATED_AT' as titulo,
    column_name,
    data_type,
    CASE 
        WHEN column_name = 'updated_at' 
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'sale_requests'
AND column_name = 'updated_at';

-- PASO 7: Verificar triggers de updated_at
SELECT 
    'TRIGGERS DE UPDATED_AT' as titulo,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'sale_requests'
AND trigger_name LIKE '%update%'
ORDER BY trigger_name;

-- PASO 8: Probar manualmente el trigger (simular cancelación)
-- Descomentar y usar un request_id real para probar:
/*
DO $$
DECLARE
    v_test_request_id UUID;
    v_test_seller_id UUID;
BEGIN
    -- Obtener una solicitud activa para probar
    SELECT id, seller_id INTO v_test_request_id, v_test_seller_id
    FROM sale_requests
    WHERE status = 'active'
    LIMIT 1;
    
    IF v_test_request_id IS NULL THEN
        RAISE NOTICE '⚠️ No hay solicitudes activas para probar';
    ELSE
        RAISE NOTICE '🧪 Probando cancelación de solicitud: %', v_test_request_id;
        
        -- Actualizar status (esto debería activar el trigger)
        UPDATE sale_requests
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE id = v_test_request_id;
        
        RAISE NOTICE '✅ Actualización ejecutada. Verificar logs del trigger.';
        
        -- Revertir para no afectar datos reales
        UPDATE sale_requests
        SET status = 'active',
            updated_at = NOW()
        WHERE id = v_test_request_id;
        
        RAISE NOTICE '✅ Estado revertido a active';
    END IF;
END $$;
*/

-- PASO 9: Verificar permisos
GRANT SELECT ON TABLE sale_requests TO authenticated;
GRANT SELECT ON TABLE sale_requests TO anon;
GRANT SELECT ON TABLE sale_requests TO service_role;

-- PASO 10: Mostrar resumen completo
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'RESUMEN DE DIAGNÓSTICO' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2;

SELECT 
    '1. Trigger de cancelación' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_notify_sale_request_cancelled'
            AND event_object_table = 'sale_requests'
        ) THEN '✅ ACTIVO'
        ELSE '❌ NO ACTIVO - Ejecutar NOTIFICACIONES_VENTAS.sql'
    END as estado;

SELECT 
    '2. Función del trigger' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'trigger_notify_sale_request_cancelled'
            AND routine_schema = 'public'
        ) THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE - Ejecutar NOTIFICACIONES_VENTAS.sql'
    END as estado;

SELECT 
    '3. Función notify_sale_request_cancelled' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'notify_sale_request_cancelled'
            AND routine_schema = 'public'
        ) THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE - Ejecutar NOTIFICACIONES_VENTAS.sql'
    END as estado;

SELECT 
    '4. Realtime habilitado' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
            AND schemaname = 'public'
        ) THEN '✅ SÍ'
        ELSE '❌ NO - Se habilitó automáticamente arriba'
    END as estado;

SELECT 
    '5. Columna updated_at' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'sale_requests'
            AND column_name = 'updated_at'
        ) THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado;

SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'INSTRUCCIONES:' as titulo,
    '1. Si algún item muestra ❌, ejecuta el script correspondiente' as paso1,
    '2. Recarga completamente la página del dashboard de ventas' as paso2,
    '3. Abre la consola del navegador (F12)' as paso3,
    '4. Cancela una solicitud y verifica los logs' as paso4,
    '═══════════════════════════════════════════════════════════' as separador2;

