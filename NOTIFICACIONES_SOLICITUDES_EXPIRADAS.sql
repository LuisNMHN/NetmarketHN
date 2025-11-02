-- =========================================================
-- NOTIFICACIONES PARA SOLICITUDES EXPIRADAS
-- =========================================================
-- Esta función notifica a los vendedores cuando una solicitud
-- se marca como expirada (por ejemplo, cuando expira el tiempo
-- de una transacción)
-- =========================================================

-- PASO 1: CREAR FUNCIÓN PARA NOTIFICAR SOLICITUDES EXPIRADAS
CREATE OR REPLACE FUNCTION notify_request_expired(
    p_request_id UUID,
    p_buyer_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_request_status TEXT;
    v_seller_id UUID;
    v_amount DECIMAL(15,2);
    v_currency_type TEXT;
    v_buyer_name TEXT;
    v_unique_code TEXT;
    v_notification_id UUID;
    v_seller_record RECORD;
    v_notification_count INTEGER := 0;
    v_message_body TEXT;
    v_formatted_amount TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_payment_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    RAISE NOTICE '🚀 notify_request_expired llamada para request: %, buyer: %', p_request_id, p_buyer_id;
    
    -- Obtener información de la solicitud
    SELECT 
        pr.status,
        pr.seller_id,
        pr.amount,
        pr.currency_type,
        pr.unique_code,
        pr.expires_at,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as buyer_name
    INTO v_request_status, v_seller_id, v_amount, v_currency_type, v_unique_code, v_expires_at, v_buyer_name
    FROM purchase_requests pr
    LEFT JOIN auth.users au ON pr.buyer_id = au.id
    LEFT JOIN public.profiles p ON pr.buyer_id = p.id
    WHERE pr.id = p_request_id;
    
    -- Si no se encontró la solicitud, salir
    IF v_buyer_name IS NULL THEN
        RAISE WARNING '⚠️ Solicitud % no encontrada en notify_request_expired', p_request_id;
        RETURN;
    END IF;
    
    RAISE NOTICE '📋 Información de solicitud: seller_id=%, amount=%, currency=%, buyer_name=%, status=%', 
        v_seller_id, v_amount, v_currency_type, v_buyer_name, v_request_status;
    
    -- Formatear monto según moneda
    v_formatted_amount := CASE 
        WHEN v_currency_type = 'USD' THEN '$' || COALESCE(v_amount::TEXT, '0')
        WHEN v_currency_type = 'EUR' THEN '€' || COALESCE(v_amount::TEXT, '0')
        ELSE 'L.' || COALESCE(v_amount::TEXT, '0')
    END;
    
    -- Intentar obtener el payment_deadline de la transacción para mostrar en la notificación
    SELECT payment_deadline INTO v_payment_deadline
    FROM purchase_transactions
    WHERE request_id = p_request_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Si la solicitud NO tiene vendedor asignado, no notificar (ya que no hay vendedor específico)
    -- En este caso, la solicitud expirada probablemente no tiene vendedor asignado
    -- porque expiró antes de ser aceptada, o la transacción expiró después de ser aceptada
    
    -- Notificar al vendedor asignado (si existe)
    IF v_seller_id IS NOT NULL AND v_seller_id != p_buyer_id THEN
        BEGIN
            RAISE NOTICE '📤 Creando notificación de expiración para vendedor asignado: %', v_seller_id;
            
            -- Construir mensaje con formato específico:
            -- (nombre) expiró por (cantidad) • Código: NMHN-XXXXXXXX
            v_message_body := v_buyer_name || ' expiró una solicitud de compra por ' || v_formatted_amount || '.';
            
            -- Agregar código si existe
            IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                v_message_body := v_message_body || ' • Código: ' || v_unique_code;
            END IF;
            
            -- Agregar información del deadline de pago si existe
            IF v_payment_deadline IS NOT NULL THEN
                v_message_body := v_message_body || ' • Tiempo agotado: ' || TO_CHAR(v_payment_deadline AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
            END IF;
            
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
                v_seller_id,
                'order',
                'REQUEST_EXPIRED',
                'Solicitud Expirada',
                v_message_body,
                'Ver Solicitudes',
                '/dashboard/solicitudes',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'buyer_id', p_buyer_id,
                    'seller_id', v_seller_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'unique_code', v_unique_code,
                    'request_status', COALESCE(v_request_status, 'expired'),
                    'payment_deadline', v_payment_deadline
                ),
                'request_expired_' || p_request_id::TEXT || '_' || v_seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación de expiración creada: % para vendedor: %', v_notification_id, v_seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de expiración para vendedor %: %', v_seller_id, SQLERRM;
        END;
    END IF;
    
    -- Notificar a vendedores con transacciones relacionadas
    FOR v_seller_record IN 
        SELECT DISTINCT pt.seller_id
        FROM purchase_transactions pt
        WHERE pt.request_id = p_request_id
        AND pt.seller_id != p_buyer_id
        AND (v_seller_id IS NULL OR pt.seller_id != v_seller_id)
    LOOP
        BEGIN
            RAISE NOTICE '📤 Creando notificación de expiración para vendedor con transacción: %', v_seller_record.seller_id;
            
            -- Construir mensaje con formato específico:
            -- (nombre) expiró por (cantidad) • Código: NMHN-XXXXXXXX
            v_message_body := v_buyer_name || ' expiró una solicitud de compra por ' || v_formatted_amount || '.';
            
            -- Agregar código si existe
            IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                v_message_body := v_message_body || ' • Código: ' || v_unique_code;
            END IF;
            
            -- Agregar información del deadline de pago si existe
            IF v_payment_deadline IS NOT NULL THEN
                v_message_body := v_message_body || ' • Tiempo agotado: ' || TO_CHAR(v_payment_deadline AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
            END IF;
            
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
                v_seller_record.seller_id,
                'order',
                'REQUEST_EXPIRED',
                'Solicitud Expirada',
                v_message_body,
                'Ver Solicitudes',
                '/dashboard/solicitudes',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'buyer_id', p_buyer_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'unique_code', v_unique_code,
                    'request_status', COALESCE(v_request_status, 'expired'),
                    'payment_deadline', v_payment_deadline
                ),
                'request_expired_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación de expiración creada: % para vendedor con transacción: %', v_notification_id, v_seller_record.seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de expiración para seller %: %', v_seller_record.seller_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ notify_request_expired completada. Total notificaciones creadas: %', v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 2: CREAR TRIGGER PARA NOTIFICACIONES AUTOMÁTICAS DE EXPIRACIÓN
-- (Opcional: si queremos que se notifique automáticamente cuando cambia el status a expired)
DROP TRIGGER IF EXISTS trigger_notify_request_expired ON purchase_requests;

CREATE OR REPLACE FUNCTION trigger_notify_request_expired()
RETURNS TRIGGER AS $$
DECLARE
    v_error TEXT;
BEGIN
    -- Solo procesar si el status cambió a 'expired'
    IF NEW.status = 'expired' AND (OLD.status IS NULL OR OLD.status != 'expired') THEN
        BEGIN
            -- Log para debugging
            RAISE NOTICE '🔔 Trigger ejecutado: Solicitud % expirada, comprador: %', NEW.id, NEW.buyer_id;
            
            -- Notificar a vendedores involucrados
            PERFORM notify_request_expired(NEW.id, NEW.buyer_id);
            
            RAISE NOTICE '✅ Trigger completado exitosamente';
        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
            RAISE WARNING '❌ Error en trigger_notify_request_expired: %', v_error;
            -- No lanzar excepción para que el UPDATE de la solicitud no falle
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
CREATE TRIGGER trigger_notify_request_expired
    AFTER UPDATE ON purchase_requests
    FOR EACH ROW
    WHEN (NEW.status = 'expired' AND (OLD.status IS NULL OR OLD.status != 'expired'))
    EXECUTE FUNCTION trigger_notify_request_expired();

-- PASO 3: VERIFICAR CONFIGURACIÓN
SELECT 
    '✅ Función notify_request_expired creada' as resultado,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'notify_request_expired'
AND routine_schema = 'public';

SELECT 
    '✅ Trigger trigger_notify_request_expired creado' as resultado,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_notify_request_expired';

SELECT 'Sistema de notificaciones para solicitudes expiradas configurado correctamente' as resultado;

