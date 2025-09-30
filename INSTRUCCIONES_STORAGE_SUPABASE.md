# Solución para Error de Storage en Supabase

## ❌ Error Encontrado
```
ERROR: 42501: must be owner of table objects
```

## 🔧 Soluciones Alternativas

### Opción 1: Vista Dashboard (Recomendada)
1. Ve al **Dashboard de Supabase**
2. Navega a **Storage** en el menú lateral
3. Haz clic en **"New bucket"**
4. Configura:
   - **Name**: `profiles`
   - **Public bucket**: ✅ (marcado)
   - **File size limit**: `5 MB`
   - **Allowed MIME types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

### Opción 2: SQL Simplificado
Ejecuta solo esta línea en el **SQL Editor**:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

### Opción 3: Configurar Políticas desde Dashboard
Si necesitas políticas específicas:

1. Ve a **Authentication** > **Policies**
2. Busca la tabla `storage.objects`
3. Crea nuevas políticas desde ahí

## ✅ Verificación
Una vez creado el bucket, verifica que funciona:

```sql
SELECT * FROM storage.buckets WHERE name = 'profiles';
```

Debería devolver una fila con los datos del bucket.

## 🚨 Nota Importante
- Supabase ya tiene políticas generales para storage que deberían funcionar automáticamente
- No necesitas crear políticas personalizadas en la mayoría de casos
- Si tienes problemas de permisos, es mejor usar el Dashboard en lugar de SQL directo

