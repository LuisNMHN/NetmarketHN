-- =========================================================
-- NMHN - NOTIFICACIONES EN TIEMPO REAL PARA SOLICITUDES DE COMPRA
-- =========================================================
-- Script para implementar notificaciones automáticas cuando se crea una solicitud
-- =========================================================

-- =========================================================
-- PASO 1: CREAR TRIGGER PARA NOTIFICACIONES DE SOLICITUDES
-- =========================================================

-- Función trigger que se ejecuta cuando se inserta una nueva solicitud
CREATE OR REPLACE FUNCTION notify_new_purchase_request()
RETURNS TRIGGER AS $$
DECLARE
    buyer_profile RECORD;
    notification_title TEXT;
    notification_body TEXT;
    notification_cta_label TEXT;
    notification_cta_href TEXT;
    dedupe_key TEXT;
BEGIN
    -- Solo procesar si es una solicitud activa y no es de tarjeta de crédito
    IF NEW.status = 'active' AND NEW.payment_method != 'card' THEN
        
        -- Obtener información del comprador
        SELECT 
            COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as buyer_name,
            au.email as buyer_email
        INTO buyer_profile
        FROM auth.users au
        LEFT JOIN public.profiles p ON p.id = au.id
        WHERE au.id = NEW.buyer_id;
        
        -- Construir contenido de la notificación
        notification_title := 'Nueva Solicitud de Compra';
        notification_body := buyer_profile.buyer_name || ' ha publicado una nueva solicitud de compra por ' || 
                           CASE 
                               WHEN NEW.currency_type = 'USD' THEN '$' || NEW.amount_in_original_currency::TEXT
                               WHEN NEW.currency_type = 'EUR' THEN '€' || NEW.amount_in_original_currency::TEXT
                               ELSE 'L.' || NEW.amount::TEXT
                           END || ' HNLD';
        
        notification_cta_label := 'Ver Solicitud';
        notification_cta_href := '/dashboard/solicitudes';
        
        -- Crear clave única para evitar duplicados
        dedupe_key := 'purchase_request_' || NEW.id::TEXT;
        
        -- Enviar notificación a todos los usuarios excepto al creador de la solicitud
        -- Esto se hace mediante una función que notifica a usuarios activos
        PERFORM notify_all_users_except(
            NEW.buyer_id,  -- Excluir al creador
            'order',       -- Topic: order
            'PURCHASE_REQUEST_CREATED',  -- Event
            notification_title,
            notification_body,
            notification_cta_label,
            notification_cta_href,
            'normal',      -- Priority
            jsonb_build_object(
                'request_id', NEW.id,
                'buyer_id', NEW.buyer_id,
                'amount', NEW.amount,
                'currency_type', NEW.currency_type,
                'payment_method', NEW.payment_method,
                'unique_code', NEW.unique_code,
                'buyer_name', buyer_profile.buyer_name
            ),
            dedupe_key,
            NEW.expires_at  -- La notificación expira cuando la solicitud expira
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- PASO 2: FUNCIÓN PARA NOTIFICAR A TODOS LOS USUARIOS EXCEPTO UNO
-- =========================================================

CREATE OR REPLACE FUNCTION notify_all_users_except(
    p_exclude_user_id UUID,
    p_topic TEXT,
    p_event TEXT,
    p_title TEXT,
    p_body TEXT,
    p_cta_label TEXT DEFAULT NULL,
    p_cta_href TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT 'normal',
    p_payload JSONB DEFAULT '{}',
    p_dedupe_key TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    user_record RECORD;
    notification_id UUID;
BEGIN
    -- Iterar sobre todos los usuarios activos excepto el excluido
    FOR user_record IN 
        SELECT DISTINCT au.id as user_id
        FROM auth.users au
        WHERE au.id != p_exclude_user_id
        AND au.email_confirmed_at IS NOT NULL  -- Solo usuarios verificados
        AND au.deleted_at IS NULL  -- Solo usuarios no eliminados
    LOOP
        -- Enviar notificación a cada usuario
        SELECT emit_notification(
            user_record.user_id,
            p_topic,
            p_event,
            p_title,
            p_body,
            p_cta_label,
            p_cta_href,
            p_priority,
            p_payload,
            p_dedupe_key || '_' || user_record.user_id::TEXT,  -- Hacer único por usuario
            p_expires_at
        ) INTO notification_id;
        
        -- Log para debugging (opcional)
        -- RAISE NOTICE 'Notificación enviada a usuario %: %', user_record.user_id, notification_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- PASO 3: CREAR EL TRIGGER
-- =========================================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_notify_new_purchase_request ON purchase_requests;

-- Crear el trigger
CREATE TRIGGER trigger_notify_new_purchase_request
    AFTER INSERT ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_purchase_request();

-- =========================================================
-- PASO 4: VERIFICAR CONFIGURACIÓN DE REALTIME
-- =========================================================

-- Asegurar que la tabla notifications esté habilitada para realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =========================================================
-- PASO 5: FUNCIÓN DE PRUEBA
-- =========================================================

-- Función para probar el sistema de notificaciones
CREATE OR REPLACE FUNCTION test_purchase_request_notification()
RETURNS TEXT AS $$
DECLARE
    test_user_id UUID;
    test_request_id UUID;
    result TEXT;
BEGIN
    -- Obtener un usuario de prueba (el primero disponible)
    SELECT id INTO test_user_id 
    FROM auth.users 
    WHERE email_confirmed_at IS NOT NULL 
    LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RETURN 'Error: No hay usuarios disponibles para la prueba';
    END IF;
    
    -- Crear una solicitud de prueba
    INSERT INTO purchase_requests (
        buyer_id,
        amount,
        description,
        status,
        expires_at,
        payment_method,
        unique_code
    ) VALUES (
        test_user_id,
        100.00,
        'Solicitud de prueba para notificaciones',
        'active',
        NOW() + INTERVAL '24 hours',
        'local_transfer',
        'TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT
    ) RETURNING id INTO test_request_id;
    
    -- Verificar que se crearon notificaciones
    SELECT 'Prueba exitosa. Solicitud creada: ' || test_request_id::TEXT || 
           '. Notificaciones enviadas: ' || COUNT(*)::TEXT
    INTO result
    FROM notifications 
    WHERE dedupe_key LIKE 'purchase_request_' || test_request_id::TEXT || '%';
    
    -- Limpiar la solicitud de prueba
    DELETE FROM purchase_requests WHERE id = test_request_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- PASO 6: VERIFICAR IMPLEMENTACIÓN
-- =========================================================

-- Verificar que el trigger se creó correctamente
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_notify_new_purchase_request';

-- Verificar que las funciones existen
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN ('notify_new_purchase_request', 'notify_all_users_except', 'test_purchase_request_notification')
AND routine_schema = 'public';

-- =========================================================
-- RESUMEN DE IMPLEMENTACIÓN
-- =========================================================

/*
IMPLEMENTACIÓN COMPLETADA:

1. ✅ Trigger automático: Se ejecuta cuando se inserta una nueva solicitud
2. ✅ Notificación masiva: Envía notificación a todos los usuarios excepto al creador
3. ✅ Contenido dinámico: Incluye información del comprador y monto
4. ✅ Prevención de duplicados: Usa dedupe_key único por usuario
5. ✅ Expiración automática: Las notificaciones expiran con la solicitud
6. ✅ Filtros inteligentes: Solo notifica solicitudes activas y no de tarjeta
7. ✅ Realtime habilitado: Las notificaciones aparecen instantáneamente

FLUJO DE FUNCIONAMIENTO:
1. Usuario crea solicitud → Trigger se ejecuta
2. Sistema obtiene info del comprador
3. Crea notificación para todos los usuarios (excepto creador)
4. Supabase Realtime envía notificación instantánea
5. Usuarios ven notificación en tiempo real

PRUEBA:
Ejecutar: SELECT test_purchase_request_notification();
*/
