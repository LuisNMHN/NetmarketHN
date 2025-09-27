-- Script para configurar políticas RLS para el bucket 'kyc' en Supabase
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Verificar que el bucket 'kyc' existe
SELECT * FROM storage.buckets WHERE name = 'kyc';

-- 2. Verificar las políticas RLS actuales
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- 3. Eliminar políticas existentes que puedan estar causando conflictos
DROP POLICY IF EXISTS "Users can upload KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;

-- 4. Crear políticas RLS para el bucket 'kyc'

-- Política para permitir a usuarios autenticados subir archivos al bucket kyc
CREATE POLICY "Enable insert for authenticated users on kyc bucket" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir a usuarios autenticados ver archivos del bucket kyc
CREATE POLICY "Enable read access for authenticated users on kyc bucket" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir a usuarios autenticados actualizar archivos del bucket kyc
CREATE POLICY "Enable update for authenticated users on kyc bucket" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir a usuarios autenticados eliminar archivos del bucket kyc
CREATE POLICY "Enable delete for authenticated users on kyc bucket" ON storage.objects
FOR DELETE USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
);

-- 5. Verificar que las políticas se crearon correctamente
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- 6. Opcional: Si quieres hacer el bucket completamente público (menos seguro)
-- Descomenta las siguientes líneas si prefieres acceso público total:

-- CREATE POLICY "Public Access" ON storage.objects
-- FOR ALL USING (bucket_id = 'kyc');

-- 7. Verificar la configuración del bucket
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name = 'kyc';
