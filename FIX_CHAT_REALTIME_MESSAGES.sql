-- =========================================================
-- NMHN - CORREGIR RECEPCIÓN DE MENSAJES EN TIEMPO REAL
-- =========================================================
-- Este script documenta la solución para que los mensajes
-- lleguen en tiempo real al destinatario
-- =========================================================

/*
PROBLEMA IDENTIFICADO:

Los mensajes NO llegaban al destinatario porque:

1. El chat NO tenía suscripción realtime configurada
2. Los mensajes se enviaban correctamente a la BD
3. PERO el destinatario no recibía notificaciones en tiempo real
4. Solo podía ver los mensajes al recargar la página

FLUJO ANTIGUO (INCORRECTO):
- Usuario A envía mensaje → se guarda en BD ✅
- Usuario B NO recibe notificación ❌
- Usuario B solo ve mensaje si recarga la página
- No hay actualización en tiempo real

FLUJO NUEVO (CORREGIDO):
- Usuario A envía mensaje → se guarda en BD ✅
- Supabase Realtime detecta el INSERT en chat_messages ✅
- Usuario B recibe evento en tiempo real ✅
- Mensaje aparece automáticamente en la interfaz ✅

CAMBIOS APLICADOS EN components/PurchaseCompletionPanel.tsx:

1. ESTADO:
   - Agregado: chatThreadId para rastrear el ID del thread
   - Agregado: chatRealtimeChannelRef para la suscripción realtime

2. setupRealtimeSubscription():
   - NUEVA FUNCIÓN que configura la suscripción realtime
   - Escucha eventos INSERT en chat_messages para el thread específico
   - Agrega nuevos mensajes al estado cuando llegan
   - Evita duplicados verificando si el mensaje ya existe

3. loadChatMessages():
   - Ahora llama a setupRealtimeSubscription cuando encuentra un thread
   - Establece chatThreadId en el estado

4. sendChatMessage():
   - Cuando crea un nuevo thread, ahora configura la suscripción realtime
   - NO agrega el mensaje localmente (viene por realtime)
   - Esto evita duplicados

5. useEffect de limpieza:
   - Desuscribe la conexión realtime al desmontar el componente

VERIFICACIÓN DEL FLUJO:

1. Usuario A (vendedor):
   - Hace clic en "Negociar" 
   - Hace clic en "Aceptar Trato" (habilita chat)
   - Envía mensaje "Hola"
   - Mensaje se guarda en BD con thread_id = X

2. Usuario B (comprador):
   - Hace clic en "Completar Compra"
   - El panel se abre y carga mensajes existentes
   - setupRealtimeSubscription(threadId=X) se configura
   - Recibe evento realtime del mensaje de A
   - Mensaje aparece automáticamente en su pantalla

3. Usuario B responde:
   - Envía mensaje "Hola, gracias"
   - Mensaje se guarda en BD
   - Usuario A recibe evento realtime
   - Mensaje aparece en pantalla de A

REQUISITOS DE LA BD:

Las tablas deben tener realtime habilitado:

```sql
-- Verificar que está habilitado
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;
```

Políticas RLS deben permitir ver mensajes del thread:

```sql
CREATE POLICY "Users can view messages in their threads" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_threads t
            WHERE t.id = thread_id
            AND (t.party_a = auth.uid() OR t.party_b = auth.uid())
        )
    );
```

VENTAJAS DE LA SOLUCIÓN:

✅ Mensajes llegan en tiempo real sin recargar
✅ No hay duplicados (verifica si ya existe)
✅ Se limpieza automática de suscripciones
✅ Funciona para múltiples usuarios simultáneamente
✅ Compatible con Supabase Realtime

NOTAS ADICIONALES:

- La suscripción se configura automáticamente cuando se habilita el chat
- Se limpia automáticamente al cerrar el panel
- Funciona tanto para el comprador como para el vendedor
- Los mensajes se guardan en la BD y vienen por realtime
*/




