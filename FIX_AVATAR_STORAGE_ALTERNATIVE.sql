-- Solución alternativa para el error de permisos de storage.objects
-- Este script NO requiere permisos de superusuario
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Verificar que el bucket 'kyc' existe
SELECT * FROM storage.buckets WHERE name = 'kyc';

-- 2. Verificar las políticas RLS actuales (solo lectura)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage' 
AND (qual LIKE '%kyc%' OR with_check LIKE '%kyc%');

-- 3. Verificar si RLS está habilitado en storage.objects
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 4. Mostrar todas las políticas de storage (solo lectura)
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- 5. Verificar configuración del bucket kyc
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets 
WHERE name = 'kyc';

-- 6. Si el bucket no existe, crearlo (esto sí debería funcionar)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc', 'kyc', true, 52428800, ARRAY['image/*', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/*', 'application/pdf'];

-- 7. Verificar que el bucket se creó/actualizó correctamente
SELECT * FROM storage.buckets WHERE name = 'kyc';

-- NOTA: Para las políticas RLS, necesitas usar el Dashboard de Supabase:
-- 1. Ve a Authentication > Policies
-- 2. Busca la tabla "storage.objects"
-- 3. Crea las políticas manualmente desde la interfaz
-- 4. O contacta al administrador del proyecto para que ejecute las políticas
