# Corrección: Panel No Abre en Solicitudes Reactivadas

## Problema Identificado

Cuando una solicitud se reactiva (después de que el tiempo del panel se agota):
1. ✅ La solicitud vuelve a estado "active"
2. ✅ El vendedor puede negociar y aceptar nuevamente
3. ✅ Al comprador le aparece el botón "Completar Compra"
4. ❌ Al hacer clic, el panel NO se abre
5. ❌ Solo ocurre en la segunda vez (después de reactivación)

## Causa Raíz

El estado `initialized` se mantiene en `true` después de cerrar el panel la primera vez. Cuando se abre por segunda vez:

- El useEffect verifica: `if (isOpen && requestData && !initialized)`
- Como `initialized` es `true`, el código dentro NO se ejecuta
- Por lo tanto, `loadExistingTransaction()` nunca se llama
- Resultado: El panel se abre pero no carga la transacción

## Solución Aplicada

### Cambio en el useEffect (línea 387-413):

```typescript
// ANTES:
useEffect(() => {
  if (isOpen && requestData && !initialized) {
    loadExistingTransaction()
    setInitialized(true)
  }
  
  // NO resetear cuando el panel se cierra
  // Esto causaba el bug
}, [isOpen, requestData, initialized])

// DESPUÉS:
useEffect(() => {
  if (isOpen && requestData && !initialized) {
    console.log('🔄 Cargando transacción (primera vez o después de cerrar)')
    loadExistingTransaction()
    setInitialized(true)
  }
  
  // ✅ AHORA: Resetear estado cuando el panel se cierra
  if (!isOpen) {
    console.log('🔄 Panel cerrado, reseteando estado initialized')
    setInitialized(false)
    setTransaction(null)
    setRequestData(null)
    
    // Limpiar estado del chat
    setChatMessages([])
    setChatEnabled(false)
    setChatThreadId(null)
    
    // Limpiar suscripción realtime
    if (chatRealtimeChannelRef.current) {
      chatRealtimeChannelRef.current.unsubscribe()
      chatRealtimeChannelRef.current = null
    }
  }
}, [isOpen, requestData, initialized])
```

## Qué Hace Ahora el Código

### Cuando el Panel se Cierra:
1. ✅ Resetea `initialized` a `false`
2. ✅ Limpia la transacción (`setTransaction(null)`)
3. ✅ Limpia los datos de la solicitud (`setRequestData(null)`)
4. ✅ Limpia el estado del chat
5. ✅ Desuscribe de realtime
6. ✅ Todo queda listo para la próxima apertura

### Cuando el Panel se Abre (Primera o Segunda Vez):
1. ✅ Como `initialized` es `false`, ejecuta `loadExistingTransaction()`
2. ✅ Carga la transacción correctamente
3. ✅ El panel funciona normal

## Flujo Completo Corregido

### Primera Vez:
1. Vendedor acepta trato → Se crea transacción
2. Comprador hace clic en "Completar Compra"
3. Panel se abre → `initialized = false` → Carga transacción ✅
4. Comprador cierra panel → Se limpia TODO el estado ✅

### Segunda Vez (Después de Reactivación):
1. Tiempo se agota → Solicitud reactivada
2. Vendedor acepta trato nuevamente → Se crea NUEVA transacción
3. Comprador hace clic en "Completar Compra"
4. Panel se abre → `initialized = false` (reseteado) → Carga NUEVA transacción ✅
5. Funciona correctamente ✅

## Archivos Modificados

- `components/PurchaseCompletionPanel.tsx` - Reseteo de estados al cerrar

## Verificación

Para probar:

1. Iniciar una transacción
2. Esperar a que expire (o simular cierre de panel)
3. Reactivar la solicitud
4. Aceptar trato nuevamente como vendedor
5. Como comprador, hacer clic en "Completar Compra"
6. ✅ Panel debe abrirse correctamente




