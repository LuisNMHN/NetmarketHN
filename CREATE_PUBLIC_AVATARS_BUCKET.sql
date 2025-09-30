-- Script para crear bucket público de avatares
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Crear bucket público para avatares
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public-avatars', 'public-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Verificar que el bucket se creó correctamente
SELECT * FROM storage.buckets WHERE name = 'public-avatars';

-- 3. Verificar configuración del bucket
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets 
WHERE name = 'public-avatars';

-- NOTA: Este bucket es público, por lo que no necesita políticas RLS
-- Los archivos serán accesibles públicamente
-- Si necesitas más seguridad, configura políticas RLS desde el Dashboard
