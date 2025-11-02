-- =========================================================
-- FIX: AGREGAR STATUS A NOTIFICACIONES Y SIMPLIFICAR PROCESO
-- =========================================================

-- PASO 1: VERIFICAR QUE REALTIME ESTÁ HABILITADO
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        RAISE NOTICE '✅ Tabla notifications agregada a realtime';
    ELSE
        RAISE NOTICE '✅ Tabla notifications ya está en realtime';
    END IF;
END $$;

-- PASO 2: SIMPLIFICAR FUNCIÓN DE NOTIFICACIÓN DE CANCELACIÓN
-- Esta versión es más directa y agrega el status al payload
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
    v_notification_id UUID;
    v_seller_record RECORD;
BEGIN
    -- Obtener información de la solicitud
    SELECT 
        pr.status,
        pr.seller_id,
        pr.amount,
        pr.currency_type,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as buyer_name
    INTO v_request_status, v_seller_id, v_amount, v_currency_type, v_buyer_name
    FROM purchase_requests pr
    LEFT JOIN auth.users au ON pr.buyer_id = au.id
    LEFT JOIN public.profiles p ON pr.buyer_id = p.id
    WHERE pr.id = p_request_id;
    
    -- Si no se encontró la solicitud, salir
    IF v_buyer_name IS NULL THEN
        RAISE WARNING 'Solicitud % no encontrada', p_request_id;
        RETURN;
    END IF;
    
    -- Notificar al vendedor asignado (si existe)
    IF v_seller_id IS NOT NULL AND v_seller_id != p_buyer_id THEN
        BEGIN
            -- Insertar directamente en notifications con el status en el payload
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
                v_buyer_name || ' ha cancelado la solicitud de compra por ' ||
                CASE 
                    WHEN v_currency_type = 'USD' THEN '$' || COALESCE(v_amount::TEXT, '0')
                    WHEN v_currency_type = 'EUR' THEN '€' || COALESCE(v_amount::TEXT, '0')
                    ELSE 'L.' || COALESCE(v_amount::TEXT, '0')
                END || ' HNLD',
                'Ver Solicitudes',
                '/dashboard/solicitudes',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'buyer_id', p_buyer_id,
                    'seller_id', v_seller_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'request_status', COALESCE(v_request_status, 'cancelled')  -- ⭐ STATUS AGREGADO
                ),
                'request_cancelled_' || p_request_id::TEXT || '_' || v_seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            RAISE NOTICE '✅ Notificación de cancelación creada: % para vendedor: %', v_notification_id, v_seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creando notificación de cancelación: %', SQLERRM;
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
                v_buyer_name || ' ha cancelado una solicitud de compra en la que estabas involucrado',
                'Ver Solicitudes',
                '/dashboard/solicitudes',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'buyer_id', p_buyer_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'request_status', COALESCE(v_request_status, 'cancelled')  -- ⭐ STATUS AGREGADO
                ),
                'request_cancelled_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            RAISE NOTICE '✅ Notificación de cancelación creada: % para vendedor con transacción: %', v_notification_id, v_seller_record.seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creando notificación de cancelación para seller %: %', v_seller_record.seller_id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3: SIMPLIFICAR FUNCIÓN DE NOTIFICACIÓN DE ELIMINACIÓN
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
    v_notification_id UUID;
    v_seller_record RECORD;
BEGIN
    -- Obtener información de la solicitud ANTES de eliminarla
    SELECT 
        pr.status,
        pr.seller_id,
        pr.amount,
        pr.currency_type,
        COALESCE(p.full_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as buyer_name
    INTO v_request_status, v_seller_id, v_amount, v_currency_type, v_buyer_name
    FROM purchase_requests pr
    LEFT JOIN auth.users au ON pr.buyer_id = au.id
    LEFT JOIN public.profiles p ON pr.buyer_id = p.id
    WHERE pr.id = p_request_id;
    
    -- Si no se encontró la solicitud, salir
    IF v_buyer_name IS NULL THEN
        RAISE WARNING 'Solicitud % no encontrada', p_request_id;
        RETURN;
    END IF;
    
    -- Notificar al vendedor asignado (si existe)
    IF v_seller_id IS NOT NULL AND v_seller_id != p_buyer_id THEN
        BEGIN
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
                v_buyer_name || ' ha eliminado la solicitud de compra por ' ||
                CASE 
                    WHEN v_currency_type = 'USD' THEN '$' || COALESCE(v_amount::TEXT, '0')
                    WHEN v_currency_type = 'EUR' THEN '€' || COALESCE(v_amount::TEXT, '0')
                    ELSE 'L.' || COALESCE(v_amount::TEXT, '0')
                END || ' HNLD',
                'Ver Solicitudes',
                '/dashboard/solicitudes',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'buyer_id', p_buyer_id,
                    'seller_id', v_seller_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'request_status', COALESCE(v_request_status, 'deleted')  -- ⭐ STATUS AGREGADO
                ),
                'request_deleted_' || p_request_id::TEXT || '_' || v_seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            RAISE NOTICE '✅ Notificación de eliminación creada: % para vendedor: %', v_notification_id, v_seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creando notificación de eliminación: %', SQLERRM;
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
                v_buyer_name || ' ha eliminado una solicitud de compra en la que estabas involucrado',
                'Ver Solicitudes',
                '/dashboard/solicitudes',
                'high',
                jsonb_build_object(
                    'request_id', p_request_id,
                    'buyer_id', p_buyer_id,
                    'amount', v_amount,
                    'currency_type', v_currency_type,
                    'request_status', COALESCE(v_request_status, 'deleted')  -- ⭐ STATUS AGREGADO
                ),
                'request_deleted_' || p_request_id::TEXT || '_' || v_seller_record.seller_id::TEXT
            ) RETURNING id INTO v_notification_id;
            
            RAISE NOTICE '✅ Notificación de eliminación creada: % para vendedor con transacción: %', v_notification_id, v_seller_record.seller_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creando notificación de eliminación para seller %: %', v_seller_record.seller_id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 4: ASEGURAR QUE LAS POLÍTICAS RLS PERMITAN INSERCIÓN DESDE FUNCIONES SECURITY DEFINER
DROP POLICY IF EXISTS "Functions can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;

-- Política para usuarios normales
CREATE POLICY "Users can insert own notifications" ON notifications
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Política para funciones SECURITY DEFINER
CREATE POLICY "Functions can insert notifications" ON notifications
    FOR INSERT 
    WITH CHECK (
        EXISTS (SELECT 1 FROM auth.users WHERE id = user_id)
    );

-- PASO 5: VERIFICAR TRIGGER
SELECT 
    '✅ Trigger verificado' as resultado,
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'trigger_notify_request_cancelled';

-- PASO 6: FUNCIÓN DE DIAGNÓSTICO - VER NOTIFICACIONES RECIENTES CON STATUS
CREATE OR REPLACE FUNCTION check_recent_notifications(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    event TEXT,
    title TEXT,
    body TEXT,
    request_status TEXT,
    request_id UUID,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.event,
        n.title,
        n.body,
        COALESCE((n.payload->>'request_status')::TEXT, 'N/A') as request_status,
        COALESCE((n.payload->>'request_id')::UUID, NULL) as request_id,
        n.created_at
    FROM notifications n
    WHERE n.user_id = p_user_id
    AND n.event IN ('REQUEST_CANCELLED', 'REQUEST_DELETED')
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 7: VERIFICAR CONFIGURACIÓN
SELECT 
    '🎯 RESUMEN' as verificación,
    'Realtime habilitado' as item_1,
    EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') as resultado_1,
    'Política Functions existe' as item_2,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Functions can insert notifications') as resultado_2,
    'Función notify_request_cancelled existe' as item_3,
    EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'notify_request_cancelled') as resultado_3;

-- PASO 8: ESTADO FINAL
SELECT '✅ Sistema actualizado. Las notificaciones ahora incluyen request_status en el payload.' as mensaje_final;
SELECT '💡 Para verificar notificaciones recientes, ejecuta: SELECT * FROM check_recent_notifications(auth.uid(), 10);' as instruccion;

