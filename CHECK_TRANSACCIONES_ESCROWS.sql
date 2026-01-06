-- =========================================================
-- SCRIPT DE VERIFICACIÓN: LISTAR RASTROS DE TRANSACCIONES (ESCROWS)
-- =========================================================
-- Este script SOLO LISTA lo que se eliminaría, sin eliminar nada
-- Ejecuta este script primero para revisar qué se encontró
-- =========================================================
-- IMPORTANTE: Este script busca específicamente el módulo de ESCROWS
-- NO afecta purchase_transactions ni el historial de Balance HNLD
-- =========================================================

-- =========================================================
-- VERIFICAR TABLAS RELACIONADAS CON ESCROWS
-- =========================================================
SELECT 
    'TABLA' as tipo,
    table_name as nombre,
    'DROP TABLE IF EXISTS ' || table_name || ' CASCADE;' as comando_eliminacion
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
      table_name LIKE '%escrow%'
      OR table_name LIKE '%escrow_%'
      OR (table_name LIKE '%transaction%' AND table_name NOT LIKE '%purchase_transaction%' AND table_name NOT LIKE '%navp%')
  )
  AND table_name NOT IN (
      -- Excluir tablas del sistema de compras
      'purchase_transactions',
      'transaction_steps',
      'transaction_documents',
      'transaction_disputes',
      'transaction_notifications',
      -- Excluir tablas de Balance HNLD
      'hnld_transactions',
      'hnld_ledger',
      'direct_transfers'
  )
ORDER BY table_name;

-- =========================================================
-- VERIFICAR FUNCIONES RELACIONADAS CON ESCROWS
-- =========================================================
SELECT 
    'FUNCIÓN' as tipo,
    p.proname as nombre,
    'DROP FUNCTION IF EXISTS ' || p.proname || 
    CASE 
        WHEN COALESCE(pg_get_function_identity_arguments(p.oid), '') = '' THEN '()'
        ELSE '(' || pg_get_function_identity_arguments(p.oid) || ')'
    END || ' CASCADE;' as comando_eliminacion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
      p.proname LIKE '%escrow%'
      OR (p.proname LIKE '%transaction%' 
          AND p.proname NOT LIKE '%purchase%'
          AND p.proname NOT LIKE '%navp%'
          AND p.proname NOT LIKE '%hnld%'
          AND p.proname NOT LIKE '%direct_transfer%')
  )
ORDER BY p.proname;

-- =========================================================
-- VERIFICAR POLÍTICAS RLS RELACIONADAS
-- =========================================================
SELECT 
    'POLÍTICA RLS' as tipo,
    schemaname || '.' || tablename || '.' || policyname as nombre,
    'DROP POLICY IF EXISTS ' || policyname || ' ON ' || 
    schemaname || '.' || tablename || ' CASCADE;' as comando_eliminacion
FROM pg_policies
WHERE (
    tablename LIKE '%escrow%'
    OR policyname LIKE '%escrow%'
    OR (tablename LIKE '%transaction%' 
        AND tablename NOT LIKE '%purchase_transaction%'
        AND tablename NOT LIKE '%navp%'
        AND tablename NOT LIKE '%hnld%'
        AND tablename NOT LIKE '%direct_transfer%')
    OR (policyname LIKE '%transaction%' 
        AND policyname NOT LIKE '%purchase%'
        AND policyname NOT LIKE '%navp%'
        AND policyname NOT LIKE '%hnld%')
)
ORDER BY schemaname, tablename, policyname;

-- =========================================================
-- VERIFICAR TRIGGERS RELACIONADOS
-- =========================================================
SELECT 
    'TRIGGER' as tipo,
    trigger_schema || '.' || event_object_table || '.' || trigger_name as nombre,
    'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON ' || 
    trigger_schema || '.' || event_object_table || ' CASCADE;' as comando_eliminacion
FROM information_schema.triggers
WHERE (
    trigger_name LIKE '%escrow%'
    OR event_object_table LIKE '%escrow%'
    OR (trigger_name LIKE '%transaction%' 
        AND trigger_name NOT LIKE '%purchase%'
        AND trigger_name NOT LIKE '%navp%'
        AND trigger_name NOT LIKE '%hnld%')
    OR (event_object_table LIKE '%transaction%' 
        AND event_object_table NOT LIKE '%purchase_transaction%'
        AND event_object_table NOT LIKE '%navp%'
        AND event_object_table NOT LIKE '%hnld%')
)
ORDER BY trigger_schema, event_object_table, trigger_name;

-- =========================================================
-- VERIFICAR VISTAS RELACIONADAS
-- =========================================================
SELECT 
    'VISTA' as tipo,
    table_name as nombre,
    'DROP VIEW IF EXISTS ' || table_name || ' CASCADE;' as comando_eliminacion
FROM information_schema.views
WHERE table_schema = 'public'
  AND (
      table_name LIKE '%escrow%'
      OR (table_name LIKE '%transaction%' 
          AND table_name NOT LIKE '%purchase%'
          AND table_name NOT LIKE '%navp%'
          AND table_name NOT LIKE '%hnld%')
  )
ORDER BY table_name;

-- =========================================================
-- VERIFICAR TIPOS PERSONALIZADOS RELACIONADOS
-- =========================================================
SELECT 
    'TIPO' as tipo,
    typname as nombre,
    'DROP TYPE IF EXISTS ' || typname || ' CASCADE;' as comando_eliminacion
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
  AND (
      typname LIKE '%escrow%'
      OR (typname LIKE '%transaction%' 
          AND typname NOT LIKE '%purchase%'
          AND typname NOT LIKE '%navp%'
          AND typname NOT LIKE '%hnld%')
  )
  AND typtype = 'c' -- Solo tipos compuestos
ORDER BY typname;

-- =========================================================
-- VERIFICAR SECUENCIAS RELACIONADAS
-- =========================================================
SELECT 
    'SECUENCIA' as tipo,
    sequence_name as nombre,
    'DROP SEQUENCE IF EXISTS ' || sequence_name || ' CASCADE;' as comando_eliminacion
FROM information_schema.sequences
WHERE sequence_schema = 'public'
  AND (
      sequence_name LIKE '%escrow%'
      OR (sequence_name LIKE '%transaction%' 
          AND sequence_name NOT LIKE '%purchase%'
          AND sequence_name NOT LIKE '%navp%'
          AND sequence_name NOT LIKE '%hnld%')
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
      AND (
          table_name LIKE '%escrow%'
          OR (table_name LIKE '%transaction%' 
              AND table_name NOT LIKE '%purchase_transaction%' 
              AND table_name NOT LIKE '%navp%'
              AND table_name NOT IN ('hnld_transactions', 'hnld_ledger', 'direct_transfers'))
      )
    
    UNION ALL
    
    SELECT p.proname::text FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (
          p.proname LIKE '%escrow%'
          OR (p.proname LIKE '%transaction%' 
              AND p.proname NOT LIKE '%purchase%'
              AND p.proname NOT LIKE '%navp%'
              AND p.proname NOT LIKE '%hnld%'
              AND p.proname NOT LIKE '%direct_transfer%')
      )
    
    UNION ALL
    
    SELECT policyname::text FROM pg_policies
    WHERE policyname LIKE '%escrow%'
       OR (policyname LIKE '%transaction%' 
           AND policyname NOT LIKE '%purchase%'
           AND policyname NOT LIKE '%navp%'
           AND policyname NOT LIKE '%hnld%')
    
    UNION ALL
    
    SELECT trigger_name::text FROM information_schema.triggers
    WHERE trigger_name LIKE '%escrow%'
       OR (trigger_name LIKE '%transaction%' 
           AND trigger_name NOT LIKE '%purchase%'
           AND trigger_name NOT LIKE '%navp%'
           AND trigger_name NOT LIKE '%hnld%')
    
    UNION ALL
    
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public'
      AND (
          table_name LIKE '%escrow%'
          OR (table_name LIKE '%transaction%' 
              AND table_name NOT LIKE '%purchase%'
              AND table_name NOT LIKE '%navp%'
              AND table_name NOT LIKE '%hnld%')
      )
) as todos;

