-- =========================================================
-- SCRIPT DE VERIFICACIÓN: LISTAR RASTROS DE LINKS DE PAGO
-- =========================================================
-- Este script SOLO LISTA lo que se eliminaría, sin eliminar nada
-- Ejecuta este script primero para revisar qué se encontró
-- =========================================================

-- =========================================================
-- VERIFICAR TABLAS
-- =========================================================
SELECT 
    'TABLA' as tipo,
    table_name as nombre,
    'DROP TABLE IF EXISTS ' || table_name || ' CASCADE;' as comando_eliminacion
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
      table_name LIKE '%payment_link%'
      OR table_name LIKE '%pay_link%'
      OR table_name LIKE '%paylink%'
  )
ORDER BY table_name;

-- =========================================================
-- VERIFICAR FUNCIONES
-- =========================================================
SELECT 
    'FUNCIÓN' as tipo,
    p.proname as nombre,
    'DROP FUNCTION IF EXISTS ' || p.proname || '(' || 
    pg_get_function_arguments(p.oid) || ') CASCADE;' as comando_eliminacion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
      p.proname LIKE '%payment_link%'
      OR p.proname LIKE '%pay_link%'
      OR p.proname LIKE '%paylink%'
  )
ORDER BY p.proname;

-- =========================================================
-- VERIFICAR POLÍTICAS RLS
-- =========================================================
SELECT 
    'POLÍTICA RLS' as tipo,
    schemaname || '.' || tablename || '.' || policyname as nombre,
    'DROP POLICY IF EXISTS ' || policyname || ' ON ' || 
    schemaname || '.' || tablename || ' CASCADE;' as comando_eliminacion
FROM pg_policies
WHERE tablename LIKE '%payment_link%'
   OR tablename LIKE '%pay_link%'
   OR tablename LIKE '%paylink%'
   OR policyname LIKE '%payment_link%'
   OR policyname LIKE '%pay_link%'
   OR policyname LIKE '%paylink%'
ORDER BY schemaname, tablename, policyname;

-- =========================================================
-- VERIFICAR TRIGGERS
-- =========================================================
SELECT 
    'TRIGGER' as tipo,
    trigger_schema || '.' || event_object_table || '.' || trigger_name as nombre,
    'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON ' || 
    trigger_schema || '.' || event_object_table || ' CASCADE;' as comando_eliminacion
FROM information_schema.triggers
WHERE trigger_name LIKE '%payment_link%'
   OR trigger_name LIKE '%pay_link%'
   OR trigger_name LIKE '%paylink%'
   OR event_object_table LIKE '%payment_link%'
   OR event_object_table LIKE '%pay_link%'
   OR event_object_table LIKE '%paylink%'
ORDER BY trigger_schema, event_object_table, trigger_name;

-- =========================================================
-- VERIFICAR VISTAS
-- =========================================================
SELECT 
    'VISTA' as tipo,
    table_name as nombre,
    'DROP VIEW IF EXISTS ' || table_name || ' CASCADE;' as comando_eliminacion
FROM information_schema.views
WHERE table_schema = 'public'
  AND (
      table_name LIKE '%payment_link%'
      OR table_name LIKE '%pay_link%'
      OR table_name LIKE '%paylink%'
  )
ORDER BY table_name;

-- =========================================================
-- VERIFICAR TIPOS PERSONALIZADOS
-- =========================================================
SELECT 
    'TIPO' as tipo,
    typname as nombre,
    'DROP TYPE IF EXISTS ' || typname || ' CASCADE;' as comando_eliminacion
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
  AND (
      typname LIKE '%payment_link%'
      OR typname LIKE '%pay_link%'
      OR typname LIKE '%paylink%'
  )
  AND typtype = 'c' -- Solo tipos compuestos
ORDER BY typname;

-- =========================================================
-- VERIFICAR SECUENCIAS
-- =========================================================
SELECT 
    'SECUENCIA' as tipo,
    sequence_name as nombre,
    'DROP SEQUENCE IF EXISTS ' || sequence_name || ' CASCADE;' as comando_eliminacion
FROM information_schema.sequences
WHERE sequence_schema = 'public'
  AND (
      sequence_name LIKE '%payment_link%'
      OR sequence_name LIKE '%pay_link%'
      OR sequence_name LIKE '%paylink%'
  )
ORDER BY sequence_name;

-- =========================================================
-- RESUMEN
-- =========================================================
SELECT 
    'RESUMEN' as tipo,
    COUNT(*) as total_encontrado,
    'Revisa los resultados anteriores' as mensaje
FROM (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE '%payment_link%' OR table_name LIKE '%pay_link%' OR table_name LIKE '%paylink%')
    
    UNION ALL
    
    SELECT p.proname::text FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (p.proname LIKE '%payment_link%' OR p.proname LIKE '%pay_link%' OR p.proname LIKE '%paylink%')
    
    UNION ALL
    
    SELECT policyname::text FROM pg_policies
    WHERE policyname LIKE '%payment_link%' OR policyname LIKE '%pay_link%' OR policyname LIKE '%paylink%'
    
    UNION ALL
    
    SELECT trigger_name::text FROM information_schema.triggers
    WHERE trigger_name LIKE '%payment_link%' OR trigger_name LIKE '%pay_link%' OR trigger_name LIKE '%paylink%'
    
    UNION ALL
    
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public'
      AND (table_name LIKE '%payment_link%' OR table_name LIKE '%pay_link%' OR table_name LIKE '%paylink%')
) as todos;

