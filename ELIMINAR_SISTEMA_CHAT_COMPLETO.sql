-- =========================================================
-- NMHN - ELIMINACIÓN COMPLETA DEL SISTEMA DE CHAT
-- =========================================================
-- Script para eliminar todas las tablas, funciones, triggers y políticas
-- relacionadas con el sistema de chat de Supabase
-- 
-- ⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de chat
-- ⚠️  Ejecutar solo si estás seguro de eliminar permanentemente el chat
-- 
-- Ejecutar en Supabase SQL Editor

-- =========================================================
-- 1. ELIMINAR TRIGGERS RELACIONADOS CON CHAT
-- =========================================================

-- Eliminar triggers de actualización de timestamps
DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
DROP TRIGGER IF EXISTS update_chat_typing_status_updated_at ON chat_typing_status;

-- Eliminar triggers de notificaciones
DROP TRIGGER IF EXISTS create_message_notification_trigger ON chat_messages;
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON chat_messages;

-- Eliminar triggers de borrado inteligente
DROP TRIGGER IF EXISTS handle_conversation_deletion_trigger ON chat_conversations;
DROP TRIGGER IF EXISTS handle_message_deletion_trigger ON chat_messages;

-- =========================================================
-- 2. ELIMINAR FUNCIONES RELACIONADAS CON CHAT
-- =========================================================

-- Funciones de conversaciones
DROP FUNCTION IF EXISTS get_user_conversations_with_unread_count(uuid);
DROP FUNCTION IF EXISTS get_user_conversations(uuid);
DROP FUNCTION IF EXISTS create_or_get_conversation(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS get_conversation_by_participants(uuid, uuid);
DROP FUNCTION IF EXISTS get_conversation_by_id(uuid, uuid);
DROP FUNCTION IF EXISTS delete_conversation_for_user(uuid, uuid);
DROP FUNCTION IF EXISTS restore_conversation_for_user(uuid, uuid);
DROP FUNCTION IF EXISTS archive_conversation_for_user(uuid, uuid);

-- Funciones de mensajes
DROP FUNCTION IF EXISTS get_conversation_messages(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS send_chat_message(uuid, uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS mark_messages_as_read(uuid, uuid);
DROP FUNCTION IF EXISTS delete_own_message(uuid, uuid);
DROP FUNCTION IF EXISTS get_unread_message_count(uuid);

-- Funciones de typing status
DROP FUNCTION IF EXISTS set_user_typing_status(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS get_typing_users(uuid);
DROP FUNCTION IF EXISTS clear_typing_status(uuid, uuid);

-- Funciones de notificaciones
DROP FUNCTION IF EXISTS create_message_notification(uuid, uuid, text);
DROP FUNCTION IF EXISTS get_user_notifications(uuid, integer, integer);
DROP FUNCTION IF EXISTS mark_notification_as_read(uuid, uuid);
DROP FUNCTION IF EXISTS mark_all_notifications_as_read(uuid);

-- Funciones de borrado inteligente
DROP FUNCTION IF EXISTS handle_conversation_deletion();
DROP FUNCTION IF EXISTS handle_message_deletion();
DROP FUNCTION IF EXISTS cleanup_orphaned_attachments();
DROP FUNCTION IF EXISTS cleanup_old_typing_status();

-- Funciones de utilidad
DROP FUNCTION IF EXISTS update_chat_conversations_updated_at();
DROP FUNCTION IF EXISTS update_chat_messages_updated_at();
DROP FUNCTION IF EXISTS update_chat_typing_status_updated_at();

-- =========================================================
-- 3. ELIMINAR POLÍTICAS RLS (Row Level Security)
-- =========================================================

-- Políticas de chat_conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON chat_conversations;

-- Políticas de chat_messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;

-- Políticas de chat_attachments
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON chat_attachments;
DROP POLICY IF EXISTS "Users can upload attachments in their conversations" ON chat_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON chat_attachments;

-- Políticas de chat_typing_status
DROP POLICY IF EXISTS "Users can view typing status in their conversations" ON chat_typing_status;
DROP POLICY IF EXISTS "Users can update their own typing status" ON chat_typing_status;
DROP POLICY IF EXISTS "Users can delete their own typing status" ON chat_typing_status;

-- Políticas de chat_notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON chat_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON chat_notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON chat_notifications;

-- =========================================================
-- 4. ELIMINAR ÍNDICES RELACIONADOS CON CHAT
-- =========================================================

-- Índices de chat_conversations
DROP INDEX IF EXISTS idx_chat_conversations_participant_1;
DROP INDEX IF EXISTS idx_chat_conversations_participant_2;
DROP INDEX IF EXISTS idx_chat_conversations_participants;
DROP INDEX IF EXISTS idx_chat_conversations_status;
DROP INDEX IF EXISTS idx_chat_conversations_last_message_at;
DROP INDEX IF EXISTS idx_chat_conversations_purchase_request;

-- Índices de chat_messages
DROP INDEX IF EXISTS idx_chat_messages_conversation_id;
DROP INDEX IF EXISTS idx_chat_messages_sender_id;
DROP INDEX IF EXISTS idx_chat_messages_created_at;
DROP INDEX IF EXISTS idx_chat_messages_conversation_created;
DROP INDEX IF EXISTS idx_chat_messages_is_deleted;

-- Índices de chat_attachments
DROP INDEX IF EXISTS idx_chat_attachments_message_id;
DROP INDEX IF EXISTS idx_chat_attachments_file_type;

-- Índices de chat_typing_status
DROP INDEX IF EXISTS idx_chat_typing_status_conversation_id;
DROP INDEX IF EXISTS idx_chat_typing_status_user_id;
DROP INDEX IF EXISTS idx_chat_typing_status_updated_at;

-- Índices de chat_notifications
DROP INDEX IF EXISTS idx_chat_notifications_user_id;
DROP INDEX IF EXISTS idx_chat_notifications_conversation_id;
DROP INDEX IF EXISTS idx_chat_notifications_is_read;
DROP INDEX IF EXISTS idx_chat_notifications_created_at;

-- =========================================================
-- 5. ELIMINAR TABLAS DE CHAT
-- =========================================================

-- Eliminar tablas en orden correcto (respetando dependencias de claves foráneas)
DROP TABLE IF EXISTS chat_notifications CASCADE;
DROP TABLE IF EXISTS chat_attachments CASCADE;
DROP TABLE IF EXISTS chat_typing_status CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;

-- =========================================================
-- 6. ELIMINAR TIPOS PERSONALIZADOS (ENUMS)
-- =========================================================

DROP TYPE IF EXISTS chat_message_type CASCADE;
DROP TYPE IF EXISTS chat_conversation_status CASCADE;
DROP TYPE IF EXISTS chat_notification_type CASCADE;

-- =========================================================
-- 7. ELIMINAR SECUENCIAS (SI EXISTEN)
-- =========================================================

DROP SEQUENCE IF EXISTS chat_messages_id_seq CASCADE;
DROP SEQUENCE IF EXISTS chat_conversations_id_seq CASCADE;

-- =========================================================
-- 8. LIMPIAR STORAGE BUCKETS DE CHAT
-- =========================================================

-- Eliminar bucket de archivos de chat (si existe)
-- NOTA: Esto debe ejecutarse desde el dashboard de Supabase Storage
-- o usando la API de Storage, no desde SQL

-- =========================================================
-- 9. VERIFICACIÓN DE ELIMINACIÓN
-- =========================================================

-- Verificar que no quedan tablas de chat
SELECT 
    'Tablas de chat restantes' as verificacion,
    COUNT(*) as cantidad
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'chat_%';

-- Verificar que no quedan funciones de chat
SELECT 
    'Funciones de chat restantes' as verificacion,
    COUNT(*) as cantidad
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%chat%';

-- Verificar que no quedan triggers de chat
SELECT 
    'Triggers de chat restantes' as verificacion,
    COUNT(*) as cantidad
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name LIKE '%chat%';

-- Verificar que no quedan políticas RLS de chat
SELECT 
    'Políticas RLS de chat restantes' as verificacion,
    COUNT(*) as cantidad
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'chat_%';

-- =========================================================
-- 10. MENSAJE FINAL
-- =========================================================

DO $$
BEGIN
    RAISE NOTICE '=========================================================';
    RAISE NOTICE '✅ ELIMINACIÓN COMPLETA DEL SISTEMA DE CHAT FINALIZADA';
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'Todas las tablas, funciones, triggers y políticas de chat';
    RAISE NOTICE 'han sido eliminadas de la base de datos.';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  RECORDATORIO:';
    RAISE NOTICE '- Los datos de chat han sido eliminados permanentemente';
    RAISE NOTICE '- Si tienes un bucket de Storage para chat, elimínalo manualmente';
    RAISE NOTICE '- Reinicia tu aplicación para limpiar cualquier caché';
    RAISE NOTICE '=========================================================';
END $$;

-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================
