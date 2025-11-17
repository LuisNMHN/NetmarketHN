-- =========================================================
-- VERIFICACIÓN Y CORRECCIÓN COMPLETA DE RLS Y REALTIME
-- PARA COMPRAS Y VENTAS
-- =========================================================
-- Este script verifica y corrige todas las políticas RLS
-- y la configuración de Realtime para ambos sistemas
-- =========================================================

-- =========================================================
-- PARTE 1: VERIFICAR Y CORREGIR POLÍTICAS RLS PARA COMPRAS
-- =========================================================

-- Verificar que RLS está habilitado para compras
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'purchase_requests'
    ) THEN
        RAISE EXCEPTION 'La tabla purchase_requests no existe';
    END IF;
    
    -- Habilitar RLS si no está habilitado
    ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE purchase_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transaction_steps ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ RLS habilitado para tablas de compras';
END $$;

-- Eliminar políticas existentes para recrearlas correctamente (compras)
DROP POLICY IF EXISTS "Users can view own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can create own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can delete own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Anyone can view active purchase requests" ON purchase_requests;

DROP POLICY IF EXISTS "Users can view own transactions" ON purchase_transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON purchase_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON purchase_transactions;

DROP POLICY IF EXISTS "Users can view transaction steps" ON transaction_steps;
DROP POLICY IF EXISTS "Users can update transaction steps" ON transaction_steps;

-- =========================================================
-- POLÍTICAS RLS PARA purchase_requests
-- =========================================================

-- 1. SELECT: Usuarios pueden ver sus propias solicitudes (como comprador o vendedor)
CREATE POLICY "Users can view own purchase requests" ON purchase_requests
    FOR SELECT 
    USING (
        auth.uid() = buyer_id OR 
        auth.uid() = seller_id
    );

-- 2. SELECT: Cualquiera puede ver solicitudes activas (excepto el propio comprador)
CREATE POLICY "Anyone can view active purchase requests" ON purchase_requests
    FOR SELECT 
    USING (
        status = 'active' AND 
        auth.uid() IS NOT NULL AND
        auth.uid() != buyer_id
    );

-- 3. INSERT: Solo el comprador puede crear sus propias solicitudes
CREATE POLICY "Users can create own purchase requests" ON purchase_requests
    FOR INSERT 
    WITH CHECK (auth.uid() = buyer_id);

-- 4. UPDATE: Solo el comprador puede actualizar sus propias solicitudes
CREATE POLICY "Users can update own purchase requests" ON purchase_requests
    FOR UPDATE 
    USING (auth.uid() = buyer_id)
    WITH CHECK (auth.uid() = buyer_id);

-- 5. DELETE: Solo el comprador puede eliminar sus propias solicitudes
CREATE POLICY "Users can delete own purchase requests" ON purchase_requests
    FOR DELETE 
    USING (auth.uid() = buyer_id);

-- =========================================================
-- POLÍTICAS RLS PARA purchase_transactions
-- =========================================================

-- 1. SELECT: Usuarios pueden ver transacciones donde son comprador o vendedor
CREATE POLICY "Users can view own transactions" ON purchase_transactions
    FOR SELECT 
    USING (
        auth.uid() = buyer_id OR 
        auth.uid() = seller_id
    );

-- 2. INSERT: Comprador o vendedor pueden crear transacciones
CREATE POLICY "Users can create transactions" ON purchase_transactions
    FOR INSERT 
    WITH CHECK (
        auth.uid() = buyer_id OR 
        auth.uid() = seller_id
    );

-- 3. UPDATE: Comprador o vendedor pueden actualizar transacciones
CREATE POLICY "Users can update own transactions" ON purchase_transactions
    FOR UPDATE 
    USING (
        auth.uid() = buyer_id OR 
        auth.uid() = seller_id
    )
    WITH CHECK (
        auth.uid() = buyer_id OR 
        auth.uid() = seller_id
    );

-- =========================================================
-- POLÍTICAS RLS PARA transaction_steps (compras)
-- =========================================================

-- 1. SELECT: Usuarios pueden ver pasos de transacciones donde participan
CREATE POLICY "Users can view transaction steps" ON transaction_steps
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM purchase_transactions pt
            WHERE pt.id = transaction_steps.transaction_id
            AND (pt.buyer_id = auth.uid() OR pt.seller_id = auth.uid())
        )
    );

-- 2. UPDATE: Usuarios pueden actualizar pasos de transacciones donde participan
CREATE POLICY "Users can update transaction steps" ON transaction_steps
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM purchase_transactions pt
            WHERE pt.id = transaction_steps.transaction_id
            AND (pt.buyer_id = auth.uid() OR pt.seller_id = auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM purchase_transactions pt
            WHERE pt.id = transaction_steps.transaction_id
            AND (pt.buyer_id = auth.uid() OR pt.seller_id = auth.uid())
        )
    );

-- =========================================================
-- PARTE 2: VERIFICAR Y HABILITAR REALTIME PARA COMPRAS
-- =========================================================

-- Verificar si purchase_requests está en la publicación de Realtime
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_is_in_publication BOOLEAN;
BEGIN
    -- Verificar que la tabla existe
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'purchase_requests'
    ) INTO v_table_exists;
    
    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'La tabla purchase_requests no existe';
    END IF;
    
    -- Verificar si está en la publicación
    SELECT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'purchase_requests'
    ) INTO v_is_in_publication;
    
    -- Agregar a la publicación si no está
    IF NOT v_is_in_publication THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE purchase_requests;
        RAISE NOTICE '✅ purchase_requests agregada a la publicación supabase_realtime';
    ELSE
        RAISE NOTICE '✅ purchase_requests ya está en la publicación supabase_realtime';
    END IF;
END $$;

-- Verificar si purchase_transactions está en la publicación de Realtime
DO $$
DECLARE
    v_is_in_publication BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'purchase_transactions'
    ) INTO v_is_in_publication;
    
    IF NOT v_is_in_publication THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE purchase_transactions;
        RAISE NOTICE '✅ purchase_transactions agregada a la publicación supabase_realtime';
    ELSE
        RAISE NOTICE '✅ purchase_transactions ya está en la publicación supabase_realtime';
    END IF;
END $$;

-- Verificar si transaction_steps está en la publicación de Realtime
DO $$
DECLARE
    v_is_in_publication BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'transaction_steps'
    ) INTO v_is_in_publication;
    
    IF NOT v_is_in_publication THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE transaction_steps;
        RAISE NOTICE '✅ transaction_steps agregada a la publicación supabase_realtime';
    ELSE
        RAISE NOTICE '✅ transaction_steps ya está en la publicación supabase_realtime';
    END IF;
END $$;

-- =========================================================
-- PARTE 3: CONFIGURAR REPLICA IDENTITY PARA REALTIME
-- =========================================================

-- Configurar REPLICA IDENTITY para compras (necesario para UPDATE y DELETE en Realtime)
ALTER TABLE purchase_requests REPLICA IDENTITY FULL;
ALTER TABLE purchase_transactions REPLICA IDENTITY FULL;
ALTER TABLE transaction_steps REPLICA IDENTITY FULL;

-- Configurar REPLICA IDENTITY para ventas (necesario para UPDATE y DELETE en Realtime)
DO $$
BEGIN
    ALTER TABLE sale_requests REPLICA IDENTITY FULL;
    ALTER TABLE sale_transactions REPLICA IDENTITY FULL;
    ALTER TABLE sale_transaction_steps REPLICA IDENTITY FULL;
    RAISE NOTICE '✅ REPLICA IDENTITY configurado para todas las tablas';
END $$;

-- =========================================================
-- PARTE 4: CREAR ÍNDICES PARA OPTIMIZAR REALTIME (COMPRAS)
-- =========================================================

-- Índices para purchase_requests (optimizar consultas de Realtime)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_buyer_id ON purchase_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_seller_id ON purchase_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON purchase_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_buyer ON purchase_requests(status, buyer_id) WHERE status = 'active';

-- Índices para purchase_transactions
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_buyer_id ON purchase_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_seller_id ON purchase_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_status ON purchase_transactions(status);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_request_id ON purchase_transactions(request_id);

-- Índices para transaction_steps
CREATE INDEX IF NOT EXISTS idx_transaction_steps_transaction_id ON transaction_steps(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_steps_step_order ON transaction_steps(transaction_id, step_order);

-- =========================================================
-- PARTE 5: VERIFICAR PERMISOS DE REALTIME (COMPRAS)
-- =========================================================

-- Verificar que el rol anon tiene permisos de SELECT en las tablas
DO $$
BEGIN
    -- Verificar permisos para purchase_requests
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.role_table_grants 
        WHERE grantee = 'anon' 
        AND table_schema = 'public' 
        AND table_name = 'purchase_requests'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT ON purchase_requests TO anon;
        RAISE NOTICE '✅ Permisos SELECT otorgados a anon para purchase_requests';
    ELSE
        RAISE NOTICE '✅ Permisos SELECT ya existen para anon en purchase_requests';
    END IF;
    
    -- Verificar permisos para purchase_transactions
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.role_table_grants 
        WHERE grantee = 'anon' 
        AND table_schema = 'public' 
        AND table_name = 'purchase_transactions'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT ON purchase_transactions TO anon;
        RAISE NOTICE '✅ Permisos SELECT otorgados a anon para purchase_transactions';
    ELSE
        RAISE NOTICE '✅ Permisos SELECT ya existen para anon en purchase_transactions';
    END IF;
    
    -- Verificar permisos para transaction_steps
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.role_table_grants 
        WHERE grantee = 'anon' 
        AND table_schema = 'public' 
        AND table_name = 'transaction_steps'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT ON transaction_steps TO anon;
        RAISE NOTICE '✅ Permisos SELECT otorgados a anon para transaction_steps';
    ELSE
        RAISE NOTICE '✅ Permisos SELECT ya existen para anon en transaction_steps';
    END IF;
END $$;

-- =========================================================
-- PARTE 6: RESUMEN DE VERIFICACIÓN COMPLETA
-- =========================================================

DO $$
DECLARE
    v_purchase_policies_count INTEGER;
    v_sale_policies_count INTEGER;
    v_realtime_tables INTEGER;
BEGIN
    -- Contar políticas RLS para purchase_requests
    SELECT COUNT(*) INTO v_purchase_policies_count
    FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename IN ('purchase_requests', 'purchase_transactions', 'transaction_steps');
    
    -- Contar políticas RLS para sale_requests
    SELECT COUNT(*) INTO v_sale_policies_count
    FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename IN ('sale_requests', 'sale_transactions', 'sale_transaction_steps');
    
    -- Contar tablas en Realtime
    SELECT COUNT(*) INTO v_realtime_tables
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN (
        'purchase_requests', 'purchase_transactions', 'transaction_steps',
        'sale_requests', 'sale_transactions', 'sale_transaction_steps'
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DE VERIFICACIÓN COMPLETA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Políticas RLS para COMPRAS: %', v_purchase_policies_count;
    RAISE NOTICE 'Políticas RLS para VENTAS: %', v_sale_policies_count;
    RAISE NOTICE 'Tablas en Realtime (total): %', v_realtime_tables;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Verificar políticas específicas de compras
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_requests' 
        AND policyname = 'Users can delete own purchase requests'
    ) THEN
        RAISE NOTICE '✅ Política DELETE para purchase_requests: OK';
    ELSE
        RAISE WARNING '⚠️ Política DELETE para purchase_requests: FALTA';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'purchase_requests'
    ) THEN
        RAISE NOTICE '✅ purchase_requests en Realtime: OK';
    ELSE
        RAISE WARNING '⚠️ purchase_requests NO está en Realtime';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'purchase_transactions'
    ) THEN
        RAISE NOTICE '✅ purchase_transactions en Realtime: OK';
    ELSE
        RAISE WARNING '⚠️ purchase_transactions NO está en Realtime';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'transaction_steps'
    ) THEN
        RAISE NOTICE '✅ transaction_steps en Realtime: OK';
    ELSE
        RAISE WARNING '⚠️ transaction_steps NO está en Realtime';
    END IF;
    
    -- Verificar políticas específicas de ventas
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_requests'
    ) THEN
        RAISE NOTICE '✅ sale_requests en Realtime: OK';
    ELSE
        RAISE WARNING '⚠️ sale_requests NO está en Realtime';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_transactions'
    ) THEN
        RAISE NOTICE '✅ sale_transactions en Realtime: OK';
    ELSE
        RAISE WARNING '⚠️ sale_transactions NO está en Realtime';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'sale_transaction_steps'
    ) THEN
        RAISE NOTICE '✅ sale_transaction_steps en Realtime: OK';
    ELSE
        RAISE WARNING '⚠️ sale_transaction_steps NO está en Realtime';
    END IF;
    
    -- Verificar REPLICA IDENTITY
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = 'purchase_requests'
        AND c.relreplident = 'f'
    ) THEN
        RAISE NOTICE '✅ REPLICA IDENTITY FULL para purchase_requests: OK';
    ELSE
        RAISE WARNING '⚠️ REPLICA IDENTITY para purchase_requests: VERIFICAR';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = 'sale_requests'
        AND c.relreplident = 'f'
    ) THEN
        RAISE NOTICE '✅ REPLICA IDENTITY FULL para sale_requests: OK';
    ELSE
        RAISE WARNING '⚠️ REPLICA IDENTITY para sale_requests: VERIFICAR';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Verificación completada para COMPRAS y VENTAS';
    RAISE NOTICE '';
END $$;

