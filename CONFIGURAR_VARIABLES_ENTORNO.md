# Configurar Variables de Entorno para el Chat

## Problema Identificado
El chat no está enviando mensajes porque faltan las variables de entorno de Supabase.

## Variables Necesarias

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```bash
# URL de tu proyecto Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave anónima de Supabase (pública)
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima-aqui

# Clave de servicio de Supabase (privada - solo para servidor)
SUPABASE_SERVICE_ROLE_KEY=tu-clave-de-servicio-aqui

# Configuración adicional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Cómo Obtener las Variables

1. **NEXT_PUBLIC_SUPABASE_URL**: 
   - Ve a tu proyecto en Supabase
   - Settings > API
   - Copia la "Project URL"

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**:
   - En la misma página de Settings > API
   - Copia la "anon public" key

3. **SUPABASE_SERVICE_ROLE_KEY**:
   - En la misma página de Settings > API
   - Copia la "service_role" key (manténla privada)

## Pasos para Configurar

1. Crea el archivo `.env.local` en la raíz del proyecto
2. Agrega las variables con tus valores reales
3. Reinicia el servidor de desarrollo (`npm run dev`)
4. Prueba el chat nuevamente

## Verificación

Después de configurar las variables, ejecuta:

```sql
-- Verificar que las funciones de chat funcionan
SELECT get_user_conversations_with_unread_count('e9cf435a-3ae6-4b1f-aca1-f6cde883f792'::uuid);
```

## Problemas Comunes

- **Error "Failed to fetch"**: Variables de entorno no configuradas
- **Error de autenticación**: Claves incorrectas
- **Error de permisos**: RLS policies bloqueando acceso

## Estado Actual

- ❌ Variables de entorno: No configuradas
- ✅ Estructura de base de datos: Correcta
- ✅ Funciones SQL: Funcionando
- ✅ Políticas RLS: Configuradas
- ❌ Frontend: No puede conectarse a Supabase

