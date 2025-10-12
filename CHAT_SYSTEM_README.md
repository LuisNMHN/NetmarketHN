# Sistema de Chat 1:1 NMHN

## Descripción General

Sistema de chat en tiempo real 1:1 restringido exclusivamente a usuarios con rol 'user'. Los administradores están completamente excluidos del sistema de chat.

## Características Principales

### ✅ Restricción de Acceso
- **Solo usuarios con rol 'user'** pueden usar el chat
- **Administradores completamente excluidos** (no ven botón, panel, ni reciben notificaciones)
- **Verificación de rol en UI y backend/RLS**

### ✅ Funcionalidades de Chat
- **Chat 1:1** basado en `solicitud_id` de `purchase_requests`
- **Tiempo real** con Supabase Realtime
- **Notificaciones in-app** con toasts
- **Contadores de no leídos** por conversación y global
- **Estado de escritura** ("escribiendo...")
- **Adjuntos** (imágenes/PDF) con URLs firmadas
- **Eliminación de mensajes propios**
- **Limpieza de historial** por usuario
- **Reconexión automática**

## Estructura de Base de Datos

### Tablas Principales

#### `chat_conversations`
- `id` (UUID, PK)
- `solicitud_id` (UUID, FK a purchase_requests)
- `created_at`, `updated_at`

#### `chat_conversation_participants`
- `conversation_id` (UUID, FK)
- `user_id` (UUID, FK a auth.users)
- `last_read_at` (TIMESTAMP)
- `cleared_at` (TIMESTAMP, opcional)
- `created_at`

#### `chat_messages`
- `id` (UUID, PK)
- `conversation_id` (UUID, FK)
- `sender_id` (UUID, FK a auth.users)
- `body` (TEXT)
- `attachment_url` (TEXT, opcional)
- `attachment_type` (VARCHAR, opcional)
- `attachment_size` (INTEGER, opcional)
- `client_message_id` (UUID, para idempotencia)
- `is_author_deleted` (BOOLEAN)
- `created_at`, `updated_at`

#### `chat_typing_status`
- `conversation_id` (UUID, FK)
- `user_id` (UUID, FK a auth.users)
- `is_typing` (BOOLEAN)
- `updated_at`

### Storage
- **Bucket**: `chat_attachments` (privado)
- **URLs firmadas** con expiración de 1 hora
- **Tipos permitidos**: imágenes (JPEG, PNG, GIF, WebP) y PDF
- **Límite de tamaño**: 10MB

## Funciones RPC

### `create_or_get_chat_conversation(solicitud_id, target_user_id)`
- Crea o obtiene conversación existente
- Verifica que ambos usuarios tengan rol 'user'
- Retorna `conversation_id`

### `mark_chat_messages_read(conversation_id)`
- Marca mensajes como leídos para el usuario actual
- Actualiza `last_read_at`

### `clear_chat_history(conversation_id)`
- Limpia historial para el usuario actual
- Actualiza `cleared_at`

### `delete_own_chat_message(message_id)`
- Elimina mensaje propio
- Marca `is_author_deleted = true`

### `is_user_role(user_id)`
- Verifica si un usuario tiene rol 'user'
- Usado en políticas RLS

### `is_admin_role(user_id)`
- Verifica si un usuario tiene rol 'admin'
- Usado en políticas RLS

## Políticas RLS

### Restricciones de Rol
- **Todas las operaciones** requieren rol 'user'
- **Administradores bloqueados** en todas las políticas
- **Verificación de rol** en cada operación

### Acceso por Participante
- **Solo participantes** pueden ver conversaciones/mensajes
- **Solo el autor** puede eliminar sus mensajes
- **Solo el dueño** puede limpiar su historial

## Componentes UI

### `ChatLauncher`
- Botón flotante con contador global
- Solo visible para usuarios con rol 'user'
- Posición fija en esquina inferior derecha

### `ChatWindow`
- Panel deslizante con dos vistas:
  - **Lista de conversaciones**: avatar, nombre, último mensaje, contador no leídos
  - **Ventana de chat**: mensajes, input, adjuntos, estado de escritura

### `StartChatButton`
- Botón "Negociar" en solicitudes
- Inicia chat con usuario objetivo
- Solo visible para usuarios con rol 'user'

### `ChatNotifications`
- Notificaciones in-app con toasts
- Solo para usuarios con rol 'user'
- Notifica mensajes nuevos y estado de escritura

## Hook Principal

### `useChat()`
- **Estado**: conversaciones, mensajes, usuarios escribiendo
- **Acciones**: crear conversación, enviar mensaje, marcar leído, limpiar historial
- **Suscripciones**: tiempo real para mensajes y estado de escritura
- **Verificación de rol**: bloquea funcionalidad para administradores

## Integración con Solicitudes

### Botón "Negociar"
- Ubicado en páginas de solicitudes
- Requiere `solicitud_id` y `target_user_id`
- Solo visible para usuarios con rol 'user'

### Flujo de Negociación
1. Usuario hace clic en "Negociar"
2. Se crea/obtiene conversación
3. Se abre panel de chat
4. Usuarios negocian en tiempo real

## Seguridad

### Verificación de Rol
- **UI**: Componentes no se renderizan para administradores
- **Backend**: Políticas RLS bloquean acceso
- **RPC**: Funciones verifican rol antes de ejecutar

### URLs Firmadas
- **Adjuntos**: URLs firmadas con expiración de 1 hora
- **Acceso**: Solo participantes de la conversación
- **Validación**: Tipo y tamaño de archivo

### Idempotencia
- **client_message_id**: Evita duplicados
- **Reconexión**: Sincroniza gaps sin duplicar
- **Optimistic UI**: Actualiza inmediatamente, reconcilia después

## Eventos Realtime

### Suscripciones Activas
- **Mensajes**: `chat_messages` (INSERT, UPDATE)
- **Escritura**: `chat_typing_status` (INSERT, UPDATE)
- **Participantes**: `chat_conversation_participants` (UPDATE)

### Reconexión
- **Automática**: Re-suscribe al reconectar
- **Sincronización**: Obtiene mensajes perdidos
- **Estado**: Mantiene estado de UI

## Rendimiento

### Índices
- `chat_conversations(solicitud_id)`
- `chat_messages(conversation_id, created_at DESC)`
- `chat_conversation_participants(user_id)`

### Paginación
- **Mensajes**: Carga incremental
- **Conversaciones**: Lista completa con límite

### Optimizaciones
- **Lazy loading**: Carga mensajes al abrir conversación
- **Debounce**: Estado de escritura con timeout
- **Memoización**: Hooks optimizados

## Accesibilidad

### Estándares
- **WCAG AA**: Cumple estándares de accesibilidad
- **Teclado**: Navegación completa con teclado
- **Screen readers**: Etiquetas ARIA apropiadas

### Características
- **Focus management**: Manejo de foco en modales
- **Keyboard shortcuts**: Enter para enviar, Shift+Enter para nueva línea
- **High contrast**: Soporte para temas de alto contraste

## Monitoreo y Logs

### Eventos Rastreados
- **Creación de conversaciones**
- **Envío de mensajes**
- **Errores de RLS**
- **Intentos de acceso no autorizados**

### Métricas
- **Mensajes por conversación**
- **Tiempo de respuesta**
- **Errores de conexión**
- **Uso de adjuntos**

## Despliegue

### Requisitos
- **Supabase**: Proyecto con RLS habilitado
- **Next.js**: Aplicación con middleware
- **Variables de entorno**: Supabase URL y keys

### Pasos
1. Ejecutar `CREATE_CHAT_SYSTEM_NMHN.sql`
2. Ejecutar `CREATE_CHAT_STORAGE_BUCKET.sql`
3. Desplegar componentes y hooks
4. Configurar notificaciones
5. Probar restricciones de rol

## Troubleshooting

### Problemas Comunes
- **RLS bloqueando acceso**: Verificar rol de usuario
- **Notificaciones no funcionan**: Verificar suscripciones Realtime
- **Adjuntos no se suben**: Verificar permisos de storage
- **Chat no aparece**: Verificar rol de usuario

### Logs Útiles
- **Consola del navegador**: Errores de JavaScript
- **Supabase Dashboard**: Logs de RLS y RPC
- **Network tab**: Requests fallidos

## Futuras Mejoras

### Funcionalidades
- **Búsqueda de mensajes**
- **Reacciones a mensajes**
- **Mensajes de voz**
- **Chat grupal** (opcional)

### Optimizaciones
- **Compresión de imágenes**
- **Cache de mensajes**
- **Offline support**
- **Push notifications**

---

**Nota**: Este sistema está diseñado específicamente para NMHN y respeta la arquitectura y convenciones existentes del proyecto.
