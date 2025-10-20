-- Sistema de Notificaciones NMHN
-- Crea las tablas y políticas necesarias para el sistema de notificaciones

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL CHECK (topic IN ('order', 'kyc', 'wallet', 'chat', 'system')),
    event TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    cta_label TEXT,
    cta_href TEXT,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    payload JSONB DEFAULT '{}',
    dedupe_key TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de preferencias de notificaciones
CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_inapp BOOLEAN NOT NULL DEFAULT true,
    channel_email BOOLEAN NOT NULL DEFAULT false,
    channel_push BOOLEAN NOT NULL DEFAULT false,
    muted_topics TEXT[] DEFAULT '{}',
    quiet_hours JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(event);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_prefs_updated_at 
    BEFORE UPDATE ON notification_prefs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para limpiar notificaciones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Políticas RLS para notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver sus propias notificaciones
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Los usuarios pueden insertar notificaciones para sí mismos (para testing)
CREATE POLICY "Users can insert own notifications" ON notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propias notificaciones
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para notification_prefs
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver y modificar sus propias preferencias
CREATE POLICY "Users can view own notification prefs" ON notification_prefs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification prefs" ON notification_prefs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification prefs" ON notification_prefs
    FOR UPDATE USING (auth.uid() = user_id);

-- Habilitar realtime para notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Función para emitir notificaciones (para uso desde el servidor)
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
            SELECT id INTO notification_id FROM notifications 
            WHERE dedupe_key = p_dedupe_key AND user_id = p_user_id;
            
            IF FOUND THEN
                RETURN notification_id;
            END IF;
        END IF;

        -- Insertar la notificación
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

-- Función para obtener estadísticas de notificaciones de un usuario
CREATE OR REPLACE FUNCTION get_notification_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'unread', COUNT(*) FILTER (WHERE status = 'unread'),
        'read', COUNT(*) FILTER (WHERE status = 'read'),
        'archived', COUNT(*) FILTER (WHERE status = 'archived'),
        'high_priority', COUNT(*) FILTER (WHERE priority = 'high' AND status = 'unread')
    ) INTO stats
    FROM notifications 
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(stats, '{"total": 0, "unread": 0, "read": 0, "archived": 0, "high_priority": 0}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentación
COMMENT ON TABLE notifications IS 'Sistema de notificaciones para la plataforma NMHN';
COMMENT ON COLUMN notifications.topic IS 'Categoría de la notificación: order, kyc, wallet, chat, system';
COMMENT ON COLUMN notifications.event IS 'Tipo específico de evento: ORDER_CREATED, NEW_MESSAGE, etc.';
COMMENT ON COLUMN notifications.priority IS 'Prioridad: low, normal, high';
COMMENT ON COLUMN notifications.status IS 'Estado: unread, read, archived';
COMMENT ON COLUMN notifications.payload IS 'Metadatos adicionales para render y navegación';
COMMENT ON COLUMN notifications.dedupe_key IS 'Clave para evitar duplicados en reintentos';

COMMENT ON TABLE notification_prefs IS 'Preferencias de notificación por usuario';
COMMENT ON COLUMN notification_prefs.muted_topics IS 'Array de tópicos silenciados';
COMMENT ON COLUMN notification_prefs.quiet_hours IS 'Horarios de silencio en formato JSON';


