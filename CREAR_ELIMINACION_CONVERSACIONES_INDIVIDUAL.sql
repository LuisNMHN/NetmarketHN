-- Script para crear sistema de eliminación individual de conversaciones
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna para marcar conversaciones eliminadas por usuario
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS participant_1_deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS participant_2_deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_1_deleted 
ON chat_conversations(participant_1_deleted_at) WHERE participant_1_deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_2_deleted 
ON chat_conversations(participant_2_deleted_at) WHERE participant_2_deleted_at IS NOT NULL;

-- 3. Crear función para eliminar conversación individualmente
CREATE OR REPLACE FUNCTION delete_conversation_for_user(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    conversation_record RECORD;
BEGIN
    -- Obtener información de la conversación
    SELECT 
        participant_1_id,
        participant_2_id,
        participant_1_deleted_at,
        participant_2_deleted_at
    INTO conversation_record
    FROM chat_conversations
    WHERE id = p_conversation_id;
    
    -- Verificar que la conversación existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversación no encontrada';
    END IF;
    
    -- Verificar que el usuario es participante de la conversación
    IF conversation_record.participant_1_id != p_user_id AND conversation_record.participant_2_id != p_user_id THEN
        RAISE EXCEPTION 'Usuario no es participante de esta conversación';
    END IF;
    
    -- Marcar como eliminada para el usuario correspondiente
    IF conversation_record.participant_1_id = p_user_id THEN
        UPDATE chat_conversations
        SET participant_1_deleted_at = NOW()
        WHERE id = p_conversation_id;
    ELSE
        UPDATE chat_conversations
        SET participant_2_deleted_at = NOW()
        WHERE id = p_conversation_id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- 4. Crear función para restaurar conversación eliminada
CREATE OR REPLACE FUNCTION restore_conversation_for_user(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    conversation_record RECORD;
BEGIN
    -- Obtener información de la conversación
    SELECT 
        participant_1_id,
        participant_2_id,
        participant_1_deleted_at,
        participant_2_deleted_at
    INTO conversation_record
    FROM chat_conversations
    WHERE id = p_conversation_id;
    
    -- Verificar que la conversación existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversación no encontrada';
    END IF;
    
    -- Verificar que el usuario es participante de la conversación
    IF conversation_record.participant_1_id != p_user_id AND conversation_record.participant_2_id != p_user_id THEN
        RAISE EXCEPTION 'Usuario no es participante de esta conversación';
    END IF;
    
    -- Restaurar para el usuario correspondiente
    IF conversation_record.participant_1_id = p_user_id THEN
        UPDATE chat_conversations
        SET participant_1_deleted_at = NULL
        WHERE id = p_conversation_id;
    ELSE
        UPDATE chat_conversations
        SET participant_2_deleted_at = NULL
        WHERE id = p_conversation_id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- 5. Crear función para obtener conversaciones del usuario (excluyendo eliminadas)
CREATE OR REPLACE FUNCTION get_user_conversations_with_deletion(
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    participant_1_id UUID,
    participant_2_id UUID,
    purchase_request_id UUID,
    status TEXT,
    participant_1_notifications INTEGER,
    participant_2_notifications INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE,
    participant_1_deleted_at TIMESTAMP WITH TIME ZONE,
    participant_2_deleted_at TIMESTAMP WITH TIME ZONE,
    other_participant_id UUID,
    other_participant_name TEXT,
    other_participant_avatar TEXT,
    last_message_content TEXT,
    last_message_created_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.participant_1_id,
        c.participant_2_id,
        c.purchase_request_id,
        c.status::TEXT,
        c.participant_1_notifications,
        c.participant_2_notifications,
        c.created_at,
        c.updated_at,
        c.last_message_at,
        c.participant_1_deleted_at,
        c.participant_2_deleted_at,
        CASE 
            WHEN c.participant_1_id = p_user_id THEN c.participant_2_id
            ELSE c.participant_1_id
        END as other_participant_id,
        CASE 
            WHEN c.participant_1_id = p_user_id THEN p2.full_name
            ELSE p1.full_name
        END as other_participant_name,
        CASE 
            WHEN c.participant_1_id = p_user_id THEN p2.avatar_url
            ELSE p1.avatar_url
        END as other_participant_avatar,
        cm.content as last_message_content,
        cm.created_at as last_message_created_at,
        CASE 
            WHEN c.participant_1_id = p_user_id THEN c.participant_1_notifications
            ELSE c.participant_2_notifications
        END as unread_count
    FROM chat_conversations c
    LEFT JOIN profiles p1 ON c.participant_1_id = p1.id
    LEFT JOIN profiles p2 ON c.participant_2_id = p2.id
    LEFT JOIN chat_messages cm ON c.id = cm.conversation_id 
        AND cm.created_at = c.last_message_at
    WHERE 
        (c.participant_1_id = p_user_id OR c.participant_2_id = p_user_id)
        AND (
            -- No mostrar si el usuario actual la eliminó
            (c.participant_1_id = p_user_id AND c.participant_1_deleted_at IS NULL)
            OR 
            (c.participant_2_id = p_user_id AND c.participant_2_deleted_at IS NULL)
        )
    ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC;
END;
$$;

-- 6. Crear función para eliminar permanentemente conversaciones eliminadas por ambos usuarios
CREATE OR REPLACE FUNCTION cleanup_deleted_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Eliminar conversaciones donde ambos usuarios las marcaron como eliminadas
    DELETE FROM chat_conversations
    WHERE 
        participant_1_deleted_at IS NOT NULL 
        AND participant_2_deleted_at IS NOT NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- 7. Crear política RLS para las nuevas columnas
CREATE POLICY "Users can view their own conversation deletion status" ON chat_conversations
    FOR SELECT USING (
        auth.uid() = participant_1_id OR auth.uid() = participant_2_id
    );

CREATE POLICY "Users can update their own conversation deletion status" ON chat_conversations
    FOR UPDATE USING (
        auth.uid() = participant_1_id OR auth.uid() = participant_2_id
    );

-- 8. Probar las funciones
DO $$
DECLARE
    test_conversation_id UUID := 'd7227b30-4b56-4716-9bd4-5e7bbcdab503';
    test_user_id UUID := 'e9cf435a-3ae6-4b1f-aca1-f6cde883f792';
    result BOOLEAN;
    rec RECORD; -- Declarar variable RECORD para el loop
BEGIN
    RAISE NOTICE '--- Prueba de eliminación individual de conversaciones ---';
    
    -- Probar eliminación
    SELECT delete_conversation_for_user(test_conversation_id, test_user_id) INTO result;
    RAISE NOTICE 'Eliminación exitosa: %', result;
    
    -- Verificar estado
    RAISE NOTICE 'Estado después de eliminación:';
    FOR rec IN SELECT participant_1_deleted_at, participant_2_deleted_at FROM chat_conversations WHERE id = test_conversation_id LOOP
        RAISE NOTICE '  Participant 1 deleted: %, Participant 2 deleted: %', rec.participant_1_deleted_at, rec.participant_2_deleted_at;
    END LOOP;
    
    -- Probar restauración
    SELECT restore_conversation_for_user(test_conversation_id, test_user_id) INTO result;
    RAISE NOTICE 'Restauración exitosa: %', result;
    
    -- Verificar estado final
    RAISE NOTICE 'Estado después de restauración:';
    FOR rec IN SELECT participant_1_deleted_at, participant_2_deleted_at FROM chat_conversations WHERE id = test_conversation_id LOOP
        RAISE NOTICE '  Participant 1 deleted: %, Participant 2 deleted: %', rec.participant_1_deleted_at, rec.participant_2_deleted_at;
    END LOOP;
    
    RAISE NOTICE 'Pruebas completadas exitosamente';
END $$;

-- 9. Verificar estructura final
SELECT 
    'Estructura actualizada' as test,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'chat_conversations'
AND column_name IN ('participant_1_deleted_at', 'participant_2_deleted_at')
ORDER BY ordinal_position;

SELECT 'Sistema de eliminación individual creado exitosamente' as resultado;
