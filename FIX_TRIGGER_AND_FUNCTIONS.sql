-- =========================================================
-- FIX: ASEGURAR QUE EL TRIGGER Y FUNCIONES FUNCIONEN CORRECTAMENTE
-- =========================================================

-- PASO 1: ELIMINAR Y RECREAR EL TRIGGER CON MEJOR MANEJO DE ERRORES
DROP TRIGGER IF EXISTS trigger_notify_request_cancelled ON purchase_requests;

-- Función del trigger mejorada con logs
CREATE OR REPLACE FUNCTION trigger_notify_request_cancelled()
RETURNS TRIGGER AS $$
DECLARE
    v_error TEXT;
BEGIN
    -- Solo procesar si el status cambió a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        BEGIN
            -- Log para debugging
            RAISE NOTICE '🔔 Trigger ejecutado: Solicitud % cancelada, comprador: %', NEW.id, NEW.buyer_id;
            
            -- Notificar a vendedores involucrados
            PERFORM notify_request_cancelled(NEW.id, NEW.buyer_id);
            
            RAISE NOTICE '✅ Trigger completado exitosamente';
        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
            RAISE WARNING '❌ Error en trigger_notify_request_cancelled: %', v_error;
            -- No lanzar excepción para que el UPDATE de la solicitud no falle
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
CREATE TRIGGER trigger_notify_request_cancelled
    AFTER UPDATE ON purchase_requests
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
    EXECUTE FUNCTION trigger_notify_request_cancelled();

-- PASO 2: MEJORAR LA FUNCIÓN notify_request_cancelled CON MÁS LOGS Y MEJOR MANEJO DE ERRORES
CREATE OR REPLACE FUNCTION notify_request_cancelled(
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
BEGIN
    RAISE NOTICE '🚀 notify_request_cancelled llamada para request: %, buyer: %', p_request_id, p_buyer_id;
    
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
        RAISE WARNING '⚠️ Solicitud % no encontrada en notify_request_cancelled', p_request_id;
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
    
    -- Si la solicitud NO tiene vendedor asignado (estado 'active'), notificar solo a usuarios activos
    -- Limitamos a usuarios verificados para no sobrecargar
    IF v_seller_id IS NULL THEN
        RAISE NOTICE '📤 Solicitud sin vendedor asignado. Notificando a usuarios activos...';
        
        -- Notificar solo a usuarios que han iniciado sesión recientemente (últimos 30 días)
        -- para evitar notificar a usuarios inactivos
        FOR v_seller_record IN 
            SELECT DISTINCT au.id as seller_id
            FROM auth.users au
            WHERE au.id != p_buyer_id
            AND au.email_confirmed_at IS NOT NULL
            AND au.deleted_at IS NULL
            AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at > NOW() - INTERVAL '30 days')
            LIMIT 100  -- Limitar a 100 usuarios para no sobrecargar
        LOOP
            BEGIN
                -- Construir mensaje con formato simple y visible en todos los dispositivos:
                -- (nombre) canceló por (cantidad) • Código: NMHN-XXXXXXXX • Expiraba: fecha
                v_message_body := v_buyer_name || ' canceló una solicitud de compra por ' || v_formatted_amount || '.';
                
                -- Agregar código separado por " • " para mejor visibilidad
                IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                    v_message_body := v_message_body || ' • Código: ' || v_unique_code;
                END IF;
                
                -- Agregar temporalidad separada por " • "
                IF v_expires_at IS NOT NULL THEN
                    v_message_body := v_message_body || ' • Expiraba: ' || TO_CHAR(v_expires_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
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
                    'REQUEST_CANCELLED',
                    'Solicitud Cancelada',
                    v_message_body,
                    'Ver Solicitudes',
                    '/dashboard/solicitudes',
                    'normal',
                    jsonb_build_object(
                        'request_id', p_request_id,
                        'buyer_id', p_buyer_id,
                        'amount', v_amount,
                        'currency_type', v_currency_type,
                        'unique_code', v_unique_code,
                        'request_status', COALESCE(v_request_status, 'cancelled')
                    ),
                    'request_cancelled_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT
                ) RETURNING id INTO v_notification_id;
                
                v_notification_count := v_notification_count + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '⚠️ Error creando notificación para usuario %: %', v_seller_record.seller_id, SQLERRM;
            END;
        END LOOP;
        
        RAISE NOTICE '✅ Total notificaciones creadas para solicitud sin vendedor: %', v_notification_count;
        RETURN; -- Salir ya que procesamos este caso
    END IF;
    
    -- Notificar al vendedor asignado (si existe)
    IF v_seller_id IS NOT NULL AND v_seller_id != p_buyer_id THEN
        BEGIN
            RAISE NOTICE '📤 Creando notificación para vendedor asignado: %', v_seller_id;
            
            -- Construir mensaje con formato específico:
            -- 1. (nombre) canceló por (cantidad).
            -- 2. Código: NMHN-XXXXXXXX
            -- 3. temporalidad
            v_message_body := v_buyer_name || ' canceló una solicitud de compra por ' || v_formatted_amount || '.';
            
            -- Agregar código en nueva línea si existe
            IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                v_message_body := v_message_body || ' • Código: ' || v_unique_code;
            END IF;
            
            -- Agregar temporalidad
            IF v_expires_at IS NOT NULL THEN
                v_message_body := v_message_body || ' • Expiraba: ' || TO_CHAR(v_expires_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
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
                'REQUEST_CANCELLED',
                'Solicitud Cancelada',
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
                    'request_status', COALESCE(v_request_status, 'cancelled')
                ),
                'request_cancelled_' || p_request_id::TEXT || '_' || v_seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación creada: % para vendedor: %', v_notification_id, v_seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación para vendedor %: %', v_seller_id, SQLERRM;
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
            RAISE NOTICE '📤 Creando notificación para vendedor con transacción: %', v_seller_record.seller_id;
            
            -- Construir mensaje con formato específico:
            -- 1. (nombre) canceló por (cantidad).
            -- 2. Código: NMHN-XXXXXXXX
            -- 3. temporalidad
            v_message_body := v_buyer_name || ' canceló una solicitud de compra por ' || v_formatted_amount || '.';
            
            -- Agregar código en nueva línea si existe
            IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                v_message_body := v_message_body || ' • Código: ' || v_unique_code;
            END IF;
            
            -- Agregar temporalidad
            IF v_expires_at IS NOT NULL THEN
                v_message_body := v_message_body || ' • Expiraba: ' || TO_CHAR(v_expires_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
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
                'REQUEST_CANCELLED',
                'Solicitud Cancelada',
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
                    'request_status', COALESCE(v_request_status, 'cancelled')
                ),
                'request_cancelled_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación creada: % para vendedor con transacción: %', v_notification_id, v_seller_record.seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación para seller %: %', v_seller_record.seller_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ notify_request_cancelled completada. Total notificaciones creadas: %', v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3: MEJORAR LA FUNCIÓN notify_request_deleted CON MÁS LOGS
CREATE OR REPLACE FUNCTION notify_request_deleted(
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
BEGIN
    RAISE NOTICE '🚀 notify_request_deleted llamada para request: %, buyer: %', p_request_id, p_buyer_id;
    
    -- Obtener información de la solicitud ANTES de eliminarla
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
        RAISE WARNING '⚠️ Solicitud % no encontrada en notify_request_deleted', p_request_id;
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
    
    -- Si la solicitud NO tiene vendedor asignado, notificar a usuarios activos
    IF v_seller_id IS NULL THEN
        RAISE NOTICE '📤 Solicitud sin vendedor asignado. Notificando a usuarios activos...';
        
        FOR v_seller_record IN 
            SELECT DISTINCT au.id as seller_id
            FROM auth.users au
            WHERE au.id != p_buyer_id
            AND au.email_confirmed_at IS NOT NULL
            AND au.deleted_at IS NULL
            AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at > NOW() - INTERVAL '30 days')
            LIMIT 100
        LOOP
            BEGIN
                -- Construir mensaje con formato específico:
                -- 1. (nombre) eliminó por (cantidad).
                -- 2. Código: NMHN-XXXXXXXX
                -- 3. temporalidad
                v_message_body := v_buyer_name || ' eliminó una solicitud de compra por ' || v_formatted_amount || '.';
                
                -- Agregar código en nueva línea si existe
                IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                    v_message_body := v_message_body || ' • Código: ' || v_unique_code;
                END IF;
                
                -- Agregar temporalidad
                IF v_expires_at IS NOT NULL THEN
                    v_message_body := v_message_body || ' • Expiraba: ' || TO_CHAR(v_expires_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
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
                    'REQUEST_DELETED',
                    'Solicitud Eliminada',
                    v_message_body,
                    'Ver Solicitudes',
                    '/dashboard/solicitudes',
                    'normal',
                    jsonb_build_object(
                        'request_id', p_request_id,
                        'buyer_id', p_buyer_id,
                        'amount', v_amount,
                        'currency_type', v_currency_type,
                        'unique_code', v_unique_code,
                        'request_status', COALESCE(v_request_status, 'deleted')
                    ),
                    'request_deleted_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT
                ) RETURNING id INTO v_notification_id;
                
                v_notification_count := v_notification_count + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '⚠️ Error creando notificación para usuario %: %', v_seller_record.seller_id, SQLERRM;
            END;
        END LOOP;
        
        RAISE NOTICE '✅ Total notificaciones creadas para solicitud sin vendedor: %', v_notification_count;
        RETURN; -- Salir ya que procesamos este caso
    END IF;
    
    -- Notificar al vendedor asignado (si existe)
    IF v_seller_id IS NOT NULL AND v_seller_id != p_buyer_id THEN
        BEGIN
            RAISE NOTICE '📤 Creando notificación de eliminación para vendedor asignado: %', v_seller_id;
            
            -- Construir mensaje con formato específico:
            -- 1. (nombre) eliminó por (cantidad).
            -- 2. Código: NMHN-XXXXXXXX
            -- 3. temporalidad
            v_message_body := v_buyer_name || ' eliminó una solicitud de compra por ' || v_formatted_amount || '.';
            
            -- Agregar código en nueva línea si existe
            IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                v_message_body := v_message_body || ' • Código: ' || v_unique_code;
            END IF;
            
            -- Agregar temporalidad
            IF v_expires_at IS NOT NULL THEN
                v_message_body := v_message_body || ' • Expiraba: ' || TO_CHAR(v_expires_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
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
                'REQUEST_DELETED',
                'Solicitud Eliminada',
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
                    'request_status', COALESCE(v_request_status, 'deleted')
                ),
                'request_deleted_' || p_request_id::TEXT || '_' || v_seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación de eliminación creada: % para vendedor: %', v_notification_id, v_seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de eliminación: %', SQLERRM;
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
            RAISE NOTICE '📤 Creando notificación de eliminación para vendedor con transacción: %', v_seller_record.seller_id;
            
            -- Construir mensaje con formato específico:
            -- 1. (nombre) eliminó por (cantidad).
            -- 2. Código: NMHN-XXXXXXXX
            -- 3. temporalidad
            v_message_body := v_buyer_name || ' eliminó una solicitud de compra por ' || v_formatted_amount || '.';
            
            -- Agregar código en nueva línea si existe
            IF v_unique_code IS NOT NULL AND v_unique_code != '' THEN
                v_message_body := v_message_body || ' • Código: ' || v_unique_code;
            END IF;
            
            -- Agregar temporalidad
            IF v_expires_at IS NOT NULL THEN
                v_message_body := v_message_body || ' • Expiraba: ' || TO_CHAR(v_expires_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
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
                'REQUEST_DELETED',
                'Solicitud Eliminada',
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
                    'request_status', COALESCE(v_request_status, 'deleted')
                ),
                'request_deleted_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            v_notification_count := v_notification_count + 1;
            RAISE NOTICE '✅ Notificación de eliminación creada: % para vendedor con transacción: %', v_notification_id, v_seller_record.seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Error creando notificación de eliminación para seller %: %', v_seller_record.seller_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ notify_request_deleted completada. Total notificaciones creadas: %', v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 4: VERIFICAR CONFIGURACIÓN
SELECT 
    '🎯 RESUMEN' as verificación,
    'Trigger existe' as item_1,
    EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_notify_request_cancelled'
    ) as resultado_1,
    'Función notify_request_cancelled existe' as item_2,
    EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'notify_request_cancelled'
    ) as resultado_2,
    'Función notify_request_deleted existe' as item_3,
    EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'notify_request_deleted'
    ) as resultado_3;

-- PASO 5: ESTADO FINAL
SELECT '✅ Funciones y trigger mejorados con logs detallados. Revisa los logs cuando canceles/elimines una solicitud.' as mensaje_final;
SELECT '💡 Los logs aparecerán en los "Logs" de Supabase cuando se ejecuten las funciones.' as instruccion;

