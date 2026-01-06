-- =========================================================
-- SCRIPT DE LIMPIEZA: ELIMINAR RASTROS DE LINKS DE PAGO
-- =========================================================
-- Este script elimina cualquier tabla, función, política o trigger
-- relacionado con el módulo de Links de Pago que fue eliminado
-- =========================================================
-- IMPORTANTE: Este script NO afecta el campo payment_link de navp_payments
-- que es parte del sistema NAVP (diferente módulo)
-- =========================================================

-- =========================================================
-- PASO 1: ELIMINAR TABLAS (si existen)
-- =========================================================

-- Eliminar tabla payment_links (si existe)
DROP TABLE IF EXISTS payment_links CASCADE;

-- Eliminar tabla pay_links (si existe)
DROP TABLE IF EXISTS pay_links CASCADE;

-- Eliminar tabla paylinks (si existe)
DROP TABLE IF EXISTS paylinks CASCADE;

-- Eliminar tabla user_payment_links (si existe)
DROP TABLE IF EXISTS user_payment_links CASCADE;

-- Eliminar tabla payment_link_usage (si existe)
DROP TABLE IF EXISTS payment_link_usage CASCADE;

-- Eliminar tabla payment_link_analytics (si existe)
DROP TABLE IF EXISTS payment_link_analytics CASCADE;

-- =========================================================
-- PASO 2: ELIMINAR FUNCIONES RELACIONADAS
-- =========================================================

-- Eliminar función create_payment_link
DROP FUNCTION IF EXISTS create_payment_link CASCADE;

-- Eliminar función get_payment_link
DROP FUNCTION IF EXISTS get_payment_link CASCADE;

-- Eliminar función get_user_payment_links
DROP FUNCTION IF EXISTS get_user_payment_links CASCADE;

-- Eliminar función update_payment_link
DROP FUNCTION IF EXISTS update_payment_link CASCADE;

-- Eliminar función delete_payment_link
DROP FUNCTION IF EXISTS delete_payment_link CASCADE;

-- Eliminar función disable_payment_link
DROP FUNCTION IF EXISTS disable_payment_link CASCADE;

-- Eliminar función enable_payment_link
DROP FUNCTION IF EXISTS enable_payment_link CASCADE;

-- Eliminar función track_payment_link_usage
DROP FUNCTION IF EXISTS track_payment_link_usage CASCADE;

-- Eliminar función generate_payment_link_code
DROP FUNCTION IF EXISTS generate_payment_link_code CASCADE;

-- Eliminar función validate_payment_link
DROP FUNCTION IF EXISTS validate_payment_link CASCADE;

-- Eliminar función get_payment_link_stats
DROP FUNCTION IF EXISTS get_payment_link_stats CASCADE;

-- =========================================================
-- PASO 3: ELIMINAR POLÍTICAS RLS (Row Level Security)
-- =========================================================

-- Nota: Las políticas se eliminan automáticamente cuando se eliminan las tablas
-- pero incluimos esto por si hay políticas huérfanas

-- Buscar y eliminar políticas relacionadas con payment_links
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE tablename LIKE '%payment_link%'
           OR tablename LIKE '%pay_link%'
           OR tablename LIKE '%paylink%'
           OR policyname LIKE '%payment_link%'
           OR policyname LIKE '%pay_link%'
           OR policyname LIKE '%paylink%'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE',
            r.policyname, r.schemaname, r.tablename);
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
        WHERE trigger_name LIKE '%payment_link%'
           OR trigger_name LIKE '%pay_link%'
           OR trigger_name LIKE '%paylink%'
           OR event_object_table LIKE '%payment_link%'
           OR event_object_table LIKE '%pay_link%'
           OR event_object_table LIKE '%paylink%'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE',
            r.trigger_name, r.trigger_schema, r.event_object_table);
    END LOOP;
END $$;

-- =========================================================
-- PASO 5: ELIMINAR VISTAS (VIEWS) RELACIONADAS
-- =========================================================

-- Eliminar vistas relacionadas
DROP VIEW IF EXISTS payment_links_view CASCADE;
DROP VIEW IF EXISTS pay_links_view CASCADE;
DROP VIEW IF EXISTS user_payment_links_summary CASCADE;
DROP VIEW IF EXISTS payment_link_statistics CASCADE;

-- =========================================================
-- PASO 6: ELIMINAR TIPOS PERSONALIZADOS (si existen)
-- =========================================================

-- Eliminar tipos relacionados
DROP TYPE IF EXISTS payment_link_status CASCADE;
DROP TYPE IF EXISTS payment_link_currency CASCADE;
DROP TYPE IF EXISTS payment_link_type CASCADE;

-- =========================================================
-- PASO 7: LIMPIAR SECUENCIAS (SEQUENCES) RELACIONADAS
-- =========================================================

-- Eliminar secuencias relacionadas
DROP SEQUENCE IF EXISTS payment_links_id_seq CASCADE;
DROP SEQUENCE IF EXISTS pay_links_id_seq CASCADE;
DROP SEQUENCE IF EXISTS payment_link_code_seq CASCADE;

-- =========================================================
-- PASO 8: VERIFICAR Y REPORTAR
-- =========================================================

-- Verificar que no queden tablas relacionadas
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
          table_name LIKE '%payment_link%'
          OR table_name LIKE '%pay_link%'
          OR table_name LIKE '%paylink%'
      );
    
    IF table_count > 0 THEN
        RAISE NOTICE '⚠️ ADVERTENCIA: Se encontraron % tabla(s) relacionada(s) con payment links', table_count;
        RAISE NOTICE 'Revisa manualmente las siguientes tablas:';
        FOR r IN (
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND (
                  table_name LIKE '%payment_link%'
                  OR table_name LIKE '%pay_link%'
                  OR table_name LIKE '%paylink%'
              )
        ) LOOP
            RAISE NOTICE '  - %', r.table_name;
        END LOOP;
    ELSE
        RAISE NOTICE '✅ No se encontraron tablas relacionadas con payment links';
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
          p.proname LIKE '%payment_link%'
          OR p.proname LIKE '%pay_link%'
          OR p.proname LIKE '%paylink%'
      );
    
    IF func_count > 0 THEN
        RAISE NOTICE '⚠️ ADVERTENCIA: Se encontraron % función(es) relacionada(s)', func_count;
    ELSE
        RAISE NOTICE '✅ No se encontraron funciones relacionadas con payment links';
    END IF;
END $$;

-- =========================================================
-- PASO 9: COMENTARIOS FINALES
-- =========================================================

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'LIMPIEZA DE LINKS DE PAGO COMPLETADA';
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'Se han eliminado todas las tablas, funciones, políticas';
    RAISE NOTICE 'y triggers relacionados con el módulo de Links de Pago.';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTA: El campo payment_link en la tabla navp_payments';
    RAISE NOTICE 'NO fue eliminado porque es parte del sistema NAVP.';
    RAISE NOTICE '=========================================================';
END $$;

