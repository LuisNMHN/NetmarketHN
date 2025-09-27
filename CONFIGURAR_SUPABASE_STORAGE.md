# Configuración de Supabase Storage para KYC

## Problema Actual
El error "Ni el bucket 'public' ni 'public' existen" indica que no hay buckets configurados en Supabase Storage.

## Solución Manual (Recomendada)

### 1. Acceder a Supabase Dashboard
1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Navega a **Storage** en el menú lateral

### 2. Crear Bucket Público
1. Haz clic en **"New bucket"**
2. Configura:
   - **Name**: `public`
   - **Public bucket**: ✅ (marcado)
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: `image/*,application/pdf`
3. Haz clic en **"Create bucket"**

### 3. Verificar Configuración
Después de crear el bucket, deberías ver:
- ✅ Bucket `public` en la lista
- ✅ Estado: Public
- ✅ Límite de archivo: 50 MB

## Solución Automática (Alternativa)

Si prefieres usar SQL, ejecuta estas consultas en el **SQL Editor** de Supabase:

```sql
-- Crear bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public', 'public', true, 52428800, ARRAY['image/*', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Verificar que se creó
SELECT * FROM storage.buckets WHERE name = 'public';
```

## Verificación

Después de configurar, prueba subir un archivo en el paso 2. Los logs deberían mostrar:

```
📤 Verificando bucket: public
📋 Buckets disponibles: ['public']
📤 Subiendo al bucket: public
✅ Archivo subido exitosamente
```

## Si Persisten Problemas

1. **Verifica permisos**: Asegúrate de que el usuario tenga permisos de administrador en Supabase
2. **Revisa variables de entorno**: Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén correctas
3. **Contacta soporte**: Si el problema persiste, contacta al administrador del sistema

## Logs de Debug

El código ahora incluye logs detallados:
- `📋 Buckets disponibles:` - Lista todos los buckets encontrados
- `🔄 No hay buckets disponibles` - Indica que no hay buckets configurados
- `✅ Bucket público creado exitosamente` - Confirmación de creación automática
- `🔄 Usando bucket disponible como fallback` - Usa un bucket existente como alternativa
