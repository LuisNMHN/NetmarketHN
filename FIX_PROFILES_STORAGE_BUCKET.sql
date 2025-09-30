-- Script CORREGIDO para crear el bucket 'profiles' para avatares en Supabase
-- SOLUCIÓN AL ERROR: "must be owner of table objects"

-- 1. Primero, intentar crear el bucket sin modificar las políticas existentes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Verificar si las políticas ya existen antes de intentar eliminarlas
SELECT policyname FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage' 
AND policyname ILIKE '%profile%';

-- 3. Si necesitas crear políticas específicas, usa estas alternativas:

-- Opción A: Usar las políticas generales existentes (más probable que funcione)
-- Supabase ya tiene políticas generales que deberían funcionar para el bucket profiles

-- Opción B: Solo crear políticas si eres superusuario (no recomendado para proyectos en producción)
-- Estas funciones requieren permisos de superusuario

-- ALTERNATIVA SIMPLIFICADA (recomendada):
-- Si el bucket se creó correctamente, las políticas generales de Supabase deberían funcionar

-- 4. Verificar que el bucket se creó correctamente
SELECT * FROM storage.buckets WHERE name = 'profiles';

-- 5. Si necesitas políticas específicas y tienes problemas de permisos,
-- usa el Dashboard de Supabase:
-- Ve a Authentication > Policies en el Dashboard
-- Y crea las políticas desde ahí en lugar de SQL

-- Verificación final
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'profiles') THEN
        RAISE NOTICE 'Bucket "profiles" creado correctamente';
        RAISE NOTICE 'Las políticas generales de Supabase deberían funcionar automáticamente';
    ELSE
        RAISE NOTICE 'Error: No se pudo crear el bucket "profiles"';
    END IF;
END $$;

