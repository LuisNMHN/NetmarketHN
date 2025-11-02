-- =========================================================
-- NOTIFICACIONES PARA CANCELACIÓN Y ELIMINACIÓN DE SOLICITUDES
-- =========================================================

-- PASO 1: ACTUALIZAR EL CHECK DE TIPOS DE NOTIFICACIÓN PARA INCLUIR CANCELACIÓN Y ELIMINACIÓN
ALTER TABLE request_notifications 
DROP CONSTRAINT IF EXISTS request_notifications_type_check;

ALTER TABLE request_notifications 
ADD CONSTRAINT request_notifications_type_check 
CHECK (type IN (
    'new_request',
    'new_offer', 
    'offer_accepted',
    'offer_rejected',
    'payment_sent',
    'payment_confirmed',
    'transaction_completed',
    'request_expired',
    'request_cancelled',
    'request_deleted'  -- Nuevo tipo
));

-- PASO 2: FUNCIÓN PARA NOTIFICAR A VENDEDORES CUANDO SE CANCELA UNA SOLICITUD
CREATE OR REPLACE FUNCTION notify_request_cancelled(
    p_request_id UUID,
    p_buyer_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_seller_id UUID;
    v_amount DECIMAL(15,2);
    v_currency_type TEXT;
    v_buyer_name TEXT;
    notification_title TEXT;
    notification_body TEXT;
    v_seller_record RECORD;
BEGIN
    -- Obtener información de la solicitud
    SELECT 
        pr.seller_id,
        pr.amount,
        pr.currency_type,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as buyer_name
    INTO v_seller_id, v_amount, v_currency_type, v_buyer_name
    FROM purchase_requests pr
    LEFT JOIN auth.users au ON pr.buyer_id = au.id
    LEFT JOIN public.profiles p ON pr.buyer_id = p.id
    WHERE pr.id = p_request_id;
    
    -- Si hay un vendedor asignado (solicitud aceptada), notificarle
    IF v_seller_id IS NOT NULL THEN
        notification_title := 'Solicitud Cancelada';
        notification_body := v_buyer_name || ' ha cancelado la solicitud de compra por ' ||
                           CASE 
                               WHEN v_currency_type = 'USD' THEN '$' || v_amount::TEXT
                               WHEN v_currency_type = 'EUR' THEN '€' || v_amount::TEXT
                               ELSE 'L.' || v_amount::TEXT
                           END || ' HNLD';
        
        -- Crear notificación en request_notifications
        INSERT INTO request_notifications (
            user_id,
            request_id,
            type,
            title,
            message
        ) VALUES (
            v_seller_id,
            p_request_id,
            'request_cancelled',
            notification_title,
            notification_body
        );
        
        -- También crear notificación en el sistema general de notificaciones
        PERFORM emit_notification(
            v_seller_id,
            'order',
            'REQUEST_CANCELLED',
            notification_title,
            notification_body,
            'Ver Solicitudes',
            '/dashboard/solicitudes',
            'high',
            jsonb_build_object(
                'request_id', p_request_id,
                'buyer_id', p_buyer_id,
                'seller_id', v_seller_id,
                'amount', v_amount,
                'currency_type', v_currency_type
            ),
            'request_cancelled_' || p_request_id::TEXT || '_' || v_seller_id::TEXT,
            NULL
        );
    END IF;
    
    -- Notificar a todos los vendedores que tenían transacciones relacionadas con esta solicitud
    FOR v_seller_record IN 
        SELECT DISTINCT pt.seller_id
        FROM purchase_transactions pt
        WHERE pt.request_id = p_request_id
        AND pt.seller_id != p_buyer_id
        AND pt.seller_id != v_seller_id  -- Evitar duplicados si ya se notificó arriba
    LOOP
        notification_title := 'Solicitud Cancelada';
        notification_body := v_buyer_name || ' ha cancelado una solicitud de compra en la que estabas involucrado';
        
        -- Crear notificación en request_notifications
        INSERT INTO request_notifications (
            user_id,
            request_id,
            type,
            title,
            message
        ) VALUES (
            v_seller_record.seller_id,
            p_request_id,
            'request_cancelled',
            notification_title,
            notification_body
        );
        
        -- También crear notificación en el sistema general
        PERFORM emit_notification(
            v_seller_record.seller_id,
            'order',
            'REQUEST_CANCELLED',
            notification_title,
            notification_body,
            'Ver Solicitudes',
            '/dashboard/solicitudes',
            'high',
            jsonb_build_object(
                'request_id', p_request_id,
                'buyer_id', p_buyer_id,
                'amount', v_amount,
                'currency_type', v_currency_type
            ),
            'request_cancelled_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT,
            NULL
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3: FUNCIÓN PARA NOTIFICAR A VENDEDORES CUANDO SE ELIMINA UNA SOLICITUD
CREATE OR REPLACE FUNCTION notify_request_deleted(
    p_request_id UUID,
    p_buyer_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_seller_id UUID;
    v_amount DECIMAL(15,2);
    v_currency_type TEXT;
    v_buyer_name TEXT;
    notification_title TEXT;
    notification_body TEXT;
    v_seller_record RECORD;
    v_old_status TEXT;
BEGIN
    -- Obtener información de la solicitud ANTES de eliminarla
    -- Nota: Esta función se debe llamar ANTES de eliminar la solicitud
    SELECT 
        pr.seller_id,
        pr.amount,
        pr.currency_type,
        pr.status,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as buyer_name
    INTO v_seller_id, v_amount, v_currency_type, v_old_status, v_buyer_name
    FROM purchase_requests pr
    LEFT JOIN auth.users au ON pr.buyer_id = au.id
    LEFT JOIN public.profiles p ON pr.buyer_id = p.id
    WHERE pr.id = p_request_id;
    
    -- Si hay un vendedor asignado (solicitud aceptada), notificarle
    IF v_seller_id IS NOT NULL THEN
        notification_title := 'Solicitud Eliminada';
        notification_body := v_buyer_name || ' ha eliminado la solicitud de compra por ' ||
                           CASE 
                               WHEN v_currency_type = 'USD' THEN '$' || v_amount::TEXT
                               WHEN v_currency_type = 'EUR' THEN '€' || v_amount::TEXT
                               ELSE 'L.' || v_amount::TEXT
                           END || ' HNLD';
        
        -- Crear notificación en el sistema general (request_notifications se elimina con CASCADE)
        PERFORM emit_notification(
            v_seller_id,
            'order',
            'REQUEST_DELETED',
            notification_title,
            notification_body,
            'Ver Solicitudes',
            '/dashboard/solicitudes',
            'high',
            jsonb_build_object(
                'request_id', p_request_id,
                'buyer_id', p_buyer_id,
                'seller_id', v_seller_id,
                'amount', v_amount,
                'currency_type', v_currency_type,
                'previous_status', v_old_status
            ),
            'request_deleted_' || p_request_id::TEXT || '_' || v_seller_id::TEXT,
            NULL
        );
    END IF;
    
    -- Notificar a todos los vendedores que tenían transacciones relacionadas con esta solicitud
    FOR v_seller_record IN 
        SELECT DISTINCT pt.seller_id
        FROM purchase_transactions pt
        WHERE pt.request_id = p_request_id
        AND pt.seller_id != p_buyer_id
        AND pt.seller_id != v_seller_id  -- Evitar duplicados
    LOOP
        notification_title := 'Solicitud Eliminada';
        notification_body := v_buyer_name || ' ha eliminado una solicitud de compra en la que estabas involucrado';
        
        -- Crear notificación en el sistema general
        PERFORM emit_notification(
            v_seller_record.seller_id,
            'order',
            'REQUEST_DELETED',
            notification_title,
            notification_body,
            'Ver Solicitudes',
            '/dashboard/solicitudes',
            'high',
            jsonb_build_object(
                'request_id', p_request_id,
                'buyer_id', p_buyer_id,
                'amount', v_amount,
                'currency_type', v_currency_type,
                'previous_status', v_old_status
            ),
            'request_deleted_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT,
            NULL
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 4: CREAR TRIGGER PARA NOTIFICAR AUTOMÁTICAMENTE AL CANCELAR
-- Este trigger se ejecuta cuando el status cambia a 'cancelled'
CREATE OR REPLACE FUNCTION trigger_notify_request_cancelled()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si el status cambió a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        -- Notificar a vendedores involucrados
        PERFORM notify_request_cancelled(NEW.id, NEW.buyer_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_notify_request_cancelled ON purchase_requests;

-- Crear el trigger
CREATE TRIGGER trigger_notify_request_cancelled
    AFTER UPDATE ON purchase_requests
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
    EXECUTE FUNCTION trigger_notify_request_cancelled();

-- PASO 5: VERIFICAR QUE LAS FUNCIONES SE CREARON CORRECTAMENTE
SELECT 
    '✅ Funciones creadas' as resultado,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('notify_request_cancelled', 'notify_request_deleted', 'trigger_notify_request_cancelled')
ORDER BY routine_name;

-- PASO 6: VERIFICAR QUE EL TRIGGER EXISTE
SELECT 
    '✅ Trigger creado' as resultado,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'trigger_notify_request_cancelled';

-- PASO 7: ESTADO FINAL
SELECT '✅ Sistema de notificaciones para cancelación/eliminación configurado correctamente' as mensaje_final;

