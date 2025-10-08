-- Sistema de Ledger + HNLD (Honduras Lempira Digital)
-- Doble partida + RLS para transacciones 1:1
-- VERSIÓN CORREGIDA

-- 1. Tabla de saldos HNLD por usuario
CREATE TABLE IF NOT EXISTS hnld_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    reserved_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00, -- Para transacciones pendientes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Tabla de ledger (libro mayor) - Doble partida
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL, -- ID único de la transacción
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    account_type VARCHAR(50) NOT NULL, -- 'hnld_balance', 'cash_reserve', 'fees', etc.
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    reference_id UUID, -- ID de referencia (otra transacción, depósito, etc.)
    reference_type VARCHAR(50), -- 'deposit', 'withdrawal', 'transfer', 'fee'
    metadata JSONB, -- Datos adicionales
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Tabla de transacciones principales
CREATE TABLE IF NOT EXISTS hnld_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'fee')),
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    from_user_id UUID REFERENCES auth.users(id),
    to_user_id UUID REFERENCES auth.users(id),
    description TEXT,
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de reserva de efectivo (backing 1:1)
CREATE TABLE IF NOT EXISTS cash_reserve (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_hnld_issued DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_cash_backing DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    last_audit TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_id ON ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_hnld_transactions_user_id ON hnld_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_hnld_transactions_status ON hnld_transactions(status);
CREATE INDEX IF NOT EXISTS idx_hnld_transactions_created_at ON hnld_transactions(created_at);

-- RLS (Row Level Security)
ALTER TABLE hnld_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hnld_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para hnld_balances
CREATE POLICY "Users can view own balance" ON hnld_balances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own balance" ON hnld_balances
    FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para ledger_entries
CREATE POLICY "Users can view own ledger entries" ON ledger_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert ledger entries" ON ledger_entries
    FOR INSERT WITH CHECK (true);

-- Políticas RLS para hnld_transactions
CREATE POLICY "Users can view own transactions" ON hnld_transactions
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create own transactions" ON hnld_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON hnld_transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para cash_reserve (solo admin) - CORREGIDA
CREATE POLICY "Only admins can view cash reserve" ON cash_reserve
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

-- Función para crear balance inicial
CREATE OR REPLACE FUNCTION create_hnld_balance(user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO hnld_balances (user_id, balance, reserved_balance)
    VALUES (user_id, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para emitir HNLD (depósito)
CREATE OR REPLACE FUNCTION emit_hnld(
    p_user_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT DEFAULT 'Depósito de efectivo'
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID := gen_random_uuid();
    v_cash_reserve_id UUID;
BEGIN
    -- Crear transacción
    INSERT INTO hnld_transactions (
        id, user_id, transaction_type, amount, status, description
    ) VALUES (
        v_transaction_id, p_user_id, 'deposit', p_amount, 'completed', p_description
    );

    -- Actualizar balance del usuario
    INSERT INTO hnld_balances (user_id, balance, reserved_balance)
    VALUES (p_user_id, p_amount, 0.00)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance = hnld_balances.balance + p_amount,
        updated_at = NOW();

    -- Registrar en ledger (doble partida)
    -- Débito: Aumentar balance del usuario
    INSERT INTO ledger_entries (
        transaction_id, user_id, entry_type, account_type, amount, description, reference_type
    ) VALUES (
        v_transaction_id, p_user_id, 'debit', 'hnld_balance', p_amount, p_description, 'deposit'
    );

    -- Crédito: Aumentar reserva de efectivo
    INSERT INTO cash_reserve (total_hnld_issued, total_cash_backing)
    VALUES (p_amount, p_amount)
    ON CONFLICT (id) DO UPDATE SET
        total_hnld_issued = cash_reserve.total_hnld_issued + p_amount,
        total_cash_backing = cash_reserve.total_cash_backing + p_amount,
        updated_at = NOW();

    -- Obtener ID de cash_reserve para el crédito
    SELECT id INTO v_cash_reserve_id FROM cash_reserve ORDER BY created_at DESC LIMIT 1;

    INSERT INTO ledger_entries (
        transaction_id, user_id, entry_type, account_type, amount, description, reference_type, reference_id
    ) VALUES (
        v_transaction_id, p_user_id, 'credit', 'cash_reserve', p_amount, p_description, 'deposit', v_cash_reserve_id
    );

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para quemar HNLD (retiro)
CREATE OR REPLACE FUNCTION burn_hnld(
    p_user_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT DEFAULT 'Retiro de efectivo'
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID := gen_random_uuid();
    v_current_balance DECIMAL(15,2);
    v_cash_reserve_id UUID;
BEGIN
    -- Verificar balance suficiente
    SELECT balance INTO v_current_balance 
    FROM hnld_balances 
    WHERE user_id = p_user_id;

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: %, Solicitado: %', v_current_balance, p_amount;
    END IF;

    -- Crear transacción
    INSERT INTO hnld_transactions (
        id, user_id, transaction_type, amount, status, description
    ) VALUES (
        v_transaction_id, p_user_id, 'withdrawal', p_amount, 'completed', p_description
    );

    -- Actualizar balance del usuario
    UPDATE hnld_balances 
    SET balance = balance - p_amount, updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Registrar en ledger (doble partida)
    -- Crédito: Disminuir balance del usuario
    INSERT INTO ledger_entries (
        transaction_id, user_id, entry_type, account_type, amount, description, reference_type
    ) VALUES (
        v_transaction_id, p_user_id, 'credit', 'hnld_balance', p_amount, p_description, 'withdrawal'
    );

    -- Débito: Disminuir reserva de efectivo
    SELECT id INTO v_cash_reserve_id FROM cash_reserve ORDER BY created_at DESC LIMIT 1;
    
    UPDATE cash_reserve 
    SET 
        total_hnld_issued = total_hnld_issued - p_amount,
        total_cash_backing = total_cash_backing - p_amount,
        updated_at = NOW()
    WHERE id = v_cash_reserve_id;

    INSERT INTO ledger_entries (
        transaction_id, user_id, entry_type, account_type, amount, description, reference_type, reference_id
    ) VALUES (
        v_transaction_id, p_user_id, 'debit', 'cash_reserve', p_amount, p_description, 'withdrawal', v_cash_reserve_id
    );

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para transferir HNLD entre usuarios
CREATE OR REPLACE FUNCTION transfer_hnld(
    p_from_user_id UUID,
    p_to_user_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT DEFAULT 'Transferencia HNLD'
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID := gen_random_uuid();
    v_from_balance DECIMAL(15,2);
BEGIN
    -- Verificar balance del remitente
    SELECT balance INTO v_from_balance 
    FROM hnld_balances 
    WHERE user_id = p_from_user_id;

    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: %, Solicitado: %', v_from_balance, p_amount;
    END IF;

    -- Crear transacción
    INSERT INTO hnld_transactions (
        id, user_id, transaction_type, amount, status, description, from_user_id, to_user_id
    ) VALUES (
        v_transaction_id, p_from_user_id, 'transfer', p_amount, 'completed', p_description, p_from_user_id, p_to_user_id
    );

    -- Actualizar balances
    UPDATE hnld_balances SET balance = balance - p_amount, updated_at = NOW() WHERE user_id = p_from_user_id;
    
    INSERT INTO hnld_balances (user_id, balance, reserved_balance)
    VALUES (p_to_user_id, p_amount, 0.00)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance = hnld_balances.balance + p_amount,
        updated_at = NOW();

    -- Registrar en ledger (doble partida)
    -- Crédito: Disminuir balance del remitente
    INSERT INTO ledger_entries (
        transaction_id, user_id, entry_type, account_type, amount, description, reference_type
    ) VALUES (
        v_transaction_id, p_from_user_id, 'credit', 'hnld_balance', p_amount, p_description, 'transfer'
    );

    -- Débito: Aumentar balance del destinatario
    INSERT INTO ledger_entries (
        transaction_id, user_id, entry_type, account_type, amount, description, reference_type
    ) VALUES (
        v_transaction_id, p_to_user_id, 'debit', 'hnld_balance', p_amount, p_description, 'transfer'
    );

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener balance de usuario
CREATE OR REPLACE FUNCTION get_user_hnld_balance(p_user_id UUID)
RETURNS TABLE (
    balance DECIMAL(15,2),
    reserved_balance DECIMAL(15,2),
    available_balance DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hb.balance,
        hb.reserved_balance,
        (hb.balance - hb.reserved_balance) as available_balance
    FROM hnld_balances hb
    WHERE hb.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener historial de transacciones
CREATE OR REPLACE FUNCTION get_user_transaction_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    transaction_type VARCHAR(20),
    amount DECIMAL(15,2),
    status VARCHAR(20),
    description TEXT,
    from_user_id UUID,
    to_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ht.id,
        ht.transaction_type,
        ht.amount,
        ht.status,
        ht.description,
        ht.from_user_id,
        ht.to_user_id,
        ht.created_at
    FROM hnld_transactions ht
    WHERE ht.user_id = p_user_id 
       OR ht.from_user_id = p_user_id 
       OR ht.to_user_id = p_user_id
    ORDER BY ht.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inicializar cash_reserve
INSERT INTO cash_reserve (total_hnld_issued, total_cash_backing) 
VALUES (0.00, 0.00) 
ON CONFLICT DO NOTHING;

-- Comentarios
COMMENT ON TABLE hnld_balances IS 'Saldos de HNLD por usuario con respaldo 1:1';
COMMENT ON TABLE ledger_entries IS 'Libro mayor con doble partida para auditoría completa';
COMMENT ON TABLE hnld_transactions IS 'Transacciones principales del sistema HNLD';
COMMENT ON TABLE cash_reserve IS 'Reserva de efectivo que respalda los HNLD emitidos';
