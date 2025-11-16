-- =========================================================
-- NMHN - VERIFICAR Y ASEGURAR NOTIFICACIONES DE VENTAS
-- =========================================================
-- Script para verificar que las notificaciones de ventas
-- estén correctamente configuradas y funcionando
-- =========================================================

-- =========================================================
-- PASO 1: VERIFICAR QUE LA FUNCIÓN notify_all_users_except EXISTA
-- =========================================================

SELECT 
    '✅ Función notify_all_users_except existe' as resultado,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'notify_all_users_except'
AND routine_schema = 'public';

-- Si no existe, crearla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'notify_all_users_except'
        AND routine_schema = 'public'
    ) THEN
        RAISE NOTICE '⚠️ La función notify_all_users_except no existe. Debe crearse desde NOTIFICACIONES_REALTIME_SOLICITUDES.sql';
    ELSE
        RAISE NOTICE '✅ La función notify_all_users_except existe';
    END IF;
END $$;

-- =========================================================
-- PASO 2: VERIFICAR QUE EL TRIGGER EXISTA
-- =========================================================

SELECT 
    '✅ Trigger para nuevas solicitudes de venta' as resultado,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_notify_new_sale_request'
AND event_object_table = 'sale_requests';

-- =========================================================
-- PASO 3: VERIFICAR QUE LA FUNCIÓN notify_new_sale_request EXISTA
-- =========================================================

SELECT 
    '✅ Función notify_new_sale_request existe' as resultado,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'notify_new_sale_request'
AND routine_schema = 'public';

-- =========================================================
-- PASO 4: VERIFICAR QUE REALTIME ESTÉ HABILITADO
-- =========================================================

-- Verificar que sale_requests esté en la publicación de realtime
SELECT 
    '✅ Verificación de realtime para sale_requests' as resultado,
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'sale_requests';

-- Si no está, habilitarlo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'sale_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅ Realtime habilitado para sale_requests';
    ELSE
        RAISE NOTICE '✅ Realtime ya está habilitado para sale_requests';
    END IF;
END $$;

-- =========================================================
-- PASO 5: RESUMEN DE CONFIGURACIÓN
-- =========================================================

SELECT 
    'RESUMEN DE CONFIGURACIÓN' as tipo,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'notify_all_users_except' AND routine_schema = 'public') 
        THEN '✅ Función notify_all_users_except: EXISTE'
        ELSE '❌ Función notify_all_users_except: NO EXISTE'
    END as estado
UNION ALL
SELECT 
    'RESUMEN DE CONFIGURACIÓN',
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'notify_new_sale_request' AND routine_schema = 'public') 
        THEN '✅ Función notify_new_sale_request: EXISTE'
        ELSE '❌ Función notify_new_sale_request: NO EXISTE'
    END
UNION ALL
SELECT 
    'RESUMEN DE CONFIGURACIÓN',
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_notify_new_sale_request') 
        THEN '✅ Trigger trigger_notify_new_sale_request: EXISTE'
        ELSE '❌ Trigger trigger_notify_new_sale_request: NO EXISTE'
    END
UNION ALL
SELECT 
    'RESUMEN DE CONFIGURACIÓN',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sale_requests') 
        THEN '✅ Realtime para sale_requests: HABILITADO'
        ELSE '❌ Realtime para sale_requests: NO HABILITADO'
    END;

-- =========================================================
-- NOTAS
-- =========================================================

/*
CONFIGURACIÓN REQUERIDA:

1. ✅ Función notify_all_users_except: Debe existir (se crea en NOTIFICACIONES_REALTIME_SOLICITUDES.sql)
2. ✅ Función notify_new_sale_request: Debe existir (se crea en NOTIFICACIONES_VENTAS.sql)
3. ✅ Trigger trigger_notify_new_sale_request: Debe existir (se crea en NOTIFICACIONES_VENTAS.sql)
4. ✅ Realtime para sale_requests: Debe estar habilitado

FLUJO DE NOTIFICACIONES:

1. Usuario crea solicitud de venta → INSERT en sale_requests
2. Trigger trigger_notify_new_sale_request se ejecuta
3. Función notify_new_sale_request crea notificaciones
4. Función notify_all_users_except envía notificaciones a todos los usuarios excepto al creador
5. Frontend recibe notificación vía realtime
6. NotificationBell muestra toast
7. Página /dashboard/ventas muestra la solicitud en tiempo real

EVENTOS:
- SALE_REQUEST_CREATED: Nueva solicitud de venta creada
*/

