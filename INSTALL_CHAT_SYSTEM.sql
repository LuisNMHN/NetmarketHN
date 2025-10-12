-- =========================================================
-- NMHN - INSTALACIÓN PASO A PASO DEL SISTEMA DE CHAT
-- =========================================================
-- Script para instalar el sistema de chat de manera segura

-- PASO 1: Verificar que las tablas base existen
SELECT 'PASO 1: Verificando tablas base...' as status;

-- Verificar tabla de roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
        RAISE EXCEPTION 'Tabla "roles" no existe. Ejecuta primero CREATE_PROFILE_TRIGGER.sql';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        RAISE EXCEPTION 'Tabla "user_roles" no existe. Ejecuta primero CREATE_PROFILE_TRIGGER.sql';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_requests') THEN
        RAISE EXCEPTION 'Tabla "purchase_requests" no existe. Ejecuta primero CREATE_PURCHASE_REQUESTS_SYSTEM.sql';
    END IF;
    
    RAISE NOTICE 'Tablas base verificadas correctamente';
END $$;

-- PASO 2: Crear tablas del chat
SELECT 'PASO 2: Creando tablas del chat...' as status;

-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unicidad: una conversación por solicitud_id y pareja
    UNIQUE(solicitud_id)
);

-- Tabla de participantes de conversación
CREATE TABLE IF NOT EXISTS chat_conversation_participants (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cleared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- PK compuesta
    PRIMARY KEY (conversation_id, user_id)
);

-- Tabla de mensajes
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

-- Tabla de estado de escritura (efímero)
CREATE TABLE IF NOT EXISTS chat_typing_status (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (conversation_id, user_id)
);

-- PASO 3: Crear índices
SELECT 'PASO 3: Creando índices...' as status;

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

-- PASO 4: Habilitar RLS
SELECT 'PASO 4: Habilitando RLS...' as status;

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_status ENABLE ROW LEVEL SECURITY;

-- PASO 5: Crear funciones de verificación de rol
SELECT 'PASO 5: Creando funciones de verificación de rol...' as status;

-- Función para verificar rol de usuario
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

-- Función para verificar si es admin
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

-- PASO 6: Crear políticas RLS
SELECT 'PASO 6: Creando políticas RLS...' as status;

-- Políticas para chat_conversations
DROP POLICY IF EXISTS "chat_conversations_select_user_only" ON chat_conversations;
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

DROP POLICY IF EXISTS "chat_conversations_insert_user_only" ON chat_conversations;
CREATE POLICY "chat_conversations_insert_user_only" ON chat_conversations
    FOR INSERT WITH CHECK (
        public.is_user_role(auth.uid())
    );

DROP POLICY IF EXISTS "chat_conversations_update_user_only" ON chat_conversations;
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

-- Políticas para chat_conversation_participants
DROP POLICY IF EXISTS "chat_participants_select_user_only" ON chat_conversation_participants;
CREATE POLICY "chat_participants_select_user_only" ON chat_conversation_participants
    FOR SELECT USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

DROP POLICY IF EXISTS "chat_participants_insert_user_only" ON chat_conversation_participants;
CREATE POLICY "chat_participants_insert_user_only" ON chat_conversation_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

DROP POLICY IF EXISTS "chat_participants_update_user_only" ON chat_conversation_participants;
CREATE POLICY "chat_participants_update_user_only" ON chat_conversation_participants
    FOR UPDATE USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- Políticas para chat_messages
DROP POLICY IF EXISTS "chat_messages_select_user_only" ON chat_messages;
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

DROP POLICY IF EXISTS "chat_messages_insert_user_only" ON chat_messages;
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

DROP POLICY IF EXISTS "chat_messages_update_user_only" ON chat_messages;
CREATE POLICY "chat_messages_update_user_only" ON chat_messages
    FOR UPDATE USING (
        sender_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- Políticas para chat_typing_status
DROP POLICY IF EXISTS "chat_typing_select_user_only" ON chat_typing_status;
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

DROP POLICY IF EXISTS "chat_typing_insert_user_only" ON chat_typing_status;
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

DROP POLICY IF EXISTS "chat_typing_update_user_only" ON chat_typing_status;
CREATE POLICY "chat_typing_update_user_only" ON chat_typing_status
    FOR UPDATE USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

DROP POLICY IF EXISTS "chat_typing_delete_user_only" ON chat_typing_status;
CREATE POLICY "chat_typing_delete_user_only" ON chat_typing_status
    FOR DELETE USING (
        user_id = auth.uid() 
        AND public.is_user_role(auth.uid())
    );

-- PASO 7: Crear funciones RPC
SELECT 'PASO 7: Creando funciones RPC...' as status;

-- Función para crear o obtener conversación
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

-- Función para marcar mensajes como leídos
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

-- Función para limpiar historial
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

-- Función para eliminar mensaje propio
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

-- PASO 8: Crear triggers
SELECT 'PASO 8: Creando triggers...' as status;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

-- PASO 9: Habilitar Realtime
SELECT 'PASO 9: Habilitando Realtime...' as status;

-- Agregar tablas a la publicación de Realtime (idempotente)
DO $$
BEGIN
    -- Agregar chat_conversations si no está ya en la publicación
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'chat_conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
    END IF;
    
    -- Agregar chat_conversation_participants si no está ya en la publicación
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'chat_conversation_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversation_participants;
    END IF;
    
    -- Agregar chat_messages si no está ya en la publicación
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    END IF;
    
    -- Agregar chat_typing_status si no está ya en la publicación
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'chat_typing_status'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_status;
    END IF;
END $$;

-- PASO 10: Crear bucket de storage
SELECT 'PASO 10: Creando bucket de storage...' as status;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat_attachments',
    'chat_attachments',
    false, -- Privado
    10485760, -- 10MB límite
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- PASO 11: Crear funciones de storage
SELECT 'PASO 11: Creando funciones de storage...' as status;

-- Función para generar URL firmada de adjunto
CREATE OR REPLACE FUNCTION public.get_chat_attachment_url(
    p_conversation_id UUID,
    p_filename TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_url TEXT;
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden acceder a adjuntos';
    END IF;
    
    -- Verificar que el usuario es participante de la conversación
    IF NOT EXISTS (
        SELECT 1 
        FROM chat_conversation_participants cp
        WHERE cp.conversation_id = p_conversation_id
        AND cp.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: no eres participante de esta conversación';
    END IF;
    
    -- Generar URL firmada con expiración corta (1 hora)
    SELECT storage.create_signed_url(
        'chat_attachments',
        p_conversation_id::text || '/' || p_filename,
        3600 -- 1 hora en segundos
    ) INTO v_url;
    
    RETURN v_url;
END;
$$;

-- PASO 12: Verificación final
SELECT 'PASO 12: Verificación final...' as status;

-- Verificar que todo se creó correctamente
SELECT 
    'Tablas del chat' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ Todas las tablas existen'
        ELSE '❌ Faltan tablas'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'chat_%'

UNION ALL

SELECT 
    'Políticas RLS' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 12 THEN '✅ Políticas suficientes'
        ELSE '❌ Faltan políticas'
    END as status
FROM pg_policies 
WHERE tablename LIKE 'chat_%'

UNION ALL

SELECT 
    'Funciones RPC' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 6 THEN '✅ Funciones suficientes'
        ELSE '❌ Faltan funciones'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%chat%' OR routine_name LIKE '%user_role%' OR routine_name LIKE '%admin_role%')

UNION ALL

SELECT 
    'Bucket de storage' as component,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ Bucket configurado'
        ELSE '❌ Bucket no configurado'
    END as status
FROM storage.buckets 
WHERE name = 'chat_attachments';

-- Estado final
SELECT 'Sistema de chat NMHN instalado exitosamente' as final_status;
SELECT 'Restricción de rol: Solo usuarios con rol "user" pueden usar el chat' as restriction_note;
SELECT 'Administradores están completamente excluidos del sistema' as admin_exclusion;
SELECT 'Bucket de storage configurado para adjuntos privados' as storage_note;
