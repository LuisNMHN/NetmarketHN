# Solución para Error de Avatar - Configuración desde Dashboard

## Problema
Error: `StorageApiError: new row violates row-level security policy` al subir avatares.

## Solución Manual desde Dashboard de Supabase

### Paso 1: Verificar Bucket
1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **Storage** en el menú lateral
3. Verifica que existe el bucket `kyc`
4. Si no existe, créalo con estas configuraciones:
   - **Name**: `kyc`
   - **Public bucket**: ✅ (marcado)
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: `image/*,application/pdf`

### Paso 2: Configurar Políticas RLS
1. Ve a **Authentication** > **Policies** en el menú lateral
2. Busca la tabla `storage.objects`
3. Haz clic en **"New Policy"**

#### Política 1: INSERT (Subir archivos)
- **Policy name**: `Enable insert for authenticated users on kyc bucket`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: (deja vacío)
- **WITH CHECK expression**: 
  ```sql
  bucket_id = 'kyc' AND auth.role() = 'authenticated'
  ```

#### Política 2: SELECT (Ver archivos)
- **Policy name**: `Enable read access for authenticated users on kyc bucket`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**: 
  ```sql
  bucket_id = 'kyc' AND auth.role() = 'authenticated'
  ```
- **WITH CHECK expression**: (deja vacío)

#### Política 3: UPDATE (Actualizar archivos)
- **Policy name**: `Enable update for authenticated users on kyc bucket`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**: 
  ```sql
  bucket_id = 'kyc' AND auth.role() = 'authenticated'
  ```
- **WITH CHECK expression**: (deja vacío)

#### Política 4: DELETE (Eliminar archivos)
- **Policy name**: `Enable delete for authenticated users on kyc bucket`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**: 
  ```sql
  bucket_id = 'kyc' AND auth.role() = 'authenticated'
  ```
- **WITH CHECK expression**: (deja vacío)

### Paso 3: Verificar Configuración
1. Ve a **Storage** > **Policies**
2. Verifica que las 4 políticas aparecen en la lista
3. Asegúrate de que todas están **enabled**

### Paso 4: Probar
1. Ve a la página de perfil
2. Intenta subir un avatar
3. Debería funcionar sin errores

## Alternativa: Usar Bucket Público
Si sigues teniendo problemas, puedes hacer el bucket completamente público:

1. Ve a **Storage** > **Buckets**
2. Haz clic en el bucket `kyc`
3. En **Settings**, marca **"Public bucket"**
4. Esto permitirá acceso público sin políticas RLS

## Verificación Final
Después de configurar, prueba subir un avatar. Los logs en la consola deberían mostrar:
- ✅ Upload exitoso
- ✅ URL pública generada
- ✅ Perfil actualizado

## Notas Importantes
- Las políticas RLS son necesarias para seguridad
- El bucket público es menos seguro pero más simple
- Siempre verifica que los archivos subidos sean del tipo correcto
- El límite de 50MB es suficiente para avatares
