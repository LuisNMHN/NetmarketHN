-- Script para configurar el bucket 'public' en Supabase
-- Ejecuta estas consultas en el SQL Editor de Supabase Dashboard

-- 1. Verificar si el bucket 'public' existe
SELECT * FROM storage.buckets WHERE name = 'public';

-- 2. Si no existe, crear el bucket 'public'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public', 'public', true, 52428800, ARRAY['image/*', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 3. Verificar que se creó correctamente
SELECT * FROM storage.buckets WHERE name = 'public';

-- 4. El bucket 'public' no necesita políticas RLS porque es público
-- Las políticas RLS solo se aplican a buckets privados


