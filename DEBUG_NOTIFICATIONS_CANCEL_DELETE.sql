-- =========================================================
-- DEBUG: VERIFICAR Y FORZAR CREACIÓN DE NOTIFICACIONES
-- =========================================================

-- PASO 1: VERIFICAR QUE LAS FUNCIONES EXISTEN Y FUNCIONAN
SELECT 
    'Funciones disponibles' as tipo,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('notify_request_cancelled', 'notify_request_deleted')
ORDER BY routine_name;

-- PASO 2: PROBAR LA FUNCIÓN DIRECTAMENTE CON UNA SOLICITUD ESPECÍFICA
-- Reemplaza los UUIDs con IDs reales de tu base de datos
DO $$
DECLARE
    v_test_request_id UUID;
    v_test_buyer_id UUID;
    v_test_seller_id UUID;
BEGIN
    -- Buscar una solicitud aceptada con vendedor para probar
    SELECT pr.id, pr.buyer_id, pr.seller_id
    INTO v_test_request_id, v_test_buyer_id, v_test_seller_id
    FROM purchase_requests pr
    WHERE pr.status = 'accepted'
    AND pr.seller_id IS NOT NULL
    LIMIT 1;
    
    IF v_test_request_id IS NULL THEN
        RAISE NOTICE '⚠️ No se encontró solicitud de prueba';
        RETURN;
    END IF;
    
    RAISE NOTICE '🧪 Probando con solicitud: %, comprador: %, vendedor: %', 
        v_test_request_id, v_test_buyer_id, v_test_seller_id;
    
    -- Llamar a la función de notificación
    BEGIN
        PERFORM notify_request_cancelled(v_test_request_id, v_test_buyer_id);
        RAISE NOTICE '✅ Función notify_request_cancelled ejecutada';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Error ejecutando notify_request_cancelled: %', SQLERRM;
    END;
    
    -- Verificar si se creó la notificación
    IF EXISTS (
        SELECT 1 FROM notifications 
        WHERE user_id = v_test_seller_id 
        AND event = 'REQUEST_CANCELLED'
        AND (payload->>'request_id')::UUID = v_test_request_id
    ) THEN
        RAISE NOTICE '✅ Notificación creada correctamente en la BD';
    ELSE
        RAISE WARNING '❌ No se encontró notificación en la BD';
    END IF;
END $$;

-- PASO 3: VER NOTIFICACIONES RECIENTES DE CANCELACIÓN/ELIMINACIÓN
SELECT 
    'Notificaciones recientes' as tipo,
    n.id,
    n.user_id,
    n.event,
    n.title,
    n.payload->>'request_status' as request_status,
    n.payload->>'request_id' as request_id,
    n.created_at
FROM notifications n
WHERE n.event IN ('REQUEST_CANCELLED', 'REQUEST_DELETED')
ORDER BY n.created_at DESC
LIMIT 10;

-- PASO 4: VERIFICAR POLÍTICAS RLS DE notifications
SELECT 
    'Políticas RLS' as tipo,
    policyname,
    cmd,
    CASE permissive
        WHEN 'PERMISSIVE' THEN '✅ Permisiva'
        ELSE '❌ Restrictiva'
    END as tipo_politica
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- PASO 5: VERIFICAR SI REALTIME ESTÁ CONFIGURADO
SELECT 
    'Realtime' as tipo,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'notifications'
        ) THEN '✅ Habilitado'
        ELSE '❌ No habilitado'
    END as estado
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'notifications';

-- PASO 6: VERIFICAR TRIGGER
SELECT 
    'Trigger' as tipo,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'trigger_notify_request_cancelled';

-- PASO 7: FORZAR CREACIÓN DE NOTIFICACIÓN DE PRUEBA MANUALMENTE
-- Esto permite verificar si el problema está en la creación o en realtime
DO $$
DECLARE
    v_test_user_id UUID;
    v_test_notification_id UUID;
BEGIN
    -- Obtener un usuario de prueba (reemplaza con un UUID real)
    SELECT id INTO v_test_user_id
    FROM auth.users
    WHERE email_confirmed_at IS NOT NULL
    LIMIT 1;
    
    IF v_test_user_id IS NULL THEN
        RAISE NOTICE '⚠️ No se encontró usuario de prueba';
        RETURN;
    END IF;
    
    RAISE NOTICE '🧪 Creando notificación de prueba para usuario: %', v_test_user_id;
    
    -- Crear notificación de prueba directamente
    INSERT INTO notifications (
        user_id,
        topic,
        event,
        title,
        body,
        cta_label,
        cta_href,
        priority,
        payload,
        dedupe_key
    ) VALUES (
        v_test_user_id,
        'order',
        'REQUEST_CANCELLED',
        'Prueba: Solicitud Cancelada',
        'Esta es una notificación de prueba para verificar que realtime funciona',
        'Ver Solicitudes',
        '/dashboard/solicitudes',
        'high',
        jsonb_build_object(
            'request_id', gen_random_uuid(),
            'request_status', 'cancelled',
            'test', true
        ),
        'test_notification_' || gen_random_uuid()::TEXT
    ) RETURNING id INTO v_test_notification_id;
    
    RAISE NOTICE '✅ Notificación de prueba creada: %', v_test_notification_id;
    RAISE NOTICE '💡 Verifica en la aplicación si esta notificación aparece en tiempo real';
END $$;

-- PASO 8: VERIFICAR ÚLTIMAS NOTIFICACIONES CREADAS
SELECT 
    'Últimas 5 notificaciones creadas' as tipo,
    id,
    user_id,
    event,
    title,
    created_at,
    status
FROM notifications
ORDER BY created_at DESC
LIMIT 5;

