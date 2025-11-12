-- =========================================================
-- RLS (Row Level Security) Y FUNCIONES ADICIONALES PARA VENTAS
-- =========================================================

-- =========================================================
-- 1. HABILITAR RLS
-- =========================================================

ALTER TABLE sale_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_transaction_steps ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. ELIMINAR POLÍTICAS EXISTENTES (SI HAY)
-- =========================================================

DROP POLICY IF EXISTS "Users can view own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can create own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Users can update own sale requests" ON sale_requests;
DROP POLICY IF EXISTS "Anyone can view active sale requests" ON sale_requests;

DROP POLICY IF EXISTS "Users can view own sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can create sale transactions" ON sale_transactions;
DROP POLICY IF EXISTS "Users can update own sale transactions" ON sale_transactions;

DROP POLICY IF EXISTS "Users can view sale transaction steps" ON sale_transaction_steps;
DROP POLICY IF EXISTS "Users can update sale transaction steps" ON sale_transaction_steps;

-- =========================================================
-- 3. POLÍTICAS RLS PARA sale_requests
-- =========================================================

-- Los usuarios pueden ver sus propias solicitudes de venta
CREATE POLICY "Users can view own sale requests" ON sale_requests
    FOR SELECT USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Los usuarios pueden crear sus propias solicitudes de venta
CREATE POLICY "Users can create own sale requests" ON sale_requests
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- Los usuarios pueden actualizar sus propias solicitudes de venta
CREATE POLICY "Users can update own sale requests" ON sale_requests
    FOR UPDATE USING (auth.uid() = seller_id);

-- Todos pueden ver solicitudes de venta activas (excepto las propias)
CREATE POLICY "Anyone can view active sale requests" ON sale_requests
    FOR SELECT USING (status = 'active' AND auth.uid() != seller_id);

-- =========================================================
-- 4. POLÍTICAS RLS PARA sale_transactions
-- =========================================================

-- Los usuarios pueden ver transacciones donde son vendedor o comprador
CREATE POLICY "Users can view own sale transactions" ON sale_transactions
    FOR SELECT USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Los usuarios pueden crear transacciones donde son vendedor o comprador
CREATE POLICY "Users can create sale transactions" ON sale_transactions
    FOR INSERT WITH CHECK (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Los usuarios pueden actualizar transacciones donde son vendedor o comprador
CREATE POLICY "Users can update own sale transactions" ON sale_transactions
    FOR UPDATE USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- =========================================================
-- 5. POLÍTICAS RLS PARA sale_transaction_steps
-- =========================================================

-- Los usuarios pueden ver pasos de transacciones donde participan
CREATE POLICY "Users can view sale transaction steps" ON sale_transaction_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sale_transactions st
            WHERE st.id = sale_transaction_steps.transaction_id
            AND (st.seller_id = auth.uid() OR st.buyer_id = auth.uid())
        )
    );

-- Los usuarios pueden actualizar pasos de transacciones donde participan
CREATE POLICY "Users can update sale transaction steps" ON sale_transaction_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sale_transactions st
            WHERE st.id = sale_transaction_steps.transaction_id
            AND (st.seller_id = auth.uid() OR st.buyer_id = auth.uid())
        )
    );

-- =========================================================
-- 6. FUNCIÓN PARA DEBITAR HNLD (para ventas)
-- =========================================================

CREATE OR REPLACE FUNCTION debit_hnld(
    p_user_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance DECIMAL(15,2),
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL(15,2);
    v_new_balance DECIMAL(15,2);
BEGIN
    -- Obtener saldo actual
    SELECT balance INTO v_current_balance
    FROM hnld_balance
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Si no existe registro, crearlo con saldo 0
    IF NOT FOUND THEN
        INSERT INTO hnld_balance (user_id, balance)
        VALUES (p_user_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
        
        v_current_balance := 0;
    END IF;
    
    -- Verificar saldo suficiente
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT 
            FALSE,
            v_current_balance,
            ('Saldo insuficiente. Tienes L.' || v_current_balance::TEXT || ' HNLD')::TEXT;
        RETURN;
    END IF;
    
    -- Calcular nuevo saldo
    v_new_balance := v_current_balance - p_amount;
    
    -- Actualizar saldo
    UPDATE hnld_balance
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Registrar en historial
    INSERT INTO hnld_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        balance_after
    ) VALUES (
        p_user_id,
        -p_amount, -- Negativo porque es un débito
        'debit',
        COALESCE(p_description, 'Débito de HNLD'),
        v_new_balance
    );
    
    RETURN QUERY SELECT 
        TRUE,
        v_new_balance,
        'HNLD debitado exitosamente'::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            FALSE,
            v_current_balance,
            ('Error: ' || SQLERRM)::TEXT;
END;
$$;

-- =========================================================
-- 7. FUNCIÓN PARA BLOQUEAR HNLD EN ESCROW (para ventas)
-- =========================================================

CREATE OR REPLACE FUNCTION lock_hnld_in_escrow(
    p_user_id UUID,
    p_amount DECIMAL(15,2),
    p_transaction_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL(15,2);
BEGIN
    -- Obtener saldo actual
    SELECT balance INTO v_current_balance
    FROM hnld_balance
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Verificar saldo suficiente
    IF v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Debitar HNLD (se bloquea en escrow)
    PERFORM debit_hnld(
        p_user_id,
        p_amount,
        'HNLD bloqueado en escrow para venta - Transacción: ' || p_transaction_id::TEXT
    );
    
    RETURN TRUE;
END;
$$;

-- =========================================================
-- 8. COMENTARIOS
-- =========================================================

COMMENT ON FUNCTION debit_hnld IS 'Debitar HNLD de un usuario (para ventas)';
COMMENT ON FUNCTION lock_hnld_in_escrow IS 'Bloquear HNLD en escrow para una venta';

