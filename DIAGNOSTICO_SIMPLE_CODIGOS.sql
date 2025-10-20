-- =========================================================
-- NMHN - DIAGNÓSTICO SIMPLE DE CÓDIGOS CORRELATIVOS
-- =========================================================
-- Script simple para verificar códigos correlativos sin problemas de sintaxis
-- =========================================================

-- 1. Verificar códigos existentes en la base de datos
SELECT 
    'CÓDIGOS EXISTENTES' as estado,
    unique_code,
    created_at,
    payment_method,
    amount
FROM purchase_requests 
WHERE unique_code IS NOT NULL
ORDER BY created_at DESC;

-- 2. Analizar códigos por día (versión simple)
SELECT 
    'ANÁLISIS POR DÍA' as estado,
    SUBSTRING(unique_code FROM 6 FOR 6) as fecha,
    COUNT(*) as cantidad_codigos,
    MIN(SUBSTRING(unique_code FROM 13)) as primer_codigo,
    MAX(SUBSTRING(unique_code FROM 13)) as ultimo_codigo
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-%'
GROUP BY SUBSTRING(unique_code FROM 6 FOR 6)
ORDER BY fecha DESC;

-- 3. Verificar si hay códigos duplicados
SELECT 
    'CÓDIGOS DUPLICADOS' as estado,
    unique_code,
    COUNT(*) as repeticiones
FROM purchase_requests 
WHERE unique_code IS NOT NULL
GROUP BY unique_code
HAVING COUNT(*) > 1;

-- 4. Verificar códigos de hoy específicamente
SELECT 
    'CÓDIGOS DE HOY' as estado,
    unique_code,
    SUBSTRING(unique_code FROM 13) as numero,
    created_at,
    payment_method
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-' || TO_CHAR(NOW(), 'YYMMDD') || '-%'
ORDER BY CAST(SUBSTRING(unique_code FROM 13) AS INTEGER);

-- 5. Verificar lógica de numeración por día
SELECT 
    'LÓGICA NUMERACIÓN' as estado,
    TO_CHAR(NOW(), 'YYMMDD') as fecha_hoy,
    COALESCE(MAX(CAST(SUBSTRING(unique_code FROM 15) AS INTEGER)), 0) as max_numero_hoy,
    COALESCE(MAX(CAST(SUBSTRING(unique_code FROM 15) AS INTEGER)), 0) + 1 as siguiente_numero
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-' || TO_CHAR(NOW(), 'YYMMDD') || '-%';

-- 6. Probar generación de códigos múltiples veces
SELECT 
    'PRUEBA GENERACIÓN' as estado,
    generate_unique_code_safe() as codigo_1,
    generate_unique_code_safe() as codigo_2,
    generate_unique_code_safe() as codigo_3;

-- 7. Verificar si hay problemas con la función actual
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

-- 8. Mostrar secuencia de códigos de hoy
SELECT 
    'SECUENCIA HOY' as estado,
    ROW_NUMBER() OVER (ORDER BY CAST(SUBSTRING(unique_code FROM 13) AS INTEGER)) as posicion,
    SUBSTRING(unique_code FROM 13) as numero,
    unique_code,
    created_at
FROM purchase_requests 
WHERE unique_code LIKE 'NMHN-' || TO_CHAR(NOW(), 'YYMMDD') || '-%'
ORDER BY CAST(SUBSTRING(unique_code FROM 13) AS INTEGER);

-- =========================================================
-- RESUMEN DEL DIAGNÓSTICO SIMPLE
-- =========================================================
/*
DIAGNÓSTICO SIMPLE COMPLETADO:

Este script verifica:
1. ✅ Códigos existentes en la base de datos
2. ✅ Análisis por día (sin problemas de sintaxis)
3. ✅ Códigos duplicados
4. ✅ Códigos de hoy específicamente
5. ✅ Lógica de numeración
6. ✅ Prueba de generación múltiple
7. ✅ Identificación de problemas
8. ✅ Secuencia de códigos de hoy

SIN PROBLEMAS DE SINTAXIS
*/
-- =========================================================
-- FIN DEL DIAGNÓSTICO SIMPLE
-- =========================================================

