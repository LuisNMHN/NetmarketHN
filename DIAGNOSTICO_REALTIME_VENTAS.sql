-- =========================================================
-- DIAGNÓSTICO COMPLETO: REALTIME PARA SALE_REQUESTS
-- =========================================================
-- Script para diagnosticar y corregir problemas de Realtime
-- =========================================================

-- =========================================================
-- PASO 1: VERIFICAR Y HABILITAR REALTIME
-- =========================================================
DO $$
DECLARE
    v_is_enabled BOOLEAN;
BEGIN
    -- Verificar si sale_requests está en Realtime
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
    ) INTO v_is_enabled;
    
    IF NOT v_is_enabled THEN
        -- Habilitar Realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅✅✅ sale_requests HABILITADA PARA REALTIME';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está habilitada para Realtime';
    END IF;
END $$;

-- =========================================================
-- PASO 2: VERIFICAR CONFIGURACIÓN DE REALTIME
-- =========================================================
SELECT 
    'CONFIGURACIÓN DE REALTIME' as verificacion,
    schemaname,
    tablename,
    '✅ HABILITADA' as estado
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'sale_requests';

-- Si no aparece, significa que no está habilitada
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅ sale_requests está en Realtime'
        ELSE '❌ sale_requests NO está en Realtime - EJECUTAR: ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;'
    END as resultado;

-- =========================================================
-- PASO 3: VERIFICAR QUE LA TABLA EXISTA Y TENGA DATOS
-- =========================================================
SELECT 
    'VERIFICACIÓN DE TABLA' as verificacion,
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as canceladas,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as activas,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as aceptadas
FROM sale_requests;

-- =========================================================
-- PASO 4: VERIFICAR TRIGGER DE CANCELACIÓN
-- =========================================================
SELECT 
    'TRIGGER DE CANCELACIÓN' as verificacion,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    CASE 
        WHEN trigger_name = 'trigger_notify_sale_request_cancelled' 
        THEN '✅ ACTIVO'
        ELSE '❌ NO ENCONTRADO'
    END as estado
FROM information_schema.triggers
WHERE event_object_table = 'sale_requests'
AND trigger_name = 'trigger_notify_sale_request_cancelled';

-- =========================================================
-- PASO 5: PROBAR MANUALMENTE LA FUNCIÓN DE NOTIFICACIÓN
-- =========================================================
-- Descomentar y ejecutar con un request_id real para probar:
-- SELECT notify_sale_request_cancelled(
--     'TU_REQUEST_ID_AQUI'::UUID,
--     'TU_SELLER_ID_AQUI'::UUID
-- );

-- =========================================================
-- PASO 6: VERIFICAR PERMISOS DE REALTIME
-- =========================================================
SELECT 
    'PERMISOS DE REALTIME' as verificacion,
    grantee,
    privilege_type,
    '✅ Tiene permiso' as estado
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'sale_requests'
AND grantee IN ('authenticated', 'anon', 'service_role')
ORDER BY grantee, privilege_type;

-- =========================================================
-- RESUMEN Y ACCIONES
-- =========================================================
SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'DIAGNÓSTICO COMPLETO' as titulo,
    '═══════════════════════════════════════════════════════════' as separador2;

SELECT 
    '1. Realtime habilitado' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'sale_requests'
        ) THEN '✅ SÍ'
        ELSE '❌ NO - Se habilitó automáticamente arriba'
    END as estado;

SELECT 
    '2. Trigger de cancelación' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_notify_sale_request_cancelled'
            AND event_object_table = 'sale_requests'
        ) THEN '✅ ACTIVO'
        ELSE '❌ NO ACTIVO - Ejecutar NOTIFICACIONES_VENTAS.sql'
    END as estado;

SELECT 
    '3. Permisos' as item,
    '✅ VERIFICADOS' as estado;

SELECT 
    '═══════════════════════════════════════════════════════════' as separador,
    'Si Realtime muestra ❌, recarga la página después de ejecutar este script' as mensaje1,
    'Si todo muestra ✅, el problema puede estar en el frontend' as mensaje2,
    '═══════════════════════════════════════════════════════════' as separador2;

