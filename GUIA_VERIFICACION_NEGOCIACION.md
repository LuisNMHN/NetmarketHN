# 🧪 Guía de Verificación: Sistema de Negociación Mejorado

## 📋 **Checklist de Verificación**

### **🔧 Paso 1: Ejecutar Scripts de Base de Datos**

#### **1.1 Ejecutar Script Principal**
```sql
-- Ejecutar en tu base de datos Supabase
\i IMPROVE_NEGOTIATION_STATES.sql
```

#### **1.2 Verificar que las funciones se crearon**
```sql
-- Verificar funciones creadas
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'start_negotiation',
    'end_negotiation_no_deal', 
    'accept_offer_during_negotiation',
    'cleanup_expired_negotiations',
    'get_available_purchase_requests'
);
```

#### **1.3 Verificar nuevos campos en la tabla**
```sql
-- Verificar campos agregados
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchase_requests' 
AND column_name IN ('negotiating_with', 'negotiation_started_at', 'negotiation_timeout_at');
```

### **🔧 Paso 2: Probar Funciones de Base de Datos**

#### **2.1 Crear una solicitud de prueba**
```sql
-- Crear solicitud de prueba (reemplaza con tu user_id)
INSERT INTO purchase_requests (
    buyer_id, 
    amount, 
    description, 
    status,
    metadata
) VALUES (
    'TU_USER_ID_AQUI',  -- Reemplaza con tu ID de usuario
    1000,
    'Solicitud de prueba para verificar negociación',
    'active',
    '{"payment_method": "local_transfer", "bank_name": "Banco de Prueba"}'
);
```

#### **2.2 Probar función start_negotiation**
```sql
-- Probar iniciar negociación (reemplaza con IDs reales)
SELECT start_negotiation(
    'ID_DE_LA_SOLICITUD',  -- ID de la solicitud creada
    'OTRO_USER_ID'         -- ID de otro usuario (vendedor)
);
```

#### **2.3 Verificar que el estado cambió**
```sql
-- Verificar que el estado cambió a 'negotiating'
SELECT 
    id,
    status,
    negotiating_with,
    negotiation_started_at,
    negotiation_timeout_at
FROM purchase_requests 
WHERE id = 'ID_DE_LA_SOLICITUD';
```

#### **2.4 Probar función end_negotiation_no_deal**
```sql
-- Probar finalizar negociación sin acuerdo
SELECT end_negotiation_no_deal(
    'ID_DE_LA_SOLICITUD',
    'OTRO_USER_ID'
);
```

#### **2.5 Verificar que volvió a 'active'**
```sql
-- Verificar que volvió a estado 'active'
SELECT 
    id,
    status,
    negotiating_with,
    negotiation_started_at
FROM purchase_requests 
WHERE id = 'ID_DE_LA_SOLICITUD';
```

### **🔧 Paso 3: Probar Funciones del Servidor (TypeScript)**

#### **3.1 Verificar que las nuevas funciones están disponibles**
```typescript
// En tu archivo de acciones, verificar que estas funciones existen:
import { 
  startNegotiation,
  endNegotiationNoDeal,
  acceptOfferDuringNegotiation,
  getAvailablePurchaseRequests,
  cleanupExpiredNegotiations
} from "@/lib/actions/purchase_requests"
```

#### **3.2 Probar función getAvailablePurchaseRequests**
```typescript
// En la consola del navegador o en un componente de prueba:
const result = await getAvailablePurchaseRequests(10, 0);
console.log('Solicitudes disponibles:', result);
```

#### **3.3 Probar función startNegotiation**
```typescript
// Probar iniciar negociación (reemplaza con ID real)
const result = await startNegotiation('ID_DE_SOLICITUD_REAL');
console.log('Resultado de iniciar negociación:', result);
```

### **🔧 Paso 4: Probar Interfaz de Usuario**

#### **4.1 Verificar página de solicitudes**
1. **Ir a** `/dashboard/solicitudes`
2. **Verificar que se cargan** las solicitudes
3. **Verificar que aparecen** los nuevos estados visuales:
   - 🟢 **Activa** - Verde
   - 🔵 **Tú estás negociando** - Azul
   - 🟠 **En negociación** - Naranja

#### **4.2 Probar botón "Negociar"**
1. **Hacer clic** en "Negociar" en una solicitud activa
2. **Verificar que aparece** toast de "Negociación iniciada"
3. **Verificar que se abre** el chat
4. **Verificar que el estado** cambia a "Tú estás negociando"

#### **4.3 Probar botones de negociación**
1. **Verificar que aparecen** los botones correctos:
   - **Solicitud Activa:** Botón "Negociar"
   - **Negociando (tú):** Botones "Continuar Chat" y "Finalizar"
   - **Negociando (otro):** Botón deshabilitado "En negociación"

#### **4.4 Probar información de tiempo**
1. **Verificar que aparece** información de expiración de negociación
2. **Verificar formato** de fecha y hora

### **🔧 Paso 5: Probar Sistema de Chat**

#### **5.1 Verificar apertura de chat**
1. **Hacer clic** en "Negociar"
2. **Verificar que se abre** el ChatPanel
3. **Verificar que muestra** información de la solicitud
4. **Verificar que se puede** enviar mensajes

#### **5.2 Probar continuar chat**
1. **Cerrar** el chat
2. **Hacer clic** en "Continuar Chat"
3. **Verificar que se abre** con el historial de mensajes

### **🔧 Paso 6: Probar Sistema de Notificaciones**

#### **6.1 Verificar componente de notificaciones**
```typescript
// Importar y usar el componente en una página de prueba
import { NegotiationNotifications } from "@/components/notifications/NegotiationNotifications";

// En tu componente:
<NegotiationNotifications />
```

#### **6.2 Verificar notificaciones en base de datos**
```sql
-- Verificar que se crean notificaciones
SELECT 
    type,
    title,
    message,
    is_read,
    created_at
FROM request_notifications 
WHERE type LIKE '%negotiation%'
ORDER BY created_at DESC;
```

### **🔧 Paso 7: Probar Limpieza Automática**

#### **7.1 Ejecutar script de limpieza**
```sql
-- Ejecutar el script de limpieza
\i CLEANUP_NEGOTIATIONS.sql
```

#### **7.2 Probar función de limpieza**
```sql
-- Probar limpieza manual
SELECT cleanup_expired_negotiations();
```

#### **7.3 Verificar estadísticas**
```sql
-- Ver estadísticas de negociaciones
SELECT 
    status,
    COUNT(*) as cantidad,
    COUNT(CASE WHEN negotiating_with IS NOT NULL THEN 1 END) as en_negociacion
FROM purchase_requests 
WHERE status IN ('active', 'negotiating')
GROUP BY status;
```

### **🔧 Paso 8: Pruebas de Escenarios Completos**

#### **8.1 Escenario 1: Negociación Exitosa**
1. **Crear** solicitud de compra
2. **Iniciar** negociación
3. **Chat** entre comprador y vendedor
4. **Aceptar** oferta negociada
5. **Verificar** que cambia a estado 'accepted'

#### **8.2 Escenario 2: Negociación Fallida**
1. **Crear** solicitud de compra
2. **Iniciar** negociación
3. **Finalizar** sin acuerdo
4. **Verificar** que vuelve a estado 'active'

#### **8.3 Escenario 3: Negociación Expirada**
1. **Crear** solicitud de compra
2. **Iniciar** negociación
3. **Esperar** 2 horas (o cambiar timeout en BD)
4. **Ejecutar** limpieza automática
5. **Verificar** que vuelve a estado 'active'

### **🔧 Paso 9: Verificar Rendimiento**

#### **9.1 Verificar índices**
```sql
-- Verificar que los índices se crearon
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'purchase_requests'
AND indexname LIKE '%negotiation%';
```

#### **9.2 Verificar políticas RLS**
```sql
-- Verificar políticas RLS
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'purchase_requests';
```

### **🔧 Paso 10: Pruebas de Usuario Final**

#### **10.1 Prueba con dos usuarios diferentes**
1. **Usuario A:** Crear solicitud de compra
2. **Usuario B:** Hacer clic en "Negociar"
3. **Verificar** que Usuario A ve "En negociación"
4. **Verificar** que Usuario C (tercero) ve "En negociación"

#### **10.2 Prueba de concurrencia**
1. **Múltiples usuarios** intentan negociar la misma solicitud
2. **Solo uno** debe poder iniciar negociación
3. **Los demás** deben ver "En negociación"

## 🚨 **Problemas Comunes y Soluciones**

### **Error: "Función no encontrada"**
```sql
-- Verificar que las funciones existen
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'start_negotiation';
```

### **Error: "Campo no existe"**
```sql
-- Verificar que los campos existen
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'purchase_requests' 
AND column_name = 'negotiating_with';
```

### **Error: "Política RLS"**
```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'purchase_requests';
```

### **Error en TypeScript: "Función no exportada"**
```typescript
// Verificar que las funciones están exportadas en purchase_requests.ts
export async function startNegotiation(requestId: string) {
  // ...
}
```

## ✅ **Checklist Final**

- [ ] Scripts SQL ejecutados sin errores
- [ ] Funciones de base de datos funcionando
- [ ] Nuevos campos agregados correctamente
- [ ] Funciones TypeScript importadas correctamente
- [ ] UI muestra estados correctos
- [ ] Botones funcionan según el estado
- [ ] Chat se abre correctamente
- [ ] Notificaciones se crean
- [ ] Limpieza automática funciona
- [ ] Políticas RLS funcionan
- [ ] Índices creados correctamente
- [ ] Pruebas de escenarios completos
- [ ] Pruebas con múltiples usuarios

## 🎉 **¡Verificación Completa!**

Una vez que hayas completado todos estos pasos, tu sistema de negociación mejorado estará funcionando perfectamente. Si encuentras algún problema, revisa la sección de "Problemas Comunes" o consulta los logs de la consola del navegador y de Supabase.





















