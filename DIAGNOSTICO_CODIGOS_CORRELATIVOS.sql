-- =========================================================
-- NMHN - DIAGNÓSTICO PROFUNDO DE CÓDIGOS CORRELATIVOS
-- =========================================================
-- Script para verificar exactamente cómo están funcionando los códigos
-- =========================================================

-- 1. Verificar función actual de generación de códigos
SELECT 
    'FUNCIÓN ACTUAL' as estado,
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'generate_unique_code_safe'
AND routine_schema = 'public';

-- 2. Verificar códigos existentes en la base de datos
SELECT 
    'CÓDIGOS EXISTENTES' as estado,
    unique_code,
    created_at,
    payment_method,
    amount
FROM purchase_requests 
WHERE unique_code IS NOT NULL
ORDER BY created_at DESC;

-- 3. Analizar patrones de códigos por día
SELECT 
    'ANÁLISIS POR DÍA' as estado,
    SUBSTRING(unique_code FROM 6 FOR 6) as fecha,
    COUNT(*) as cantidad_codigos,
    MIN(SUBSTRING(unique_code FROM 13)) as primer_codigo,
    MAX(SUBSTRING(unique_code FROM 13)) as ultimo_codigo,
    STRING_AGG(SUBSTRING(unique_code FROM 13), ', ' ORDER BY created_at) as secuencia_codigos
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-%'
GROUP BY SUBSTRING(unique_code FROM 6 FOR 6)
ORDER BY fecha DESC;

-- 4. Verificar si hay códigos duplicados
SELECT 
    'CÓDIGOS DUPLICADOS' as estado,
    unique_code,
    COUNT(*) as repeticiones
FROM purchase_requests 
WHERE unique_code IS NOT NULL
GROUP BY unique_code
HAVING COUNT(*) > 1;

-- 5. Probar generación de códigos múltiples veces
SELECT 
    'PRUEBA GENERACIÓN' as estado,
    generate_unique_code_safe() as codigo_1,
    generate_unique_code_safe() as codigo_2,
    generate_unique_code_safe() as codigo_3;

-- 6. Verificar lógica de numeración por día
SELECT 
    'LÓGICA NUMERACIÓN' as estado,
    TO_CHAR(NOW(), 'YYMMDD') as fecha_hoy,
    COALESCE(MAX(CAST(SUBSTRING(unique_code FROM 15) AS INTEGER)), 0) as max_numero_hoy,
    COALESCE(MAX(CAST(SUBSTRING(unique_code FROM 15) AS INTEGER)), 0) + 1 as siguiente_numero
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-' || TO_CHAR(NOW(), 'YYMMDD') || '-%';

-- 7. Crear función de prueba para verificar lógica
CREATE OR REPLACE FUNCTION test_code_generation()
RETURNS TABLE (
    fecha TEXT,
    max_existente INTEGER,
    siguiente_generado INTEGER,
    codigo_generado TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    today_date TEXT;
    max_number INTEGER;
    next_number INTEGER;
    generated_code TEXT;
BEGIN
    -- Obtener fecha actual
    today_date := TO_CHAR(NOW(), 'YYMMDD');
    
    -- Obtener máximo número existente para hoy
    SELECT COALESCE(MAX(CAST(SUBSTRING(unique_code FROM 15) AS INTEGER)), 0)
    INTO max_number
    FROM purchase_requests
    WHERE unique_code LIKE 'NMHN-' || today_date || '-%';
    
    -- Calcular siguiente número
    next_number := max_number + 1;
    
    -- Generar código
    generated_code := 'NMHN-' || today_date || '-' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN QUERY SELECT today_date, max_number, next_number, generated_code;
END;
$$;

-- 8. Ejecutar prueba de lógica
SELECT * FROM test_code_generation();

-- 9. Limpiar función de prueba
DROP FUNCTION IF EXISTS test_code_generation();

-- 10. Verificar si hay problemas con la función actual
SELECT 
    'PROBLEMA IDENTIFICADO' as estado,
    CASE 
        WHEN COUNT(*) = 0 THEN 'No hay códigos generados'
        WHEN COUNT(DISTINCT SUBSTRING(unique_code FROM 13)) != COUNT(*) THEN 'Hay códigos duplicados'
        WHEN MAX(CAST(SUBSTRING(unique_code FROM 13) AS INTEGER)) != COUNT(*) THEN 'Numeración no secuencial'
        ELSE 'Lógica correcta'
    END as diagnostico
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-' || TO_CHAR(NOW(), 'YYMMDD') || '-%';

-- =========================================================
-- RESUMEN DEL DIAGNÓSTICO
-- =========================================================
/*
DIAGNÓSTICO COMPLETADO:

Este script verifica:
1. ✅ Función actual de generación
2. ✅ Códigos existentes en la base de datos
3. ✅ Patrones por día
4. ✅ Códigos duplicados
5. ✅ Prueba de generación múltiple
6. ✅ Lógica de numeración
7. ✅ Identificación de problemas

EJECUTAR ESTE SCRIPT PARA VER EXACTAMENTE QUÉ ESTÁ FALLANDO
*/
-- =========================================================
-- FIN DEL DIAGNÓSTICO
-- =========================================================
