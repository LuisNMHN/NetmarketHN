-- =========================================================
-- SISTEMA DE TRANSFERENCIA DIRECTA DE HNLD ENTRE USUARIOS
-- =========================================================
-- Sistema para transferir HNLD directamente entre usuarios registrados
-- Basado en las mejores prácticas de los sistemas de ventas y compras
-- =========================================================

-- 1. Tabla de transferencias directas
CREATE TABLE IF NOT EXISTS hnld_direct_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participantes
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información de la transferencia
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    
    -- Estado de la transferencia
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Pendiente de confirmación
        'processing',  -- Procesando
        'completed',   -- Completada
        'failed',      -- Fallida
        'cancelled'    -- Cancelada
    )),
    
    -- Información de procesamiento
    processed_at TIMESTAMP WITH TIME ZONE,
    failed_reason TEXT,
    
    -- Referencia a la transacción HNLD
    hnld_transaction_id UUID REFERENCES hnld_transactions(id),
    
    -- Código único de la transferencia
    unique_code VARCHAR(50) UNIQUE,
    
    -- Metadatos
    metadata JSONB,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_transfer CHECK (from_user_id != to_user_id),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- 2. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_hnld_direct_transfers_from_user ON hnld_direct_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_hnld_direct_transfers_to_user ON hnld_direct_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_hnld_direct_transfers_status ON hnld_direct_transfers(status);
CREATE INDEX IF NOT EXISTS idx_hnld_direct_transfers_created_at ON hnld_direct_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hnld_direct_transfers_unique_code ON hnld_direct_transfers(unique_code);

-- 3. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_hnld_direct_transfers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hnld_direct_transfers_updated_at
    BEFORE UPDATE ON hnld_direct_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_hnld_direct_transfers_updated_at();

-- =========================================================
-- POLÍTICAS RLS
-- =========================================================

ALTER TABLE hnld_direct_transfers ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view own transfers" ON hnld_direct_transfers;
DROP POLICY IF EXISTS "Users can create transfers" ON hnld_direct_transfers;
DROP POLICY IF EXISTS "Users can update own transfers" ON hnld_direct_transfers;

-- SELECT: Usuarios pueden ver transferencias donde son remitente o destinatario
CREATE POLICY "Users can view own transfers" ON hnld_direct_transfers
    FOR SELECT 
    USING (
        auth.uid() = from_user_id OR 
        auth.uid() = to_user_id
    );

-- INSERT: Solo el remitente puede crear transferencias
CREATE POLICY "Users can create transfers" ON hnld_direct_transfers
    FOR INSERT 
    WITH CHECK (auth.uid() = from_user_id);

-- UPDATE: Solo el remitente puede actualizar transferencias (para cancelar)
CREATE POLICY "Users can update own transfers" ON hnld_direct_transfers
    FOR UPDATE 
    USING (auth.uid() = from_user_id)
    WITH CHECK (auth.uid() = from_user_id);

-- =========================================================
-- FUNCIONES RPC
-- =========================================================

-- Función para crear una transferencia directa
CREATE OR REPLACE FUNCTION create_direct_transfer(
    p_to_user_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_id UUID;
    v_from_balance DECIMAL(15,2);
    v_available_balance DECIMAL(15,2);
    v_transfer_id UUID;
    v_unique_code TEXT;
    v_to_user_name TEXT;
    v_from_user_name TEXT;
    v_hnld_transaction_id UUID;
BEGIN
    -- Obtener usuario actual
    v_current_user_id := auth.uid();
    
    -- Verificar autenticación
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Verificar que no se transfiera a sí mismo
    IF v_current_user_id = p_to_user_id THEN
        RAISE EXCEPTION 'No puedes transferir HNLD a ti mismo';
    END IF;
    
    -- Verificar que el destinatario existe
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_to_user_id) THEN
        RAISE EXCEPTION 'Usuario destinatario no encontrado';
    END IF;
    
    -- Verificar monto positivo
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0';
    END IF;
    
    -- Verificar balance disponible del remitente
    SELECT COALESCE(balance, 0) - COALESCE(reserved_balance, 0) INTO v_available_balance
    FROM hnld_balances
    WHERE user_id = v_current_user_id;
    
    -- Si no existe balance, crear registro
    IF v_available_balance IS NULL THEN
        INSERT INTO hnld_balances (user_id, balance, reserved_balance)
        VALUES (v_current_user_id, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
        v_available_balance := 0;
    END IF;
    
    -- Verificar que tiene suficiente balance disponible
    IF v_available_balance < p_amount THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: L. %, Solicitado: L. %', 
            v_available_balance, p_amount;
    END IF;
    
    -- Generar código único
    v_unique_code := 'NMHNT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                     UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));
    
    -- Obtener nombres de usuarios
    SELECT COALESCE(p.full_name, SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Usuario') INTO v_to_user_name
    FROM public.profiles p
    WHERE p.id = p_to_user_id;
    
    SELECT COALESCE(p.full_name, SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Usuario') INTO v_from_user_name
    FROM public.profiles p
    WHERE p.id = v_current_user_id;
    
    -- Crear registro de transferencia
    INSERT INTO hnld_direct_transfers (
        id,
        from_user_id,
        to_user_id,
        amount,
        description,
        status,
        unique_code,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_current_user_id,
        p_to_user_id,
        p_amount,
        COALESCE(p_description, format('Transferencia de L.%s a %s', p_amount::TEXT, v_to_user_name)),
        'pending',
        v_unique_code,
        NOW(),
        NOW()
    ) RETURNING id INTO v_transfer_id;
    
    -- Procesar la transferencia inmediatamente
    -- Crear transacción HNLD
    v_hnld_transaction_id := gen_random_uuid();
    
    INSERT INTO hnld_transactions (
        id,
        user_id,
        transaction_type,
        amount,
        status,
        description,
        from_user_id,
        to_user_id,
        created_at,
        updated_at,
        processed_at
    ) VALUES (
        v_hnld_transaction_id,
        v_current_user_id,
        'transfer',
        p_amount,
        'completed',
        COALESCE(p_description, format('Transferencia directa de L.%s a %s', p_amount::TEXT, v_to_user_name)),
        v_current_user_id,
        p_to_user_id,
        NOW(),
        NOW(),
        NOW()
    );
    
    -- Debitar del remitente
    UPDATE hnld_balances
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE user_id = v_current_user_id;
    
    -- Acreditar al destinatario
    INSERT INTO hnld_balances (user_id, balance, reserved_balance)
    VALUES (p_to_user_id, p_amount, 0.00)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance = hnld_balances.balance + p_amount,
        updated_at = NOW();
    
    -- Registrar en ledger (doble partida)
    -- Crédito: Disminuir balance del remitente
    INSERT INTO ledger_entries (
        transaction_id,
        user_id,
        entry_type,
        account_type,
        amount,
        description,
        reference_type,
        reference_id,
        created_at
    ) VALUES (
        v_hnld_transaction_id,
        v_current_user_id,
        'credit',
        'hnld_balance',
        p_amount,
        COALESCE(p_description, format('Transferencia a %s', v_to_user_name)),
        'transfer',
        v_transfer_id,
        NOW()
    );
    
    -- Débito: Aumentar balance del destinatario
    INSERT INTO ledger_entries (
        transaction_id,
        user_id,
        entry_type,
        account_type,
        amount,
        description,
        reference_type,
        reference_id,
        created_at
    ) VALUES (
        v_hnld_transaction_id,
        p_to_user_id,
        'debit',
        'hnld_balance',
        p_amount,
        COALESCE(p_description, format('Transferencia de %s', v_from_user_name)),
        'transfer',
        v_transfer_id,
        NOW()
    );
    
    -- Actualizar transferencia a completada
    UPDATE hnld_direct_transfers
    SET status = 'completed',
        processed_at = NOW(),
        hnld_transaction_id = v_hnld_transaction_id,
        updated_at = NOW()
    WHERE id = v_transfer_id;
    
    -- Emitir notificaciones
    -- Notificación al remitente
    PERFORM emit_notification(
        v_current_user_id,
        'TRANSFER_SENT',
        format('Transferencia enviada a %s', v_to_user_name),
        format('Has transferido L.%s a %s. Código: %s', p_amount::TEXT, v_to_user_name, v_unique_code),
        'high',
        'Ver transferencia',
        '/dashboard/transferencias',
        format('transfer_sent_%s', v_transfer_id),
        jsonb_build_object(
            'transfer_id', v_transfer_id,
            'to_user_id', p_to_user_id,
            'to_user_name', v_to_user_name,
            'amount', p_amount,
            'unique_code', v_unique_code
        )
    );
    
    -- Notificación al destinatario
    PERFORM emit_notification(
        p_to_user_id,
        'TRANSFER_RECEIVED',
        format('Has recibido una transferencia de %s', v_from_user_name),
        format('Has recibido L.%s de %s. Código: %s', p_amount::TEXT, v_from_user_name, v_unique_code),
        'high',
        'Ver transferencia',
        '/dashboard/transferencias',
        format('transfer_received_%s', v_transfer_id),
        jsonb_build_object(
            'transfer_id', v_transfer_id,
            'from_user_id', v_current_user_id,
            'from_user_name', v_from_user_name,
            'amount', p_amount,
            'unique_code', v_unique_code
        )
    );
    
    -- Retornar resultado
    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', v_transfer_id,
        'unique_code', v_unique_code,
        'hnld_transaction_id', v_hnld_transaction_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Actualizar transferencia a fallida si existe
        IF v_transfer_id IS NOT NULL THEN
            UPDATE hnld_direct_transfers
            SET status = 'failed',
                failed_reason = SQLERRM,
                updated_at = NOW()
            WHERE id = v_transfer_id;
        END IF;
        
        RAISE;
END;
$$;

-- Función para buscar usuarios para transferencias
CREATE OR REPLACE FUNCTION search_users_for_transfer(
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_id UUID;
BEGIN
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    IF LENGTH(p_query) < 2 THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id,
        COALESCE(p.email, '') as email,
        p.full_name
    FROM profiles p
    WHERE (p.full_name ILIKE '%' || p_query || '%' OR p.email ILIKE '%' || p_query || '%')
      AND p.id != v_current_user_id
    ORDER BY 
        CASE 
            WHEN p.email ILIKE p_query || '%' THEN 1
            WHEN p.full_name ILIKE p_query || '%' THEN 2
            ELSE 3
        END,
        p.full_name
    LIMIT 10;
END;
$$;

-- Función para obtener transferencias del usuario
CREATE OR REPLACE FUNCTION get_user_transfers(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    from_user_id UUID,
    to_user_id UUID,
    amount DECIMAL(15,2),
    description TEXT,
    status VARCHAR(20),
    unique_code VARCHAR(50),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    from_user_name TEXT,
    to_user_name TEXT,
    is_sent BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_id UUID;
BEGIN
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    RETURN QUERY
    SELECT 
        dt.id,
        dt.from_user_id,
        dt.to_user_id,
        dt.amount,
        dt.description,
        dt.status,
        dt.unique_code,
        dt.processed_at,
        dt.created_at,
        COALESCE(pf.full_name, SPLIT_PART(COALESCE(pf.email, ''), '@', 1), 'Usuario') as from_user_name,
        COALESCE(pt.full_name, SPLIT_PART(COALESCE(pt.email, ''), '@', 1), 'Usuario') as to_user_name,
        (dt.from_user_id = v_current_user_id) as is_sent
    FROM hnld_direct_transfers dt
    LEFT JOIN public.profiles pf ON pf.id = dt.from_user_id
    LEFT JOIN public.profiles pt ON pt.id = dt.to_user_id
    WHERE dt.from_user_id = v_current_user_id OR dt.to_user_id = v_current_user_id
    ORDER BY dt.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =========================================================
-- HABILITAR REALTIME
-- =========================================================

-- Agregar tabla a la publicación de Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'hnld_direct_transfers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE hnld_direct_transfers;
        RAISE NOTICE '✅ hnld_direct_transfers agregada a la publicación supabase_realtime';
    ELSE
        RAISE NOTICE '✅ hnld_direct_transfers ya está en la publicación supabase_realtime';
    END IF;
END $$;

-- Configurar REPLICA IDENTITY para Realtime
ALTER TABLE hnld_direct_transfers REPLICA IDENTITY FULL;

-- =========================================================
-- PERMISOS
-- =========================================================

-- Otorgar permisos SELECT al rol anon para Realtime
GRANT SELECT ON hnld_direct_transfers TO anon;

-- =========================================================
-- COMENTARIOS
-- =========================================================

COMMENT ON TABLE hnld_direct_transfers IS 'Transferencias directas de HNLD entre usuarios';
COMMENT ON FUNCTION create_direct_transfer IS 'Crea y procesa una transferencia directa de HNLD entre usuarios';
COMMENT ON FUNCTION get_user_transfers IS 'Obtiene el historial de transferencias del usuario actual';

