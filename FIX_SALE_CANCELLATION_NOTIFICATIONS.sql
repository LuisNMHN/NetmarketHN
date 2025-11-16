-- =========================================================
-- FIX: CORREGIR NOTIFICACIONES DE CANCELACIÓN DE VENTAS
-- =========================================================
-- Este script corrige la función notify_sale_request_cancelled
-- para que notifique correctamente a todos los usuarios cuando
-- se cancela una solicitud de venta
-- =========================================================

-- Paso 1: Eliminar el trigger existente
DROP TRIGGER IF EXISTS trigger_notify_sale_request_cancelled ON sale_requests;

-- Paso 2: Recrear la función notify_sale_request_cancelled con la lógica corregida
CREATE OR REPLACE FUNCTION notify_sale_request_cancelled(
    p_request_id UUID,
    p_seller_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_buyer_id UUID;
    v_amount DECIMAL(15,2);
    v_currency_type TEXT;
    v_seller_name TEXT;
    v_unique_code TEXT;
    v_message_body TEXT;
    v_formatted_amount TEXT;
    v_user_record RECORD;
    v_notification_id UUID;
BEGIN
    -- Obtener información de la solicitud
    SELECT 
        sr.buyer_id,
        sr.final_amount_hnld,
        sr.currency_type,
        sr.unique_code,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as seller_name
    INTO v_buyer_id, v_amount, v_currency_type, v_unique_code, v_seller_name
    FROM sale_requests sr
    LEFT JOIN auth.users au ON sr.seller_id = au.id
    LEFT JOIN public.profiles p ON sr.seller_id = p.id
    WHERE sr.id = p_request_id;
    
    -- Si no se encontró la solicitud, salir
    IF v_seller_name IS NULL THEN
        RAISE WARNING '⚠️ Solicitud % no encontrada en notify_sale_request_cancelled', p_request_id;
        RETURN;
    END IF;
    
    -- Formatear monto según moneda
    v_formatted_amount := CASE 
        WHEN v_currency_type = 'USD' THEN '$' || COALESCE(v_amount::TEXT, '0')
        WHEN v_currency_type = 'EUR' THEN '€' || COALESCE(v_amount::TEXT, '0')
        ELSE 'L.' || COALESCE(v_amount::TEXT, '0')
    END;
    
    -- Construir mensaje
    v_message_body := v_seller_name || ' canceló una solicitud de venta por ' || v_formatted_amount || ' HNLD.';
    
    -- Agregar código si existe
    IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
        v_message_body := v_message_body || ' • Código: ' || v_unique_code;
    END IF;
    
    -- Si hay un comprador asignado (solicitud aceptada), notificar solo a ese comprador
    IF v_buyer_id IS NOT NULL AND v_buyer_id != p_seller_id THEN
        BEGIN
            SELECT emit_notification(
                v_buyer_id,
                'order',
                'SALE_REQUEST_CANCELLED',
                'Solicitud de Venta Cancelada',
                v_message_body,
                'Ver Solicitudes',
                '/dashboard/ventas',
                'normal',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'seller_id', p_seller_id,
                    'buyer_id', v_buyer_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'unique_code', v_unique_code
                ),
                'sale_request_cancelled_' || p_request_id::TEXT || '_' || v_buyer_id::TEXT,
                NULL
            ) INTO v_notification_id;
            
            RAISE NOTICE '✅ Notificación de cancelación enviada a comprador % para solicitud %', v_buyer_id, p_request_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de cancelación para comprador: %', SQLERRM;
        END;
    -- Si NO hay comprador asignado (solicitud activa), notificar a TODOS los usuarios excepto al vendedor
    ELSE
        BEGIN
            RAISE NOTICE '📢 Notificando a todos los usuarios sobre cancelación de solicitud %', p_request_id;
            
            -- Iterar sobre todos los usuarios activos excepto el vendedor
            FOR v_user_record IN 
                SELECT DISTINCT au.id as user_id
                FROM auth.users au
                WHERE au.id != p_seller_id
                AND au.email_confirmed_at IS NOT NULL  -- Solo usuarios verificados
                AND au.deleted_at IS NULL  -- Solo usuarios no eliminados
            LOOP
                BEGIN
                    SELECT emit_notification(
                        v_user_record.user_id,
                        'order',
                        'SALE_REQUEST_CANCELLED',
                        'Solicitud de Venta Cancelada',
                        v_message_body,
                        'Ver Solicitudes',
                        '/dashboard/ventas',
                        'normal',
                        jsonb_build_object(
                            'request_id', p_request_id,
                            'seller_id', p_seller_id,
                            'amount', v_amount,
                            'currency_type', v_currency_type,
                            'unique_code', v_unique_code
                        ),
                        'sale_request_cancelled_' || p_request_id::TEXT || '_' || v_user_record.user_id::TEXT,
                        NULL
                    ) INTO v_notification_id;
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING '❌ Error creando notificación de cancelación para usuario %: %', v_user_record.user_id, SQLERRM;
                END;
            END LOOP;
            
            RAISE NOTICE '✅ Notificaciones de cancelación enviadas a todos los usuarios para solicitud %', p_request_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error en bucle de notificaciones de cancelación: %', SQLERRM;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 3: Recrear el trigger
CREATE OR REPLACE FUNCTION trigger_notify_sale_request_cancelled()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si el status cambió a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        BEGIN
            RAISE NOTICE '🚨 Trigger detectó cancelación de solicitud % (vendedor: %)', NEW.id, NEW.seller_id;
            PERFORM notify_sale_request_cancelled(NEW.id, NEW.seller_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error en trigger_notify_sale_request_cancelled: %', SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_sale_request_cancelled
    AFTER UPDATE ON sale_requests
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
    EXECUTE FUNCTION trigger_notify_sale_request_cancelled();

-- Paso 4: Verificar que el trigger esté creado
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_sale_request_cancelled'
AND event_object_table = 'sale_requests';

-- Paso 5: Verificar que la función existe
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'notify_sale_request_cancelled';

-- =========================================================
-- RESUMEN
-- =========================================================
-- ✅ Función notify_sale_request_cancelled actualizada
-- ✅ Trigger trigger_notify_sale_request_cancelled recreado
-- ✅ Notificaciones se envían a todos los usuarios cuando la solicitud está activa
-- ✅ Notificaciones se envían solo al comprador cuando la solicitud está aceptada
-- =========================================================

