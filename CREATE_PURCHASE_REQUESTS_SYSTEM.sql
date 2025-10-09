-- Sistema de Solicitudes de Compra HNLD
-- Corazón de NMHN - Alimentación de fondos

-- 1. Tabla de solicitudes de compra
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información de la solicitud
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'HNLD',
    description TEXT,
    
    -- Estado de la solicitud
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'negotiating', 'accepted', 'completed', 'cancelled', 'expired')),
    
    -- Información del vendedor (cuando se acepta)
    seller_id UUID REFERENCES auth.users(id),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Términos de la transacción
    terms TEXT, -- Términos negociados
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000, -- Tasa de cambio si aplica
    
    -- Fechas importantes
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadatos
    metadata JSONB
);

-- 2. Tabla de ofertas de vendedores
CREATE TABLE IF NOT EXISTS purchase_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información de la oferta
    offered_amount DECIMAL(15,2) NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    terms TEXT,
    message TEXT, -- Mensaje del vendedor al comprador
    
    -- Estado de la oferta
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    
    -- Fechas
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar ofertas duplicadas
    UNIQUE(request_id, seller_id)
);

-- 3. Tabla de transacciones de compra
CREATE TABLE IF NOT EXISTS purchase_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información de la transacción
    amount DECIMAL(15,2) NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    final_amount DECIMAL(15,2) NOT NULL, -- Monto final después de tasa de cambio
    
    -- Estado de la transacción
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'payment_sent', 'payment_confirmed', 'hnld_transferred', 'completed', 'disputed', 'cancelled')),
    
    -- Información de pago
    payment_method VARCHAR(50), -- 'bank_transfer', 'cash', 'mobile_payment', etc.
    payment_reference TEXT, -- Referencia del pago
    payment_proof_url TEXT, -- URL del comprobante de pago
    
    -- Fechas importantes
    payment_sent_at TIMESTAMP WITH TIME ZONE,
    payment_confirmed_at TIMESTAMP WITH TIME ZONE,
    hnld_transferred_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadatos
    metadata JSONB
);

-- 4. Tabla de notificaciones de solicitudes
CREATE TABLE IF NOT EXISTS request_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_id UUID REFERENCES purchase_requests(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES purchase_offers(id) ON DELETE CASCADE,
    
    -- Información de la notificación
    type VARCHAR(50) NOT NULL CHECK (type IN ('new_request', 'new_offer', 'offer_accepted', 'offer_rejected', 'payment_sent', 'payment_confirmed', 'transaction_completed', 'request_expired')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Estado de la notificación
    is_read BOOLEAN NOT NULL DEFAULT false,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_purchase_requests_buyer_id ON purchase_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_seller_id ON purchase_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON purchase_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_expires_at ON purchase_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_purchase_offers_request_id ON purchase_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_offers_seller_id ON purchase_offers(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_offers_status ON purchase_offers(status);

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_request_id ON purchase_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_buyer_id ON purchase_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_seller_id ON purchase_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_status ON purchase_transactions(status);

CREATE INDEX IF NOT EXISTS idx_request_notifications_user_id ON request_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_request_notifications_is_read ON request_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_request_notifications_created_at ON request_notifications(created_at);

-- RLS (Row Level Security)
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_notifications ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can create own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Users can update own purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Anyone can view active purchase requests" ON purchase_requests;

DROP POLICY IF EXISTS "Users can view offers on their requests" ON purchase_offers;
DROP POLICY IF EXISTS "Users can create offers" ON purchase_offers;
DROP POLICY IF EXISTS "Users can update own offers" ON purchase_offers;

DROP POLICY IF EXISTS "Users can view own transactions" ON purchase_transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON purchase_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON purchase_transactions;

DROP POLICY IF EXISTS "Users can view own notifications" ON request_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON request_notifications;

-- Políticas RLS para purchase_requests
CREATE POLICY "Users can view own purchase requests" ON purchase_requests
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create own purchase requests" ON purchase_requests
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update own purchase requests" ON purchase_requests
    FOR UPDATE USING (auth.uid() = buyer_id);

-- Política para que todos puedan ver solicitudes activas (excepto el propio comprador)
CREATE POLICY "Anyone can view active purchase requests" ON purchase_requests
    FOR SELECT USING (status = 'active' AND auth.uid() != buyer_id);

-- Políticas RLS para purchase_offers
CREATE POLICY "Users can view offers on their requests" ON purchase_offers
    FOR SELECT USING (
        auth.uid() = seller_id OR 
        EXISTS (SELECT 1 FROM purchase_requests WHERE id = purchase_offers.request_id AND buyer_id = auth.uid())
    );

CREATE POLICY "Users can create offers" ON purchase_offers
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own offers" ON purchase_offers
    FOR UPDATE USING (auth.uid() = seller_id);

-- Políticas RLS para purchase_transactions
CREATE POLICY "Users can view own transactions" ON purchase_transactions
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create transactions" ON purchase_transactions
    FOR INSERT WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can update own transactions" ON purchase_transactions
    FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Políticas RLS para request_notifications
CREATE POLICY "Users can view own notifications" ON request_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON request_notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Función para crear solicitud de compra
CREATE OR REPLACE FUNCTION create_purchase_request(
    p_buyer_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 7
)
RETURNS UUID AS $$
DECLARE
    v_request_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO purchase_requests (
        id, buyer_id, amount, description, expires_at
    ) VALUES (
        v_request_id, p_buyer_id, p_amount, p_description, 
        NOW() + (p_expires_in_days || ' days')::INTERVAL
    );
    
    -- Crear notificación para vendedores potenciales
    INSERT INTO request_notifications (
        user_id, request_id, type, title, message
    ) 
    SELECT 
        u.id, v_request_id, 'new_request', 
        'Nueva solicitud de compra HNLD',
        'Se ha publicado una nueva solicitud de compra por L.' || p_amount || ' HNLD'
    FROM auth.users u
    WHERE u.id != p_buyer_id; -- Notificar a todos excepto al comprador
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear oferta de vendedor
CREATE OR REPLACE FUNCTION create_purchase_offer(
    p_request_id UUID,
    p_seller_id UUID,
    p_offered_amount DECIMAL(15,2),
    p_exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    p_terms TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_offer_id UUID := gen_random_uuid();
    v_buyer_id UUID;
BEGIN
    -- Obtener el comprador de la solicitud
    SELECT buyer_id INTO v_buyer_id FROM purchase_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud de compra no encontrada';
    END IF;
    
    -- Verificar que el vendedor no sea el mismo comprador
    IF p_seller_id = v_buyer_id THEN
        RAISE EXCEPTION 'No puedes hacer una oferta en tu propia solicitud';
    END IF;
    
    -- Crear la oferta
    INSERT INTO purchase_offers (
        id, request_id, seller_id, offered_amount, exchange_rate, terms, message
    ) VALUES (
        v_offer_id, p_request_id, p_seller_id, p_offered_amount, p_exchange_rate, p_terms, p_message
    );
    
    -- Crear notificación para el comprador
    INSERT INTO request_notifications (
        user_id, request_id, offer_id, type, title, message
    ) VALUES (
        v_buyer_id, p_request_id, v_offer_id, 'new_offer',
        'Nueva oferta en tu solicitud',
        'Has recibido una nueva oferta por tu solicitud de compra'
    );
    
    RETURN v_offer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para aceptar oferta
CREATE OR REPLACE FUNCTION accept_purchase_offer(
    p_offer_id UUID,
    p_buyer_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID := gen_random_uuid();
    v_request_id UUID;
    v_seller_id UUID;
    v_amount DECIMAL(15,2);
    v_exchange_rate DECIMAL(10,4);
BEGIN
    -- Obtener información de la oferta
    SELECT o.request_id, o.seller_id, o.offered_amount, o.exchange_rate
    INTO v_request_id, v_seller_id, v_amount, v_exchange_rate
    FROM purchase_offers o
    WHERE o.id = p_offer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oferta no encontrada';
    END IF;
    
    -- Verificar que el comprador sea el dueño de la solicitud
    IF NOT EXISTS (SELECT 1 FROM purchase_requests WHERE id = v_request_id AND buyer_id = p_buyer_id) THEN
        RAISE EXCEPTION 'No tienes permisos para aceptar esta oferta';
    END IF;
    
    -- Actualizar estado de la oferta
    UPDATE purchase_offers 
    SET status = 'accepted', updated_at = NOW()
    WHERE id = p_offer_id;
    
    -- Actualizar estado de la solicitud
    UPDATE purchase_requests 
    SET status = 'accepted', seller_id = v_seller_id, accepted_at = NOW(), updated_at = NOW()
    WHERE id = v_request_id;
    
    -- Crear transacción
    INSERT INTO purchase_transactions (
        id, request_id, buyer_id, seller_id, amount, exchange_rate, final_amount
    ) VALUES (
        v_transaction_id, v_request_id, p_buyer_id, v_seller_id, v_amount, v_exchange_rate, v_amount
    );
    
    -- Crear notificaciones
    INSERT INTO request_notifications (user_id, request_id, offer_id, type, title, message) VALUES
    (p_buyer_id, v_request_id, p_offer_id, 'offer_accepted', 'Oferta aceptada', 'Has aceptado una oferta. Procede con el pago.'),
    (v_seller_id, v_request_id, p_offer_id, 'offer_accepted', 'Tu oferta fue aceptada', 'El comprador ha aceptado tu oferta. Espera el pago.');
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener solicitudes activas (para vendedores, excluyendo las propias)
CREATE OR REPLACE FUNCTION get_active_purchase_requests(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    buyer_id UUID,
    amount DECIMAL(15,2),
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    buyer_name TEXT,
    buyer_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.buyer_id,
        pr.amount,
        pr.description,
        pr.expires_at,
        pr.created_at,
        p.full_name as buyer_name,
        p.email as buyer_email
    FROM purchase_requests pr
    JOIN profiles p ON p.id = pr.buyer_id
    WHERE pr.status = 'active' 
    AND pr.expires_at > NOW()
    AND pr.buyer_id != auth.uid() -- Excluir las propias solicitudes
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener solicitudes del usuario
CREATE OR REPLACE FUNCTION get_user_purchase_requests(
    p_user_id UUID,
    p_status VARCHAR(20) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    amount DECIMAL(15,2),
    description TEXT,
    status VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    offers_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.amount,
        pr.description,
        pr.status,
        pr.expires_at,
        pr.created_at,
        COUNT(po.id) as offers_count
    FROM purchase_requests pr
    LEFT JOIN purchase_offers po ON po.request_id = pr.id AND po.status = 'pending'
    WHERE pr.buyer_id = p_user_id
    AND (p_status IS NULL OR pr.status = p_status)
    GROUP BY pr.id, pr.amount, pr.description, pr.status, pr.expires_at, pr.created_at
    ORDER BY pr.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener notificaciones del usuario
CREATE OR REPLACE FUNCTION get_user_notifications(
    p_user_id UUID,
    p_is_read BOOLEAN DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    request_id UUID,
    offer_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rn.id,
        rn.type,
        rn.title,
        rn.message,
        rn.is_read,
        rn.created_at,
        rn.request_id,
        rn.offer_id
    FROM request_notifications rn
    WHERE rn.user_id = p_user_id
    AND (p_is_read IS NULL OR rn.is_read = p_is_read)
    ORDER BY rn.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar notificación como leída
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE request_notifications 
    SET is_read = true, read_at = NOW()
    WHERE id = p_notification_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS update_purchase_requests_updated_at ON purchase_requests;
DROP TRIGGER IF EXISTS update_purchase_offers_updated_at ON purchase_offers;
DROP TRIGGER IF EXISTS update_purchase_transactions_updated_at ON purchase_transactions;

CREATE TRIGGER update_purchase_requests_updated_at 
    BEFORE UPDATE ON purchase_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_offers_updated_at 
    BEFORE UPDATE ON purchase_offers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_transactions_updated_at 
    BEFORE UPDATE ON purchase_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE purchase_requests IS 'Solicitudes de compra de HNLD - Corazón del sistema NMHN';
COMMENT ON TABLE purchase_offers IS 'Ofertas de vendedores para solicitudes de compra';
COMMENT ON TABLE purchase_transactions IS 'Transacciones completadas de compra de HNLD';
COMMENT ON TABLE request_notifications IS 'Sistema de notificaciones para solicitudes de compra';

COMMENT ON FUNCTION create_purchase_request IS 'Crear nueva solicitud de compra HNLD';
COMMENT ON FUNCTION create_purchase_offer IS 'Crear oferta de vendedor para solicitud';
COMMENT ON FUNCTION accept_purchase_offer IS 'Aceptar oferta y crear transacción';
COMMENT ON FUNCTION get_active_purchase_requests IS 'Obtener solicitudes activas para vendedores';
COMMENT ON FUNCTION get_user_purchase_requests IS 'Obtener solicitudes del usuario';
COMMENT ON FUNCTION get_user_notifications IS 'Obtener notificaciones del usuario';
