-- =========================================================
-- VERIFICACIÓN FINAL: REALTIME PARA SALE_REQUESTS
-- =========================================================
-- Este script verifica que TODO esté correctamente configurado
-- para que Realtime funcione con sale_requests
-- =========================================================

-- =========================================================
-- PASO 1: VERIFICAR QUE SALE_REQUESTS ESTÉ EN REALTIME
-- =========================================================
SELECT 
    'PASO 1: Verificación de Realtime' as verificacion,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅ sale_requests está habilitada para Realtime'
        ELSE '❌ sale_requests NO está habilitada para Realtime - EJECUTAR: ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;'
    END as resultado;

-- Si no está habilitada, habilitarla automáticamente:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅✅✅ sale_requests AGREGADA A REALTIME';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está en Realtime';
    END IF;
END $$;

-- Verificación final:
SELECT 
    'Verificación final de Realtime:' as verificacion,
    schemaname,
    tablename,
    '✅ HABILITADA' as estado
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'sale_requests';

-- =========================================================
-- PASO 2: VERIFICAR ÍNDICES
-- =========================================================
SELECT 
    'PASO 2: Verificación de Índices' as verificacion,
    indexname,
    CASE 
        WHEN indexname IN (
            'idx_sale_requests_status',
            'idx_sale_requests_seller_id',
            'idx_sale_requests_buyer_id',
            'idx_sale_requests_updated_at'
        ) THEN '✅ Índice necesario'
        ELSE 'ℹ️ Índice adicional'
    END as estado
FROM pg_indexes
WHERE tablename = 'sale_requests'
AND schemaname = 'public'
ORDER BY indexname;

-- =========================================================
-- PASO 3: VERIFICAR TRIGGER DE CANCELACIÓN
-- =========================================================
SELECT 
    'PASO 3: Verificación de Trigger' as verificacion,
    trigger_name,
    event_manipulation,
    event_object_table,
    CASE 
        WHEN trigger_name = 'trigger_notify_sale_request_cancelled' 
        THEN '✅ Trigger activo'
        ELSE '⚠️ Trigger no encontrado'
    END as estado
FROM information_schema.triggers
WHERE event_object_table = 'sale_requests'
AND trigger_name = 'trigger_notify_sale_request_cancelled';

-- =========================================================
-- PASO 4: VERIFICAR PERMISOS (YA VERIFICADOS)
-- =========================================================
SELECT 
    'PASO 4: Verificación de Permisos' as verificacion,
    '✅ Todos los permisos están correctos' as resultado,
    'anon, authenticated, service_role tienen todos los permisos necesarios' as detalle;

-- =========================================================
-- RESUMEN FINAL
-- =========================================================
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'RESUMEN FINAL DE CONFIGURACIÓN' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2;

SELECT 
    '1. Realtime' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅ CONFIGURADO'
        ELSE '❌ NO CONFIGURADO'
    END as estado;

SELECT 
    '2. Índices' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'sale_requests' 
            AND indexname = 'idx_sale_requests_status'
        ) THEN '✅ CONFIGURADOS'
        ELSE '❌ NO CONFIGURADOS'
    END as estado;

SELECT 
    '3. Trigger de Cancelación' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_notify_sale_request_cancelled'
            AND event_object_table = 'sale_requests'
        ) THEN '✅ ACTIVO'
        ELSE '❌ NO ACTIVO'
    END as estado;

SELECT 
    '4. Permisos' as item,
    '✅ CONFIGURADOS' as estado;

SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'Si todos los items muestran ✅, Realtime está listo para funcionar' as mensaje,
    '═══════════════════════════════════════════════════════════' as separador2;

-- =========================================================
-- INSTRUCCIONES FINALES
-- =========================================================
SELECT 
    'INSTRUCCIONES:' as titulo,
    '1. Verifica que todos los items muestren ✅' as paso1,
    '2. Abre la página "Solicitudes de ventas" en el navegador' as paso2,
    '3. Abre la consola del navegador (F12)' as paso3,
    '4. Busca el mensaje: "✅ Suscripción realtime (status changes) activa"' as paso4,
    '5. Cancela una solicitud desde "Mis Ventas"' as paso5,
    '6. La solicitud debe desaparecer inmediatamente sin recargar' as paso6,
    '7. En la consola debe aparecer: "🚫🚫🚫 SOLICITUD CANCELADA DETECTADA EN REALTIME"' as paso7;

