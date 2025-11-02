-- =========================================================
-- NMHN - DIAGNÓSTICO Y CORRECCIÓN COMPLETA DEL CHAT
-- =========================================================

-- PASO 1: VERIFICAR QUE RLS ESTÉ HABILITADO
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- PASO 2: ELIMINAR TODAS LAS POLÍTICAS EXISTENTES PARA EVITAR CONFLICTOS
DROP POLICY IF EXISTS "Users can view their own threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can create threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can update their own threads" ON chat_threads;

DROP POLICY IF EXISTS "Users can view messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;

-- PASO 3: CREAR POLÍTICAS PARA chat_threads (SELECT, INSERT, UPDATE)

-- Política para VER threads donde el usuario es party_a o party_b
CREATE POLICY "chat_threads_select"
    ON chat_threads FOR SELECT
    USING (party_a = auth.uid() OR party_b = auth.uid());

-- Política para CREAR threads donde el usuario es party_a o party_b
CREATE POLICY "chat_threads_insert"
    ON chat_threads FOR INSERT
    WITH CHECK (party_a = auth.uid() OR party_b = auth.uid());

-- Política para ACTUALIZAR threads donde el usuario es party_a o party_b
CREATE POLICY "chat_threads_update"
    ON chat_threads FOR UPDATE
    USING (party_a = auth.uid() OR party_b = auth.uid());

-- PASO 4: CREAR POLÍTICAS PARA chat_messages (SELECT, INSERT, UPDATE)

-- Política para VER mensajes en threads donde el usuario participa
CREATE POLICY "chat_messages_select"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_messages.thread_id
            AND (chat_threads.party_a = auth.uid() OR chat_threads.party_b = auth.uid())
        )
    );

-- Política para ENVIAR/INSERTAR mensajes
-- IMPORTANTE: Verificar que sender_id = auth.uid() Y que el usuario es parte del thread
CREATE POLICY "chat_messages_insert"
    ON chat_messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_messages.thread_id
            AND (chat_threads.party_a = auth.uid() OR chat_threads.party_b = auth.uid())
        )
    );

-- Política para ACTUALIZAR propios mensajes (opcional)
CREATE POLICY "chat_messages_update"
    ON chat_messages FOR UPDATE
    USING (sender_id = auth.uid());

-- PASO 5: VERIFICAR QUE REALTIME ESTÉ HABILITADO
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;

-- PASO 6: VERIFICAR POLÍTICAS CREADAS
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd as command,
    permissive,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE tablename IN ('chat_threads', 'chat_messages')
ORDER BY tablename, policyname;

-- PASO 7: DIAGNÓSTICO
-- Verificar threads existentes (esto debe ejecutarse como el usuario actual en la aplicación)
-- SELECT * FROM chat_threads;

-- Verificar mensajes existentes
-- SELECT * FROM chat_messages;

-- Verificar realtime
SELECT tablename, schemaname 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('chat_threads', 'chat_messages');

-- =========================================================
-- INSTRUCCIONES DE PRUEBA
-- =========================================================

/*
PARA PROBAR EL CHAT:

1. Ejecutar este script SQL en Supabase SQL Editor
2. Como vendedor: abrir una solicitud y hacer clic en "Negociar"
3. Hacer clic en "Aceptar Trato" para habilitar el chat
4. Enviar un mensaje de prueba
5. Como comprador: abrir "Completar Compra"
6. Verificar que el mensaje del vendedor aparece
7. El comprador envía respuesta
8. Verificar que el vendedor recibe el mensaje en tiempo real

SÍNTOMAS DE PROBLEMA:

❌ Si los mensajes no se insertan:
   - Revisar consola del navegador para errores RLS
   - Verificar que el usuario es party_a o party_b en el thread
   
❌ Si los mensajes no aparecen:
   - Verificar que realtime está habilitado
   - Revisar consola para errores de suscripción realtime
   - Verificar que las políticas SELECT permiten ver mensajes
   
❌ Si los mensajes no llegan en tiempo real:
   - Verificar conexión a Supabase Realtime
   - Revisar que el canal está subscripto correctamente
   - Verificar filtro del canal: thread_id=eq.{threadId}
*/




