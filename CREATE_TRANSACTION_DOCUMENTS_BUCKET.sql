-- =========================================================
-- SCRIPT PARA CREAR EL BUCKET 'transaction-documents'
-- =========================================================
-- Este bucket almacenará documentos relacionados con transacciones
-- como comprobantes de pago, recibos, etc.
-- 
-- IMPORTANTE: 
-- 1. Ejecuta SOLO la parte de creación del bucket (líneas 8-25)
-- 2. Las políticas RLS deben configurarse desde el Dashboard de Supabase:
--    - Ve a Storage > Policies
--    - Selecciona el bucket 'transaction-documents'
--    - Crea las políticas manualmente o usa la interfaz web
-- =========================================================

-- 1. Crear el bucket transaction-documents
-- NOTA: Si tienes permisos limitados, ejecuta esto desde el Dashboard de Supabase
-- en: Storage > Create new bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-documents', 
  'transaction-documents', 
  true, 
  10485760, -- 10MB en bytes
  ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/jpg', 
    'image/gif', 
    'image/webp', 
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/jpg', 
    'image/gif', 
    'image/webp', 
    'application/pdf'
  ];

-- 2. Verificar que el bucket se creó correctamente
SELECT 
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets 
WHERE name = 'transaction-documents';

-- =========================================================
-- CONFIGURACIÓN DE POLÍTICAS RLS (hacer desde el Dashboard)
-- =========================================================
-- Como no tienes permisos de propietario en storage.objects,
-- debes configurar las políticas desde el Dashboard de Supabase:
--
-- 1. Ve a: Storage > transaction-documents > Policies
-- 2. Crea las siguientes políticas:
--
-- POLÍTICA 1: Upload (INSERT)
--   Name: "Users can upload transaction documents"
--   Allowed operation: INSERT
--   Target roles: authenticated
--   USING expression: bucket_id = 'transaction-documents'
--   WITH CHECK expression: bucket_id = 'transaction-documents' AND auth.role() = 'authenticated'
--
-- POLÍTICA 2: View (SELECT)  
--   Name: "Users can view transaction documents"
--   Allowed operation: SELECT
--   Target roles: authenticated
--   USING expression: bucket_id = 'transaction-documents' AND auth.role() = 'authenticated'
--
-- POLÍTICA 3: Update (UPDATE)
--   Name: "Users can update transaction documents"
--   Allowed operation: UPDATE
--   Target roles: authenticated
--   USING expression: bucket_id = 'transaction-documents' AND auth.role() = 'authenticated'
--   WITH CHECK expression: bucket_id = 'transaction-documents' AND auth.role() = 'authenticated'
--
-- POLÍTICA 4: Delete (DELETE)
--   Name: "Users can delete transaction documents"
--   Allowed operation: DELETE
--   Target roles: authenticated
--   USING expression: bucket_id = 'transaction-documents' AND auth.role() = 'authenticated'
--
-- NOTA: Para simplificar, puedes hacer el bucket completamente público temporalmente
-- y luego restringir el acceso a nivel de aplicación en el código.
-- =========================================================

