-- =========================================================
-- NMHN - PRUEBA DEL SISTEMA DE NOTIFICACIONES EN TIEMPO REAL
-- =========================================================
-- Script para probar las notificaciones de solicitudes de compra
-- =========================================================

-- =========================================================
-- PASO 1: VERIFICAR CONFIGURACIÓN
-- =========================================================

-- Verificar que el trigger existe
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
WHERE routine_name IN ('notify_new_purchase_request', 'notify_all_users_except', 'emit_notification')
AND routine_schema = 'public';

-- Verificar que realtime está habilitado
SELECT schemaname, tablename, hasindexes, hasrules, hastriggers 
FROM pg_tables 
WHERE tablename = 'notifications';

-- =========================================================
-- PASO 2: LIMPIAR NOTIFICACIONES DE PRUEBA ANTERIORES
-- =========================================================

-- Eliminar notificaciones de prueba anteriores
DELETE FROM notifications 
WHERE dedupe_key LIKE 'purchase_request_TEST-%' 
OR dedupe_key LIKE 'TEST-%';

-- Eliminar solicitudes de prueba anteriores
DELETE FROM purchase_requests 
WHERE unique_code LIKE 'TEST-%' 
OR description LIKE '%prueba para notificaciones%';

-- =========================================================
-- PASO 3: CREAR SOLICITUD DE PRUEBA
-- =========================================================

-- Obtener un usuario de prueba
DO $$
DECLARE
    test_user_id UUID;
    test_request_id UUID;
    notification_count INTEGER;
    result_text TEXT;
BEGIN
    -- Obtener el primer usuario disponible
    SELECT id INTO test_user_id 
    FROM auth.users 
    WHERE email_confirmed_at IS NOT NULL 
    AND deleted_at IS NULL
    LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'Error: No hay usuarios disponibles para la prueba';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usuario de prueba: %', test_user_id;
    
    -- Crear una solicitud de prueba
    INSERT INTO purchase_requests (
        buyer_id,
        amount,
        description,
        status,
        expires_at,
        payment_method,
        unique_code,
        currency_type,
        amount_in_original_currency
    ) VALUES (
        test_user_id,
        250.00,
        'Solicitud de prueba para notificaciones en tiempo real',
        'active',
        NOW() + INTERVAL '24 hours',
        'local_transfer',
        'TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        'L',
        250.00
    ) RETURNING id INTO test_request_id;
    
    RAISE NOTICE 'Solicitud creada: %', test_request_id;
    
    -- Esperar un momento para que se procese el trigger
    PERFORM pg_sleep(1);
    
    -- Verificar que se crearon notificaciones
    SELECT COUNT(*) INTO notification_count
    FROM notifications 
    WHERE dedupe_key LIKE 'purchase_request_' || test_request_id::TEXT || '%';
    
    RAISE NOTICE 'Notificaciones creadas: %', notification_count;
    
    -- Mostrar detalles de las notificaciones
    RAISE NOTICE 'Detalles de las notificaciones:';
    FOR result_text IN 
        SELECT 'Usuario: ' || user_id || ', Título: ' || title || ', Evento: ' || event
        FROM notifications 
        WHERE dedupe_key LIKE 'purchase_request_' || test_request_id::TEXT || '%'
        LIMIT 5
    LOOP
        RAISE NOTICE '%', result_text;
    END LOOP;
    
    -- Limpiar la solicitud de prueba
    DELETE FROM purchase_requests WHERE id = test_request_id;
    RAISE NOTICE 'Solicitud de prueba eliminada';
    
END $$;

-- =========================================================
-- PASO 4: VERIFICAR ESTADO FINAL
-- =========================================================

-- Mostrar estadísticas de notificaciones
SELECT 
    COUNT(*) as total_notificaciones,
    COUNT(*) FILTER (WHERE status = 'unread') as no_leidas,
    COUNT(*) FILTER (WHERE event = 'PURCHASE_REQUEST_CREATED') as solicitudes_compra,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as ultima_hora
FROM notifications;

-- Mostrar las últimas notificaciones
SELECT 
    id,
    user_id,
    title,
    event,
    status,
    created_at,
    dedupe_key
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;

-- =========================================================
-- PASO 5: PRUEBA MANUAL ADICIONAL
-- =========================================================

-- Función para crear una solicitud de prueba manual
CREATE OR REPLACE FUNCTION crear_solicitud_prueba_notificaciones()
RETURNS TEXT AS $$
DECLARE
    test_user_id UUID;
    test_request_id UUID;
    notification_count INTEGER;
    result_text TEXT;
BEGIN
    -- Obtener un usuario de prueba
    SELECT id INTO test_user_id 
    FROM auth.users 
    WHERE email_confirmed_at IS NOT NULL 
    AND deleted_at IS NULL
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
        unique_code,
        currency_type,
        amount_in_original_currency
    ) VALUES (
        test_user_id,
        500.00,
        'Prueba manual de notificaciones - ' || NOW()::TEXT,
        'active',
        NOW() + INTERVAL '24 hours',
        'international_transfer',
        'MANUAL-TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        'USD',
        500.00
    ) RETURNING id INTO test_request_id;
    
    -- Esperar un momento
    PERFORM pg_sleep(1);
    
    -- Contar notificaciones creadas
    SELECT COUNT(*) INTO notification_count
    FROM notifications 
    WHERE dedupe_key LIKE 'purchase_request_' || test_request_id::TEXT || '%';
    
    result_text := 'Solicitud creada: ' || test_request_id::TEXT || 
                   '. Notificaciones enviadas: ' || notification_count::TEXT;
    
    -- Limpiar
    DELETE FROM purchase_requests WHERE id = test_request_id;
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- INSTRUCCIONES DE PRUEBA
-- =========================================================

/*
INSTRUCCIONES PARA PROBAR EL SISTEMA:

1. Ejecutar este script completo para verificar la configuración
2. Para pruebas manuales adicionales, ejecutar:
   SELECT crear_solicitud_prueba_notificaciones();

3. Verificar en el frontend:
   - Abrir dos navegadores con diferentes usuarios
   - Crear una solicitud en uno
   - Verificar que aparece la notificación en el otro

4. Verificar en tiempo real:
   - Las notificaciones deben aparecer instantáneamente
   - Los toasts deben mostrarse con el estilo verde
   - El componente PurchaseRequestNotification debe aparecer

5. Verificar en la base de datos:
   - Las notificaciones se crean en la tabla notifications
   - El dedupe_key es único por usuario
   - Las notificaciones expiran con la solicitud

RESULTADO ESPERADO:
- ✅ Trigger funciona correctamente
- ✅ Notificaciones se crean para todos los usuarios excepto el creador
- ✅ Realtime funciona en el frontend
- ✅ Toasts aparecen con estilo personalizado
- ✅ Componente de notificación aparece en la esquina superior derecha
*/
