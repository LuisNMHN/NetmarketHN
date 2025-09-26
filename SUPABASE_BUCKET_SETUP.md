# Configuración del Bucket de Supabase Storage

## Problema
El error 400 (Bad Request) al subir archivos indica que el bucket `kyc` no está configurado correctamente con los permisos necesarios.

## Solución

### 1. Crear el Bucket en Supabase Dashboard

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
2. Navega a **Storage** en el menú lateral
3. Haz clic en **"New bucket"**
4. Configura:
   - **Name**: `kyc`
   - **Public bucket**: ✅ (marcado)
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: `image/*,application/pdf`

### 2. Configurar Políticas RLS (Row Level Security)

Ejecuta estas consultas SQL en el **SQL Editor** de Supabase:

```sql
-- Habilitar RLS en el bucket
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Política para permitir a usuarios autenticados subir archivos
CREATE POLICY "Users can upload KYC files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a usuarios autenticados ver sus propios archivos
CREATE POLICY "Users can view own KYC files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a usuarios autenticados actualizar sus archivos
CREATE POLICY "Users can update own KYC files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a usuarios autenticados eliminar sus archivos
CREATE POLICY "Users can delete own KYC files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'kyc' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 3. Verificar la Configuración

Después de configurar, prueba subir un archivo. Los logs en la consola deberían mostrar:

```
✅ Permisos del bucket verificados
📤 Subiendo archivo: { path: "user-id/document_front.png", bucket: "kyc", ... }
✅ Archivo subido exitosamente
```

### 4. Si Persisten los Problemas

Si el error 400 continúa, verifica:

1. **Variables de entorno**: Asegúrate de que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén correctas
2. **Sesión de usuario**: Verifica que el usuario esté autenticado correctamente
3. **Bucket público**: El bucket debe estar marcado como público
4. **Políticas RLS**: Las políticas deben estar activas y correctas

### 5. Logs de Debug

El código ahora incluye logs detallados que te ayudarán a identificar el problema:

- `❌ Error de permisos del bucket:` - Problema con RLS
- `❌ Error de upload:` - Error específico de Supabase Storage
- `Error de configuración del bucket` - Problema de configuración general

## Contacto

Si necesitas ayuda adicional, contacta al administrador del sistema con los logs de error específicos.

