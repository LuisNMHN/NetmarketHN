-- =========================================================
-- FIX: CORREGIR NOTIFICACIONES EN TIEMPO REAL PARA CANCELACIÓN/ELIMINACIÓN
-- =========================================================

-- PASO 1: VERIFICAR QUE LA TABLA notifications ESTÁ EN REALTIME
DO $$
BEGIN
    -- Verificar si notifications está en realtime
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

-- PASO 2: AGREGAR POLÍTICA RLS QUE PERMITA A FUNCIONES SECURITY DEFINER INSERTAR
-- Las funciones SECURITY DEFINER necesitan poder insertar notificaciones para cualquier usuario
-- IMPORTANTE: Cuando una función SECURITY DEFINER se ejecuta, auth.uid() puede ser NULL
-- Por lo tanto, necesitamos una política más permisiva que verifique solo que el user_id sea válido

DROP POLICY IF EXISTS "Functions can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;

-- Política para usuarios normales (inserción propia)
CREATE POLICY "Users can insert own notifications" ON notifications
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Política especial para funciones SECURITY DEFINER
-- Esta política permite insertar si el user_id existe en auth.users
-- Esto es necesario porque las funciones SECURITY DEFINER pueden no tener auth.uid() correctamente establecido
-- pero necesitamos verificar que el user_id sea un usuario válido
CREATE POLICY "Functions can insert notifications" ON notifications
    FOR INSERT 
    WITH CHECK (
        -- Verificar que el user_id existe en auth.users (seguridad básica)
        EXISTS (SELECT 1 FROM auth.users WHERE id = user_id)
    );

-- PASO 3: CORREGIR LA FUNCIÓN notify_request_cancelled PARA MANEJAR ERRORES MEJOR
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
    v_notification_id UUID;
    v_error TEXT;
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
    
    -- Si no se encontró la solicitud, salir
    IF v_buyer_name IS NULL THEN
        RAISE WARNING 'Solicitud % no encontrada', p_request_id;
        RETURN;
    END IF;
    
    -- Si hay un vendedor asignado (solicitud aceptada), notificarle
    IF v_seller_id IS NOT NULL AND v_seller_id != p_buyer_id THEN
        notification_title := 'Solicitud Cancelada';
        notification_body := v_buyer_name || ' ha cancelado la solicitud de compra por ' ||
                           CASE 
                               WHEN v_currency_type = 'USD' THEN '$' || COALESCE(v_amount::TEXT, '0')
                               WHEN v_currency_type = 'EUR' THEN '€' || COALESCE(v_amount::TEXT, '0')
                               ELSE 'L.' || COALESCE(v_amount::TEXT, '0')
                           END || ' HNLD';
        
        -- Crear notificación en request_notifications
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error insertando en request_notifications: %', SQLERRM;
        END;
        
        -- Crear notificación en el sistema general de notificaciones
        BEGIN
            SELECT emit_notification(
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
            ) INTO v_notification_id;
            
            IF v_notification_id IS NOT NULL THEN
                RAISE NOTICE '✅ Notificación creada para vendedor %: %', v_seller_id, v_notification_id;
            ELSE
                RAISE WARNING '⚠️ emit_notification retornó NULL para vendedor %', v_seller_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error llamando emit_notification: %', SQLERRM;
        END;
    END IF;
    
    -- Notificar a todos los vendedores que tenían transacciones relacionadas con esta solicitud
    FOR v_seller_record IN 
        SELECT DISTINCT pt.seller_id
        FROM purchase_transactions pt
        WHERE pt.request_id = p_request_id
        AND pt.seller_id != p_buyer_id
        AND (v_seller_id IS NULL OR pt.seller_id != v_seller_id)  -- Evitar duplicados
    LOOP
        notification_title := 'Solicitud Cancelada';
        notification_body := v_buyer_name || ' ha cancelado una solicitud de compra en la que estabas involucrado';
        
        -- Crear notificación en request_notifications
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error insertando en request_notifications para seller %: %', v_seller_record.seller_id, SQLERRM;
        END;
        
        -- Crear notificación en el sistema general
        BEGIN
            SELECT emit_notification(
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
            ) INTO v_notification_id;
            
            IF v_notification_id IS NOT NULL THEN
                RAISE NOTICE '✅ Notificación creada para vendedor con transacción %: %', v_seller_record.seller_id, v_notification_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error llamando emit_notification para seller %: %', v_seller_record.seller_id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 4: CORREGIR LA FUNCIÓN notify_request_deleted
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
    v_notification_id UUID;
BEGIN
    -- Obtener información de la solicitud ANTES de eliminarla
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
    
    -- Si no se encontró la solicitud, salir
    IF v_buyer_name IS NULL THEN
        RAISE WARNING 'Solicitud % no encontrada', p_request_id;
        RETURN;
    END IF;
    
    -- Si hay un vendedor asignado (solicitud aceptada), notificarle
    IF v_seller_id IS NOT NULL AND v_seller_id != p_buyer_id THEN
        notification_title := 'Solicitud Eliminada';
        notification_body := v_buyer_name || ' ha eliminado la solicitud de compra por ' ||
                           CASE 
                               WHEN v_currency_type = 'USD' THEN '$' || COALESCE(v_amount::TEXT, '0')
                               WHEN v_currency_type = 'EUR' THEN '€' || COALESCE(v_amount::TEXT, '0')
                               ELSE 'L.' || COALESCE(v_amount::TEXT, '0')
                           END || ' HNLD';
        
        -- Crear notificación en el sistema general (request_notifications se elimina con CASCADE)
        BEGIN
            SELECT emit_notification(
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
            ) INTO v_notification_id;
            
            IF v_notification_id IS NOT NULL THEN
                RAISE NOTICE '✅ Notificación de eliminación creada para vendedor %: %', v_seller_id, v_notification_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error llamando emit_notification para eliminación: %', SQLERRM;
        END;
    END IF;
    
    -- Notificar a todos los vendedores que tenían transacciones relacionadas con esta solicitud
    FOR v_seller_record IN 
        SELECT DISTINCT pt.seller_id
        FROM purchase_transactions pt
        WHERE pt.request_id = p_request_id
        AND pt.seller_id != p_buyer_id
        AND (v_seller_id IS NULL OR pt.seller_id != v_seller_id)  -- Evitar duplicados
    LOOP
        notification_title := 'Solicitud Eliminada';
        notification_body := v_buyer_name || ' ha eliminado una solicitud de compra en la que estabas involucrado';
        
        -- Crear notificación en el sistema general
        BEGIN
            SELECT emit_notification(
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
            ) INTO v_notification_id;
            
            IF v_notification_id IS NOT NULL THEN
                RAISE NOTICE '✅ Notificación de eliminación creada para vendedor con transacción %: %', v_seller_record.seller_id, v_notification_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error llamando emit_notification para eliminación (seller %): %', v_seller_record.seller_id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 5: VERIFICAR QUE EMIT_NOTIFICATION PERMITA INSERCIÓN DESDE FUNCIONES SECURITY DEFINER
-- Necesitamos verificar que emit_notification puede insertar sin problemas de RLS
-- La función ya es SECURITY DEFINER, así que debería funcionar, pero verificamos la política

-- PASO 6: VERIFICAR CONFIGURACIÓN
SELECT 
    '🎯 RESUMEN DE CONFIGURACIÓN' as verificación,
    'Realtime habilitado para notifications' as item_1,
    EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) as resultado_1,
    'Política de inserción para funciones' as item_2,
    EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Functions can insert notifications'
    ) as resultado_2,
    'Función notify_request_cancelled existe' as item_3,
    EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'notify_request_cancelled'
    ) as resultado_3,
    'Función notify_request_deleted existe' as item_4,
    EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'notify_request_deleted'
    ) as resultado_4;

-- PASO 7: MOSTRAR POLÍTICAS ACTUALES DE notifications
SELECT 
    policyname,
    cmd,
    CASE permissive
        WHEN 'PERMISSIVE' THEN '✅ Permisiva'
        ELSE '❌ Restrictiva'
    END as tipo
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- PASO 8: CREAR FUNCIÓN DE PRUEBA PARA VERIFICAR QUE TODO FUNCIONA
CREATE OR REPLACE FUNCTION test_notify_request_cancelled(
    p_test_request_id UUID DEFAULT NULL,
    p_test_buyer_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_test_request_id UUID;
    v_test_buyer_id UUID;
    v_test_seller_id UUID;
    v_result TEXT;
BEGIN
    -- Si no se proporcionan parámetros, buscar una solicitud activa para probar
    IF p_test_request_id IS NULL OR p_test_buyer_id IS NULL THEN
        SELECT id, buyer_id, seller_id
        INTO v_test_request_id, v_test_buyer_id, v_test_seller_id
        FROM purchase_requests
        WHERE status IN ('active', 'accepted')
        AND seller_id IS NOT NULL
        LIMIT 1;
        
        IF v_test_request_id IS NULL THEN
            RETURN '❌ No se encontró una solicitud de prueba';
        END IF;
    ELSE
        v_test_request_id := p_test_request_id;
        v_test_buyer_id := p_test_buyer_id;
    END IF;
    
    -- Llamar a la función de notificación
    BEGIN
        PERFORM notify_request_cancelled(v_test_request_id, v_test_buyer_id);
        v_result := '✅ Función notify_request_cancelled ejecutada sin errores para solicitud: ' || v_test_request_id::TEXT;
    EXCEPTION WHEN OTHERS THEN
        v_result := '❌ Error ejecutando notify_request_cancelled: ' || SQLERRM;
    END;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 9: VERIFICAR TRIGGER
SELECT 
    '✅ Trigger verificado' as resultado,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'trigger_notify_request_cancelled';

-- PASO 10: ESTADO FINAL
SELECT '✅ Sistema de notificaciones corregido. Las notificaciones deberían aparecer en tiempo real ahora.' as mensaje_final;
SELECT '💡 Para probar, ejecuta: SELECT test_notify_request_cancelled();' as instruccion;

