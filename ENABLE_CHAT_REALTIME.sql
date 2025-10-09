-- Script para habilitar Realtime en el sistema de chat
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Habilitar Realtime en la tabla purchase_chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_chat_messages;

-- 2. Habilitar RLS en purchase_chat_messages
ALTER TABLE purchase_chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can view own messages" ON purchase_chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON purchase_chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON purchase_chat_messages;

-- 4. Crear políticas RLS para el chat
-- Los usuarios pueden ver mensajes donde son sender o receiver
CREATE POLICY "Users can view own messages" ON purchase_chat_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Los usuarios pueden enviar mensajes (solo como sender)
CREATE POLICY "Users can send messages" ON purchase_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

-- Los usuarios pueden actualizar sus propios mensajes (para marcar como leído, etc.)
CREATE POLICY "Users can update own messages" ON purchase_chat_messages
  FOR UPDATE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- 5. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'purchase_chat_messages' AND schemaname = 'public';

-- 6. Verificar que Realtime está habilitado
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'purchase_chat_messages';
