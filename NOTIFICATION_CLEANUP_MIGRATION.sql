-- MIGRACIÓN DE FUNCIONES DE LIMPIEZA DE NOTIFICACIONES
-- Este script elimina las funciones existentes y crea las nuevas versiones

-- =====================================================
-- 1. ELIMINAR FUNCIONES EXISTENTES (si existen)
-- =====================================================

-- Eliminar funciones de limpieza existentes
DROP FUNCTION IF EXISTS cleanup_expired_notifications();
DROP FUNCTION IF EXISTS cleanup_old_notifications_by_user(UUID, INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_archived_notifications(INTEGER);
DROP FUNCTION IF EXISTS cleanup_duplicate_notifications();
DROP FUNCTION IF EXISTS maintain_user_notification_limit(UUID, INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_system_notifications(INTEGER);
DROP FUNCTION IF EXISTS perform_automatic_cleanup();
DROP FUNCTION IF EXISTS admin_cleanup_user_notifications(UUID, INTEGER);
DROP FUNCTION IF EXISTS admin_cleanup_topic_notifications(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_cleanup_stats();

-- Eliminar función trigger si existe
DROP FUNCTION IF EXISTS trigger_auto_cleanup();

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS auto_cleanup_trigger ON notifications;

-- =====================================================
-- 2. CREAR NUEVAS FUNCIONES DE LIMPIEZA
-- =====================================================

-- Función para limpiar notificaciones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar notificaciones que han expirado
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log de la operación
    RAISE NOTICE 'Limpieza automática: % notificaciones expiradas eliminadas', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar notificaciones antiguas por usuario
CREATE OR REPLACE FUNCTION cleanup_old_notifications_by_user(
    p_user_id UUID,
    p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar notificaciones leídas más antiguas que p_days_old días
    DELETE FROM notifications 
    WHERE user_id = p_user_id 
    AND status = 'read' 
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar notificaciones archivadas antiguas
CREATE OR REPLACE FUNCTION cleanup_old_archived_notifications(
    p_days_old INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar notificaciones archivadas más antiguas que p_days_old días
    DELETE FROM notifications 
    WHERE status = 'archived' 
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Limpieza automática: % notificaciones archivadas eliminadas', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar notificaciones duplicadas
CREATE OR REPLACE FUNCTION cleanup_duplicate_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar notificaciones duplicadas basadas en dedupe_key
    WITH duplicates AS (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, dedupe_key, topic, event 
                   ORDER BY created_at ASC
               ) as rn
        FROM notifications 
        WHERE dedupe_key IS NOT NULL
    )
    DELETE FROM notifications 
    WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Limpieza automática: % notificaciones duplicadas eliminadas', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para mantener límite de notificaciones por usuario
CREATE OR REPLACE FUNCTION maintain_user_notification_limit(
    p_user_id UUID,
    p_max_notifications INTEGER DEFAULT 1000
)
RETURNS INTEGER AS $$
DECLARE
    current_count INTEGER;
    deleted_count INTEGER;
BEGIN
    -- Contar notificaciones actuales del usuario
    SELECT COUNT(*) INTO current_count
    FROM notifications 
    WHERE user_id = p_user_id;
    
    -- Si excede el límite, eliminar las más antiguas
    IF current_count > p_max_notifications THEN
        WITH old_notifications AS (
            SELECT id 
            FROM notifications 
            WHERE user_id = p_user_id 
            ORDER BY created_at ASC 
            LIMIT (current_count - p_max_notifications)
        )
        DELETE FROM notifications 
        WHERE id IN (SELECT id FROM old_notifications);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        
        RAISE NOTICE 'Límite de usuario: % notificaciones antiguas eliminadas para usuario %', deleted_count, p_user_id;
    ELSE
        deleted_count := 0;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar notificaciones de sistema antiguas
CREATE OR REPLACE FUNCTION cleanup_old_system_notifications(
    p_days_old INTEGER DEFAULT 14
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar notificaciones de sistema antiguas (independientemente del estado)
    DELETE FROM notifications 
    WHERE topic = 'system' 
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Limpieza automática: % notificaciones de sistema eliminadas', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función principal de limpieza automática
CREATE OR REPLACE FUNCTION perform_automatic_cleanup()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    expired_count INTEGER := 0;
    archived_count INTEGER := 0;
    duplicate_count INTEGER := 0;
    system_count INTEGER := 0;
    total_deleted INTEGER := 0;
BEGIN
    -- Ejecutar todas las limpiezas automáticas
    SELECT cleanup_expired_notifications() INTO expired_count;
    SELECT cleanup_old_archived_notifications(7) INTO archived_count;
    SELECT cleanup_duplicate_notifications() INTO duplicate_count;
    SELECT cleanup_old_system_notifications(14) INTO system_count;
    
    total_deleted := expired_count + archived_count + duplicate_count + system_count;
    
    -- Construir resultado
    result := jsonb_build_object(
        'success', true,
        'timestamp', NOW(),
        'total_deleted', total_deleted,
        'breakdown', jsonb_build_object(
            'expired', expired_count,
            'archived', archived_count,
            'duplicates', duplicate_count,
            'system', system_count
        )
    );
    
    RAISE NOTICE 'Limpieza automática completada: % notificaciones eliminadas en total', total_deleted;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar notificaciones de un usuario específico
CREATE OR REPLACE FUNCTION admin_cleanup_user_notifications(
    p_user_id UUID,
    p_keep_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    deleted_count INTEGER;
BEGIN
    -- Eliminar notificaciones del usuario más antiguas que p_keep_days
    DELETE FROM notifications 
    WHERE user_id = p_user_id 
    AND created_at < NOW() - INTERVAL '1 day' * p_keep_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'deleted_count', deleted_count,
        'kept_days', p_keep_days,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar notificaciones por tópico
CREATE OR REPLACE FUNCTION admin_cleanup_topic_notifications(
    p_topic TEXT,
    p_days_old INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    deleted_count INTEGER;
BEGIN
    -- Eliminar notificaciones del tópico más antiguas que p_days_old días
    DELETE FROM notifications 
    WHERE topic = p_topic 
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    result := jsonb_build_object(
        'success', true,
        'topic', p_topic,
        'deleted_count', deleted_count,
        'days_old', p_days_old,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de limpieza
CREATE OR REPLACE FUNCTION get_cleanup_stats()
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_notifications', COUNT(*),
        'by_status', jsonb_build_object(
            'unread', COUNT(*) FILTER (WHERE status = 'unread'),
            'read', COUNT(*) FILTER (WHERE status = 'read'),
            'archived', COUNT(*) FILTER (WHERE status = 'archived')
        ),
        'by_topic', jsonb_build_object(
            'order', COUNT(*) FILTER (WHERE topic = 'order'),
            'kyc', COUNT(*) FILTER (WHERE topic = 'kyc'),
            'wallet', COUNT(*) FILTER (WHERE topic = 'wallet'),
            'chat', COUNT(*) FILTER (WHERE topic = 'chat'),
            'system', COUNT(*) FILTER (WHERE topic = 'system')
        ),
        'by_age', jsonb_build_object(
            'last_24h', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day'),
            'last_7d', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),
            'last_30d', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'),
            'older_30d', COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days')
        ),
        'expired_count', COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()),
        'duplicate_count', (
            SELECT COUNT(*) FROM (
                SELECT dedupe_key, COUNT(*) as cnt
                FROM notifications 
                WHERE dedupe_key IS NOT NULL
                GROUP BY dedupe_key
                HAVING COUNT(*) > 1
            ) duplicates
        )
    ) INTO stats
    FROM notifications;
    
    RETURN COALESCE(stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREAR TRIGGER AUTOMÁTICO
-- =====================================================

-- Función trigger para limpieza automática al insertar
CREATE OR REPLACE FUNCTION trigger_auto_cleanup()
RETURNS TRIGGER AS $$
DECLARE
    user_notification_count INTEGER;
BEGIN
    -- Verificar si el usuario tiene demasiadas notificaciones
    SELECT COUNT(*) INTO user_notification_count
    FROM notifications 
    WHERE user_id = NEW.user_id;
    
    -- Si el usuario tiene más de 1000 notificaciones, limpiar las más antiguas
    IF user_notification_count > 1000 THEN
        PERFORM maintain_user_notification_limit(NEW.user_id, 1000);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para limpieza automática
CREATE TRIGGER auto_cleanup_trigger
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_cleanup();

-- =====================================================
-- 4. CREAR ÍNDICES ADICIONALES PARA OPTIMIZAR LIMPIEZA
-- =====================================================

-- Índices para optimizar las consultas de limpieza
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup_expired 
ON notifications(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_cleanup_archived 
ON notifications(status, created_at) WHERE status = 'archived';

CREATE INDEX IF NOT EXISTS idx_notifications_cleanup_system 
ON notifications(topic, created_at) WHERE topic = 'system';

CREATE INDEX IF NOT EXISTS idx_notifications_cleanup_user_old 
ON notifications(user_id, status, created_at) WHERE status = 'read';

-- =====================================================
-- 5. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION cleanup_expired_notifications() IS 'Elimina notificaciones que han expirado según su campo expires_at';
COMMENT ON FUNCTION cleanup_old_notifications_by_user(UUID, INTEGER) IS 'Elimina notificaciones leídas antiguas de un usuario específico';
COMMENT ON FUNCTION cleanup_old_archived_notifications(INTEGER) IS 'Elimina notificaciones archivadas antiguas';
COMMENT ON FUNCTION cleanup_duplicate_notifications() IS 'Elimina notificaciones duplicadas basadas en dedupe_key';
COMMENT ON FUNCTION maintain_user_notification_limit(UUID, INTEGER) IS 'Mantiene un límite de notificaciones por usuario';
COMMENT ON FUNCTION cleanup_old_system_notifications(INTEGER) IS 'Elimina notificaciones de sistema antiguas';
COMMENT ON FUNCTION perform_automatic_cleanup() IS 'Función principal que ejecuta todas las limpiezas automáticas';
COMMENT ON FUNCTION admin_cleanup_user_notifications(UUID, INTEGER) IS 'Función administrativa para limpiar notificaciones de un usuario';
COMMENT ON FUNCTION admin_cleanup_topic_notifications(TEXT, INTEGER) IS 'Función administrativa para limpiar notificaciones por tópico';
COMMENT ON FUNCTION get_cleanup_stats() IS 'Obtiene estadísticas detalladas del sistema de notificaciones';

-- =====================================================
-- 6. VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que todas las funciones se crearon correctamente
DO $$
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'cleanup_expired_notifications',
        'cleanup_old_notifications_by_user',
        'cleanup_old_archived_notifications',
        'cleanup_duplicate_notifications',
        'maintain_user_notification_limit',
        'cleanup_old_system_notifications',
        'perform_automatic_cleanup',
        'admin_cleanup_user_notifications',
        'admin_cleanup_topic_notifications',
        'get_cleanup_stats',
        'trigger_auto_cleanup'
    );
    
    IF function_count = 11 THEN
        RAISE NOTICE '✅ Todas las funciones de limpieza se crearon correctamente';
    ELSE
        RAISE WARNING '⚠️ Solo se crearon % de 11 funciones esperadas', function_count;
    END IF;
END $$;

-- =====================================================
-- 7. EJEMPLOS DE USO
-- =====================================================

/*
-- Ejecutar limpieza automática completa
SELECT perform_automatic_cleanup();

-- Limpiar notificaciones de un usuario específico (mantener últimos 7 días)
SELECT admin_cleanup_user_notifications('user-uuid-here', 7);

-- Limpiar notificaciones de un tópico específico (mantener últimos 30 días)
SELECT admin_cleanup_topic_notifications('system', 30);

-- Obtener estadísticas de limpieza
SELECT get_cleanup_stats();

-- Limpiar notificaciones expiradas manualmente
SELECT cleanup_expired_notifications();

-- Limpiar notificaciones duplicadas manualmente
SELECT cleanup_duplicate_notifications();
*/
