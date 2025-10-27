-- =========================================================
-- SCRIPT DE LIMPIEZA Y RECREACIÓN DEL SISTEMA DE CHAT
-- =========================================================
-- Este script elimina todos los componentes del sistema de chat
-- y los recrea desde cero para evitar conflictos

-- =========================================================
-- 1. ELIMINAR FUNCIONES Y TRIGGERS PRIMERO
-- =========================================================

DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON chat_threads;
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
DROP TRIGGER IF EXISTS update_chat_typing_status_updated_at ON chat_typing_status;
DROP TRIGGER IF EXISTS update_thread_last_message_trigger ON chat_messages;

DROP FUNCTION IF EXISTS update_chat_updated_at_column();
DROP FUNCTION IF EXISTS update_thread_last_message();
DROP FUNCTION IF EXISTS cleanup_old_typing_status();
DROP FUNCTION IF EXISTS cleanup_old_rate_limits();

DROP FUNCTION IF EXISTS open_or_get_thread(chat_context_type,text,uuid,uuid,text,jsonb);
DROP FUNCTION IF EXISTS send_chat_message(uuid,uuid,text,chat_message_kind,jsonb);
DROP FUNCTION IF EXISTS get_thread_messages(uuid,uuid,integer,integer);
DROP FUNCTION IF EXISTS mark_thread_as_read(uuid,uuid,uuid);
DROP FUNCTION IF EXISTS get_user_threads(uuid,integer,integer);
DROP FUNCTION IF EXISTS close_chat_thread(uuid,uuid);
DROP FUNCTION IF EXISTS add_support_to_thread(uuid,uuid);

-- =========================================================
-- 2. ELIMINAR TABLAS
-- =========================================================

DROP TABLE IF EXISTS chat_rate_limits CASCADE;
DROP TABLE IF EXISTS chat_typing_status CASCADE;
DROP TABLE IF EXISTS chat_read_status CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_threads CASCADE;

-- =========================================================
-- 3. ELIMINAR TIPOS
-- =========================================================

DROP TYPE IF EXISTS chat_thread_status CASCADE;
DROP TYPE IF EXISTS chat_context_type CASCADE;
DROP TYPE IF EXISTS chat_message_kind CASCADE;

-- =========================================================
-- 4. CREAR TIPOS
-- =========================================================

CREATE TYPE chat_context_type AS ENUM ('order', 'auction', 'ticket', 'dispute');
CREATE TYPE chat_thread_status AS ENUM ('active', 'closed', 'cancelled', 'disputed');
CREATE TYPE chat_message_kind AS ENUM ('user', 'system', 'support');

-- =========================================================
-- 5. CREAR TABLAS
-- =========================================================

CREATE TABLE chat_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    context_type chat_context_type NOT NULL,
    context_id TEXT NOT NULL,
    context_title TEXT,
    context_data JSONB DEFAULT '{}',
    party_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    party_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    support_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status chat_thread_status DEFAULT 'active',
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chat_threads_unique_context UNIQUE (context_type, context_id)
);

CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind chat_message_kind DEFAULT 'user',
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_read_status (
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE chat_typing_status (
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chat_typing_status_unique UNIQUE (thread_id, user_id)
);

CREATE TABLE chat_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 1,
    
    CONSTRAINT chat_rate_limits_unique UNIQUE (user_id, thread_id)
);

-- =========================================================
-- 6. CREAR ÍNDICES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_chat_threads_context ON chat_threads(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_party_a ON chat_threads(party_a);
CREATE INDEX IF NOT EXISTS idx_chat_threads_party_b ON chat_threads(party_b);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_message_at ON chat_threads(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_kind ON chat_messages(kind);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON chat_messages(thread_id, created_at DESC) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_chat_read_status_thread_user ON chat_read_status(thread_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_read_status_user ON chat_read_status(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_typing_status_thread ON chat_typing_status(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_status_user ON chat_typing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_status_updated ON chat_typing_status(updated_at DESC);

-- =========================================================
-- 7. CREAR FUNCIONES AUXILIARES
-- =========================================================

CREATE OR REPLACE FUNCTION update_chat_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_threads 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION cleanup_old_typing_status()
RETURNS void AS $$
BEGIN
    DELETE FROM chat_typing_status 
    WHERE updated_at < NOW() - INTERVAL '30 seconds';
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM chat_rate_limits 
    WHERE last_message_at < NOW() - INTERVAL '1 hour';
END;
$$ language 'plpgsql';

-- =========================================================
-- 8. CREAR TRIGGERS
-- =========================================================

CREATE TRIGGER update_chat_threads_updated_at 
    BEFORE UPDATE ON chat_threads 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER update_chat_typing_status_updated_at 
    BEFORE UPDATE ON chat_typing_status 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER update_thread_last_message_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_thread_last_message();

-- =========================================================
-- 9. CREAR FUNCIONES PRINCIPALES DEL SISTEMA
-- =========================================================

-- Función para abrir o obtener un hilo de chat
CREATE OR REPLACE FUNCTION open_or_get_thread(
    p_context_type chat_context_type,
    p_context_id TEXT,
    p_party_a UUID,
    p_party_b UUID,
    p_context_title TEXT DEFAULT NULL,
    p_context_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    thread_id UUID;
    existing_thread_id UUID;
BEGIN
    -- Verificar que los usuarios existen
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_party_a) THEN
        RAISE EXCEPTION 'Usuario party_a no encontrado';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_party_b) THEN
        RAISE EXCEPTION 'Usuario party_b no encontrado';
    END IF;
    
    -- Buscar hilo existente para este contexto
    -- Primero buscar threads donde el contexto coincide
    SELECT id INTO existing_thread_id
    FROM chat_threads
    WHERE context_type = p_context_type 
    AND context_id = p_context_id;
    
    IF existing_thread_id IS NOT NULL THEN
        RETURN existing_thread_id;
    END IF;
    
    -- Solo crear nuevo hilo si party_a y party_b son diferentes
    IF p_party_a = p_party_b THEN
        RAISE EXCEPTION 'party_a y party_b deben ser diferentes para crear un nuevo thread';
    END IF;
    
    -- Crear nuevo hilo
    INSERT INTO chat_threads (
        context_type, context_id, party_a, party_b,
        context_title, context_data
    ) VALUES (
        p_context_type, p_context_id, p_party_a, p_party_b,
        p_context_title, p_context_data
    ) RETURNING id INTO thread_id;
    
    -- Crear estado de lectura inicial
    INSERT INTO chat_read_status (thread_id, user_id) VALUES (thread_id, p_party_a);
    INSERT INTO chat_read_status (thread_id, user_id) VALUES (thread_id, p_party_b);
    
    RETURN thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para enviar mensaje
CREATE OR REPLACE FUNCTION send_chat_message(
    p_thread_id UUID,
    p_sender_id UUID,
    p_body TEXT,
    p_kind chat_message_kind DEFAULT 'user',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    message_id UUID;
    thread_party_a UUID;
    thread_party_b UUID;
    thread_support_user_id UUID;
    thread_status chat_thread_status;
    rate_limit_count INTEGER;
    last_message_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Verificar que el hilo existe y obtener datos
    SELECT party_a, party_b, support_user_id, status
    INTO thread_party_a, thread_party_b, thread_support_user_id, thread_status
    FROM chat_threads
    WHERE id = p_thread_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hilo de chat no encontrado';
    END IF;
    
    -- Verificar que el hilo no esté cerrado
    IF thread_status IN ('closed', 'cancelled') THEN
        RAISE EXCEPTION 'El chat está cerrado';
    END IF;
    
    -- Verificar permisos del emisor
    IF p_sender_id NOT IN (thread_party_a, thread_party_b, COALESCE(thread_support_user_id, p_sender_id)) THEN
        RAISE EXCEPTION 'No tienes permisos para enviar mensajes en este chat';
    END IF;
    
    -- Verificar rate limiting (solo para mensajes de usuario)
    IF p_kind = 'user' THEN
        SELECT message_count, last_message_at
        INTO rate_limit_count, last_message_time
        FROM chat_rate_limits
        WHERE user_id = p_sender_id AND thread_id = p_thread_id;
        
        IF rate_limit_count IS NOT NULL AND last_message_time > NOW() - INTERVAL '3 seconds' THEN
            RAISE EXCEPTION 'Rate limit: espera 3 segundos entre mensajes';
        END IF;
    END IF;
    
    -- Insertar mensaje
    INSERT INTO chat_messages (thread_id, sender_id, body, kind, metadata)
    VALUES (p_thread_id, p_sender_id, p_body, p_kind, p_metadata)
    RETURNING id INTO message_id;
    
    -- Actualizar rate limit
    IF p_kind = 'user' THEN
        INSERT INTO chat_rate_limits (user_id, thread_id, last_message_at, message_count)
        VALUES (p_sender_id, p_thread_id, NOW(), 1)
        ON CONFLICT (user_id, thread_id)
        DO UPDATE SET 
            last_message_at = NOW(),
            message_count = chat_rate_limits.message_count + 1;
    END IF;
    
    RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener mensajes de un hilo (CORREGIDA)
CREATE OR REPLACE FUNCTION get_thread_messages(
    p_thread_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    thread_id UUID,
    sender_id UUID,
    kind chat_message_kind,
    body TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN
) AS $$
BEGIN
    -- Verificar permisos
    IF NOT EXISTS (
        SELECT 1 FROM chat_threads 
        WHERE chat_threads.id = p_thread_id 
        AND (chat_threads.party_a = p_user_id OR chat_threads.party_b = p_user_id OR chat_threads.support_user_id = p_user_id)
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para ver este chat';
    END IF;
    
    RETURN QUERY
    SELECT 
        chat_messages.id, 
        chat_messages.thread_id,
        chat_messages.sender_id, 
        chat_messages.kind, 
        chat_messages.body, 
        chat_messages.metadata,
        chat_messages.created_at,
        chat_messages.updated_at,
        chat_messages.is_deleted
    FROM chat_messages
    WHERE chat_messages.thread_id = p_thread_id
    AND chat_messages.is_deleted = FALSE
    ORDER BY chat_messages.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar mensajes como leídos (CORREGIDA)
CREATE OR REPLACE FUNCTION mark_thread_as_read(
    p_thread_id UUID,
    p_user_id UUID,
    p_last_message_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    last_msg_id UUID;
BEGIN
    -- Verificar permisos
    IF NOT EXISTS (
        SELECT 1 FROM chat_threads 
        WHERE chat_threads.id = p_thread_id 
        AND (chat_threads.party_a = p_user_id OR chat_threads.party_b = p_user_id OR chat_threads.support_user_id = p_user_id)
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para este chat';
    END IF;
    
    -- Obtener último mensaje si no se especifica
    IF p_last_message_id IS NULL THEN
        SELECT chat_messages.id INTO last_msg_id
        FROM chat_messages
        WHERE chat_messages.thread_id = p_thread_id
        AND chat_messages.is_deleted = FALSE
        ORDER BY chat_messages.created_at DESC
        LIMIT 1;
    ELSE
        last_msg_id := p_last_message_id;
    END IF;
    
    -- Actualizar estado de lectura
    INSERT INTO chat_read_status (thread_id, user_id, last_read_message_id, last_read_at)
    VALUES (p_thread_id, p_user_id, last_msg_id, NOW())
    ON CONFLICT (thread_id, user_id)
    DO UPDATE SET 
        last_read_message_id = last_msg_id,
        last_read_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener hilos del usuario (CORREGIDA)
CREATE OR REPLACE FUNCTION get_user_threads(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    context_type chat_context_type,
    context_id TEXT,
    context_title TEXT,
    party_a UUID,
    party_b UUID,
    support_user_id UUID,
    status chat_thread_status,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count BIGINT,
    other_party_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, 
        t.context_type, 
        t.context_id, 
        t.context_title,
        t.party_a, 
        t.party_b, 
        t.support_user_id, 
        t.status,
        t.last_message_at,
        COALESCE(unread.unread_count, 0)::BIGINT as unread_count,
        CASE 
            WHEN t.party_a = p_user_id THEN 
                COALESCE(pb_profile.display_name, pb_profile.email)
            ELSE 
                COALESCE(pa_profile.display_name, pa_profile.email)
        END as other_party_name
    FROM chat_threads t
    LEFT JOIN (
        SELECT 
            m.thread_id,
            COUNT(*) as unread_count
        FROM chat_messages m
        LEFT JOIN chat_read_status r ON m.thread_id = r.thread_id AND r.user_id = p_user_id
        WHERE m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamp)
        AND m.sender_id != p_user_id
        AND m.is_deleted = FALSE
        GROUP BY m.thread_id
    ) unread ON t.id = unread.thread_id
    LEFT JOIN profiles pa_profile ON t.party_a = pa_profile.id
    LEFT JOIN profiles pb_profile ON t.party_b = pb_profile.id
    WHERE (t.party_a = p_user_id OR t.party_b = p_user_id OR t.support_user_id = p_user_id)
    ORDER BY t.last_message_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 10. POLÍTICAS DE SEGURIDAD RLS
-- =========================================================

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;

-- Políticas para chat_threads
CREATE POLICY "Users can view their own threads"
    ON chat_threads FOR SELECT
    USING (
        auth.uid() = party_a OR 
        auth.uid() = party_b OR 
        auth.uid() = support_user_id
    );

-- Políticas para chat_messages
CREATE POLICY "Users can view messages in their threads"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_messages.thread_id
            AND (
                chat_threads.party_a = auth.uid() OR
                chat_threads.party_b = auth.uid() OR
                chat_threads.support_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert messages in their threads"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_messages.thread_id
            AND (
                chat_threads.party_a = auth.uid() OR
                chat_threads.party_b = auth.uid() OR
                chat_threads.support_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update their own messages"
    ON chat_messages FOR UPDATE
    USING (sender_id = auth.uid());

-- Políticas para chat_read_status
CREATE POLICY "Users can view their own read status"
    ON chat_read_status FOR SELECT
    USING (auth.uid() = user_id);

-- Políticas para chat_typing_status
CREATE POLICY "Users can view typing status in their threads"
    ON chat_typing_status FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_typing_status.thread_id
            AND (
                chat_threads.party_a = auth.uid() OR
                chat_threads.party_b = auth.uid() OR
                chat_threads.support_user_id = auth.uid()
            )
        )
    );

-- Políticas para chat_rate_limits
CREATE POLICY "Users can view their own rate limits"
    ON chat_rate_limits FOR SELECT
    USING (auth.uid() = user_id);

-- =========================================================
-- HABILITAR REALTIME
-- =========================================================

-- Habilitar realtime para las tablas principales
ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_status;

