-- =========================================================
-- NMHN - NOTIFICACIONES EN TIEMPO REAL PARA SOLICITUDES DE VENTA
-- =========================================================
-- Script para implementar notificaciones automáticas para el sistema de ventas
-- Equivalente al sistema de notificaciones de compras
-- =========================================================

-- =========================================================
-- PASO 1: CREAR TRIGGER PARA NOTIFICACIONES DE SOLICITUDES DE VENTA
-- =========================================================

-- Función trigger que se ejecuta cuando se inserta una nueva solicitud de venta
CREATE OR REPLACE FUNCTION notify_new_sale_request()
RETURNS TRIGGER AS $$
DECLARE
    seller_profile RECORD;
    notification_title TEXT;
    notification_body TEXT;
    notification_cta_label TEXT;
    notification_cta_href TEXT;
    dedupe_key TEXT;
    v_formatted_amount TEXT;
BEGIN
    -- Solo procesar si es una solicitud activa y no es de tarjeta de crédito
    IF NEW.status = 'active' AND NEW.payment_method != 'card' THEN
        
        -- Obtener información del vendedor
        SELECT 
            COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as seller_name,
            au.email as seller_email
        INTO seller_profile
        FROM auth.users au
        LEFT JOIN public.profiles p ON p.id = au.id
        WHERE au.id = NEW.seller_id;
        
        -- Formatear monto según moneda
        v_formatted_amount := CASE 
            WHEN NEW.currency_type = 'USD' THEN '$' || COALESCE(NEW.amount_in_original_currency::TEXT, NEW.final_amount_hnld::TEXT)
            WHEN NEW.currency_type = 'EUR' THEN '€' || COALESCE(NEW.amount_in_original_currency::TEXT, NEW.final_amount_hnld::TEXT)
            ELSE 'L.' || COALESCE(NEW.final_amount_hnld::TEXT, '0')
        END;
        
        -- Título
        notification_title := 'Nueva Solicitud de Venta';
        
        -- Construir cuerpo con formato simple y visible:
        -- (nombre) creó una solicitud de venta por (cantidad) • Código: NMHNV-XXXXXXXX • Expira: fecha
        notification_body := seller_profile.seller_name || ' creó una solicitud de venta por ' || 
                           v_formatted_amount || ' HNLD.';
        
        -- Agregar código separado por " • " para mejor visibilidad
        IF NEW.unique_code IS NOT NULL AND NEW.unique_code != '' THEN
            notification_body := notification_body || ' • Código: ' || NEW.unique_code;
        END IF;
        
        -- Agregar temporalidad separada por " • "
        IF NEW.expires_at IS NOT NULL THEN
            notification_body := notification_body || ' • Expira: ' || TO_CHAR(NEW.expires_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
        END IF;
        
        notification_cta_label := 'Ver Solicitud';
        notification_cta_href := '/dashboard/ventas';
        
        -- Crear clave única para evitar duplicados
        dedupe_key := 'sale_request_' || NEW.id::TEXT;
        
        -- Enviar notificación a todos los usuarios excepto al creador de la solicitud
        PERFORM notify_all_users_except(
            NEW.seller_id,  -- Excluir al creador
            'order',        -- Topic: order
            'SALE_REQUEST_CREATED',  -- Event
            notification_title,
            notification_body,
            notification_cta_label,
            notification_cta_href,
            'normal',       -- Priority
            jsonb_build_object(
                'request_id', NEW.id,
                'seller_id', NEW.seller_id,
                'amount', NEW.final_amount_hnld,
                'formatted_amount', v_formatted_amount,
                'currency_type', NEW.currency_type,
                'payment_method', NEW.payment_method,
                'unique_code', NEW.unique_code,
                'seller_name', seller_profile.seller_name
            ),
            dedupe_key,
            NEW.expires_at  -- La notificación expira cuando la solicitud expira
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- PASO 2: CREAR TRIGGER PARA NOTIFICACIONES DE SOLICITUDES EXPIRADAS (VENTAS)
-- =========================================================

CREATE OR REPLACE FUNCTION notify_sale_request_expired(
    p_request_id UUID,
    p_seller_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_request_status TEXT;
    v_buyer_id UUID;
    v_amount DECIMAL(15,2);
    v_currency_type TEXT;
    v_seller_name TEXT;
    v_unique_code TEXT;
    v_notification_id UUID;
    v_buyer_record RECORD;
    v_notification_count INTEGER := 0;
    v_message_body TEXT;
    v_formatted_amount TEXT;
    v_payment_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    RAISE NOTICE '🚀 notify_sale_request_expired llamada para request: %, seller: %', p_request_id, p_seller_id;
    
    -- Obtener información de la solicitud
    SELECT 
        sr.status,
        sr.buyer_id,
        sr.final_amount_hnld,
        sr.currency_type,
        sr.unique_code,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as seller_name
    INTO v_request_status, v_buyer_id, v_amount, v_currency_type, v_unique_code, v_seller_name
    FROM sale_requests sr
    LEFT JOIN auth.users au ON sr.seller_id = au.id
    LEFT JOIN public.profiles p ON sr.seller_id = p.id
    WHERE sr.id = p_request_id;
    
    -- Si no se encontró la solicitud, salir
    IF v_seller_name IS NULL THEN
        RAISE WARNING '⚠️ Solicitud % no encontrada en notify_sale_request_expired', p_request_id;
        RETURN;
    END IF;
    
    -- Formatear monto según moneda
    v_formatted_amount := CASE 
        WHEN v_currency_type = 'USD' THEN '$' || COALESCE(v_amount::TEXT, '0')
        WHEN v_currency_type = 'EUR' THEN '€' || COALESCE(v_amount::TEXT, '0')
        ELSE 'L.' || COALESCE(v_amount::TEXT, '0')
    END;
    
    -- Intentar obtener el payment_deadline de la transacción
    SELECT payment_deadline INTO v_payment_deadline
    FROM sale_transactions
    WHERE request_id = p_request_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Notificar al comprador asignado (si existe)
    IF v_buyer_id IS NOT NULL AND v_buyer_id != p_seller_id THEN
        BEGIN
            RAISE NOTICE '📤 Creando notificación de expiración para comprador asignado: %', v_buyer_id;
            
            -- Construir mensaje
            v_message_body := v_seller_name || ' expiró una solicitud de venta por ' || v_formatted_amount || ' HNLD.';
            
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
                v_buyer_id,
                'order',
                'SALE_REQUEST_EXPIRED',
                'Solicitud de Venta Expirada',
                v_message_body,
                'Ver Solicitudes',
                '/dashboard/ventas',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'seller_id', p_seller_id,
                    'buyer_id', v_buyer_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'unique_code', v_unique_code,
                    'request_status', COALESCE(v_request_status, 'expired'),
                    'payment_deadline', v_payment_deadline
                ),
                'sale_request_expired_' || p_request_id::TEXT || '_' || v_buyer_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación de expiración creada: % para comprador: %', v_notification_id, v_buyer_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de expiración para comprador %: %', v_buyer_id, SQLERRM;
        END;
    END IF;
    
    -- Notificar a compradores con transacciones relacionadas
    FOR v_buyer_record IN 
        SELECT DISTINCT st.buyer_id
        FROM sale_transactions st
        WHERE st.request_id = p_request_id
        AND st.buyer_id != p_seller_id
        AND (v_buyer_id IS NULL OR st.buyer_id != v_buyer_id)
    LOOP
        BEGIN
            RAISE NOTICE '📤 Creando notificación de expiración para comprador con transacción: %', v_buyer_record.buyer_id;
            
            -- Construir mensaje
            v_message_body := v_seller_name || ' expiró una solicitud de venta por ' || v_formatted_amount || ' HNLD.';
            
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
                v_buyer_record.buyer_id,
                'order',
                'SALE_REQUEST_EXPIRED',
                'Solicitud de Venta Expirada',
                v_message_body,
                'Ver Solicitudes',
                '/dashboard/ventas',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'seller_id', p_seller_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'unique_code', v_unique_code,
                    'request_status', COALESCE(v_request_status, 'expired'),
                    'payment_deadline', v_payment_deadline
                ),
                'sale_request_expired_' || p_request_id::TEXT || '_' || v_buyer_record.buyer_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación de expiración creada: % para comprador con transacción: %', v_notification_id, v_buyer_record.buyer_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de expiración para buyer %: %', v_buyer_record.buyer_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ notify_sale_request_expired completada. Total notificaciones creadas: %', v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificaciones automáticas de expiración
DROP TRIGGER IF EXISTS trigger_notify_sale_request_expired ON sale_requests;

CREATE OR REPLACE FUNCTION trigger_notify_sale_request_expired()
RETURNS TRIGGER AS $$
DECLARE
    v_error TEXT;
BEGIN
    -- Solo procesar si el status cambió a 'expired'
    IF NEW.status = 'expired' AND (OLD.status IS NULL OR OLD.status != 'expired') THEN
        BEGIN
            RAISE NOTICE '🔔 Trigger ejecutado: Solicitud de venta % expirada, vendedor: %', NEW.id, NEW.seller_id;
            
            -- Notificar a compradores involucrados
            PERFORM notify_sale_request_expired(NEW.id, NEW.seller_id);
            
            RAISE NOTICE '✅ Trigger completado exitosamente';
        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
            RAISE WARNING '❌ Error en trigger_notify_sale_request_expired: %', v_error;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_sale_request_expired
    AFTER UPDATE ON sale_requests
    FOR EACH ROW
    WHEN (NEW.status = 'expired' AND (OLD.status IS NULL OR OLD.status != 'expired'))
    EXECUTE FUNCTION trigger_notify_sale_request_expired();

-- =========================================================
-- PASO 3: CREAR TRIGGER PARA NOTIFICACIONES DE SOLICITUDES CANCELADAS (VENTAS)
-- =========================================================

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
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de cancelación para comprador: %', SQLERRM;
        END;
    -- Si NO hay comprador asignado (solicitud activa), notificar a TODOS los usuarios excepto al vendedor
    ELSE
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error en bucle de notificaciones de cancelación: %', SQLERRM;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificaciones automáticas de cancelación
DROP TRIGGER IF EXISTS trigger_notify_sale_request_cancelled ON sale_requests;

CREATE OR REPLACE FUNCTION trigger_notify_sale_request_cancelled()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si el status cambió a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        BEGIN
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

-- =========================================================
-- PASO 4: CREAR TRIGGERS
-- =========================================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_notify_new_sale_request ON sale_requests;

-- Crear el trigger para nuevas solicitudes
CREATE TRIGGER trigger_notify_new_sale_request
    AFTER INSERT ON sale_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_sale_request();

-- =========================================================
-- PASO 5: VERIFICAR CONFIGURACIÓN
-- =========================================================

-- Verificar que los triggers se crearon correctamente
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name IN (
    'trigger_notify_new_sale_request',
    'trigger_notify_sale_request_expired',
    'trigger_notify_sale_request_cancelled'
);

-- Verificar que las funciones existen
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'notify_new_sale_request',
    'notify_sale_request_expired',
    'notify_sale_request_cancelled',
    'trigger_notify_sale_request_expired',
    'trigger_notify_sale_request_cancelled'
)
AND routine_schema = 'public';

-- =========================================================
-- RESUMEN DE IMPLEMENTACIÓN
-- =========================================================

/*
IMPLEMENTACIÓN COMPLETADA:

1. ✅ Trigger automático: Se ejecuta cuando se inserta una nueva solicitud de venta
2. ✅ Notificación masiva: Envía notificación a todos los usuarios excepto al creador
3. ✅ Contenido dinámico: Incluye información del vendedor y monto
4. ✅ Prevención de duplicados: Usa dedupe_key único por usuario
5. ✅ Expiración automática: Las notificaciones expiran con la solicitud
6. ✅ Filtros inteligentes: Solo notifica solicitudes activas y no de tarjeta
7. ✅ Notificaciones de expiración: Notifica cuando una solicitud expira
8. ✅ Notificaciones de cancelación: Notifica cuando una solicitud se cancela

EVENTOS DE NOTIFICACIÓN:
- SALE_REQUEST_CREATED: Nueva solicitud de venta creada
- SALE_REQUEST_EXPIRED: Solicitud de venta expirada
- SALE_REQUEST_CANCELLED: Solicitud de venta cancelada

NOTA: Los eventos SALE_ACCEPTED, SALE_PAYMENT_STARTED, SALE_PAYMENT_VERIFIED, 
y SALE_COMPLETED se manejan desde las funciones RPC en CREATE_SALE_RLS_AND_FUNCTIONS.sql
*/

