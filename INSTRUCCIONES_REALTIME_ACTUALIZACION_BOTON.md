# 🔧 Instrucciones para Solucionar Actualización en Tiempo Real del Botón "Completar Compra"

## Problema
Cuando el vendedor hace clic en "Aceptar trato", el comprador no ve la actualización en tiempo real en la página "Mis Solicitudes de Compra" (el botón "Completar Compra" no aparece automáticamente).

## Solución

### Paso 1: Verificar la configuración actual
Ejecuta el siguiente script SQL en **Supabase Dashboard > SQL Editor**:

```sql
-- Script: VERIFY_REALTIME_PERMISSIONS.sql
```

Este script te mostrará:
- ✅ Si Realtime está habilitado para `purchase_requests`
- ✅ Si existen las políticas RLS necesarias
- ✅ Si los índices están correctos

### Paso 2: Corregir permisos y habilitar Realtime
Ejecuta el siguiente script SQL en **Supabase Dashboard > SQL Editor**:

```sql
-- Script: FIX_REALTIME_UPDATE_BUTTON.sql
```

Este script:
1. ✅ Habilita Realtime para `purchase_requests`
2. ✅ Crea políticas RLS permisivas para UPDATE
3. ✅ Asegura que los compradores puedan ver sus solicitudes actualizadas
4. ✅ Verifica que todo esté configurado correctamente

### Paso 3: Verificar en el código
El código en `app/(dashboard)/dashboard/mis-solicitudes/page.tsx` ya está configurado para escuchar cambios en tiempo real:

```typescript
// Líneas 376-420
const channel = supabase
  .channel('mis_solicitudes_changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'purchase_requests',
      filter: `buyer_id=eq.${userId}`
    },
    (payload) => {
      // Actualiza el estado de la solicitud
      setRequests((prevRequests) => {
        const updatedRequests = prevRequests.map((req) => {
          if (req.id === payload.new.id) {
            return {
              ...req,
              status: payload.new.status,
              seller_id: payload.new.seller_id,
              accepted_at: payload.new.accepted_at
            }
          }
          return req
        })
        return updatedRequests
      })
    }
  )
  .subscribe((status) => {
    console.log('📡 Estado de suscripción Realtime:', status)
  })
```

### Paso 4: Verificar en la consola del navegador
1. Abre la página "Mis Solicitudes de Compra" como comprador
2. Abre las **DevTools (F12)** y ve a la consola
3. Deberías ver: `📡 Estado de suscripción Realtime: SUBSCRIBED`
4. Cuando el vendedor acepte el trato, deberías ver: `🔄 Cambio en tiempo real recibido:` con los datos actualizados

### Paso 5: Verificar en Supabase Dashboard
1. Ve a **Database > Replication** en Supabase Dashboard
2. Verifica que `purchase_requests` aparece en la lista de tablas con Realtime habilitado
3. Si no aparece, ejecuta el script `FIX_REALTIME_UPDATE_BUTTON.sql` nuevamente

## Diagnóstico de Problemas

### Problema 1: No se ve el mensaje "SUBSCRIBED"
**Solución:**
- Verifica que la sesión de Supabase está activa
- Verifica que `userId` no es `null`
- Verifica la consola por errores

### Problema 2: Se ve "SUBSCRIBED" pero no hay actualizaciones
**Solución:**
1. Verifica que Realtime está habilitado en Supabase Dashboard > Replication
2. Verifica que las políticas RLS permiten SELECT y UPDATE
3. Ejecuta `FIX_REALTIME_UPDATE_BUTTON.sql` nuevamente

### Problema 3: Se reciben actualizaciones pero el botón no aparece
**Solución:**
- Verifica que el estado se actualiza correctamente:
  ```typescript
  console.log('🔍 Estado actualizado:', payload.new.status)
  ```
- Verifica que la condición `request.status === 'accepted'` se cumple
- Verifica que el botón está renderizado correctamente en las líneas 526-554

## Verificación Final
Después de ejecutar los scripts SQL:

1. ✅ Abre la consola del navegador (F12)
2. ✅ Ve a "Mis Solicitudes de Compra" como comprador
3. ✅ Deberías ver: `📡 Estado de suscripción Realtime: SUBSCRIBED`
4. ✅ En otra ventana o dispositivo, inicia sesión como vendedor
5. ✅ Acepta el trato desde la página de "Solicitudes de Compra"
6. ✅ Regresa a la ventana del comprador
7. ✅ Deberías ver: `🔄 Cambio en tiempo real recibido:` con los datos
8. ✅ El botón "Completar Compra" debería aparecer automáticamente

## Comandos SQL útiles para depuración

```sql
-- Ver todas las políticas de purchase_requests
SELECT * FROM pg_policies WHERE tablename = 'purchase_requests';

-- Ver si Realtime está habilitado
SELECT * FROM pg_publication_tables 
WHERE tablename = 'purchase_requests';

-- Ver datos de solicitudes recientes
SELECT id, buyer_id, seller_id, status, accepted_at 
FROM purchase_requests 
ORDER BY created_at DESC 
LIMIT 5;
```

## Contacto
Si después de seguir estos pasos el problema persiste, proporciona:
1. La salida de `VERIFY_REALTIME_PERMISSIONS.sql`
2. Capturas de pantalla de la consola del navegador
3. Capturas de Supabase Dashboard > Replication

