-- Script para crear el bucket 'profiles' para avatares en Supabase
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Crear el bucket profiles para avatares
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Habilitar RLS en storage.objects si no está habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas existentes para el bucket profiles si las hay
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;

-- 4. Crear políticas RLS para el bucket profiles

-- Política para permitir subir avatares
CREATE POLICY "Users can upload profile images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profiles' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir ver avatares (público porque es bucket público)
CREATE POLICY "Anyone can view profile images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profiles'
);

-- Política para permitir actualizar avatares propios
CREATE POLICY "Users can update own profile images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profiles' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir eliminar avatares propios
CREATE POLICY "Users can delete own profile images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profiles' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Verificar que el bucket y políticas se crearon correctamente
SELECT * FROM storage.buckets WHERE name = 'profiles';

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname ILIKE '%profile%';

