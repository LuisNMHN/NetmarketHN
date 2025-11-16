-- =========================================================
-- VERIFICACIÓN Y CORRECCIÓN COMPLETA DE RLS Y REALTIME PARA VENTAS
-- =========================================================
-- Este script verifica y corrige todas las políticas RLS
-- y la configuración de Realtime para el sistema de ventas
-- =========================================================

-- =========================================================
-- PARTE 1: VERIFICAR Y CORREGIR POLÍTICAS RLS
-- =========================================================

-- Verificar que RLS está habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'sale_requests'
    ) THEN
        RAISE EXCEPTION 'La tabla sale_requests no existe';
    END IF;
    
    -- Habilitar RLS si no está habilitado
    ALTER TABLE sale_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sale_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sale_transaction_steps ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ RLS habilitado para tablas de ventas';
END $$;

-- Eliminar políticas existentes para recrearlas correctamente
DROP POLICY IF EXISTS "Users can view own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can create own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can update own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can delete own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Anyone can view active sale requests" ON sale_requests;

DROP POLICY IF EXISTS "Users can view own sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can create sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can update own sale transactions" ON sale_transactions;

DROP POLICY IF EXISTS "Users can view sale transaction steps" ON sale_transaction_steps;
DROP POLICY IF EXISTS "Users can update sale transaction steps" ON sale_transaction_steps;

-- =========================================================
-- POLÍTICAS RLS PARA sale_requests
-- =========================================================

-- 1. SELECT: Usuarios pueden ver sus propias solicitudes (como vendedor o comprador)
CREATE POLICY "Users can view own sale requests" ON sale_requests
    FOR SELECT 
    USING (
        auth.uid() = seller_id OR 
        auth.uid() = buyer_id
    );

-- 2. SELECT: Cualquiera puede ver solicitudes activas (excepto el propio vendedor)
CREATE POLICY "Anyone can view active sale requests" ON sale_requests
    FOR SELECT 
    USING (
        status = 'active' AND 
        auth.uid() IS NOT NULL AND
        auth.uid() != seller_id
    );

-- 3. INSERT: Solo el vendedor puede crear sus propias solicitudes
CREATE POLICY "Users can create own sale requests" ON sale_requests
    FOR INSERT 
    WITH CHECK (auth.uid() = seller_id);

-- 4. UPDATE: Solo el vendedor puede actualizar sus propias solicitudes
CREATE POLICY "Users can update own sale requests" ON sale_requests
    FOR UPDATE 
    USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id);

-- 5. DELETE: Solo el vendedor puede eliminar sus propias solicitudes
CREATE POLICY "Users can delete own sale requests" ON sale_requests
    FOR DELETE 
    USING (auth.uid() = seller_id);

-- =========================================================
-- POLÍTICAS RLS PARA sale_transactions
-- =========================================================

-- 1. SELECT: Usuarios pueden ver transacciones donde son comprador o vendedor
CREATE POLICY "Users can view own sale transactions" ON sale_transactions
    FOR SELECT 
    USING (
        auth.uid() = buyer_id OR 
        auth.uid() = seller_id
    );

-- 2. INSERT: Comprador o vendedor pueden crear transacciones
CREATE POLICY "Users can create sale transactions" ON sale_transactions
    FOR INSERT 
    WITH CHECK (
        auth.uid() = buyer_id OR 
        auth.uid() = seller_id
    );

-- 3. UPDATE: Comprador o vendedor pueden actualizar transacciones
CREATE POLICY "Users can update own sale transactions" ON sale_transactions
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
-- POLÍTICAS RLS PARA sale_transaction_steps
-- =========================================================

-- 1. SELECT: Usuarios pueden ver pasos de transacciones donde participan
CREATE POLICY "Users can view sale transaction steps" ON sale_transaction_steps
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM sale_transactions st
            WHERE st.id = sale_transaction_steps.transaction_id
            AND (st.buyer_id = auth.uid() OR st.seller_id = auth.uid())
        )
    );

-- 2. UPDATE: Usuarios pueden actualizar pasos de transacciones donde participan
CREATE POLICY "Users can update sale transaction steps" ON sale_transaction_steps
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM sale_transactions st
            WHERE st.id = sale_transaction_steps.transaction_id
            AND (st.buyer_id = auth.uid() OR st.seller_id = auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sale_transactions st
            WHERE st.id = sale_transaction_steps.transaction_id
            AND (st.buyer_id = auth.uid() OR st.seller_id = auth.uid())
        )
    );

-- =========================================================
-- PARTE 2: VERIFICAR Y HABILITAR REALTIME
-- =========================================================

-- Verificar si sale_requests está en la publicación de Realtime
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_is_in_publication BOOLEAN;
BEGIN
    -- Verificar que la tabla existe
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'sale_requests'
    ) INTO v_table_exists;
    
    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'La tabla sale_requests no existe';
    END IF;
    
    -- Verificar si está en la publicación
    SELECT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'sale_requests'
    ) INTO v_is_in_publication;
    
    -- Agregar a la publicación si no está
    IF NOT v_is_in_publication THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_requests;
        RAISE NOTICE '✅ sale_requests agregada a la publicación supabase_realtime';
    ELSE
        RAISE NOTICE '✅ sale_requests ya está en la publicación supabase_realtime';
    END IF;
END $$;

-- Verificar si sale_transactions está en la publicación de Realtime
DO $$
DECLARE
    v_is_in_publication BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'sale_transactions'
    ) INTO v_is_in_publication;
    
    IF NOT v_is_in_publication THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_transactions;
        RAISE NOTICE '✅ sale_transactions agregada a la publicación supabase_realtime';
    ELSE
        RAISE NOTICE '✅ sale_transactions ya está en la publicación supabase_realtime';
    END IF;
END $$;

-- Verificar si sale_transaction_steps está en la publicación de Realtime
DO $$
DECLARE
    v_is_in_publication BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'sale_transaction_steps'
    ) INTO v_is_in_publication;
    
    IF NOT v_is_in_publication THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sale_transaction_steps;
        RAISE NOTICE '✅ sale_transaction_steps agregada a la publicación supabase_realtime';
    ELSE
        RAISE NOTICE '✅ sale_transaction_steps ya está en la publicación supabase_realtime';
    END IF;
END $$;

-- =========================================================
-- PARTE 3: CREAR ÍNDICES PARA OPTIMIZAR REALTIME
-- =========================================================

-- Índices para sale_requests (optimizar consultas de Realtime)
CREATE INDEX IF NOT EXISTS idx_sale_requests_status ON sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_sale_requests_seller_id ON sale_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_buyer_id ON sale_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_requests_created_at ON sale_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_requests_status_seller ON sale_requests(status, seller_id) WHERE status = 'active';

-- Índices para sale_transactions
CREATE INDEX IF NOT EXISTS idx_sale_transactions_buyer_id ON sale_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_seller_id ON sale_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_status ON sale_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_request_id ON sale_transactions(request_id);

-- Índices para sale_transaction_steps
CREATE INDEX IF NOT EXISTS idx_sale_transaction_steps_transaction_id ON sale_transaction_steps(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sale_transaction_steps_step_order ON sale_transaction_steps(transaction_id, step_order);

-- =========================================================
-- PARTE 4: VERIFICAR PERMISOS DE REALTIME
-- =========================================================

-- Verificar que el rol anon tiene permisos de SELECT en las tablas
DO $$
BEGIN
    -- Verificar permisos para sale_requests
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.role_table_grants 
        WHERE grantee = 'anon' 
        AND table_schema = 'public' 
        AND table_name = 'sale_requests'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT ON sale_requests TO anon;
        RAISE NOTICE '✅ Permisos SELECT otorgados a anon para sale_requests';
    ELSE
        RAISE NOTICE '✅ Permisos SELECT ya existen para anon en sale_requests';
    END IF;
    
    -- Verificar permisos para sale_transactions
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.role_table_grants 
        WHERE grantee = 'anon' 
        AND table_schema = 'public' 
        AND table_name = 'sale_transactions'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT ON sale_transactions TO anon;
        RAISE NOTICE '✅ Permisos SELECT otorgados a anon para sale_transactions';
    ELSE
        RAISE NOTICE '✅ Permisos SELECT ya existen para anon en sale_transactions';
    END IF;
    
    -- Verificar permisos para sale_transaction_steps
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.role_table_grants 
        WHERE grantee = 'anon' 
        AND table_schema = 'public' 
        AND table_name = 'sale_transaction_steps'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT ON sale_transaction_steps TO anon;
        RAISE NOTICE '✅ Permisos SELECT otorgados a anon para sale_transaction_steps';
    ELSE
        RAISE NOTICE '✅ Permisos SELECT ya existen para anon en sale_transaction_steps';
    END IF;
END $$;

-- =========================================================
-- PARTE 5: RESUMEN DE VERIFICACIÓN
-- =========================================================

DO $$
DECLARE
    v_policies_count INTEGER;
    v_realtime_tables INTEGER;
BEGIN
    -- Contar políticas RLS para sale_requests
    SELECT COUNT(*) INTO v_policies_count
    FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename = 'sale_requests';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DE VERIFICACIÓN';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Políticas RLS para sale_requests: %', v_policies_count;
    
    -- Contar tablas en Realtime
    SELECT COUNT(*) INTO v_realtime_tables
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('sale_requests', 'sale_transactions', 'sale_transaction_steps');
    
    RAISE NOTICE 'Tablas de ventas en Realtime: %', v_realtime_tables;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Verificar políticas específicas
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sale_requests' 
        AND policyname = 'Users can delete own sale requests'
    ) THEN
        RAISE NOTICE '✅ Política DELETE para sale_requests: OK';
    ELSE
        RAISE WARNING '⚠️ Política DELETE para sale_requests: FALTA';
    END IF;
    
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
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Verificación completada';
    RAISE NOTICE '';
END $$;

