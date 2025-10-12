-- =========================================================
-- NMHN - SISTEMA DE CHAT 1:1 RESTRINGIDO A USUARIOS NO-ADMIN
-- =========================================================
-- Chat exclusivo para usuarios con rol 'user' (no admin)
-- Basado en solicitud_id de purchase_requests

-- 1. Tabla de conversaciones
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unicidad: una conversación por solicitud_id y pareja
    UNIQUE(solicitud_id)
);

-- 2. Tabla de participantes de conversación
CREATE TABLE IF NOT EXISTS chat_conversation_participants (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cleared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- PK compuesta
    PRIMARY KEY (conversation_id, user_id)
);

-- 3. Tabla de mensajes
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    attachment_url TEXT,
    attachment_type VARCHAR(50), -- 'image', 'pdf', etc.
    attachment_size INTEGER,
    client_message_id UUID, -- Para idempotencia
    is_author_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de estado de escritura (efímero)
CREATE TABLE IF NOT EXISTS chat_typing_status (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (conversation_id, user_id)
);

-- 5. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_conversations_solicitud_id ON chat_conversations(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_at ON chat_conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation_id ON chat_conversation_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_client_id ON chat_messages(client_message_id);

CREATE INDEX IF NOT EXISTS idx_chat_typing_conversation_id ON chat_typing_status(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_user_id ON chat_typing_status(user_id);

-- 6. Habilitar RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_status ENABLE ROW LEVEL SECURITY;

-- 7. Función para verificar rol de usuario
CREATE OR REPLACE FUNCTION public.is_user_role(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id 
        AND r.name = 'user'
    );
END;
$$;

-- 8. Función para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin_role(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id 
        AND r.name = 'admin'
    );
END;
$$;

-- 9. Políticas RLS para chat_conversations
-- SELECT: Solo participantes con rol 'user'
CREATE POLICY "chat_conversations_select_user_only" ON chat_conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM chat_conversation_participants cp
            WHERE cp.conversation_id = chat_conversations.id
            AND cp.user_id = auth.uid()
            AND public.is_user_role(auth.uid())
        )
    );

-- INSERT: Solo usuarios con rol 'user'
CREATE POLICY "chat_conversations_insert_user_only" ON chat_conversations
    FOR INSERT WITH CHECK (
        public.is_user_role(auth.uid())
    );

-- UPDATE: Solo participantes con rol 'user'
CREATE POLICY "chat_conversations_update_user_only" ON chat_conversations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 
            FROM chat_conversation_participants cp
            WHERE cp.conversation_id = chat_conversations.id
            AND cp.user_id = auth.uid()
            AND public.is_user_role(auth.uid())
        )
    );

-- 10. Políticas RLS para chat_conversation_participants
-- SELECT: Solo participantes con rol 'user'
CREATE POLICY "chat_participants_select_user_only" ON chat_conversation_participants
    FOR SELECT USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- INSERT: Solo usuarios con rol 'user'
CREATE POLICY "chat_participants_insert_user_only" ON chat_conversation_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- UPDATE: Solo el dueño de la fila con rol 'user'
CREATE POLICY "chat_participants_update_user_only" ON chat_conversation_participants
    FOR UPDATE USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- 11. Políticas RLS para chat_messages
-- SELECT: Solo participantes con rol 'user'
CREATE POLICY "chat_messages_select_user_only" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM chat_conversation_participants cp
            WHERE cp.conversation_id = chat_messages.conversation_id
            AND cp.user_id = auth.uid()
            AND public.is_user_role(auth.uid())
        )
    );

-- INSERT: Solo usuarios con rol 'user'
CREATE POLICY "chat_messages_insert_user_only" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() 
        AND public.is_user_role(auth.uid())
        AND EXISTS (
            SELECT 1 
            FROM chat_conversation_participants cp
            WHERE cp.conversation_id = chat_messages.conversation_id
            AND cp.user_id = auth.uid()
        )
    );

-- UPDATE: Solo el autor del mensaje con rol 'user'
CREATE POLICY "chat_messages_update_user_only" ON chat_messages
    FOR UPDATE USING (
        sender_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- 12. Políticas RLS para chat_typing_status
-- SELECT: Solo participantes con rol 'user'
CREATE POLICY "chat_typing_select_user_only" ON chat_typing_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM chat_conversation_participants cp
            WHERE cp.conversation_id = chat_typing_status.conversation_id
            AND cp.user_id = auth.uid()
            AND public.is_user_role(auth.uid())
        )
    );

-- INSERT: Solo usuarios con rol 'user'
CREATE POLICY "chat_typing_insert_user_only" ON chat_typing_status
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
        AND EXISTS (
            SELECT 1 
            FROM chat_conversation_participants cp
            WHERE cp.conversation_id = chat_typing_status.conversation_id
            AND cp.user_id = auth.uid()
        )
    );

-- UPDATE: Solo el usuario con rol 'user'
CREATE POLICY "chat_typing_update_user_only" ON chat_typing_status
    FOR UPDATE USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- DELETE: Solo el usuario con rol 'user'
CREATE POLICY "chat_typing_delete_user_only" ON chat_typing_status
    FOR DELETE USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- 13. Función para crear o obtener conversación
CREATE OR REPLACE FUNCTION public.create_or_get_chat_conversation(
    p_solicitud_id UUID,
    p_target_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conversation_id UUID;
    v_current_user_id UUID;
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden crear conversaciones';
    END IF;
    
    -- Verificar que el usuario objetivo tiene rol 'user'
    IF NOT public.is_user_role(p_target_user_id) THEN
        RAISE EXCEPTION 'Acceso denegado: el usuario objetivo debe tener rol "user"';
    END IF;
    
    v_current_user_id := auth.uid();
    
    -- Buscar conversación existente
    SELECT id INTO v_conversation_id
    FROM chat_conversations
    WHERE solicitud_id = p_solicitud_id;
    
    -- Si no existe, crear nueva conversación
    IF v_conversation_id IS NULL THEN
        INSERT INTO chat_conversations (solicitud_id)
        VALUES (p_solicitud_id)
        RETURNING id INTO v_conversation_id;
        
        -- Agregar participantes
        INSERT INTO chat_conversation_participants (conversation_id, user_id)
        VALUES (v_conversation_id, v_current_user_id);
        
        INSERT INTO chat_conversation_participants (conversation_id, user_id)
        VALUES (v_conversation_id, p_target_user_id);
    END IF;
    
    RETURN v_conversation_id;
END;
$$;

-- 14. Función para marcar mensajes como leídos
CREATE OR REPLACE FUNCTION public.mark_chat_messages_read(
    p_conversation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden marcar mensajes como leídos';
    END IF;
    
    -- Actualizar last_read_at
    UPDATE chat_conversation_participants
    SET last_read_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();
END;
$$;

-- 15. Función para limpiar historial
CREATE OR REPLACE FUNCTION public.clear_chat_history(
    p_conversation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden limpiar historial';
    END IF;
    
    -- Actualizar cleared_at
    UPDATE chat_conversation_participants
    SET cleared_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();
END;
$$;

-- 16. Función para eliminar mensaje propio
CREATE OR REPLACE FUNCTION public.delete_own_chat_message(
    p_message_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden eliminar mensajes';
    END IF;
    
    -- Marcar mensaje como eliminado por el autor
    UPDATE chat_messages
    SET is_author_deleted = TRUE, updated_at = NOW()
    WHERE id = p_message_id
    AND sender_id = auth.uid();
END;
$$;

-- 17. Triggers para actualizar updated_at
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

CREATE TRIGGER update_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

-- 18. Habilitar Realtime para las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_status;

-- 19. Comentarios para documentación
COMMENT ON TABLE chat_conversations IS 'Conversaciones de chat 1:1 basadas en solicitud_id';
COMMENT ON TABLE chat_conversation_participants IS 'Participantes de conversaciones de chat';
COMMENT ON TABLE chat_messages IS 'Mensajes de chat con soporte para adjuntos';
COMMENT ON TABLE chat_typing_status IS 'Estado de escritura en tiempo real';

COMMENT ON FUNCTION public.is_user_role IS 'Verifica si un usuario tiene rol "user"';
COMMENT ON FUNCTION public.is_admin_role IS 'Verifica si un usuario tiene rol "admin"';
COMMENT ON FUNCTION public.create_or_get_chat_conversation IS 'Crea o obtiene conversación de chat';
COMMENT ON FUNCTION public.mark_chat_messages_read IS 'Marca mensajes como leídos';
COMMENT ON FUNCTION public.clear_chat_history IS 'Limpia historial de chat para un usuario';
COMMENT ON FUNCTION public.delete_own_chat_message IS 'Elimina mensaje propio';

-- 20. Verificación final
SELECT 'Sistema de chat NMHN creado exitosamente' as status;
SELECT 'Restricción: Solo usuarios con rol "user" pueden usar el chat' as restriction;
SELECT 'Admins están completamente excluidos del sistema de chat' as admin_exclusion;
