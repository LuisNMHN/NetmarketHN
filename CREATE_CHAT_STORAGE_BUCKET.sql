-- =========================================================
-- NMHN - BUCKET DE STORAGE PARA ADJUNTOS DE CHAT
-- =========================================================
-- Bucket privado para adjuntos de chat con URLs firmadas

-- 1. Crear bucket para adjuntos de chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat_attachments',
    'chat_attachments',
    false, -- Privado
    10485760, -- 10MB límite
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- 2. Habilitar RLS en el bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Verificar si ya existen políticas antes de crearlas
DO $$
BEGIN
    -- Política para subir archivos (solo usuarios con rol 'user')
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'chat_attachments_upload_user_only'
    ) THEN
        EXECUTE 'CREATE POLICY "chat_attachments_upload_user_only" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = ''chat_attachments''
                AND auth.uid() IS NOT NULL
                AND public.is_user_role(auth.uid())
                AND EXISTS (
                    SELECT 1 
                    FROM chat_conversation_participants cp
                    JOIN chat_conversations c ON c.id = cp.conversation_id
                    WHERE cp.user_id = auth.uid()
                    AND (storage.foldername(name))[1] = c.id::text
                )
            )';
    END IF;

    -- Política para leer archivos (solo participantes con rol 'user')
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'chat_attachments_read_user_only'
    ) THEN
        EXECUTE 'CREATE POLICY "chat_attachments_read_user_only" ON storage.objects
            FOR SELECT USING (
                bucket_id = ''chat_attachments''
                AND auth.uid() IS NOT NULL
                AND public.is_user_role(auth.uid())
                AND EXISTS (
                    SELECT 1 
                    FROM chat_conversation_participants cp
                    JOIN chat_conversations c ON c.id = cp.conversation_id
                    WHERE cp.user_id = auth.uid()
                    AND (storage.foldername(name))[1] = c.id::text
                )
            )';
    END IF;

    -- Política para eliminar archivos (solo el autor con rol 'user')
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'chat_attachments_delete_user_only'
    ) THEN
        EXECUTE 'CREATE POLICY "chat_attachments_delete_user_only" ON storage.objects
            FOR DELETE USING (
                bucket_id = ''chat_attachments''
                AND auth.uid() IS NOT NULL
                AND public.is_user_role(auth.uid())
                AND owner = auth.uid()
            )';
    END IF;
END $$;

-- 6. Función para generar URL firmada de adjunto
CREATE OR REPLACE FUNCTION public.get_chat_attachment_url(
    p_conversation_id UUID,
    p_filename TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_url TEXT;
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden acceder a adjuntos';
    END IF;
    
    -- Verificar que el usuario es participante de la conversación
    IF NOT EXISTS (
        SELECT 1 
        FROM chat_conversation_participants cp
        WHERE cp.conversation_id = p_conversation_id
        AND cp.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: no eres participante de esta conversación';
    END IF;
    
    -- Generar URL firmada con expiración corta (1 hora)
    SELECT storage.create_signed_url(
        'chat_attachments',
        p_conversation_id::text || '/' || p_filename,
        3600 -- 1 hora en segundos
    ) INTO v_url;
    
    RETURN v_url;
END;
$$;

-- 7. Función para subir adjunto
CREATE OR REPLACE FUNCTION public.upload_chat_attachment(
    p_conversation_id UUID,
    p_filename TEXT,
    p_file_data BYTEA,
    p_content_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_file_path TEXT;
    v_url TEXT;
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden subir adjuntos';
    END IF;
    
    -- Verificar que el usuario es participante de la conversación
    IF NOT EXISTS (
        SELECT 1 
        FROM chat_conversation_participants cp
        WHERE cp.conversation_id = p_conversation_id
        AND cp.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: no eres participante de esta conversación';
    END IF;
    
    -- Validar tipo de archivo
    IF p_content_type NOT IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf') THEN
        RAISE EXCEPTION 'Tipo de archivo no permitido: %', p_content_type;
    END IF;
    
    -- Construir ruta del archivo
    v_file_path := p_conversation_id::text || '/' || p_filename;
    
    -- Subir archivo al storage
    INSERT INTO storage.objects (bucket_id, name, owner, file_size, content_type, data)
    VALUES ('chat_attachments', v_file_path, auth.uid(), octet_length(p_file_data), p_content_type, p_file_data);
    
    -- Generar URL firmada
    SELECT public.get_chat_attachment_url(p_conversation_id, p_filename) INTO v_url;
    
    RETURN v_url;
END;
$$;

-- 8. Comentarios para documentación
COMMENT ON FUNCTION public.get_chat_attachment_url IS 'Genera URL firmada para adjuntos de chat';
COMMENT ON FUNCTION public.upload_chat_attachment IS 'Sube adjunto a storage de chat';

-- 9. Verificación final
SELECT 'Bucket de chat creado exitosamente' as status;
SELECT 'Restricción: Solo usuarios con rol "user" pueden subir/leer adjuntos' as restriction;
SELECT 'URLs firmadas con expiración de 1 hora' as security;
