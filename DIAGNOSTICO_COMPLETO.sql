-- =========================================================
-- NMHN - DIAGNÓSTICO COMPLETO DEL PROBLEMA
-- =========================================================
-- Script para diagnosticar exactamente qué está fallando
-- =========================================================

-- 1. Verificar si existe la función generate_unique_code_safe
SELECT 
    'FUNCIÓN generate_unique_code_safe' as estado,
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name = 'generate_unique_code_safe'
AND routine_schema = 'public';

-- 2. Verificar si existe la función create_purchase_request
SELECT 
    'FUNCIÓN create_purchase_request' as estado,
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name = 'create_purchase_request'
AND routine_schema = 'public';

-- 3. Probar la función generate_unique_code_safe directamente
SELECT generate_unique_code_safe() as codigo_generado;

-- 4. Verificar la estructura de la tabla purchase_requests
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'purchase_requests'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Probar crear una solicitud con parámetros mínimos
SELECT * FROM create_purchase_request(
    '00000000-0000-0000-0000-000000000000'::UUID,  -- buyer_id
    100.00,                                        -- amount
    'Prueba',                                      -- description
    7,                                             -- expires_in_days
    'local_transfer',                              -- payment_method
    'Banco Atlántida',                             -- bank_name
    NULL, NULL, NULL, NULL,                        -- otros campos opcionales
    'L', 100.00, 1.0000,                          -- currency, amount_original, exchange_rate
    NULL, NULL, 100.00,                           -- fees y final_amount
    NULL, 'pending'                               -- reference y status
);

-- 6. Verificar si hay datos en purchase_requests
SELECT 
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as activas,
    COUNT(CASE WHEN unique_code IS NOT NULL THEN 1 END) as con_codigo
FROM purchase_requests;

-- 7. Mostrar las últimas solicitudes creadas
SELECT 
    id,
    buyer_id,
    amount,
    description,
    status,
    unique_code,
    payment_method,
    created_at
FROM purchase_requests 
ORDER BY created_at DESC 
LIMIT 5;

-- 8. Verificar permisos RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'purchase_requests'
ORDER BY policyname;

-- 9. Crear función de prueba simple
CREATE OR REPLACE FUNCTION test_create_request()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    test_code TEXT;
    test_result RECORD;
BEGIN
    -- Probar generación de código
    test_code := generate_unique_code_safe();
    
    -- Probar inserción directa
    INSERT INTO purchase_requests (
        buyer_id,
        amount,
        description,
        currency_type,
        payment_method,
        exchange_rate,
        expires_at,
        unique_code,
        payment_status
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID,
        50.00,
        'Prueba directa',
        'L',
        'local_transfer',
        1.0000,
        NOW() + INTERVAL '7 days',
        test_code,
        'pending'
    ) RETURNING id, unique_code INTO test_result;
    
    RETURN 'ÉXITO: ID=' || test_result.id || ', Código=' || test_result.unique_code;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$$;

-- 10. Ejecutar prueba
SELECT test_create_request() as resultado_prueba;

-- 11. Limpiar función de prueba
DROP FUNCTION IF EXISTS test_create_request();

-- =========================================================
-- RESUMEN DEL DIAGNÓSTICO
-- =========================================================
/*
DIAGNÓSTICO COMPLETADO:

Este script verifica:
1. ✅ Existencia de funciones necesarias
2. ✅ Generación de códigos únicos
3. ✅ Estructura de la tabla
4. ✅ Creación de solicitudes
5. ✅ Datos existentes
6. ✅ Permisos RLS
7. ✅ Prueba de inserción directa

EJECUTAR ESTE SCRIPT PARA VER EXACTAMENTE QUÉ ESTÁ FALLANDO
*/
-- =========================================================
-- FIN DEL DIAGNÓSTICO
-- =========================================================

