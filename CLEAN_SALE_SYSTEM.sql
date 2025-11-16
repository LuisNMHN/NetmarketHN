-- =========================================================
-- SCRIPT PARA LIMPIAR SISTEMA DE VENTAS DE SUPABASE
-- =========================================================
-- Este script elimina todas las tablas, funciones, políticas RLS
-- e índices relacionados con el sistema de ventas (sale)
-- =========================================================
-- ⚠️ ADVERTENCIA: Este script eliminará TODOS los datos de ventas
-- Ejecutar con precaución
-- =========================================================

-- =========================================================
-- PASO 1: ELIMINAR POLÍTICAS RLS (Row Level Security)
-- =========================================================

-- Políticas de sale_transaction_steps
DROP POLICY IF EXISTS "Users can view sale transaction steps" ON sale_transaction_steps;
DROP POLICY IF EXISTS "Users can update sale transaction steps" ON sale_transaction_steps;

-- Políticas de sale_transactions
DROP POLICY IF EXISTS "Users can view own sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can create sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can update own sale transactions" ON sale_transactions;

-- Políticas de sale_requests
DROP POLICY IF EXISTS "Users can view own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can create own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can update own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Anyone can view active sale requests" ON sale_requests;

-- =========================================================
-- PASO 2: DESHABILITAR RLS
-- =========================================================

ALTER TABLE IF EXISTS sale_transaction_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_requests DISABLE ROW LEVEL SECURITY;

-- =========================================================
-- PASO 3: ELIMINAR TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS update_sale_transaction_steps_updated_at ON sale_transaction_steps;
DROP TRIGGER IF EXISTS update_sale_transactions_updated_at ON sale_transactions;
DROP TRIGGER IF EXISTS update_sale_requests_updated_at ON sale_requests;

-- =========================================================
-- PASO 4: ELIMINAR ÍNDICES
-- =========================================================

-- Índices de sale_transaction_steps
DROP INDEX IF EXISTS idx_sale_transaction_steps_step_order;
DROP INDEX IF EXISTS idx_sale_transaction_steps_transaction_id;

-- Índices de sale_transactions
DROP INDEX IF EXISTS idx_sale_transactions_status;
DROP INDEX IF EXISTS idx_sale_transactions_buyer_id;
DROP INDEX IF EXISTS idx_sale_transactions_seller_id;
DROP INDEX IF EXISTS idx_sale_transactions_request_id;

-- Índices de sale_requests
DROP INDEX IF EXISTS idx_sale_requests_unique_code;
DROP INDEX IF EXISTS idx_sale_requests_expires_at;
DROP INDEX IF EXISTS idx_sale_requests_created_at;
DROP INDEX IF EXISTS idx_sale_requests_status;
DROP INDEX IF EXISTS idx_sale_requests_buyer_id;
DROP INDEX IF EXISTS idx_sale_requests_seller_id;

-- =========================================================
-- PASO 5: ELIMINAR FUNCIONES RPC
-- =========================================================

-- Funciones de transacciones de venta
DROP FUNCTION IF EXISTS mark_sale_request_completed(UUID);
DROP FUNCTION IF EXISTS get_sale_transaction(UUID);
DROP FUNCTION IF EXISTS debit_hnld_from_seller(UUID);
DROP FUNCTION IF EXISTS lock_hnld_in_escrow_sale(UUID);

-- Funciones de gestión de solicitudes de venta
DROP FUNCTION IF EXISTS accept_sale_request(UUID, UUID, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS cancel_sale_request(UUID);
DROP FUNCTION IF EXISTS get_user_sale_requests(UUID, VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_active_sale_requests(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS create_sale_request(UUID, DECIMAL, VARCHAR, TEXT, INTEGER, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DECIMAL, DECIMAL, DECIMAL);

-- Función de generación de código único
DROP FUNCTION IF EXISTS generate_sale_unique_code();

-- =========================================================
-- PASO 6: ELIMINAR TABLAS (en orden de dependencias)
-- =========================================================

-- Primero eliminar tablas que tienen foreign keys
DROP TABLE IF EXISTS sale_transaction_steps CASCADE;
DROP TABLE IF EXISTS sale_transactions CASCADE;
DROP TABLE IF EXISTS sale_requests CASCADE;

-- =========================================================
-- PASO 7: VERIFICACIÓN
-- =========================================================

-- Verificar que las tablas fueron eliminadas
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'sale_%';
    
    IF table_count > 0 THEN
        RAISE NOTICE '⚠️ Advertencia: Aún existen % tablas con prefijo sale_', table_count;
    ELSE
        RAISE NOTICE '✅ Todas las tablas de ventas fueron eliminadas correctamente';
    END IF;
END $$;

-- Verificar que las funciones fueron eliminadas
DO $$
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name LIKE '%sale%';
    
    IF function_count > 0 THEN
        RAISE NOTICE '⚠️ Advertencia: Aún existen % funciones relacionadas con ventas', function_count;
    ELSE
        RAISE NOTICE '✅ Todas las funciones de ventas fueron eliminadas correctamente';
    END IF;
END $$;

-- =========================================================
-- RESUMEN
-- =========================================================

SELECT 
    'Limpieza del sistema de ventas completada' as mensaje,
    'Todas las tablas, funciones, políticas RLS e índices relacionados con ventas han sido eliminados' as detalle;

