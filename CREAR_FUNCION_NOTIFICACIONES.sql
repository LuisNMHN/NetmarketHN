-- Crear función create_message_notification faltante

-- 1. Verificar si la función existe
SELECT 
    routine_name,
    routine_type,
    data_type,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'create_message_notification';

-- 2. Crear función create_message_notification
CREATE OR REPLACE FUNCTION create_message_notification(
    p_conversation_id uuid,
    p_sender_id uuid,
    p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_other_participant_id uuid;
    v_sender_name text;
    v_conversation_title text;
BEGIN
    -- Obtener el otro participante de la conversación
    SELECT 
        CASE 
            WHEN participant_1_id = p_sender_id THEN participant_2_id
            ELSE participant_1_id
        END
    INTO v_other_participant_id
    FROM chat_conversations
    WHERE id = p_conversation_id;

    -- Obtener el nombre del remitente
    SELECT COALESCE(full_name, 'Usuario')
    INTO v_sender_name
    FROM profiles
    WHERE id = p_sender_id;

    -- Crear título de la conversación
    v_conversation_title := 'Nuevo mensaje de ' || v_sender_name;

    -- Crear notificación para el otro participante
    IF v_other_participant_id IS NOT NULL THEN
        INSERT INTO chat_notifications (
            user_id,
            conversation_id,
            notification_type,
            title,
            body,
            is_read,
            created_at,
            updated_at
        ) VALUES (
            v_other_participant_id,
            p_conversation_id,
            'message',
            v_conversation_title,
            COALESCE(p_content, 'Mensaje recibido'),
            false,
            NOW(),
            NOW()
        );
    END IF;
END;
$$;

-- 3. Verificar que la función se creó correctamente
SELECT 
    routine_name,
    routine_type,
    data_type,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'create_message_notification';

-- 4. Probar la función
SELECT create_message_notification(
    'd7227b30-4b56-4716-9bd4-5e7bbcdab503'::uuid,
    'e9cf435a-3ae6-4b1f-aca1-f6cde883f792'::uuid,
    'Mensaje de prueba desde función'::text
);

-- 5. Verificar que se creó la notificación
SELECT 
    id,
    user_id,
    conversation_id,
    notification_type,
    title,
    body,
    is_read,
    created_at
FROM chat_notifications 
WHERE conversation_id = 'd7227b30-4b56-4716-9bd4-5e7bbcdab503'
ORDER BY created_at DESC
LIMIT 5;

