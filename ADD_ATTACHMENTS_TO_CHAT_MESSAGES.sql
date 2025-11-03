-- =========================================================
-- AGREGAR SOPORTE PARA ADJUNTOS EN CHAT_MESSAGES
-- =========================================================
-- Este script agrega los campos necesarios para almacenar
-- documentos adjuntos en los mensajes del chat
-- =========================================================

-- 1. Agregar columna 'attachments' para almacenar documentos adjuntos
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Agregar columna 'message_type' para identificar el tipo de mensaje
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- 3. Agregar comentarios para documentar las columnas
COMMENT ON COLUMN chat_messages.attachments IS 'Array JSON de documentos adjuntos: [{type, name, url, size}]';
COMMENT ON COLUMN chat_messages.message_type IS 'Tipo de mensaje: text, document, image, etc.';

-- 4. Crear índice para búsquedas eficientes de mensajes con adjuntos
-- Índice GIN en la columna attachments directamente (para búsquedas en JSONB)
CREATE INDEX IF NOT EXISTS idx_chat_messages_attachments_gin 
ON chat_messages USING GIN (attachments);

-- 5. Verificar que las columnas se agregaron correctamente
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_messages'
AND column_name IN ('attachments', 'message_type')
ORDER BY column_name;

SELECT '✅ Columnas agregadas correctamente a chat_messages' as resultado;

