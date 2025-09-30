-- SOLUCIÓN SIMPLE: Solo crear el bucket sin políticas personalizadas
-- Ejecuta ESTO en el SQL Editor de Supabase (sin esperar errores de permisos)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880;

-- Verificar que se creó correctamente
SELECT * FROM storage.buckets WHERE name = 'profiles';
