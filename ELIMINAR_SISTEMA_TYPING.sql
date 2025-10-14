-- =========================================================
-- ELIMINAR SISTEMA DE TYPING STATUS DEL CHAT
-- =========================================================
-- Script para eliminar completamente el sistema de estado en línea
-- que no es una función importante según el usuario

-- 1. Eliminar triggers relacionados con typing
DROP TRIGGER IF EXISTS update_chat_typing_status_updated_at ON chat_typing_status;

-- 2. Eliminar índices de la tabla typing
DROP INDEX IF EXISTS idx_chat_typing_conversation;
DROP INDEX IF EXISTS idx_chat_typing_user;
DROP INDEX IF EXISTS idx_chat_typing_status;

-- 3. Eliminar políticas RLS de typing
DROP POLICY IF EXISTS "Users can view typing status in their conversations" ON chat_typing_status;
DROP POLICY IF EXISTS "Users can update their own typing status" ON chat_typing_status;

-- 4. Eliminar la tabla de typing status
DROP TABLE IF EXISTS chat_typing_status;

-- 5. Eliminar función upsert_typing_status si existe
DROP FUNCTION IF EXISTS upsert_typing_status(UUID, UUID, BOOLEAN);

-- 6. Actualizar tabla de notificaciones para eliminar tipo 'typing'
-- Primero eliminar notificaciones existentes de tipo typing
DELETE FROM chat_notifications WHERE notification_type = 'typing';

-- Actualizar el constraint para excluir 'typing'
ALTER TABLE chat_notifications DROP CONSTRAINT IF EXISTS chat_notifications_notification_type_check;
ALTER TABLE chat_notifications ADD CONSTRAINT chat_notifications_notification_type_check 
    CHECK (notification_type IN ('message', 'read'));

-- 7. Verificar que se eliminó correctamente
SELECT 
    'Verificación: Tabla chat_typing_status eliminada' as status,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_typing_status')
        THEN '✅ ÉXITO'
        ELSE '❌ ERROR - La tabla aún existe'
    END as result;

-- 8. Verificar políticas eliminadas
SELECT 
    'Verificación: Políticas de typing eliminadas' as status,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'chat_typing_status'
        )
        THEN '✅ ÉXITO'
        ELSE '❌ ERROR - Aún existen políticas'
    END as result;

-- 9. Verificar índices eliminados
SELECT 
    'Verificación: Índices de typing eliminados' as status,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname LIKE '%typing%'
        )
        THEN '✅ ÉXITO'
        ELSE '❌ ERROR - Aún existen índices'
    END as result;

-- 10. Mostrar resumen final
SELECT 
    'SISTEMA DE TYPING ELIMINADO EXITOSAMENTE' as mensaje,
    'El estado en línea ya no está disponible en el chat' as descripcion;
