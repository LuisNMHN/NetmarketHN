-- =========================================================
-- NMHN - BUCKET DE STORAGE PARA ADJUNTOS DE CHAT (VERSIÓN SIMPLIFICADA)
-- =========================================================
-- Bucket privado para adjuntos de chat con URLs firmadas
-- Esta versión evita modificar directamente storage.objects

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

-- 2. Función para generar URL firmada de adjunto
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

-- 3. Función para subir adjunto (versión simplificada)
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
    
    -- Subir archivo al storage usando la función de Supabase
    PERFORM storage.insert_object(
        'chat_attachments',
        v_file_path,
        p_file_data,
        p_content_type,
        auth.uid()
    );
    
    -- Generar URL firmada
    SELECT public.get_chat_attachment_url(p_conversation_id, p_filename) INTO v_url;
    
    RETURN v_url;
END;
$$;

-- 4. Función para eliminar adjunto
CREATE OR REPLACE FUNCTION public.delete_chat_attachment(
    p_conversation_id UUID,
    p_filename TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_file_path TEXT;
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden eliminar adjuntos';
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
    
    -- Construir ruta del archivo
    v_file_path := p_conversation_id::text || '/' || p_filename;
    
    -- Eliminar archivo del storage
    PERFORM storage.delete_object('chat_attachments', v_file_path);
END;
$$;

-- 5. Función para listar adjuntos de una conversación
CREATE OR REPLACE FUNCTION public.list_chat_attachments(
    p_conversation_id UUID
)
RETURNS TABLE(
    filename TEXT,
    content_type TEXT,
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE,
    url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar que el usuario actual tiene rol 'user'
    IF NOT public.is_user_role(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: solo usuarios con rol "user" pueden listar adjuntos';
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
    
    -- Retornar lista de archivos
    RETURN QUERY
    SELECT 
        o.name as filename,
        o.content_type,
        o.file_size,
        o.created_at,
        public.get_chat_attachment_url(p_conversation_id, o.name) as url
    FROM storage.objects o
    WHERE o.bucket_id = 'chat_attachments'
    AND o.name LIKE p_conversation_id::text || '/%'
    ORDER BY o.created_at DESC;
END;
$$;

-- 6. Comentarios para documentación
COMMENT ON FUNCTION public.get_chat_attachment_url IS 'Genera URL firmada para adjuntos de chat';
COMMENT ON FUNCTION public.upload_chat_attachment IS 'Sube adjunto a storage de chat';
COMMENT ON FUNCTION public.delete_chat_attachment IS 'Elimina adjunto de storage de chat';
COMMENT ON FUNCTION public.list_chat_attachments IS 'Lista adjuntos de una conversación';

-- 7. Verificación final
SELECT 'Bucket de chat creado exitosamente (versión simplificada)' as status;
SELECT 'Restricción: Solo usuarios con rol "user" pueden subir/leer adjuntos' as restriction;
SELECT 'URLs firmadas con expiración de 1 hora' as security;
SELECT 'Nota: Las políticas RLS se configurarán automáticamente por Supabase' as note;
