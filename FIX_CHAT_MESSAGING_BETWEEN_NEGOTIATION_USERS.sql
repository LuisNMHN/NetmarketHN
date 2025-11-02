-- =========================================================
-- NMHN - CORREGIR ENVÍO DE MENSAJES EN CHAT DE NEGOCIACIÓN
-- =========================================================
-- Este script documenta el problema y la solución aplicada
-- =========================================================

/*
PROBLEMA IDENTIFICADO:

Los usuarios no podían enviar mensajes en el chat durante las negociaciones porque:

1. El sistema de chat estaba usando `transaction.id` como `context_id`
2. Pero el `transaction.id` puede no existir aún o no ser el contexto correcto
3. El chat debe usar el `requestId` (ID de la solicitud) como `context_id`
4. Esto causa que el thread no se cree correctamente o que los mensajes no se envíen

FLUJO ANTIGUO (INCORRECTO):
- Vendedor abre panel → crea transacción
- Chat busca thread con context_id = transaction.id ❌
- Como no existe thread, intenta crear uno nuevo
- El thread se crea correctamente PERO:
  - Los mensajes usan context_id = transaction.id
  - Cuando el comprador abre el panel, busca context_id = transaction.id
  - Pero el comprador tiene otro transaction.id diferente
  - Resultado: No se encuentran los mensajes

FLUJO NUEVO (CORREGIDO):
- Vendedor abre panel → crea transacción
- Chat busca/crea thread con context_id = requestId ✅
- El requestId es el MISMO para comprador y vendedor
- Resultado: Ambos usuarios ven el mismo thread y pueden comunicarse

CAMBIOS APLICADOS EN components/PurchaseCompletionPanel.tsx:

1. loadChatMessages():
   - CAMBIÓ: .eq('context_id', transaction.id)
   - POR: .eq('context_id', requestId)

2. sendChatMessage():
   - CAMBIÓ: context_id: transaction.id
   - POR: context_id: requestId
   - También actualizó buyer_id y seller_id para usar props correctamente

3. useEffect de carga:
   - CAMBIÓ: if (isOpen && transaction?.id && chatEnabled)
   - POR: if (isOpen && chatEnabled && requestId)

VENTAJAS DE LA SOLUCIÓN:

✅ requestId es estable y único para cada solicitud
✅ Tanto comprador como vendedor usan el mismo requestId
✅ El thread se crea una sola vez y se reutiliza
✅ Los mensajes se ven correctamente para ambos usuarios
✅ No depende de que la transacción exista antes del chat

VERIFICACIÓN:

Para verificar que funciona:

1. Como comprador, crear una solicitud
2. Como vendedor, hacer clic en "Negociar"
3. Vendedor: hacer clic en "Aceptar Trato" (habilita el chat)
4. Vendedor: enviar un mensaje en el chat
5. Como comprador, ir a "Mis Solicitudes"
6. Hacer clic en "Completar Compra"
7. El comprador debe ver el mensaje del vendedor
8. El comprador debe poder responder

NOTAS ADICIONALES:

- El chat se habilita automáticamente cuando el vendedor acepta el trato
- El chat usa el requestId como identificador único
- El thread se crea automáticamente al enviar el primer mensaje
- Las políticas RLS permiten que party_a y party_b envíen mensajes
*/




