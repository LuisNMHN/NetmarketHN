-- =========================================================
-- NMHN - SISTEMA DE CHAT COMPLETO
-- =========================================================
-- Sistema de chat en tiempo real para negociaciones de HNLD
-- Incluye conversaciones, mensajes, adjuntos y notificaciones

-- 1. Tabla de conversaciones de chat
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participantes de la conversación
    participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Contexto de la conversación (opcional)
    purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL,
    
    -- Estado de la conversación
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    
    -- Configuración de notificaciones por usuario
    participant_1_notifications BOOLEAN DEFAULT true,
    participant_2_notifications BOOLEAN DEFAULT true,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Restricciones
    UNIQUE(participant_1_id, participant_2_id),
    CHECK(participant_1_id != participant_2_id)
);

-- 2. Tabla de mensajes de chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    
    -- Información del mensaje
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'system')),
    
    -- Contenido del mensaje
    content TEXT,
    metadata JSONB, -- Para información adicional como tamaño de archivo, tipo MIME, etc.
    
    -- Estado del mensaje
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES auth.users(id),
    
    -- Estado de lectura
    read_by_participant_1 BOOLEAN DEFAULT false,
    read_by_participant_2 BOOLEAN DEFAULT false,
    read_at_participant_1 TIMESTAMP WITH TIME ZONE,
    read_at_participant_2 TIMESTAMP WITH TIME ZONE,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de adjuntos de chat
CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    -- Información del archivo
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    
    -- URLs de almacenamiento
    storage_path TEXT NOT NULL,
    public_url TEXT,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de estado de escritura (typing indicators)
CREATE TABLE IF NOT EXISTS chat_typing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Estado de escritura
    is_typing BOOLEAN DEFAULT false,
    last_typing_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Restricción única por conversación y usuario
    UNIQUE(conversation_id, user_id)
);

-- 5. Tabla de notificaciones de chat
CREATE TABLE IF NOT EXISTS chat_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    -- Información de la notificación
    notification_type VARCHAR(20) NOT NULL DEFAULT 'message' CHECK (notification_type IN ('message', 'typing', 'read')),
    title TEXT,
    body TEXT,
    
    -- Estado de la notificación
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =========================================================

-- Índices para chat_conversations
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_1 ON chat_conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_2 ON chat_conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);

-- Índices para chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON chat_messages(is_deleted) WHERE is_deleted = false;

-- Índices para chat_attachments
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_type ON chat_attachments(file_type);

-- Índices para chat_typing_status
CREATE INDEX IF NOT EXISTS idx_chat_typing_conversation ON chat_typing_status(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_user ON chat_typing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_status ON chat_typing_status(is_typing) WHERE is_typing = true;

-- Índices para chat_notifications
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user ON chat_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_conversation ON chat_notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_unread ON chat_notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_chat_notifications_created_at ON chat_notifications(created_at DESC);

-- =========================================================
-- FUNCIONES AUXILIARES
-- =========================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_chat_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para actualizar last_message_at en conversaciones
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations 
    SET last_message_at = NEW.created_at, updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para crear conversación automáticamente
CREATE OR REPLACE FUNCTION create_chat_conversation(
    p_participant_1_id UUID,
    p_participant_2_id UUID,
    p_purchase_request_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- Verificar que los usuarios existen y son diferentes
    IF p_participant_1_id = p_participant_2_id THEN
        RAISE EXCEPTION 'Los participantes deben ser diferentes';
    END IF;
    
    -- Verificar que los usuarios existen en auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_participant_1_id) THEN
        RAISE EXCEPTION 'Participante 1 no existe';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_participant_2_id) THEN
        RAISE EXCEPTION 'Participante 2 no existe';
    END IF;
    
    -- Crear o obtener conversación existente
    INSERT INTO chat_conversations (participant_1_id, participant_2_id, purchase_request_id)
    VALUES (p_participant_1_id, p_participant_2_id, p_purchase_request_id)
    ON CONFLICT (participant_1_id, participant_2_id) 
    DO UPDATE SET 
        purchase_request_id = COALESCE(EXCLUDED.purchase_request_id, chat_conversations.purchase_request_id),
        updated_at = NOW()
    RETURNING id INTO v_conversation_id;
    
    RETURN v_conversation_id;
END;
$$;

-- Función para obtener conversaciones de un usuario
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
    conversation_id UUID,
    other_participant_id UUID,
    other_participant_name TEXT,
    other_participant_avatar TEXT,
    last_message_content TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count BIGINT,
    purchase_request_id UUID,
    purchase_request_amount DECIMAL,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as conversation_id,
        CASE 
            WHEN c.participant_1_id = p_user_id THEN c.participant_2_id
            ELSE c.participant_1_id
        END as other_participant_id,
        CASE 
            WHEN c.participant_1_id = p_user_id THEN p2.full_name
            ELSE p1.full_name
        END as other_participant_name,
        CASE 
            WHEN c.participant_1_id = p_user_id THEN up2.avatar_url
            ELSE up1.avatar_url
        END as other_participant_avatar,
        lm.content as last_message_content,
        c.last_message_at,
        COALESCE(unread.count, 0) as unread_count,
        c.purchase_request_id,
        pr.amount as purchase_request_amount,
        c.status
    FROM chat_conversations c
    LEFT JOIN profiles p1 ON p1.id = c.participant_1_id
    LEFT JOIN profiles p2 ON p2.id = c.participant_2_id
    LEFT JOIN user_profiles up1 ON up1.user_id = c.participant_1_id
    LEFT JOIN user_profiles up2 ON up2.user_id = c.participant_2_id
    LEFT JOIN purchase_requests pr ON pr.id = c.purchase_request_id
    LEFT JOIN chat_messages lm ON lm.id = (
        SELECT id FROM chat_messages 
        WHERE conversation_id = c.id 
        AND is_deleted = false 
        ORDER BY created_at DESC 
        LIMIT 1
    )
    LEFT JOIN (
        SELECT 
            conversation_id,
            COUNT(*) as count
        FROM chat_messages 
        WHERE sender_id != p_user_id 
        AND is_deleted = false
        AND (
            (conversation_id IN (
                SELECT id FROM chat_conversations 
                WHERE participant_1_id = p_user_id
            ) AND read_by_participant_1 = false)
            OR
            (conversation_id IN (
                SELECT id FROM chat_conversations 
                WHERE participant_2_id = p_user_id
            ) AND read_by_participant_2 = false)
        )
        GROUP BY conversation_id
    ) unread ON unread.conversation_id = c.id
    WHERE c.participant_1_id = p_user_id OR c.participant_2_id = p_user_id
    ORDER BY c.last_message_at DESC;
END;
$$;

-- =========================================================
-- TRIGGERS
-- =========================================================

-- Trigger para actualizar updated_at en chat_conversations
CREATE TRIGGER update_chat_conversations_updated_at 
    BEFORE UPDATE ON chat_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

-- Trigger para actualizar updated_at en chat_messages
CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

-- Trigger para actualizar updated_at en chat_typing_status
CREATE TRIGGER update_chat_typing_status_updated_at 
    BEFORE UPDATE ON chat_typing_status 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

-- Trigger para actualizar last_message_at cuando se inserta un mensaje
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- =========================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =========================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para chat_conversations
CREATE POLICY "Users can view their own conversations" ON chat_conversations
    FOR SELECT USING (
        auth.uid() = participant_1_id OR auth.uid() = participant_2_id
    );

CREATE POLICY "Users can create conversations" ON chat_conversations
    FOR INSERT WITH CHECK (
        auth.uid() = participant_1_id OR auth.uid() = participant_2_id
    );

CREATE POLICY "Users can update their own conversations" ON chat_conversations
    FOR UPDATE USING (
        auth.uid() = participant_1_id OR auth.uid() = participant_2_id
    );

-- Políticas para chat_messages
CREATE POLICY "Users can view messages in their conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c 
            WHERE c.id = conversation_id 
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages to their conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chat_conversations c 
            WHERE c.id = conversation_id 
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON chat_messages
    FOR DELETE USING (sender_id = auth.uid());

-- Políticas para chat_attachments
CREATE POLICY "Users can view attachments in their conversations" ON chat_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_messages m
            JOIN chat_conversations c ON c.id = m.conversation_id
            WHERE m.id = message_id 
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can create attachments in their messages" ON chat_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_messages m
            JOIN chat_conversations c ON c.id = m.conversation_id
            WHERE m.id = message_id 
            AND m.sender_id = auth.uid()
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

-- Políticas para chat_typing_status
CREATE POLICY "Users can view typing status in their conversations" ON chat_typing_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c 
            WHERE c.id = conversation_id 
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own typing status" ON chat_typing_status
    FOR ALL USING (user_id = auth.uid());

-- Políticas para chat_notifications
CREATE POLICY "Users can view their own notifications" ON chat_notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON chat_notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON chat_notifications
    FOR INSERT WITH CHECK (true); -- Permitir creación por el sistema

-- =========================================================
-- BUCKET DE STORAGE PARA ADJUNTOS
-- =========================================================

-- Crear bucket para archivos de chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments',
    false,
    10485760, -- 10MB límite
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Política para el bucket de chat-attachments
CREATE POLICY "Users can upload chat attachments" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-attachments' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view chat attachments" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'chat-attachments' AND
        EXISTS (
            SELECT 1 FROM chat_attachments ca
            JOIN chat_messages m ON m.id = ca.message_id
            JOIN chat_conversations c ON c.id = m.conversation_id
            WHERE ca.storage_path = name
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can delete their chat attachments" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-attachments' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- =========================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =========================================================

COMMENT ON TABLE chat_conversations IS 'Conversaciones de chat entre usuarios para negociaciones de HNLD';
COMMENT ON TABLE chat_messages IS 'Mensajes individuales dentro de las conversaciones de chat';
COMMENT ON TABLE chat_attachments IS 'Archivos adjuntos en los mensajes de chat';
COMMENT ON TABLE chat_typing_status IS 'Estado de escritura en tiempo real para indicadores de typing';
COMMENT ON TABLE chat_notifications IS 'Notificaciones de chat para usuarios';

COMMENT ON COLUMN chat_conversations.purchase_request_id IS 'ID de la solicitud de compra relacionada (opcional)';
COMMENT ON COLUMN chat_messages.message_type IS 'Tipo de mensaje: text, image, document, system';
COMMENT ON COLUMN chat_messages.metadata IS 'Metadatos adicionales del mensaje en formato JSON';
COMMENT ON COLUMN chat_attachments.storage_path IS 'Ruta del archivo en el bucket de storage';

-- =========================================================
-- VERIFICACIÓN FINAL
-- =========================================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    'chat_conversations' as table_name,
    COUNT(*) as row_count
FROM chat_conversations
UNION ALL
SELECT 
    'chat_messages' as table_name,
    COUNT(*) as row_count
FROM chat_messages
UNION ALL
SELECT 
    'chat_attachments' as table_name,
    COUNT(*) as row_count
FROM chat_attachments
UNION ALL
SELECT 
    'chat_typing_status' as table_name,
    COUNT(*) as row_count
FROM chat_typing_status
UNION ALL
SELECT 
    'chat_notifications' as table_name,
    COUNT(*) as row_count
FROM chat_notifications;

-- Verificar políticas RLS
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename LIKE 'chat_%'
ORDER BY tablename, policyname;

-- Verificar bucket de storage
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets 
WHERE id = 'chat-attachments';

