-- =========================================================
-- NOTIFICACIONES PARA SOLICITUDES COMPLETADAS
-- =========================================================
-- Esta función notifica a ambos usuarios (comprador y vendedor)
-- cuando una transacción se completa exitosamente
-- Incluye CTA para calificar al otro usuario usando el sistema de reputación
-- =========================================================

-- PASO 1: ACTUALIZAR EL CHECK DE TIPOS DE NOTIFICACIÓN PARA INCLUIR COMPLETADA
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
    'request_deleted',
    'request_completed'  -- Nuevo tipo
));

-- =========================================================
-- PASO 2: FUNCIÓN PARA NOTIFICAR CUANDO SE COMPLETA UNA SOLICITUD
-- =========================================================

CREATE OR REPLACE FUNCTION notify_request_completed(
    p_request_id UUID,
    p_transaction_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buyer_id UUID;
    v_seller_id UUID;
    v_buyer_name TEXT;
    v_seller_name TEXT;
    v_amount DECIMAL(15,2);
    v_currency_type TEXT;
    v_unique_code TEXT;
    v_formatted_amount TEXT;
    notification_title TEXT;
    notification_body TEXT;
    v_notification_count INTEGER := 0;
    v_request_exists BOOLEAN := FALSE;
    v_transaction_exists BOOLEAN := FALSE;
BEGIN
    -- Verificar que la solicitud existe
    SELECT EXISTS(SELECT 1 FROM purchase_requests WHERE id = p_request_id) INTO v_request_exists;
    
    IF NOT v_request_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Solicitud no encontrada',
            'request_id', p_request_id
        );
    END IF;
    
    -- Verificar que la transacción existe
    SELECT EXISTS(SELECT 1 FROM purchase_transactions WHERE id = p_transaction_id) INTO v_transaction_exists;
    
    IF NOT v_transaction_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Transacción no encontrada',
            'transaction_id', p_transaction_id
        );
    END IF;
    
    -- Obtener información de la solicitud y transacción
    SELECT 
        pr.buyer_id,
        pr.seller_id,
        pr.amount,
        pr.currency_type,
        pr.unique_code,
        COALESCE(buyer_profile.full_name, SPLIT_PART(buyer_auth.email, '@', 1), 'Usuario') as buyer_name,
        COALESCE(seller_profile.full_name, SPLIT_PART(seller_auth.email, '@', 1), 'Usuario') as seller_name
    INTO 
        v_buyer_id,
        v_seller_id,
        v_amount,
        v_currency_type,
        v_unique_code,
        v_buyer_name,
        v_seller_name
    FROM purchase_requests pr
    LEFT JOIN auth.users buyer_auth ON pr.buyer_id = buyer_auth.id
    LEFT JOIN public.profiles buyer_profile ON pr.buyer_id = buyer_profile.id
    LEFT JOIN auth.users seller_auth ON pr.seller_id = seller_auth.id
    LEFT JOIN public.profiles seller_profile ON pr.seller_id = seller_profile.id
    WHERE pr.id = p_request_id;
    
    -- Formatear cantidad según la moneda
    v_formatted_amount := CASE 
        WHEN v_currency_type = 'USD' THEN '$' || v_amount::TEXT
        WHEN v_currency_type = 'EUR' THEN '€' || v_amount::TEXT
        ELSE 'L.' || v_amount::TEXT
    END;
    
    -- =========================================================
    -- NOTIFICAR AL VENDEDOR
    -- =========================================================
    IF v_seller_id IS NOT NULL THEN
        notification_title := 'Solicitud de Compra Completada';
        notification_body := 'La transacción con ' || v_buyer_name || ' por ' || v_formatted_amount || ' HNLD ha sido completada exitosamente. Califica al comprador para mejorar tu reputación.';
        
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
            'request_completed',
            notification_title,
            notification_body
        )
        ON CONFLICT DO NOTHING;  -- Evitar duplicados
        
        -- Crear notificación en el sistema general de notificaciones
        PERFORM emit_notification(
            v_seller_id,
            'order',
            'REQUEST_COMPLETED',
            notification_title,
            notification_body,
            'Calificar Comprador',  -- CTA label
            '/dashboard/reputation/review?transaction_id=' || p_transaction_id::TEXT || '&reviewed_user_id=' || v_buyer_id::TEXT || '&role=seller',  -- CTA href: vendedor (role=seller) califica al comprador (reviewed_user_id=buyer_id)
            'high',
            jsonb_build_object(
                'request_id', p_request_id,
                'transaction_id', p_transaction_id,
                'buyer_id', v_buyer_id,
                'seller_id', v_seller_id,
                'buyer_name', v_buyer_name,
                'amount', v_amount,
                'formatted_amount', v_formatted_amount,
                'currency_type', v_currency_type,
                'unique_code', v_unique_code,
                'action_type', 'rate_buyer'  -- Indica que debe calificar al comprador
            ),
            'request_completed_' || p_request_id::TEXT || '_seller_' || v_seller_id::TEXT,
            NULL
        );
        
        v_notification_count := v_notification_count + 1;
    END IF;
    
    -- =========================================================
    -- NOTIFICAR AL COMPRADOR
    -- =========================================================
    IF v_buyer_id IS NOT NULL THEN
        notification_title := 'Solicitud de Compra Completada';
        notification_body := 'La transacción con ' || v_seller_name || ' por ' || v_formatted_amount || ' HNLD ha sido completada exitosamente. Los HNLD han sido acreditados a tu cuenta. Califica al vendedor para mejorar tu reputación.';
        
        -- Crear notificación en request_notifications
        INSERT INTO request_notifications (
            user_id,
            request_id,
            type,
            title,
            message
        ) VALUES (
            v_buyer_id,
            p_request_id,
            'request_completed',
            notification_title,
            notification_body
        )
        ON CONFLICT DO NOTHING;  -- Evitar duplicados
        
        -- Crear notificación en el sistema general de notificaciones
        PERFORM emit_notification(
            v_buyer_id,
            'order',
            'REQUEST_COMPLETED',
            notification_title,
            notification_body,
            'Calificar Vendedor',  -- CTA label
            '/dashboard/reputation/review?transaction_id=' || p_transaction_id::TEXT || '&reviewed_user_id=' || v_seller_id::TEXT || '&role=buyer',  -- CTA href con parámetros
            'high',
            jsonb_build_object(
                'request_id', p_request_id,
                'transaction_id', p_transaction_id,
                'buyer_id', v_buyer_id,
                'seller_id', v_seller_id,
                'seller_name', v_seller_name,
                'amount', v_amount,
                'formatted_amount', v_formatted_amount,
                'currency_type', v_currency_type,
                'unique_code', v_unique_code,
                'action_type', 'rate_seller'  -- Indica que debe calificar al vendedor
            ),
            'request_completed_' || p_request_id::TEXT || '_buyer_' || v_buyer_id::TEXT,
            NULL
        );
        
        v_notification_count := v_notification_count + 1;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Notificaciones de solicitud completada enviadas',
        'request_id', p_request_id,
        'transaction_id', p_transaction_id,
        'notifications_sent', v_notification_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error inesperado: ' || SQLERRM,
            'sqlstate', SQLSTATE,
            'request_id', p_request_id,
            'transaction_id', p_transaction_id
        );
END;
$$;

-- Agregar comentario a la función
COMMENT ON FUNCTION notify_request_completed IS 'Notifica a comprador y vendedor cuando una solicitud de compra se completa exitosamente. Incluye CTA para calificar al otro usuario.';

-- =========================================================
-- PASO 3: VERIFICAR QUE LA FUNCIÓN SE CREÓ CORRECTAMENTE
-- =========================================================

SELECT 
    '✅ Función notify_request_completed creada' as resultado,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name = 'notify_request_completed';

SELECT 'Sistema de notificaciones para solicitudes completadas configurado correctamente' as resultado;

