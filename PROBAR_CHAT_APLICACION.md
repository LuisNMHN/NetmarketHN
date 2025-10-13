# Prueba del Chat desde la Aplicación

## Pasos para Diagnosticar

### 1. Abrir Consola del Navegador
- Presionar F12 o Ctrl+Shift+I
- Ir a la pestaña "Console"
- Limpiar la consola (Ctrl+L)

### 2. Verificar Variables de Entorno
```javascript
// En la consola del navegador
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

### 3. Verificar Cliente de Supabase
```javascript
// Importar cliente de Supabase
import { supabaseBrowser } from './lib/supabase/client'
const supabase = supabaseBrowser()
console.log('Cliente Supabase:', supabase)
```

### 4. Verificar Usuario Autenticado
```javascript
// Verificar usuario actual
const { data: { user } } = await supabase.auth.getUser()
console.log('Usuario autenticado:', user)
```

### 5. Probar Consulta de Conversaciones
```javascript
// Probar consulta de conversaciones
const { data: conversations, error } = await supabase
  .from('chat_conversations')
  .select('*')
  .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
  .order('updated_at', { ascending: false })

console.log('Conversaciones:', conversations)
console.log('Error:', error)
```

### 6. Probar Consulta de Mensajes
```javascript
// Probar consulta de mensajes
const conversationId = 'd7227b30-4b56-4716-9bd4-5e7bbcdab503'
const { data: messages, error } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .eq('is_deleted', false)
  .order('created_at', { ascending: false })

console.log('Mensajes:', messages)
console.log('Error:', error)
```

### 7. Probar Envío de Mensaje
```javascript
// Probar envío de mensaje
const messageData = {
  conversation_id: conversationId,
  sender_id: user.id,
  content: 'Mensaje de prueba desde consola',
  message_type: 'text',
  metadata: {}
}

const { data, error } = await supabase
  .from('chat_messages')
  .insert(messageData)
  .select('*')
  .single()

console.log('Mensaje enviado:', data)
console.log('Error:', error)
```

### 8. Verificar Suscripciones de Tiempo Real
```javascript
// Probar suscripción de mensajes
const messagesSubscription = supabase
  .channel('chat_messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages'
  }, (payload) => {
    console.log('Nuevo mensaje recibido:', payload)
  })
  .subscribe()

console.log('Suscripción de mensajes:', messagesSubscription)
```

### 9. Verificar Notificaciones
```javascript
// Probar consulta de notificaciones
const { data: notifications, error } = await supabase
  .from('chat_notifications')
  .select('*')
  .eq('user_id', user.id)
  .eq('is_read', false)
  .order('created_at', { ascending: false })

console.log('Notificaciones:', notifications)
console.log('Error:', error)
```

## Logs Esperados

### 1. Al Enviar Mensaje
```
📤 ChatWindow handleSendMessage: Iniciando envío: {...}
📤 useChat sendMessage: Iniciando envío: {...}
📤 sendChatMessage: Iniciando envío: {...}
📤 sendChatMessage: Verificación de conversación: {...}
📤 sendChatMessage: Datos del mensaje: {...}
📤 sendChatMessage: Resultado de inserción: {...}
✅ sendChatMessage: Mensaje enviado exitosamente: {...}
✅ useChat sendMessage: Mensaje enviado exitosamente
✅ ChatWindow handleSendMessage: Mensaje enviado exitosamente
```

### 2. Al Recibir Mensaje
```
📨 Nuevo mensaje recibido: {...}
📚 Conversaciones cargadas desde DB con conteo preciso: {...}
```

### 3. Errores Comunes
```
❌ sendChatMessage: Sin acceso a conversación
❌ sendChatMessage: Error insertando mensaje: {...}
❌ useChat sendMessage: Error en el resultado del envío: {...}
❌ ChatWindow handleSendMessage: Error enviando mensaje
```

## Problemas y Soluciones

### 1. Variables de Entorno No Configuradas
**Síntoma:** `NEXT_PUBLIC_SUPABASE_URL` es `undefined`
**Solución:** Configurar `.env.local` y reiniciar servidor

### 2. Usuario No Autenticado
**Síntoma:** `user` es `null`
**Solución:** Iniciar sesión en la aplicación

### 3. Error de Permisos RLS
**Síntoma:** Error 42501 o similar
**Solución:** Verificar políticas RLS en Supabase

### 4. Error de Conexión
**Síntoma:** Error de red o timeout
**Solución:** Verificar URL de Supabase y conectividad

### 5. Tiempo Real No Funciona
**Síntoma:** No se reciben mensajes en tiempo real
**Solución:** Verificar publicación de realtime y suscripciones

## Comandos de Diagnóstico

### 1. Verificar Estado del Chat
```javascript
// Verificar estado completo del chat
const chatState = {
  user: user,
  conversations: conversations,
  messages: messages,
  notifications: notifications,
  supabaseClient: supabase
}
console.log('Estado del chat:', chatState)
```

### 2. Probar Funciones del Chat
```javascript
// Probar función de envío
const testSendMessage = async () => {
  try {
    const result = await sendChatMessage(
      'd7227b30-4b56-4716-9bd4-5e7bbcdab503',
      user.id,
      'Mensaje de prueba',
      'text'
    )
    console.log('Resultado del envío:', result)
  } catch (error) {
    console.error('Error en envío:', error)
  }
}

testSendMessage()
```

### 3. Verificar Configuración de Realtime
```javascript
// Verificar configuración de realtime
const checkRealtime = async () => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .limit(1)
  
  console.log('Consulta de prueba:', data, error)
}

checkRealtime()
```

