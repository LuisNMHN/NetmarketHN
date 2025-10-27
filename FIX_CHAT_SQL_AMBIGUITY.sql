-- =========================================================
-- CORRECCIÓN DE AMBIGÜEDAD EN FUNCIONES DE CHAT
-- =========================================================
-- Problema: "column reference id is ambiguous" en get_thread_messages y get_user_threads
-- Solución: Especificar explícitamente el nombre de la tabla en todas las referencias

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS get_thread_messages(uuid,uuid,integer,integer);
DROP FUNCTION IF EXISTS get_user_threads(uuid,integer,integer);
DROP FUNCTION IF EXISTS mark_thread_as_read(uuid,uuid,uuid);

-- Corregir función get_thread_messages
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

-- Corregir función get_user_threads
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

-- Corregir función mark_thread_as_read para evitar ambigüedad
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
