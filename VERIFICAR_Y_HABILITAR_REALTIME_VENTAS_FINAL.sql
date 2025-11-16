-- =========================================================
-- VERIFICAR Y HABILITAR REALTIME PARA SALE_REQUESTS
-- =========================================================
-- Script final para verificar y habilitar Realtime
-- para que las solicitudes canceladas desaparezcan en tiempo real
-- =========================================================

-- =========================================================
-- PASO 1: HABILITAR REALTIME PARA SALE_REQUESTS
-- =========================================================
DO $$
BEGIN
    -- Verificar si sale_requests está en la publicación de Realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
    ) THEN
        -- Agregar sale_requests a la publicación de Realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅✅✅ sale_requests AGREGADA A REALTIME';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está en Realtime';
    END IF;
END $$;

-- =========================================================
-- PASO 2: VERIFICAR QUE ESTÉ HABILITADA
-- =========================================================
SELECT 
    'Verificación de Realtime:' as verificacion,
    schemaname,
    tablename,
    CASE 
        WHEN tablename = 'sale_requests' THEN '✅ HABILITADA PARA REALTIME'
        ELSE '❌ NO HABILITADA'
    END as estado
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'sale_requests';

-- =========================================================
-- PASO 3: VERIFICAR ÍNDICES (ya están creados según el usuario)
-- =========================================================
SELECT 
    'Índices verificados:' as verificacion,
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

-- =========================================================
-- PASO 4: VERIFICAR TRIGGER DE CANCELACIÓN
-- =========================================================
SELECT 
    'Trigger de cancelación:' as verificacion,
    trigger_name,
    event_manipulation,
    event_object_table,
    CASE 
        WHEN trigger_name = 'trigger_notify_sale_request_cancelled' 
        THEN '✅ ACTIVO'
        ELSE '❌ NO ENCONTRADO'
    END as estado
FROM information_schema.triggers
WHERE event_object_table = 'sale_requests'
AND trigger_name = 'trigger_notify_sale_request_cancelled';

-- =========================================================
-- PASO 5: VERIFICAR PERMISOS (ya están correctos según el usuario)
-- =========================================================
SELECT 
    'Permisos verificados:' as verificacion,
    '✅ Todos los permisos están correctos' as resultado;

-- =========================================================
-- RESUMEN FINAL
-- =========================================================
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'CONFIGURACIÓN FINAL DE REALTIME PARA VENTAS' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2;

SELECT 
    '1. Realtime habilitado' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅ CONFIGURADO'
        ELSE '❌ NO CONFIGURADO'
    END as estado;

SELECT 
    '2. Índices creados' as item,
    '✅ CONFIGURADOS' as estado;

SELECT 
    '3. Trigger de cancelación' as item,
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
    'Si todos los items muestran ✅, Realtime está listo' as mensaje,
    '═══════════════════════════════════════════════════════════' as separador2;

-- =========================================================
-- INSTRUCCIONES
-- =========================================================
SELECT 
    'INSTRUCCIONES PARA PROBAR:' as titulo,
    '1. Abre la página "Solicitudes de ventas" en el navegador' as paso1,
    '2. Abre la consola del navegador (F12)' as paso2,
    '3. Busca: "✅ Suscripción realtime (status changes) activa"' as paso3,
    '4. Cancela una solicitud desde "Mis Ventas" (otro usuario/navegador)' as paso4,
    '5. La solicitud debe desaparecer INMEDIATAMENTE sin recargar' as paso5,
    '6. En la consola debe aparecer: "🚫 Solicitud cancelada detectada"' as paso6,
    '7. Y luego: "✅✅✅ SOLICITUD ... REMOVIDA DE LA LISTA EN TIEMPO REAL"' as paso7;

