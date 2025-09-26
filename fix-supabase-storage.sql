-- Script para configurar correctamente el bucket 'kyc' en Supabase
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Verificar si el bucket existe
SELECT * FROM storage.buckets WHERE name = 'kyc';

-- 2. Si no existe, crear el bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc', 'kyc', true, 52428800, ARRAY['image/*', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar RLS en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Users can upload KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own KYC files" ON storage.objects;

-- 5. Crear nuevas políticas RLS
CREATE POLICY "Users can upload KYC files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own KYC files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own KYC files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own KYC files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';


