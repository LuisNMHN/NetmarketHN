-- =========================================================
-- NMHN - SISTEMA DE CHAT TRANSACCIONAL
-- =========================================================
-- Sistema de chat P2P reutilizable para órdenes, subastas, soporte, etc.
-- Integrado con el sistema de notificaciones existente
-- 
-- Características:
-- - Contexto reutilizable (context_type, context_id)
-- - Participantes y permisos (party_a, party_b, support)
-- - Mensajes de usuario, sistema y soporte
-- - Acciones de negociación integradas
-- - Estados y bloqueos por contexto
-- - Realtime con Supabase
-- - RLS estricta y rate limiting
-- =========================================================

-- =========================================================
-- 1. TIPOS PERSONALIZADOS (ENUMS)
-- =========================================================

-- Tipos de contexto para el chat
CREATE TYPE chat_context_type AS ENUM (
    'order',      -- Órdenes de compra/venta
    'auction',    -- Subastas
    'ticket',     -- Tickets de soporte
    'dispute'     -- Disputas
);

-- Tipos de mensaje
CREATE TYPE chat_message_kind AS ENUM (
    'user',       -- Mensajes escritos por usuarios
    'system',     -- Mensajes automáticos del sistema
    'support'     -- Mensajes de agentes de soporte
);

-- Estados del hilo de chat
CREATE TYPE chat_thread_status AS ENUM (
    'active',     -- Chat activo
    'closed',     -- Chat cerrado
    'cancelled',  -- Chat cancelado
    'disputed'    -- Chat en disputa
);

-- =========================================================
-- 2. TABLA DE HILOS DE CHAT (THREADS)
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Contexto reutilizable
    context_type chat_context_type NOT NULL,
    context_id TEXT NOT NULL, -- UUID o ID numérico del contexto
    
    -- Participantes
    party_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    party_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    support_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Soporte opcional
    
    -- Metadatos del contexto
    context_title TEXT, -- Título descriptivo del contexto
    context_data JSONB DEFAULT '{}', -- Datos adicionales del contexto
    
    -- Estado del hilo
    status chat_thread_status NOT NULL DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Restricciones
    CONSTRAINT chat_threads_party_different CHECK (party_a != party_b),
    CONSTRAINT chat_threads_context_unique UNIQUE (context_type, context_id)
);

-- =========================================================
-- 3. TABLA DE MENSAJES
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    
    -- Emisor y tipo
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind chat_message_kind NOT NULL DEFAULT 'user',
    
    -- Contenido
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Datos adicionales (acciones, archivos, etc.)
    
    -- Estado
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Restricciones
    CONSTRAINT chat_messages_body_not_empty CHECK (LENGTH(TRIM(body)) > 0),
    CONSTRAINT chat_messages_max_length CHECK (LENGTH(body) <= 4000)
);

-- =========================================================
-- 4. TABLA DE ESTADO DE LECTURA
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_read_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Restricciones
    CONSTRAINT chat_read_status_unique UNIQUE (thread_id, user_id)
);

-- =========================================================
-- 5. TABLA DE ESTADO DE ESCRITURA (TYPING)
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_typing_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Restricciones
    CONSTRAINT chat_typing_status_unique UNIQUE (thread_id, user_id)
);

-- =========================================================
-- 6. TABLA DE RATE LIMITING
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 1,
    
    -- Restricciones
    CONSTRAINT chat_rate_limits_unique UNIQUE (user_id, thread_id)
);

-- =========================================================
-- 7. ÍNDICES PARA OPTIMIZACIÓN
-- =========================================================

-- Índices para chat_threads
CREATE INDEX IF NOT EXISTS idx_chat_threads_context ON chat_threads(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_party_a ON chat_threads(party_a);
CREATE INDEX IF NOT EXISTS idx_chat_threads_party_b ON chat_threads(party_b);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_message_at ON chat_threads(last_message_at DESC);

-- Índices para chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_kind ON chat_messages(kind);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON chat_messages(thread_id, created_at DESC) WHERE is_deleted = FALSE;

-- Índices para chat_read_status
CREATE INDEX IF NOT EXISTS idx_chat_read_status_thread_user ON chat_read_status(thread_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_read_status_user ON chat_read_status(user_id);

-- Índices para chat_typing_status
CREATE INDEX IF NOT EXISTS idx_chat_typing_status_thread ON chat_typing_status(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_status_user ON chat_typing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_status_updated ON chat_typing_status(updated_at DESC);

-- Índices para chat_rate_limits
CREATE INDEX IF NOT EXISTS idx_chat_rate_limits_user_thread ON chat_rate_limits(user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_rate_limits_last_message ON chat_rate_limits(last_message_at DESC);

-- =========================================================
-- 8. FUNCIONES DE UTILIDAD
-- =========================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_chat_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para actualizar last_message_at en threads
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_threads 
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para limpiar typing status antiguo
CREATE OR REPLACE FUNCTION cleanup_old_typing_status()
RETURNS void AS $$
BEGIN
    DELETE FROM chat_typing_status 
    WHERE updated_at < NOW() - INTERVAL '30 seconds';
END;
$$ language 'plpgsql';

-- Función para limpiar rate limits antiguos
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM chat_rate_limits 
    WHERE last_message_at < NOW() - INTERVAL '1 hour';
END;
$$ language 'plpgsql';

-- =========================================================
-- 9. TRIGGERS
-- =========================================================

-- Triggers para updated_at
CREATE TRIGGER update_chat_threads_updated_at 
    BEFORE UPDATE ON chat_threads 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER update_chat_typing_status_updated_at 
    BEFORE UPDATE ON chat_typing_status 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

-- Trigger para actualizar last_message_at
CREATE TRIGGER update_thread_last_message_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_thread_last_message();

-- =========================================================
-- 10. FUNCIONES PRINCIPALES DEL SISTEMA
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
    
    -- Buscar hilo existente
    SELECT id INTO existing_thread_id
    FROM chat_threads
    WHERE context_type = p_context_type 
    AND context_id = p_context_id;
    
    IF existing_thread_id IS NOT NULL THEN
        RETURN existing_thread_id;
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

-- Función para obtener mensajes de un hilo
CREATE OR REPLACE FUNCTION get_thread_messages(
    p_thread_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    kind chat_message_kind,
    body TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN
) AS $$
BEGIN
    -- Verificar permisos
    IF NOT EXISTS (
        SELECT 1 FROM chat_threads 
        WHERE id = p_thread_id 
        AND (party_a = p_user_id OR party_b = p_user_id OR support_user_id = p_user_id)
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para ver este chat';
    END IF;
    
    RETURN QUERY
    SELECT 
        m.id, m.sender_id, m.kind, m.body, m.metadata,
        m.created_at, m.is_deleted
    FROM chat_messages m
    WHERE m.thread_id = p_thread_id
    AND m.is_deleted = FALSE
    ORDER BY m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar mensajes como leídos
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
        WHERE id = p_thread_id 
        AND (party_a = p_user_id OR party_b = p_user_id OR support_user_id = p_user_id)
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para este chat';
    END IF;
    
    -- Obtener último mensaje si no se especifica
    IF p_last_message_id IS NULL THEN
        SELECT id INTO last_msg_id
        FROM chat_messages
        WHERE thread_id = p_thread_id
        AND is_deleted = FALSE
        ORDER BY created_at DESC
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

-- Función para obtener hilos del usuario
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
        t.id, t.context_type, t.context_id, t.context_title,
        t.party_a, t.party_b, t.support_user_id, t.status,
        t.last_message_at,
        COALESCE(unread.unread_count, 0) as unread_count,
        CASE 
            WHEN t.party_a = p_user_id THEN 
                COALESCE(pb_profile.display_name, pb_profile.email)
            ELSE 
                COALESCE(pa_profile.display_name, pa_profile.email)
        END as other_party_name
    FROM chat_threads t
    LEFT JOIN (
        SELECT 
            thread_id,
            COUNT(*) as unread_count
        FROM chat_messages m
        LEFT JOIN chat_read_status r ON m.thread_id = r.thread_id AND r.user_id = p_user_id
        WHERE m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamp)
        AND m.sender_id != p_user_id
        AND m.is_deleted = FALSE
        GROUP BY thread_id
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
-- 11. POLÍTICAS RLS (Row Level Security)
-- =========================================================

-- Habilitar RLS
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;

-- Políticas para chat_threads
CREATE POLICY "Users can view their own threads" ON chat_threads
    FOR SELECT USING (
        party_a = auth.uid() OR 
        party_b = auth.uid() OR 
        support_user_id = auth.uid()
    );

CREATE POLICY "Users can create threads" ON chat_threads
    FOR INSERT WITH CHECK (
        party_a = auth.uid() OR party_b = auth.uid()
    );

CREATE POLICY "Users can update their own threads" ON chat_threads
    FOR UPDATE USING (
        party_a = auth.uid() OR 
        party_b = auth.uid() OR 
        support_user_id = auth.uid()
    );

-- Políticas para chat_messages
CREATE POLICY "Users can view messages in their threads" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_threads t
            WHERE t.id = thread_id
            AND (t.party_a = auth.uid() OR t.party_b = auth.uid() OR t.support_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their threads" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chat_threads t
            WHERE t.id = thread_id
            AND (t.party_a = auth.uid() OR t.party_b = auth.uid() OR t.support_user_id = auth.uid())
        )
    );

-- Políticas para chat_read_status
CREATE POLICY "Users can view their own read status" ON chat_read_status
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own read status" ON chat_read_status
    FOR ALL USING (user_id = auth.uid());

-- Políticas para chat_typing_status
CREATE POLICY "Users can view typing status in their threads" ON chat_typing_status
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM chat_threads t
            WHERE t.id = thread_id
            AND (t.party_a = auth.uid() OR t.party_b = auth.uid() OR t.support_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own typing status" ON chat_typing_status
    FOR ALL USING (user_id = auth.uid());

-- Políticas para chat_rate_limits
CREATE POLICY "Users can view their own rate limits" ON chat_rate_limits
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage rate limits" ON chat_rate_limits
    FOR ALL USING (true); -- Solo el sistema puede gestionar rate limits

-- =========================================================
-- 12. HABILITAR REALTIME
-- =========================================================

-- Habilitar realtime para las tablas principales
ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_status;

-- =========================================================
-- 13. COMENTARIOS PARA DOCUMENTACIÓN
-- =========================================================

COMMENT ON TABLE chat_threads IS 'Hilos de chat transaccional reutilizables por contexto';
COMMENT ON COLUMN chat_threads.context_type IS 'Tipo de contexto: order, auction, ticket, dispute';
COMMENT ON COLUMN chat_threads.context_id IS 'ID del contexto específico (UUID o numérico)';
COMMENT ON COLUMN chat_threads.party_a IS 'Primer participante del chat';
COMMENT ON COLUMN chat_threads.party_b IS 'Segundo participante del chat';
COMMENT ON COLUMN chat_threads.support_user_id IS 'Usuario de soporte (opcional)';

COMMENT ON TABLE chat_messages IS 'Mensajes del chat transaccional';
COMMENT ON COLUMN chat_messages.kind IS 'Tipo de mensaje: user, system, support';
COMMENT ON COLUMN chat_messages.metadata IS 'Metadatos adicionales (acciones, archivos, etc.)';

COMMENT ON TABLE chat_read_status IS 'Estado de lectura por usuario y hilo';
COMMENT ON TABLE chat_typing_status IS 'Estado de escritura (typing) por usuario';
COMMENT ON TABLE chat_rate_limits IS 'Control de rate limiting por usuario';

-- =========================================================
-- 14. MENSAJE DE FINALIZACIÓN
-- =========================================================

DO $$
BEGIN
    RAISE NOTICE '=========================================================';
    RAISE NOTICE '✅ SISTEMA DE CHAT TRANSACCIONAL INSTALADO CORRECTAMENTE';
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'Tablas creadas:';
    RAISE NOTICE '- chat_threads (hilos de chat)';
    RAISE NOTICE '- chat_messages (mensajes)';
    RAISE NOTICE '- chat_read_status (estado de lectura)';
    RAISE NOTICE '- chat_typing_status (estado de escritura)';
    RAISE NOTICE '- chat_rate_limits (control de rate limiting)';
    RAISE NOTICE '';
    RAISE NOTICE 'Funciones principales:';
    RAISE NOTICE '- open_or_get_thread()';
    RAISE NOTICE '- send_chat_message()';
    RAISE NOTICE '- get_thread_messages()';
    RAISE NOTICE '- mark_thread_as_read()';
    RAISE NOTICE '- get_user_threads()';
    RAISE NOTICE '';
    RAISE NOTICE 'Realtime habilitado para:';
    RAISE NOTICE '- chat_threads';
    RAISE NOTICE '- chat_messages';
    RAISE NOTICE '- chat_typing_status';
    RAISE NOTICE '=========================================================';
END $$;


