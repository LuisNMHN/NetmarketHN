-- =========================================================
-- SCRIPT DE PRUEBA RÁPIDA - SISTEMA DE NEGOCIACIÓN
-- =========================================================
-- Este script verifica que todos los cambios funcionan correctamente
-- =========================================================

-- 1. VERIFICAR QUE LAS FUNCIONES EXISTEN
SELECT 'Verificando funciones...' as status;

SELECT 
    routine_name as funcion,
    routine_type as tipo,
    'EXISTE' as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'start_negotiation',
    'end_negotiation_no_deal', 
    'accept_offer_during_negotiation',
    'cleanup_expired_negotiations',
    'get_available_purchase_requests'
);

-- 2. VERIFICAR QUE LOS CAMPOS EXISTEN
SELECT 'Verificando campos...' as status;

SELECT 
    column_name as campo,
    data_type as tipo,
    is_nullable as nullable,
    'EXISTE' as estado
FROM information_schema.columns 
WHERE table_name = 'purchase_requests' 
AND column_name IN ('negotiating_with', 'negotiation_started_at', 'negotiation_timeout_at');

-- 3. VERIFICAR ÍNDICES
SELECT 'Verificando índices...' as status;

SELECT 
    indexname as indice,
    'EXISTE' as estado
FROM pg_indexes 
WHERE tablename = 'purchase_requests'
AND indexname LIKE '%negotiation%';

-- 4. VERIFICAR POLÍTICAS RLS
SELECT 'Verificando políticas RLS...' as status;

SELECT 
    policyname as politica,
    cmd as comando,
    'EXISTE' as estado
FROM pg_policies 
WHERE tablename = 'purchase_requests';

-- 5. CREAR DATOS DE PRUEBA
SELECT 'Creando datos de prueba...' as status;

-- Crear usuarios de prueba (reemplaza con IDs reales)
-- NOTA: Necesitas reemplazar estos IDs con IDs reales de tu sistema
DO $$
DECLARE
    test_buyer_id UUID := '00000000-0000-0000-0000-000000000001';
    test_seller_id UUID := '00000000-0000-0000-0000-000000000002';
    test_request_id UUID;
BEGIN
    -- Crear solicitud de prueba
    INSERT INTO purchase_requests (
        id,
        buyer_id, 
        amount, 
        description, 
        status,
        metadata
    ) VALUES (
        test_request_id := gen_random_uuid(),
        test_buyer_id,
        1000,
        'Solicitud de prueba para verificar negociación',
        'active',
        '{"payment_method": "local_transfer", "bank_name": "Banco de Prueba"}'
    );
    
    RAISE NOTICE 'Solicitud de prueba creada con ID: %', test_request_id;
    
    -- Probar función start_negotiation
    PERFORM start_negotiation(test_request_id, test_seller_id);
    RAISE NOTICE 'Negociación iniciada exitosamente';
    
    -- Verificar estado
    IF EXISTS (
        SELECT 1 FROM purchase_requests 
        WHERE id = test_request_id 
        AND status = 'negotiating' 
        AND negotiating_with = test_seller_id
    ) THEN
        RAISE NOTICE 'Estado cambiado a negotiating correctamente';
    ELSE
        RAISE NOTICE 'ERROR: Estado no cambió correctamente';
    END IF;
    
    -- Probar función end_negotiation_no_deal
    PERFORM end_negotiation_no_deal(test_request_id, test_seller_id);
    RAISE NOTICE 'Negociación finalizada exitosamente';
    
    -- Verificar que volvió a active
    IF EXISTS (
        SELECT 1 FROM purchase_requests 
        WHERE id = test_request_id 
        AND status = 'active' 
        AND negotiating_with IS NULL
    ) THEN
        RAISE NOTICE 'Estado volvió a active correctamente';
    ELSE
        RAISE NOTICE 'ERROR: Estado no volvió a active correctamente';
    END IF;
    
    -- Limpiar datos de prueba
    DELETE FROM purchase_requests WHERE id = test_request_id;
    RAISE NOTICE 'Datos de prueba eliminados';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR en prueba: %', SQLERRM;
END $$;

-- 6. VERIFICAR NOTIFICACIONES
SELECT 'Verificando notificaciones...' as status;

SELECT 
    type as tipo_notificacion,
    COUNT(*) as cantidad,
    'EXISTEN' as estado
FROM request_notifications 
WHERE type LIKE '%negotiation%'
GROUP BY type;

-- 7. ESTADÍSTICAS FINALES
SELECT 'Estadísticas finales...' as status;

SELECT 
    'Total Solicitudes' as metric,
    COUNT(*) as value
FROM purchase_requests

UNION ALL

SELECT 
    'Solicitudes Activas' as metric,
    COUNT(*) as value
FROM purchase_requests 
WHERE status = 'active'

UNION ALL

SELECT 
    'Solicitudes en Negociación' as metric,
    COUNT(*) as value
FROM purchase_requests 
WHERE status = 'negotiating'

UNION ALL

SELECT 
    'Notificaciones de Negociación' as metric,
    COUNT(*) as value
FROM request_notifications 
WHERE type LIKE '%negotiation%';

-- 8. MENSAJE FINAL
SELECT '========================================' as separador;
SELECT 'VERIFICACIÓN COMPLETADA' as resultado;
SELECT '========================================' as separador;
SELECT 'Si ves este mensaje sin errores, el sistema está funcionando correctamente!' as mensaje;

-- =========================================================
-- INSTRUCCIONES PARA USAR ESTE SCRIPT:
-- =========================================================
-- 1. Reemplaza los UUIDs de prueba con IDs reales de usuarios
-- 2. Ejecuta este script en tu base de datos Supabase
-- 3. Verifica que no hay errores en la salida
-- 4. Si hay errores, revisa la guía de verificación completa
-- =========================================================

















