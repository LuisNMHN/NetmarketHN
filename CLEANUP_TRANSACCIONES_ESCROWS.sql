-- =========================================================
-- SCRIPT DE LIMPIEZA: ELIMINAR RASTROS DE TRANSACCIONES (ESCROWS)
-- =========================================================
-- Este script elimina cualquier tabla, función, política o trigger
-- relacionado con el módulo de Transacciones (Escrows) que fue eliminado
-- =========================================================
-- IMPORTANTE: Este script NO afecta:
-- - purchase_transactions (sistema de compras)
-- - navp_payments (sistema NAVP)
-- - hnld_transactions, hnld_ledger (Balance HNLD)
-- - direct_transfers (transferencias directas)
-- =========================================================

-- =========================================================
-- PASO 1: ELIMINAR TABLAS (si existen)
-- =========================================================

-- Eliminar tabla escrows (si existe)
DROP TABLE IF EXISTS escrows CASCADE;

-- Eliminar tabla escrow_events (si existe)
DROP TABLE IF EXISTS escrow_events CASCADE;

-- Eliminar tabla escrow_messages (si existe)
DROP TABLE IF EXISTS escrow_messages CASCADE;

-- Eliminar tabla user_escrows (si existe)
DROP TABLE IF EXISTS user_escrows CASCADE;

-- Eliminar tabla escrow_disputes (si existe)
DROP TABLE IF EXISTS escrow_disputes CASCADE;

-- Eliminar tabla escrow_history (si existe)
DROP TABLE IF EXISTS escrow_history CASCADE;

-- Eliminar tabla escrow_attachments (si existe)
DROP TABLE IF EXISTS escrow_attachments CASCADE;

-- Eliminar tabla transactions (genérica, si existe y no es purchase_transactions)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
        AND table_name NOT IN ('purchase_transactions', 'hnld_transactions')
    ) THEN
        DROP TABLE IF EXISTS transactions CASCADE;
        RAISE NOTICE '✅ Tabla transactions eliminada';
    END IF;
END $$;

-- =========================================================
-- PASO 2: ELIMINAR FUNCIONES RELACIONADAS
-- =========================================================

-- Eliminar funciones de escrows
DROP FUNCTION IF EXISTS create_escrow CASCADE;
DROP FUNCTION IF EXISTS get_escrow CASCADE;
DROP FUNCTION IF EXISTS get_user_escrows CASCADE;
DROP FUNCTION IF EXISTS update_escrow CASCADE;
DROP FUNCTION IF EXISTS delete_escrow CASCADE;
DROP FUNCTION IF EXISTS lock_escrow CASCADE;
DROP FUNCTION IF EXISTS release_escrow CASCADE;
DROP FUNCTION IF EXISTS cancel_escrow CASCADE;
DROP FUNCTION IF EXISTS dispute_escrow CASCADE;
DROP FUNCTION IF EXISTS get_escrow_events CASCADE;
DROP FUNCTION IF EXISTS get_escrow_messages CASCADE;
DROP FUNCTION IF EXISTS add_escrow_message CASCADE;
DROP FUNCTION IF EXISTS search_user_for_escrow CASCADE;
DROP FUNCTION IF EXISTS validate_escrow CASCADE;
DROP FUNCTION IF EXISTS get_escrow_stats CASCADE;

-- Eliminar funciones genéricas de transacciones (si no son purchase o navp)
DO $$
DECLARE
    r RECORD;
    func_signature TEXT;
BEGIN
    FOR r IN (
        SELECT 
            p.proname,
            p.oid,
            pg_get_function_identity_arguments(p.oid) as identity_args,
            pg_get_function_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname LIKE '%transaction%'
          AND p.proname NOT LIKE '%purchase%'
          AND p.proname NOT LIKE '%navp%'
          AND p.proname NOT LIKE '%hnld%'
          AND p.proname NOT LIKE '%direct_transfer%'
    ) LOOP
        -- Usar identity_arguments que no incluye DEFAULT values
        func_signature := COALESCE(r.identity_args, r.args, '');
        
        -- Si la función no tiene argumentos, no incluir paréntesis
        IF func_signature = '' THEN
            EXECUTE format('DROP FUNCTION IF EXISTS %I() CASCADE', r.proname);
        ELSE
            EXECUTE format('DROP FUNCTION IF EXISTS %I(%s) CASCADE',
                r.proname, func_signature);
        END IF;
        
        RAISE NOTICE '✅ Función eliminada: %(%)', r.proname, func_signature;
    END LOOP;
END $$;

-- =========================================================
-- PASO 3: ELIMINAR POLÍTICAS RLS (Row Level Security)
-- =========================================================

-- Buscar y eliminar políticas relacionadas con escrows
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
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
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE',
            r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE '✅ Política eliminada: % en %.%', r.policyname, r.schemaname, r.tablename;
    END LOOP;
END $$;

-- =========================================================
-- PASO 4: ELIMINAR TRIGGERS RELACIONADOS
-- =========================================================

-- Buscar y eliminar triggers relacionados
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_schema, trigger_name, event_object_table
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
                AND event_object_table NOT LIKE '%hnld%'
                AND event_object_table NOT LIKE '%direct_transfer%')
        )
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE',
            r.trigger_name, r.trigger_schema, r.event_object_table);
        RAISE NOTICE '✅ Trigger eliminado: % en %.%', r.trigger_name, r.trigger_schema, r.event_object_table;
    END LOOP;
END $$;

-- =========================================================
-- PASO 5: ELIMINAR VISTAS (VIEWS) RELACIONADAS
-- =========================================================

-- Eliminar vistas relacionadas
DROP VIEW IF EXISTS escrows_view CASCADE;
DROP VIEW IF EXISTS user_escrows_view CASCADE;
DROP VIEW IF EXISTS escrows_summary CASCADE;
DROP VIEW IF EXISTS escrow_statistics CASCADE;

-- Eliminar vistas genéricas de transacciones
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND (
              table_name LIKE '%escrow%'
              OR (table_name LIKE '%transaction%' 
                  AND table_name NOT LIKE '%purchase%'
                  AND table_name NOT LIKE '%navp%'
                  AND table_name NOT LIKE '%hnld%')
          )
    ) LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', r.table_name);
        RAISE NOTICE '✅ Vista eliminada: %', r.table_name;
    END LOOP;
END $$;

-- =========================================================
-- PASO 6: ELIMINAR TIPOS PERSONALIZADOS (si existen)
-- =========================================================
-- NOTA: Los tipos se eliminan después de las tablas porque
-- las tablas pueden depender de los tipos. Si hay errores,
-- significa que hay tablas que aún usan estos tipos.

-- Eliminar tipos relacionados (después de eliminar tablas)
-- Si hay errores aquí, significa que hay tablas que aún existen
DO $$
DECLARE
    r RECORD;
    type_dropped BOOLEAN;
BEGIN
    -- Primero intentar eliminar tipos específicos conocidos
    BEGIN
        DROP TYPE IF EXISTS escrow_status CASCADE;
        RAISE NOTICE '✅ Tipo eliminado: escrow_status';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ No se pudo eliminar escrow_status: %', SQLERRM;
    END;
    
    BEGIN
        DROP TYPE IF EXISTS escrow_type CASCADE;
        RAISE NOTICE '✅ Tipo eliminado: escrow_type';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ No se pudo eliminar escrow_type: %', SQLERRM;
    END;
    
    BEGIN
        DROP TYPE IF EXISTS escrow_event_type CASCADE;
        RAISE NOTICE '✅ Tipo eliminado: escrow_event_type';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ No se pudo eliminar escrow_event_type: %', SQLERRM;
    END;
    
    BEGIN
        DROP TYPE IF EXISTS escrow_attachments CASCADE;
        RAISE NOTICE '✅ Tipo eliminado: escrow_attachments';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ No se pudo eliminar escrow_attachments: %', SQLERRM;
    END;

    -- Eliminar tipos genéricos de transacciones
    FOR r IN (
        SELECT typname
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
    ) LOOP
        BEGIN
            EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', r.typname);
            RAISE NOTICE '✅ Tipo eliminado: %', r.typname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️ No se pudo eliminar tipo %: %', r.typname, SQLERRM;
        END;
    END LOOP;
END $$;

-- =========================================================
-- PASO 7: LIMPIAR SECUENCIAS (SEQUENCES) RELACIONADAS
-- =========================================================

-- Eliminar secuencias relacionadas
DROP SEQUENCE IF EXISTS escrows_id_seq CASCADE;
DROP SEQUENCE IF EXISTS escrow_events_id_seq CASCADE;
DROP SEQUENCE IF EXISTS escrow_messages_id_seq CASCADE;

-- Eliminar secuencias genéricas de transacciones
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
          AND (
              sequence_name LIKE '%escrow%'
              OR (sequence_name LIKE '%transaction%' 
                  AND sequence_name NOT LIKE '%purchase%'
                  AND sequence_name NOT LIKE '%navp%'
                  AND sequence_name NOT LIKE '%hnld%')
          )
    ) LOOP
        EXECUTE format('DROP SEQUENCE IF EXISTS %I CASCADE', r.sequence_name);
        RAISE NOTICE '✅ Secuencia eliminada: %', r.sequence_name;
    END LOOP;
END $$;

-- =========================================================
-- PASO 8: VERIFICAR Y REPORTAR
-- =========================================================

-- Verificar que no queden tablas relacionadas
DO $$
DECLARE
    table_count INTEGER;
    r RECORD;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
          table_name LIKE '%escrow%'
          OR (table_name LIKE '%transaction%' 
              AND table_name NOT LIKE '%purchase_transaction%'
              AND table_name NOT LIKE '%navp%'
              AND table_name NOT IN ('hnld_transactions', 'hnld_ledger', 'direct_transfers'))
      );
    
    IF table_count > 0 THEN
        RAISE NOTICE '⚠️ ADVERTENCIA: Se encontraron % tabla(s) relacionada(s) con escrows/transacciones', table_count;
        RAISE NOTICE 'Revisa manualmente las siguientes tablas:';
        FOR r IN (
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND (
                  table_name LIKE '%escrow%'
                  OR (table_name LIKE '%transaction%' 
                      AND table_name NOT LIKE '%purchase_transaction%'
                      AND table_name NOT LIKE '%navp%'
                      AND table_name NOT IN ('hnld_transactions', 'hnld_ledger', 'direct_transfers'))
              )
        ) LOOP
            RAISE NOTICE '  - %', r.table_name;
        END LOOP;
    ELSE
        RAISE NOTICE '✅ No se encontraron tablas relacionadas con escrows/transacciones';
    END IF;
END $$;

-- Verificar que no queden funciones relacionadas
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
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
      );
    
    IF func_count > 0 THEN
        RAISE NOTICE '⚠️ ADVERTENCIA: Se encontraron % función(es) relacionada(s)', func_count;
    ELSE
        RAISE NOTICE '✅ No se encontraron funciones relacionadas con escrows/transacciones';
    END IF;
END $$;

-- =========================================================
-- PASO 9: COMENTARIOS FINALES
-- =========================================================

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'LIMPIEZA DE TRANSACCIONES (ESCROWS) COMPLETADA';
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'Se han eliminado todas las tablas, funciones, políticas';
    RAISE NOTICE 'y triggers relacionados con el módulo de Transacciones';
    RAISE NOTICE '(Escrows) que fue eliminado.';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTA: Las siguientes tablas NO fueron afectadas:';
    RAISE NOTICE '  - purchase_transactions (sistema de compras)';
    RAISE NOTICE '  - navp_payments (sistema NAVP)';
    RAISE NOTICE '  - hnld_transactions, hnld_ledger (Balance HNLD)';
    RAISE NOTICE '  - direct_transfers (transferencias directas)';
    RAISE NOTICE '=========================================================';
END $$;

