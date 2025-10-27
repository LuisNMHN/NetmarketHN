# 📋 Metodología: Estados de Negociación para Solicitudes de Compra

## 🎯 **Objetivo**

Mejorar la experiencia de usuario cuando una solicitud de compra entra en estado de negociación, evitando conflictos entre múltiples usuarios y proporcionando claridad sobre el estado actual de cada solicitud.

## 🔍 **Problema Identificado**

### **Situación Actual:**
- Cuando un usuario hace clic en "Negociar", se abre el chat pero **NO se cambia el estado** de la solicitud
- Múltiples usuarios pueden negociar simultáneamente la misma solicitud
- No hay indicación clara de quién está negociando con quién
- No hay timeout automático para negociaciones abandonadas
- La experiencia de usuario es confusa y puede generar conflictos

### **Consecuencias:**
- Confusión entre usuarios
- Pérdida de tiempo en negociaciones que no prosperan
- Falta de transparencia en el proceso
- Posibles disputas por ofertas simultáneas

## ✅ **Solución Implementada**

### **1. Sistema de Estados Mejorado**

#### **Estados de Solicitud:**
- `active` - Disponible para negociación
- `negotiating` - En proceso de negociación (bloqueada)
- `accepted` - Oferta aceptada, en proceso de pago
- `completed` - Transacción completada
- `cancelled` - Cancelada por el usuario
- `expired` - Expirada por tiempo

#### **Campos Adicionales:**
- `negotiating_with` - ID del usuario que está negociando
- `negotiation_started_at` - Timestamp de inicio de negociación
- `negotiation_timeout_at` - Timestamp de expiración (2 horas)

### **2. Flujo de Negociación**

```mermaid
graph TD
    A[Solicitud Activa] --> B[Usuario hace clic en 'Negociar']
    B --> C[start_negotiation()]
    C --> D[Estado cambia a 'negotiating']
    D --> E[Solicitud bloqueada para otros usuarios]
    E --> F[Se abre chat de negociación]
    F --> G{¿Negociación exitosa?}
    G -->|Sí| H[Aceptar oferta negociada]
    G -->|No| I[Finalizar negociación sin acuerdo]
    H --> J[Estado cambia a 'accepted']
    I --> K[Estado vuelve a 'active']
    J --> L[Proceso de pago]
    K --> M[Disponible para otros usuarios]
```

### **3. Funciones de Base de Datos**

#### **start_negotiation(request_id, seller_id)**
- Cambia estado a `negotiating`
- Asigna `negotiating_with` al vendedor
- Establece timeout de 2 horas
- Crea notificación para el comprador
- **Bloquea** la solicitud para otros usuarios

#### **end_negotiation_no_deal(request_id, user_id)**
- Vuelve estado a `active`
- Limpia campos de negociación
- Crea notificaciones para ambas partes
- **Libera** la solicitud para otros usuarios

#### **accept_offer_during_negotiation(request_id, buyer_id, amount, terms)**
- Cambia estado a `accepted`
- Crea transacción
- Crea notificaciones
- **Finaliza** la negociación exitosamente

#### **cleanup_expired_negotiations()**
- Limpia negociaciones expiradas (se ejecuta manualmente o por cron)
- Vuelve estado a `active`
- Crea notificaciones de expiración
- **Nota:** Se ejecuta mediante script separado o job programado

### **4. Mejoras en la UI**

#### **Estados Visuales:**
- 🟢 **Activa** - Verde, disponible para negociación
- 🔵 **Tú estás negociando** - Azul, puedes continuar o finalizar
- 🟠 **En negociación** - Naranja, bloqueada por otro usuario
- ⚫ **Negociación Expirada** - Gris, disponible nuevamente

#### **Botones Dinámicos:**
- **Solicitud Activa:** Botón "Negociar"
- **Negociando (tú):** Botones "Continuar Chat" y "Finalizar"
- **Negociando (otro):** Botón deshabilitado "En negociación"

#### **Información Adicional:**
- Tiempo de expiración de negociación
- Timestamp de inicio de negociación
- Notificaciones en tiempo real

### **5. Sistema de Notificaciones**

#### **Tipos de Notificación:**
- `negotiation_started` - "Un vendedor ha iniciado negociación"
- `negotiation_ended` - "La negociación ha terminado sin acuerdo"
- `negotiation_expired` - "La negociación ha expirado por tiempo"
- `offer_accepted` - "Has aceptado la oferta negociada"

#### **Componente de Notificaciones:**
- Lista filtrada solo para negociaciones
- Indicadores visuales de estado
- Botones para marcar como leídas
- Actualización automática cada 30 segundos

## 🚀 **Beneficios de la Solución**

### **Para los Usuarios:**
1. **Claridad Total** - Saben exactamente quién está negociando qué
2. **Sin Conflictos** - Imposible que múltiples usuarios negocien simultáneamente
3. **Timeout Automático** - Las negociaciones abandonadas se liberan automáticamente
4. **Notificaciones Reales** - Información inmediata sobre cambios de estado
5. **Control Total** - Pueden finalizar negociaciones que no prosperan

### **Para el Sistema:**
1. **Integridad de Datos** - Estados consistentes y predecibles
2. **Rendimiento** - Menos consultas innecesarias
3. **Escalabilidad** - Sistema robusto para múltiples usuarios
4. **Mantenimiento** - Limpieza automática de datos obsoletos

### **Para la Experiencia:**
1. **Profesional** - Proceso claro y estructurado
2. **Eficiente** - Menos tiempo perdido en negociaciones fallidas
3. **Transparente** - Todos los usuarios ven el mismo estado
4. **Confiable** - Sistema que funciona consistentemente

## 📊 **Métricas de Éxito**

### **Antes de la Implementación:**
- ❌ Múltiples negociaciones simultáneas
- ❌ Estados inconsistentes
- ❌ Confusión de usuarios
- ❌ Negociaciones abandonadas sin liberar

### **Después de la Implementación:**
- ✅ Una negociación por solicitud
- ✅ Estados claros y consistentes
- ✅ Usuarios informados en tiempo real
- ✅ Limpieza automática de negociaciones expiradas

## 🔧 **Implementación Técnica**

### **Archivos Modificados:**
1. `IMPROVE_NEGOTIATION_STATES.sql` - Script de base de datos
2. `CLEANUP_NEGOTIATIONS.sql` - Script de limpieza automática
3. `lib/actions/purchase_requests.ts` - Nuevas funciones del servidor
4. `app/(dashboard)/dashboard/solicitudes/page.tsx` - UI mejorada
5. `components/notifications/NegotiationNotifications.tsx` - Componente nuevo

### **Funciones Principales:**
- `startNegotiation()` - Inicia negociación
- `endNegotiationNoDeal()` - Finaliza sin acuerdo
- `acceptOfferDuringNegotiation()` - Acepta oferta negociada
- `getAvailablePurchaseRequests()` - Obtiene solo solicitudes disponibles

### **Políticas RLS:**
- Solo solicitudes activas visibles
- Solo el comprador o negociador puede actualizar

### **Limpieza Automática:**
- **Script:** `CLEANUP_NEGOTIATIONS.sql`
- **Ejecución:** Manual o mediante cron job
- **Frecuencia recomendada:** Cada 15 minutos
- **Función:** `cleanup_expired_negotiations()`

## 🎉 **Resultado Final**

La implementación de esta metodología transforma completamente la experiencia de negociación en NMHN:

1. **Elimina conflictos** entre usuarios
2. **Proporciona claridad** sobre el estado de cada solicitud
3. **Automatiza la limpieza** de negociaciones abandonadas
4. **Mejora la confianza** de los usuarios en el sistema
5. **Acelera el proceso** de negociación exitosa

Esta solución no solo resuelve el problema técnico, sino que también mejora significativamente la experiencia de usuario, haciendo que el proceso de negociación sea más profesional, eficiente y confiable.

---

## 📝 **Próximos Pasos**

1. **Ejecutar el script SQL** `IMPROVE_NEGOTIATION_STATES.sql` en la base de datos
2. **Configurar limpieza automática** ejecutando `CLEANUP_NEGOTIATIONS.sql` periódicamente
3. **Probar la funcionalidad** en desarrollo
4. **Desplegar a producción** gradualmente
5. **Monitorear métricas** de uso y satisfacción
6. **Recopilar feedback** de usuarios para mejoras futuras

### **Configuración de Limpieza Automática:**

#### **Opción 1: Manual**
```sql
-- Ejecutar cada 15 minutos manualmente
SELECT cleanup_expired_negotiations();
```

#### **Opción 2: Con pg_cron (recomendado)**
```sql
-- Crear job automático
SELECT cron.schedule(
    'cleanup-expired-negotiations',
    '*/15 * * * *',
    'SELECT cleanup_expired_negotiations();'
);
```

#### **Opción 3: Script externo**
Crear un script que ejecute la función cada 15 minutos usando cron del sistema operativo.

La metodología está diseñada para ser robusta, escalable y fácil de mantener, proporcionando una base sólida para el crecimiento futuro del sistema de negociaciones en NMHN.
