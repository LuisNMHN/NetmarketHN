-- Sistema de Escrow (Depósito en garantía) para NMHN
-- Lock/Release con estados y integración HNLD

-- 1. Tabla de Escrows principales
CREATE TABLE IF NOT EXISTS escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'HNLD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'locked', 'released', 'cancelled', 'disputed')),
    escrow_type VARCHAR(50) NOT NULL CHECK (escrow_type IN ('p2p_trade', 'service', 'auction', 'guarantee', 'custom')),
    
    -- Información de la transacción
    title VARCHAR(255) NOT NULL,
    description TEXT,
    terms TEXT, -- Términos y condiciones del escrow
    
    -- Fechas importantes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Información adicional
    metadata JSONB,
    dispute_reason TEXT,
    dispute_created_at TIMESTAMP WITH TIME ZONE,
    
    -- Referencias
    related_transaction_id UUID REFERENCES hnld_transactions(id),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Tabla de eventos del Escrow (auditoría)
CREATE TABLE IF NOT EXISTS escrow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('created', 'locked', 'released', 'cancelled', 'disputed', 'expired', 'extended')),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Tabla de mensajes/comunicación en Escrow
CREATE TABLE IF NOT EXISTS escrow_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'dispute', 'resolution')),
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de archivos adjuntos del Escrow
CREATE TABLE IF NOT EXISTS escrow_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_escrows_payer_id ON escrows(payer_id);
CREATE INDEX IF NOT EXISTS idx_escrows_payee_id ON escrows(payee_id);
CREATE INDEX IF NOT EXISTS idx_escrows_status ON escrows(status);
CREATE INDEX IF NOT EXISTS idx_escrows_created_at ON escrows(created_at);
CREATE INDEX IF NOT EXISTS idx_escrows_expires_at ON escrows(expires_at);
CREATE INDEX IF NOT EXISTS idx_escrow_events_escrow_id ON escrow_events(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_events_created_at ON escrow_events(created_at);
CREATE INDEX IF NOT EXISTS idx_escrow_messages_escrow_id ON escrow_messages(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_attachments_escrow_id ON escrow_attachments(escrow_id);

-- RLS (Row Level Security)
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para escrows
CREATE POLICY "Users can view own escrows" ON escrows
    FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = payee_id);

CREATE POLICY "Users can create escrows" ON escrows
    FOR INSERT WITH CHECK (auth.uid() = payer_id);

CREATE POLICY "Users can update own escrows" ON escrows
    FOR UPDATE USING (auth.uid() = payer_id OR auth.uid() = payee_id);

-- Políticas RLS para escrow_events
CREATE POLICY "Users can view escrow events" ON escrow_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM escrows e 
            WHERE e.id = escrow_events.escrow_id 
            AND (e.payer_id = auth.uid() OR e.payee_id = auth.uid())
        )
    );

CREATE POLICY "System can insert escrow events" ON escrow_events
    FOR INSERT WITH CHECK (true);

-- Políticas RLS para escrow_messages
CREATE POLICY "Users can view escrow messages" ON escrow_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM escrows e 
            WHERE e.id = escrow_messages.escrow_id 
            AND (e.payer_id = auth.uid() OR e.payee_id = auth.uid())
        )
    );

CREATE POLICY "Users can create escrow messages" ON escrow_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM escrows e 
            WHERE e.id = escrow_messages.escrow_id 
            AND (e.payer_id = auth.uid() OR e.payee_id = auth.uid())
        )
    );

-- Políticas RLS para escrow_attachments
CREATE POLICY "Users can view escrow attachments" ON escrow_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM escrows e 
            WHERE e.id = escrow_attachments.escrow_id 
            AND (e.payer_id = auth.uid() OR e.payee_id = auth.uid())
        )
    );

CREATE POLICY "Users can create escrow attachments" ON escrow_attachments
    FOR INSERT WITH CHECK (
        auth.uid() = uploaded_by AND
        EXISTS (
            SELECT 1 FROM escrows e 
            WHERE e.id = escrow_attachments.escrow_id 
            AND (e.payer_id = auth.uid() OR e.payee_id = auth.uid())
        )
    );

-- Función para crear un Escrow
CREATE OR REPLACE FUNCTION create_escrow(
    p_payee_id UUID,
    p_amount DECIMAL(15,2),
    p_title VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_terms TEXT DEFAULT NULL,
    p_escrow_type VARCHAR(50) DEFAULT 'custom',
    p_expires_in_hours INTEGER DEFAULT 168 -- 7 días por defecto
)
RETURNS UUID AS $$
DECLARE
    v_escrow_id UUID := gen_random_uuid();
    v_current_balance DECIMAL(15,2);
    v_transaction_id UUID;
BEGIN
    -- Verificar balance suficiente del pagador
    SELECT available_balance INTO v_current_balance 
    FROM get_user_hnld_balance(auth.uid());

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Balance insuficiente. Disponible: %, Solicitado: %', v_current_balance, p_amount;
    END IF;

    -- Crear el escrow
    INSERT INTO escrows (
        id, payer_id, payee_id, amount, title, description, terms, 
        escrow_type, expires_at, created_by
    ) VALUES (
        v_escrow_id, auth.uid(), p_payee_id, p_amount, p_title, p_description, p_terms,
        p_escrow_type, NOW() + (p_expires_in_hours || ' hours')::INTERVAL, auth.uid()
    );

    -- Bloquear fondos (reservar en balance)
    UPDATE hnld_balances 
    SET reserved_balance = reserved_balance + p_amount, updated_at = NOW()
    WHERE user_id = auth.uid();

    -- Crear transacción de bloqueo
    INSERT INTO hnld_transactions (
        id, user_id, transaction_type, amount, status, description, to_user_id
    ) VALUES (
        gen_random_uuid(), auth.uid(), 'transfer', p_amount, 'pending', 
        'Escrow: ' || p_title, p_payee_id
    );

    -- Registrar evento
    INSERT INTO escrow_events (
        escrow_id, event_type, old_status, new_status, description, created_by
    ) VALUES (
        v_escrow_id, 'created', NULL, 'pending', 'Escrow creado y fondos bloqueados', auth.uid()
    );

    RETURN v_escrow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para confirmar (lock) un Escrow
CREATE OR REPLACE FUNCTION lock_escrow(p_escrow_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_escrow RECORD;
BEGIN
    -- Obtener información del escrow
    SELECT * INTO v_escrow FROM escrows WHERE id = p_escrow_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Escrow no encontrado';
    END IF;

    -- Verificar permisos (solo el pagador puede confirmar)
    IF v_escrow.payer_id != auth.uid() THEN
        RAISE EXCEPTION 'Solo el pagador puede confirmar el escrow';
    END IF;

    -- Verificar estado
    IF v_escrow.status != 'pending' THEN
        RAISE EXCEPTION 'Solo se pueden confirmar escrows en estado pending';
    END IF;

    -- Actualizar estado
    UPDATE escrows 
    SET status = 'locked', locked_at = NOW(), updated_at = NOW()
    WHERE id = p_escrow_id;

    -- Registrar evento
    INSERT INTO escrow_events (
        escrow_id, event_type, old_status, new_status, description, created_by
    ) VALUES (
        p_escrow_id, 'locked', 'pending', 'locked', 'Escrow confirmado y fondos bloqueados', auth.uid()
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para liberar (release) un Escrow
CREATE OR REPLACE FUNCTION release_escrow(p_escrow_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_escrow RECORD;
    v_transaction_id UUID;
BEGIN
    -- Obtener información del escrow
    SELECT * INTO v_escrow FROM escrows WHERE id = p_escrow_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Escrow no encontrado';
    END IF;

    -- Verificar permisos (pagador o beneficiario pueden liberar)
    IF v_escrow.payer_id != auth.uid() AND v_escrow.payee_id != auth.uid() THEN
        RAISE EXCEPTION 'Solo las partes del escrow pueden liberarlo';
    END IF;

    -- Verificar estado
    IF v_escrow.status != 'locked' THEN
        RAISE EXCEPTION 'Solo se pueden liberar escrows en estado locked';
    END IF;

    -- Transferir fondos al beneficiario
    v_transaction_id := transfer_hnld(
        v_escrow.payer_id, 
        v_escrow.payee_id, 
        v_escrow.amount, 
        'Liberación de Escrow: ' || v_escrow.title
    );

    -- Actualizar estado
    UPDATE escrows 
    SET status = 'released', released_at = NOW(), updated_at = NOW()
    WHERE id = p_escrow_id;

    -- Liberar fondos reservados del pagador
    UPDATE hnld_balances 
    SET reserved_balance = reserved_balance - v_escrow.amount, updated_at = NOW()
    WHERE user_id = v_escrow.payer_id;

    -- Registrar evento
    INSERT INTO escrow_events (
        escrow_id, event_type, old_status, new_status, description, created_by
    ) VALUES (
        p_escrow_id, 'released', 'locked', 'released', 
        COALESCE(p_reason, 'Escrow liberado por ' || 
            CASE WHEN auth.uid() = v_escrow.payer_id THEN 'pagador' ELSE 'beneficiario' END), 
        auth.uid()
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cancelar un Escrow
CREATE OR REPLACE FUNCTION cancel_escrow(p_escrow_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_escrow RECORD;
BEGIN
    -- Obtener información del escrow
    SELECT * INTO v_escrow FROM escrows WHERE id = p_escrow_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Escrow no encontrado';
    END IF;

    -- Verificar permisos (solo el pagador puede cancelar)
    IF v_escrow.payer_id != auth.uid() THEN
        RAISE EXCEPTION 'Solo el pagador puede cancelar el escrow';
    END IF;

    -- Verificar estado
    IF v_escrow.status NOT IN ('pending', 'locked') THEN
        RAISE EXCEPTION 'Solo se pueden cancelar escrows en estado pending o locked';
    END IF;

    -- Liberar fondos reservados
    UPDATE hnld_balances 
    SET reserved_balance = reserved_balance - v_escrow.amount, updated_at = NOW()
    WHERE user_id = v_escrow.payer_id;

    -- Actualizar estado
    UPDATE escrows 
    SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
    WHERE id = p_escrow_id;

    -- Registrar evento
    INSERT INTO escrow_events (
        escrow_id, event_type, old_status, new_status, description, created_by
    ) VALUES (
        p_escrow_id, 'cancelled', v_escrow.status, 'cancelled', 
        COALESCE(p_reason, 'Escrow cancelado por el pagador'), 
        auth.uid()
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para disputar un Escrow
CREATE OR REPLACE FUNCTION dispute_escrow(p_escrow_id UUID, p_reason TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_escrow RECORD;
BEGIN
    -- Obtener información del escrow
    SELECT * INTO v_escrow FROM escrows WHERE id = p_escrow_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Escrow no encontrado';
    END IF;

    -- Verificar permisos (cualquiera de las partes puede disputar)
    IF v_escrow.payer_id != auth.uid() AND v_escrow.payee_id != auth.uid() THEN
        RAISE EXCEPTION 'Solo las partes del escrow pueden disputarlo';
    END IF;

    -- Verificar estado
    IF v_escrow.status != 'locked' THEN
        RAISE EXCEPTION 'Solo se pueden disputar escrows en estado locked';
    END IF;

    -- Actualizar estado
    UPDATE escrows 
    SET status = 'disputed', dispute_reason = p_reason, dispute_created_at = NOW(), updated_at = NOW()
    WHERE id = p_escrow_id;

    -- Registrar evento
    INSERT INTO escrow_events (
        escrow_id, event_type, old_status, new_status, description, created_by
    ) VALUES (
        p_escrow_id, 'disputed', 'locked', 'disputed', 
        'Escrow disputado: ' || p_reason, 
        auth.uid()
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener escrows del usuario
CREATE OR REPLACE FUNCTION get_user_escrows(
    p_user_id UUID,
    p_status VARCHAR(20) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    payer_id UUID,
    payee_id UUID,
    amount DECIMAL(15,2),
    status VARCHAR(20),
    escrow_type VARCHAR(50),
    title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.payer_id,
        e.payee_id,
        e.amount,
        e.status,
        e.escrow_type,
        e.title,
        e.description,
        e.created_at,
        e.expires_at,
        e.locked_at,
        e.released_at,
        e.cancelled_at
    FROM escrows e
    WHERE (e.payer_id = p_user_id OR e.payee_id = p_user_id)
    AND (p_status IS NULL OR e.status = p_status)
    ORDER BY e.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener eventos de un escrow
CREATE OR REPLACE FUNCTION get_escrow_events(p_escrow_id UUID)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(50),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    created_by UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ee.id,
        ee.event_type,
        ee.old_status,
        ee.new_status,
        ee.description,
        ee.created_at,
        ee.created_by
    FROM escrow_events ee
    WHERE ee.escrow_id = p_escrow_id
    ORDER BY ee.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener mensajes de un escrow
CREATE OR REPLACE FUNCTION get_escrow_messages(
    p_escrow_id UUID,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    message TEXT,
    message_type VARCHAR(20),
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        em.id,
        em.sender_id,
        em.message,
        em.message_type,
        em.is_public,
        em.created_at
    FROM escrow_messages em
    WHERE em.escrow_id = p_escrow_id
    ORDER BY em.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para agregar mensaje a un escrow
CREATE OR REPLACE FUNCTION add_escrow_message(
    p_escrow_id UUID,
    p_message TEXT,
    p_message_type VARCHAR(20) DEFAULT 'text'
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID := gen_random_uuid();
BEGIN
    -- Verificar que el usuario es parte del escrow
    IF NOT EXISTS (
        SELECT 1 FROM escrows 
        WHERE id = p_escrow_id 
        AND (payer_id = auth.uid() OR payee_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para agregar mensajes a este escrow';
    END IF;

    -- Insertar mensaje
    INSERT INTO escrow_messages (
        id, escrow_id, sender_id, message, message_type
    ) VALUES (
        v_message_id, p_escrow_id, auth.uid(), p_message, p_message_type
    );

    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE escrows IS 'Sistema de depósito en garantía (Escrow) con estados lock/release';
COMMENT ON TABLE escrow_events IS 'Auditoría de eventos del sistema Escrow';
COMMENT ON TABLE escrow_messages IS 'Mensajes y comunicación en Escrows';
COMMENT ON TABLE escrow_attachments IS 'Archivos adjuntos en Escrows';
