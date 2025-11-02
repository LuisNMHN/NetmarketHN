-- =========================================================
-- FIX: Corregir función emit_notification para actualizar notificaciones existentes
-- =========================================================

-- Eliminar función existente
DROP FUNCTION IF EXISTS emit_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMP WITH TIME ZONE);

-- Recrear función corregida
CREATE OR REPLACE FUNCTION emit_notification(
    p_user_id UUID,
    p_topic TEXT,
    p_event TEXT,
    p_title TEXT,
    p_body TEXT,
    p_cta_label TEXT DEFAULT NULL,
    p_cta_href TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT 'normal',
    p_payload JSONB DEFAULT '{}',
    p_dedupe_key TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    user_prefs RECORD;
    existing_notification_id UUID;
BEGIN
    -- Validar parámetros
    IF p_user_id IS NULL OR p_topic IS NULL OR p_event IS NULL OR p_title IS NULL OR p_body IS NULL THEN
        RAISE EXCEPTION 'Parámetros requeridos: user_id, topic, event, title, body';
    END IF;

    -- Obtener preferencias del usuario
    SELECT * INTO user_prefs FROM notification_prefs WHERE user_id = p_user_id;
    
    -- Si no existen preferencias, crear las por defecto
    IF NOT FOUND THEN
        INSERT INTO notification_prefs (user_id) VALUES (p_user_id);
        SELECT * INTO user_prefs FROM notification_prefs WHERE user_id = p_user_id;
    END IF;

    -- Solo insertar si el canal in-app está habilitado
    IF user_prefs.channel_inapp THEN
        -- Verificar si ya existe una notificación con el mismo dedupe_key
        IF p_dedupe_key IS NOT NULL THEN
            SELECT id INTO existing_notification_id FROM notifications 
            WHERE dedupe_key = p_dedupe_key AND user_id = p_user_id;
            
            IF existing_notification_id IS NOT NULL THEN
                -- Si existe y está en estado "read" o "archived", crear una nueva notificación
                -- Esto permite que las notificaciones de chat lleguen incluso si ya fueron leídas
                IF EXISTS (
                    SELECT 1 FROM notifications 
                    WHERE id = existing_notification_id 
                    AND status IN ('read', 'archived')
                ) THEN
                    -- Crear nueva notificación
                    INSERT INTO notifications (
                        user_id, topic, event, title, body, cta_label, cta_href,
                        priority, payload, dedupe_key, expires_at
                    ) VALUES (
                        p_user_id, p_topic, p_event, p_title, p_body, p_cta_label, p_cta_href,
                        p_priority, p_payload, p_dedupe_key, p_expires_at
                    ) RETURNING id INTO notification_id;
                    
                    RETURN notification_id;
                ELSE
                    -- Si existe y está en estado "unread", actualizar la notificación existente
                    UPDATE notifications SET
                        title = p_title,
                        body = p_body,
                        updated_at = NOW(),
                        created_at = NOW() -- Actualizar created_at para que aparezca como nueva
                    WHERE id = existing_notification_id;
                    
                    RETURN existing_notification_id;
                END IF;
            END IF;
        END IF;

        -- Insertar la notificación (si no existe una con dedupe_key)
        INSERT INTO notifications (
            user_id, topic, event, title, body, cta_label, cta_href,
            priority, payload, dedupe_key, expires_at
        ) VALUES (
            p_user_id, p_topic, p_event, p_title, p_body, p_cta_label, p_cta_href,
            p_priority, p_payload, p_dedupe_key, p_expires_at
        ) RETURNING id INTO notification_id;

        RETURN notification_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;






