-- Sistema de Chat en Vivo para Solicitudes de Compra HNLD
-- Comunicación fluida entre compradores y vendedores

-- 1. Tabla de mensajes de chat
CREATE TABLE IF NOT EXISTS purchase_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Contenido del mensaje
    message TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'offer', 'system', 'file')),
    
    -- Estado del mensaje
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadatos
    metadata JSONB, -- Para arc-hivos, ofertas, etc.
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2. Tabla de conversaciones activas
CREATE TABLE IF NOT EXISTS purchase_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Estado de la conversación
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_id UUID REFERENCES purchase_chat_messages(id),
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar conversaciones duplicadas
    UNIQUE(request_id, buyer_id, seller_id)
);

-- 3. Tabla de usuarios en línea
CREATE TABLE IF NOT EXISTS chat_online_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES purchase_conversations(id) ON DELETE CASCADE,
    
    -- Estado de conexión
    is_online BOOLEAN NOT NULL DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadatos de conexión
    connection_id TEXT, -- ID de la conexión WebSocket
    user_agent TEXT,
    ip_address INET,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de mensajes de sistema (para ofertas, aceptaciones, etc.)
CREATE TABLE IF NOT EXISTS chat_system_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES purchase_conversations(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('offer_sent', 'offer_accepted', 'offer_rejected', 'payment_sent', 'payment_confirmed', 'transaction_completed', 'conversation_started')),
    
    -- Contenido del mensaje
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB, -- Datos adicionales específicos del tipo
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_purchase_chat_messages_request_id ON purchase_chat_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_chat_messages_sender_id ON purchase_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_purchase_chat_messages_receiver_id ON purchase_chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_purchase_chat_messages_created_at ON purchase_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_chat_messages_is_read ON purchase_chat_messages(is_read);

CREATE INDEX IF NOT EXISTS idx_purchase_conversations_request_id ON purchase_conversations(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_conversations_buyer_id ON purchase_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_conversations_seller_id ON purchase_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_conversations_last_message_at ON purchase_conversations(last_message_at);

CREATE INDEX IF NOT EXISTS idx_chat_online_users_user_id ON chat_online_users(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_online_users_is_online ON chat_online_users(is_online);
CREATE INDEX IF NOT EXISTS idx_chat_online_users_last_seen ON chat_online_users(last_seen);

CREATE INDEX IF NOT EXISTS idx_chat_system_messages_conversation_id ON chat_system_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_system_messages_created_at ON chat_system_messages(created_at);

-- RLS (Row Level Security)
ALTER TABLE purchase_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_online_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_system_messages ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON purchase_chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON purchase_chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON purchase_chat_messages;

DROP POLICY IF EXISTS "Users can view their conversations" ON purchase_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON purchase_conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON purchase_conversations;

DROP POLICY IF EXISTS "Users can view online status" ON chat_online_users;
DROP POLICY IF EXISTS "Users can insert own online status" ON chat_online_users;
DROP POLICY IF EXISTS "Users can update own online status" ON chat_online_users;

DROP POLICY IF EXISTS "Users can view system messages in their conversations" ON chat_system_messages;

-- Políticas RLS para purchase_chat_messages
CREATE POLICY "Users can view messages in their conversations" ON purchase_chat_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages in their conversations" ON purchase_chat_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages" ON purchase_chat_messages
    FOR UPDATE USING (auth.uid() = sender_id);

-- Políticas RLS para purchase_conversations
CREATE POLICY "Users can view their conversations" ON purchase_conversations
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create conversations" ON purchase_conversations
    FOR INSERT WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can update their conversations" ON purchase_conversations
    FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Políticas RLS para chat_online_users
CREATE POLICY "Users can view online status" ON chat_online_users
    FOR SELECT USING (true); -- Todos pueden ver quién está en línea

CREATE POLICY "Users can insert own online status" ON chat_online_users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own online status" ON chat_online_users
    FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para chat_system_messages
CREATE POLICY "Users can view system messages in their conversations" ON chat_system_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_conversations pc 
            WHERE pc.id = chat_system_messages.conversation_id 
            AND (pc.buyer_id = auth.uid() OR pc.seller_id = auth.uid())
        )
    );

-- Función para crear o obtener conversación
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_request_id UUID,
    p_buyer_id UUID,
    p_seller_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- Buscar conversación existente
    SELECT id INTO v_conversation_id 
    FROM purchase_conversations 
    WHERE request_id = p_request_id 
    AND buyer_id = p_buyer_id 
    AND seller_id = p_seller_id;
    
    -- Si no existe, crear nueva
    IF v_conversation_id IS NULL THEN
        v_conversation_id := gen_random_uuid();
        INSERT INTO purchase_conversations (id, request_id, buyer_id, seller_id)
        VALUES (v_conversation_id, p_request_id, p_buyer_id, p_seller_id);
        
        -- Crear mensaje de sistema
        INSERT INTO chat_system_messages (conversation_id, message_type, title, message)
        VALUES (v_conversation_id, 'conversation_started', 'Conversación iniciada', 'La conversación ha comenzado');
    END IF;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para enviar mensaje
CREATE OR REPLACE FUNCTION send_chat_message(
    p_request_id UUID,
    p_sender_id UUID,
    p_receiver_id UUID,
    p_message TEXT,
    p_message_type VARCHAR(20) DEFAULT 'text',
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID := gen_random_uuid();
    v_conversation_id UUID;
BEGIN
    -- Obtener o crear conversación
    v_conversation_id := get_or_create_conversation(p_request_id, p_sender_id, p_receiver_id);
    
    -- Insertar mensaje
    INSERT INTO purchase_chat_messages (
        id, request_id, sender_id, receiver_id, message, message_type, metadata
    ) VALUES (
        v_message_id, p_request_id, p_sender_id, p_receiver_id, p_message, p_message_type, p_metadata
    );
    
    -- Actualizar conversación
    UPDATE purchase_conversations 
    SET 
        last_message_at = NOW(),
        last_message_id = v_message_id,
        updated_at = NOW()
    WHERE id = v_conversation_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener mensajes de una conversación
CREATE OR REPLACE FUNCTION get_conversation_messages(
    p_conversation_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    receiver_id UUID,
    message TEXT,
    message_type VARCHAR(20),
    is_read BOOLEAN,
    is_edited BOOLEAN,
    is_deleted BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    sender_name TEXT,
    sender_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pcm.id,
        pcm.sender_id,
        pcm.receiver_id,
        pcm.message,
        pcm.message_type,
        pcm.is_read,
        pcm.is_edited,
        pcm.is_deleted,
        pcm.metadata,
        pcm.created_at,
        pcm.updated_at,
        p.full_name as sender_name,
        p.email as sender_email
    FROM purchase_chat_messages pcm
    JOIN profiles p ON p.id = pcm.sender_id
    WHERE pcm.request_id IN (
        SELECT request_id FROM purchase_conversations WHERE id = p_conversation_id
    )
    AND (pcm.sender_id = p_user_id OR pcm.receiver_id = p_user_id)
    AND pcm.is_deleted = false
    ORDER BY pcm.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener conversaciones del usuario
CREATE OR REPLACE FUNCTION get_user_conversations(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    request_id UUID,
    buyer_id UUID,
    seller_id UUID,
    is_active BOOLEAN,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    other_user_name TEXT,
    other_user_email TEXT,
    request_amount DECIMAL(15,2),
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id,
        pc.request_id,
        pc.buyer_id,
        pc.seller_id,
        pc.is_active,
        pc.last_message_at,
        pc.last_message_id,
        pc.created_at,
        CASE 
            WHEN pc.buyer_id = p_user_id THEN seller_profile.full_name
            ELSE buyer_profile.full_name
        END as other_user_name,
        CASE 
            WHEN pc.buyer_id = p_user_id THEN seller_profile.email
            ELSE buyer_profile.email
        END as other_user_email,
        pr.amount as request_amount,
        COUNT(CASE WHEN pcm.is_read = false AND pcm.receiver_id = p_user_id THEN 1 END) as unread_count
    FROM purchase_conversations pc
    JOIN purchase_requests pr ON pr.id = pc.request_id
    JOIN profiles buyer_profile ON buyer_profile.id = pc.buyer_id
    JOIN profiles seller_profile ON seller_profile.id = pc.seller_id
    LEFT JOIN purchase_chat_messages pcm ON pcm.request_id = pc.request_id
    WHERE (pc.buyer_id = p_user_id OR pc.seller_id = p_user_id)
    AND pc.is_active = true
    GROUP BY pc.id, pc.request_id, pc.buyer_id, pc.seller_id, pc.is_active, 
             pc.last_message_at, pc.last_message_id, pc.created_at,
             seller_profile.full_name, seller_profile.email,
             buyer_profile.full_name, buyer_profile.email, pr.amount
    ORDER BY pc.last_message_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar mensajes como leídos
CREATE OR REPLACE FUNCTION mark_messages_as_read(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE purchase_chat_messages 
    SET 
        is_read = true,
        read_at = NOW()
    WHERE request_id IN (
        SELECT request_id FROM purchase_conversations WHERE id = p_conversation_id
    )
    AND receiver_id = p_user_id
    AND is_read = false;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar estado en línea
CREATE OR REPLACE FUNCTION update_user_online_status(
    p_user_id UUID,
    p_conversation_id UUID DEFAULT NULL,
    p_is_online BOOLEAN DEFAULT true,
    p_connection_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO chat_online_users (user_id, conversation_id, is_online, connection_id, last_seen)
    VALUES (p_user_id, p_conversation_id, p_is_online, p_connection_id, NOW())
    ON CONFLICT (user_id, conversation_id) 
    DO UPDATE SET 
        is_online = p_is_online,
        connection_id = p_connection_id,
        last_seen = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener usuarios en línea
CREATE OR REPLACE FUNCTION get_online_users(
    p_conversation_id UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    is_online BOOLEAN,
    last_seen TIMESTAMP WITH TIME ZONE,
    user_name TEXT,
    user_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cou.user_id,
        cou.is_online,
        cou.last_seen,
        p.full_name as user_name,
        p.email as user_email
    FROM chat_online_users cou
    JOIN profiles p ON p.id = cou.user_id
    WHERE (p_conversation_id IS NULL OR cou.conversation_id = p_conversation_id)
    AND cou.is_online = true
    AND cou.last_seen > NOW() - INTERVAL '5 minutes' -- Considerar en línea si se vio en los últimos 5 minutos
    ORDER BY cou.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear mensaje de sistema
CREATE OR REPLACE FUNCTION create_system_message(
    p_conversation_id UUID,
    p_message_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO chat_system_messages (id, conversation_id, message_type, title, message, metadata)
    VALUES (v_message_id, p_conversation_id, p_message_type, p_title, p_message, p_metadata);
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS update_purchase_chat_messages_updated_at ON purchase_chat_messages;
DROP TRIGGER IF EXISTS update_purchase_conversations_updated_at ON purchase_conversations;
DROP TRIGGER IF EXISTS update_chat_online_users_updated_at ON chat_online_users;

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_purchase_chat_messages_updated_at 
    BEFORE UPDATE ON purchase_chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_conversations_updated_at 
    BEFORE UPDATE ON purchase_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_online_users_updated_at 
    BEFORE UPDATE ON chat_online_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para limpiar usuarios offline (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_offline_users()
RETURNS INTEGER AS $$
DECLARE
    v_cleaned_count INTEGER;
BEGIN
    UPDATE chat_online_users 
    SET is_online = false
    WHERE last_seen < NOW() - INTERVAL '10 minutes';
    
    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
    RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE purchase_chat_messages IS 'Mensajes de chat en tiempo real entre compradores y vendedores';
COMMENT ON TABLE purchase_conversations IS 'Conversaciones activas por solicitud de compra';
COMMENT ON TABLE chat_online_users IS 'Estado de usuarios en línea para chat';
COMMENT ON TABLE chat_system_messages IS 'Mensajes del sistema (ofertas, aceptaciones, etc.)';

COMMENT ON FUNCTION get_or_create_conversation IS 'Obtener o crear conversación entre comprador y vendedor';
COMMENT ON FUNCTION send_chat_message IS 'Enviar mensaje de chat en tiempo real';
COMMENT ON FUNCTION get_conversation_messages IS 'Obtener mensajes de una conversación';
COMMENT ON FUNCTION get_user_conversations IS 'Obtener conversaciones del usuario';
COMMENT ON FUNCTION mark_messages_as_read IS 'Marcar mensajes como leídos';
COMMENT ON FUNCTION update_user_online_status IS 'Actualizar estado en línea del usuario';
COMMENT ON FUNCTION get_online_users IS 'Obtener usuarios en línea';
COMMENT ON FUNCTION create_system_message IS 'Crear mensaje del sistema';
COMMENT ON FUNCTION cleanup_offline_users IS 'Limpiar usuarios offline (ejecutar periódicamente)';
