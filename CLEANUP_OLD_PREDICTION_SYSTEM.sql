-- =========================================================
-- LIMPIEZA DEL SISTEMA ANTERIOR (POLYMARKET)
-- =========================================================
-- Este script elimina las tablas y funciones del sistema
-- anterior de compra/venta de acciones antes de migrar
-- al sistema Parimutuel
-- =========================================================

-- =========================================================
-- 1. ELIMINAR FUNCIONES SQL DEL SISTEMA ANTERIOR
-- =========================================================

-- Eliminar función de compra de acciones
DROP FUNCTION IF EXISTS buy_market_shares(
    UUID, UUID, UUID, NUMERIC, NUMERIC
) CASCADE;

-- Eliminar función de venta de acciones
DROP FUNCTION IF EXISTS sell_market_shares(
    UUID, UUID, UUID, NUMERIC, NUMERIC
) CASCADE;

-- Eliminar función de resolución antigua (será reemplazada por resolve_parimutuel_market)
DROP FUNCTION IF EXISTS resolve_prediction_market(
    UUID, UUID, TEXT
) CASCADE;

-- =========================================================
-- 2. ELIMINAR TABLAS DEL SISTEMA ANTERIOR
-- =========================================================

-- Eliminar tabla de posiciones (será reemplazada por market_bets)
-- CUIDADO: Esto eliminará todos los datos de posiciones existentes
DROP TABLE IF EXISTS market_positions CASCADE;

-- Eliminar tabla de trades (será reemplazada por market_bets_history)
-- CUIDADO: Esto eliminará todo el historial de operaciones
DROP TABLE IF EXISTS market_trades CASCADE;

-- =========================================================
-- 3. LIMPIAR COLUMNAS OBSOLETAS (OPCIONAL)
-- =========================================================
-- Nota: Estas columnas se mantienen para compatibilidad,
-- pero puedes eliminarlas si estás seguro de que no las necesitas

-- Eliminar columna current_price de market_outcomes si no se usa
-- (Se mantiene probability en su lugar)
-- ALTER TABLE market_outcomes DROP COLUMN IF EXISTS current_price;

-- Eliminar columna total_shares de market_outcomes si no se usa
-- (Se mantiene total_bet_amount en su lugar)
-- ALTER TABLE market_outcomes DROP COLUMN IF EXISTS total_shares;

-- Eliminar columna liquidity_pool_hnld de prediction_markets si no se usa
-- (Se mantiene total_pool_hnld en su lugar)
-- ALTER TABLE prediction_markets DROP COLUMN IF EXISTS liquidity_pool_hnld;

-- Eliminar columna trading_fee_percent de prediction_markets si no se usa
-- (Solo se usa platform_fee_percent en Parimutuel)
-- ALTER TABLE prediction_markets DROP COLUMN IF EXISTS trading_fee_percent;

-- =========================================================
-- 4. ELIMINAR ÍNDICES RELACIONADOS (si existen)
-- =========================================================

DROP INDEX IF EXISTS idx_market_positions_user;
DROP INDEX IF EXISTS idx_market_positions_market;
DROP INDEX IF EXISTS idx_market_positions_outcome;
DROP INDEX IF EXISTS idx_market_trades_user;
DROP INDEX IF EXISTS idx_market_trades_market;
DROP INDEX IF EXISTS idx_market_trades_outcome;
DROP INDEX IF EXISTS idx_market_trades_created;

-- =========================================================
-- 5. ELIMINAR POLÍTICAS RLS RELACIONADAS
-- =========================================================
-- Solo eliminar políticas si las tablas existen

DO $$
BEGIN
    -- Eliminar políticas RLS de market_positions (solo si la tabla existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'market_positions'
    ) THEN
        DROP POLICY IF EXISTS "Users can view their own positions" ON market_positions;
        DROP POLICY IF EXISTS "Users can manage their own positions" ON market_positions;
        RAISE NOTICE '✅ Políticas RLS de market_positions eliminadas.';
    ELSE
        RAISE NOTICE 'ℹ️ Tabla market_positions no existe, omitiendo eliminación de políticas.';
    END IF;
    
    -- Eliminar políticas RLS de market_trades (solo si la tabla existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'market_trades'
    ) THEN
        DROP POLICY IF EXISTS "Users can view their own trades" ON market_trades;
        DROP POLICY IF EXISTS "Anyone can view trades of active markets" ON market_trades;
        RAISE NOTICE '✅ Políticas RLS de market_trades eliminadas.';
    ELSE
        RAISE NOTICE 'ℹ️ Tabla market_trades no existe, omitiendo eliminación de políticas.';
    END IF;
END $$;

-- =========================================================
-- 6. VERIFICACIÓN Y REPORTE
-- =========================================================

DO $$
DECLARE
    v_tables_exist BOOLEAN;
    v_functions_exist BOOLEAN;
BEGIN
    -- Verificar si las tablas fueron eliminadas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('market_positions', 'market_trades')
    ) INTO v_tables_exist;
    
    -- Verificar si las funciones fueron eliminadas
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('buy_market_shares', 'sell_market_shares', 'resolve_prediction_market')
    ) INTO v_functions_exist;
    
    IF v_tables_exist THEN
        RAISE WARNING '⚠️ Algunas tablas del sistema anterior aún existen. Verifica manualmente.';
    ELSE
        RAISE NOTICE '✅ Tablas del sistema anterior eliminadas correctamente.';
    END IF;
    
    IF v_functions_exist THEN
        RAISE WARNING '⚠️ Algunas funciones del sistema anterior aún existen. Verifica manualmente.';
    ELSE
        RAISE NOTICE '✅ Funciones del sistema anterior eliminadas correctamente.';
    END IF;
    
    RAISE NOTICE '✅ Limpieza completada. Puedes proceder con CREATE_PARIMUTUEL_PREDICTION_SYSTEM.sql';
END $$;

-- =========================================================
-- NOTAS IMPORTANTES
-- =========================================================
-- 
-- ⚠️ ADVERTENCIA: Este script eliminará permanentemente:
--   1. Todas las posiciones de usuarios (market_positions)
--   2. Todo el historial de operaciones (market_trades)
--   3. Todas las funciones relacionadas con compra/venta
--
-- 📋 ANTES DE EJECUTAR:
--   1. Hacer backup de la base de datos
--   2. Verificar que no hay datos importantes en market_positions
--   3. Considerar exportar datos históricos si los necesitas
--
-- ✅ DESPUÉS DE EJECUTAR:
--   1. Ejecutar CREATE_PARIMUTUEL_PREDICTION_SYSTEM.sql
--   2. Verificar que las nuevas tablas se crearon correctamente
--   3. Probar el nuevo sistema con datos de prueba
--
-- =========================================================
