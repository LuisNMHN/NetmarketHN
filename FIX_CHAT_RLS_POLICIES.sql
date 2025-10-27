-- =========================================================
-- FIX: Configurar políticas RLS para chat_threads
-- =========================================================

-- Primero, asegurarse de que RLS esté habilitado
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view their threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can create threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can update their threads" ON chat_threads;

-- Política para ver threads donde el usuario es party_a o party_b
CREATE POLICY "Users can view their threads"
ON chat_threads
FOR SELECT
USING (
  party_a = auth.uid() OR 
  party_b = auth.uid()
);

-- Política para crear threads donde el usuario es party_a o party_b
CREATE POLICY "Users can create threads"
ON chat_threads
FOR INSERT
WITH CHECK (
  party_a = auth.uid() OR 
  party_b = auth.uid()
);

-- Política para actualizar threads donde el usuario es party_a o party_b
CREATE POLICY "Users can update their threads"
ON chat_threads
FOR UPDATE
USING (
  party_a = auth.uid() OR 
  party_b = auth.uid()
)
WITH CHECK (
  party_a = auth.uid() OR 
  party_b = auth.uid()
);

-- Configurar políticas para chat_messages si es necesario
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages in their threads" ON chat_messages;

-- Política para ver mensajes en threads donde el usuario participa
CREATE POLICY "Users can view messages in their threads"
ON chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_threads
    WHERE chat_threads.id = chat_messages.thread_id
    AND (chat_threads.party_a = auth.uid() OR chat_threads.party_b = auth.uid())
  )
);

-- Política para crear mensajes en threads donde el usuario participa
CREATE POLICY "Users can create messages in their threads"
ON chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM chat_threads
    WHERE chat_threads.id = chat_messages.thread_id
    AND (chat_threads.party_a = auth.uid() OR chat_threads.party_b = auth.uid())
  )
);

SELECT 'Políticas RLS configuradas correctamente' as resultado;

