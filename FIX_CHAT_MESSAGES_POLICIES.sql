-- =========================================================
-- FIX: Agregar políticas INSERT y UPDATE para chat_messages
-- =========================================================

-- Eliminar políticas existentes si es necesario
DROP POLICY IF EXISTS "Users can insert messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;

-- Política para INSERT
CREATE POLICY "Users can insert messages in their threads"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_messages.thread_id
            AND (
                chat_threads.party_a = auth.uid() OR
                chat_threads.party_b = auth.uid() OR
                chat_threads.support_user_id = auth.uid()
            )
        )
    );

-- Política para UPDATE
CREATE POLICY "Users can update their own messages"
    ON chat_messages FOR UPDATE
    USING (sender_id = auth.uid());

-- Verificar que las políticas estén aplicadas
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'chat_messages';








