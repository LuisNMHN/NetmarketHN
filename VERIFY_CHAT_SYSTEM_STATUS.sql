-- =========================================================
-- VERIFICACIÓN DEL ESTADO DEL SISTEMA DE CHAT
-- =========================================================

-- Verificar tablas del chat
SELECT 
  'TABLAS DEL CHAT' as seccion,
  table_name,
  CASE 
    WHEN table_name IN (
      'chat_conversations',
      'chat_conversation_participants', 
      'chat_messages',
      'chat_typing_status'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'chat_%'
ORDER BY table_name;

-- Verificar políticas RLS del chat
SELECT 
  'POLÍTICAS RLS DEL CHAT' as seccion,
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN policyname IS NOT NULL THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename LIKE 'chat_%'
ORDER BY tablename, policyname;

-- Verificar funciones RPC del chat
SELECT 
  'FUNCIONES RPC DEL CHAT' as seccion,
  routine_name,
  CASE 
    WHEN routine_name IN (
      'create_or_get_chat_conversation',
      'send_chat_message',
      'mark_chat_messages_read',
      'clear_chat_history',
      'delete_own_chat_message',
      'upload_chat_attachment',
      'get_chat_attachment_url',
      'delete_chat_attachment',
      'list_chat_attachments'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%chat%'
ORDER BY routine_name;

-- Verificar bucket de storage
SELECT 
  'BUCKET DE STORAGE' as seccion,
  name,
  CASE 
    WHEN name = 'chat_attachments' THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM storage.buckets 
WHERE name = 'chat_attachments';

-- Verificar políticas RLS del storage
SELECT 
  'POLÍTICAS RLS STORAGE' as seccion,
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN policyname IS NOT NULL THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%chat%'
ORDER BY policyname;

-- Verificar datos de prueba
SELECT 
  'DATOS DE PRUEBA' as seccion,
  'conversaciones' as tipo,
  COUNT(*) as cantidad
FROM chat_conversations
UNION ALL
SELECT 
  'DATOS DE PRUEBA' as seccion,
  'participantes' as tipo,
  COUNT(*) as cantidad
FROM chat_conversation_participants
UNION ALL
SELECT 
  'DATOS DE PRUEBA' as seccion,
  'mensajes' as tipo,
  COUNT(*) as cantidad
FROM chat_messages
UNION ALL
SELECT 
  'DATOS DE PRUEBA' as seccion,
  'estado_escritura' as tipo,
  COUNT(*) as cantidad
FROM chat_typing_status;

-- Verificar usuarios con rol 'user'
SELECT 
  'USUARIOS CON ROL USER' as seccion,
  COUNT(*) as cantidad
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'user';

-- Verificar usuarios con rol 'admin'
SELECT 
  'USUARIOS CON ROL ADMIN' as seccion,
  COUNT(*) as cantidad
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'admin';

-- Verificar perfiles de usuarios
SELECT 
  'PERFILES DE USUARIOS' as seccion,
  COUNT(*) as cantidad
FROM profiles;

-- Verificar perfiles de usuario_profiles
SELECT 
  'PERFILES DE USER_PROFILES' as seccion,
  COUNT(*) as cantidad
FROM user_profiles;
