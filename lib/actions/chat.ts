"use server"

import { supabaseServer } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"


// =========================================================
// TIPOS DE DATOS PARA EL CHAT
// =========================================================

export interface ChatConversation {
  id: string
  participant_1_id: string
  participant_2_id: string
  purchase_request_id?: string
  status: 'active' | 'archived' | 'blocked'
  participant_1_notifications: boolean
  participant_2_notifications: boolean
  created_at: string
  updated_at: string
  last_message_at: string
  other_participant_id?: string
  other_participant_name?: string
  other_participant_avatar?: string
  last_message_content?: string
  unread_count?: number
  purchase_request_amount?: number
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  message_type: 'text' | 'image' | 'document' | 'system'
  content?: string
  metadata?: Record<string, any>
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
  read_by_participant_1: boolean
  read_by_participant_2: boolean
  read_at_participant_1?: string
  read_at_participant_2?: string
  created_at: string
  updated_at: string
  sender_name?: string
  sender_avatar?: string
  attachments?: ChatAttachment[]
}

export interface ChatAttachment {
  id: string
  message_id: string
  file_name: string
  file_size: number
  file_type: string
  mime_type: string
  storage_path: string
  public_url?: string
  created_at: string
}

export interface ChatTypingStatus {
  id: string
  conversation_id: string
  user_id: string
  is_typing: boolean
  last_typing_at: string
  created_at: string
  updated_at: string
  user_name?: string
  user_avatar?: string
}

export interface ChatNotification {
  id: string
  user_id: string
  conversation_id: string
  message_id?: string
  notification_type: 'message' | 'typing' | 'read'
  title?: string
  body?: string
  is_read: boolean
  read_at?: string
  created_at: string
}

// =========================================================
// RESULTADOS DE ACCIONES
// =========================================================

export interface ChatActionResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

// =========================================================
// FUNCIONES DE CONVERSACIONES
// =========================================================

export async function createChatConversation(
  participant1Id: string,
  participant2Id: string,
  purchaseRequestId?: string
): Promise<ChatActionResult<ChatConversation>> {
  try {

    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: "Configuración de Supabase incompleta. Contacta al administrador."
      }
    }

    const supabase = await supabaseServer()
    
    // Verificar que ambos usuarios existen y son diferentes
    if (participant1Id === participant2Id) {
      return {
        success: false,
        error: "Los participantes deben ser diferentes"
      }
    }

    // Verificar que los usuarios existen en profiles
    const { data: participant1, error: error1 } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', participant1Id)
      .maybeSingle()

    const { data: participant2, error: error2 } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', participant2Id)
      .maybeSingle()


    if (error1 || error2) {
      return {
        success: false,
        error: `Error consultando usuarios. Error1: ${error1?.message}, Error2: ${error2?.message}`
      }
    }

    if (!participant1 || !participant2) {
      return {
        success: false,
        error: `Uno o ambos usuarios no existen. Usuario1: ${participant1 ? 'existe' : 'no existe'}, Usuario2: ${participant2 ? 'existe' : 'no existe'}`
      }
    }

    // Crear conversación usando la función SQL
    const { data, error } = await supabase.rpc('create_chat_conversation', {
      p_participant_1_id: participant1Id,
      p_participant_2_id: participant2Id,
      p_purchase_request_id: purchaseRequestId
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    // Obtener la conversación creada
    const { data: conversation, error: fetchError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', data)
      .maybeSingle()

    if (fetchError) {
      return {
        success: false,
        error: fetchError.message
      }
    }

    return {
      success: true,
      data: conversation
    }
  } catch (error) {
    return {
      success: false,
      error: "Error inesperado al crear conversación"
    }
  }
}

export async function getUserConversations(
  userId: string
): Promise<ChatActionResult<ChatConversation[]>> {
  try {
    const supabase = await supabaseServer()
    
    // Usar la función SQL mejorada con conteo preciso de no leídos
    const { data, error } = await supabase.rpc('get_user_conversations_with_unread_count', {
      p_user_id: userId
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    // Mapear conv_id a id para mantener compatibilidad
    const mappedData = (data || []).map((conv: any) => ({
      ...conv,
      id: conv.conv_id
    }))

    return {
      success: true,
      data: mappedData
    }
  } catch (error) {
    return {
      success: false,
      error: "Error inesperado al obtener conversaciones"
    }
  }
}

export async function getConversationById(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<ChatConversation>> {
  try {
    const supabase = await supabaseServer()
    
    const { data, error } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        profiles!chat_conversations_participant_1_id_fkey(full_name, avatar_url),
        profiles!chat_conversations_participant_2_id_fkey(full_name, avatar_url),
        user_profiles!chat_conversations_participant_1_id_fkey(display_name, avatar_url),
        user_profiles!chat_conversations_participant_2_id_fkey(display_name, avatar_url)
      `)
      .eq('id', conversationId)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .maybeSingle()

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data
    }
  } catch (error) {
    return {
      success: false,
      error: "Error inesperado al obtener conversación"
    }
  }
}

// =========================================================
// FUNCIONES DE MENSAJES
// =========================================================

export async function sendChatMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'image' | 'document' | 'system' = 'text',
  metadata?: Record<string, any>
): Promise<ChatActionResult<ChatMessage>> {
  try {

    const supabase = await supabaseServer()
    console.log('📤 sendChatMessage: Cliente Supabase obtenido:', {
      hasSupabase: !!supabase,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    })
    
    // Verificar que el usuario es participante de la conversación
    console.log('📤 sendChatMessage: Verificando acceso a conversación...')
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`participant_1_id.eq.${senderId},participant_2_id.eq.${senderId}`)
      .maybeSingle()

    console.log('📤 sendChatMessage: Verificación de conversación:', {
      conversation,
      convError,
      hasAccess: !!(conversation && !convError),
      conversationId,
      senderId
    })

    if (convError || !conversation) {
      console.log('❌ sendChatMessage: Sin acceso a conversación:', {
        convError,
        conversation,
        conversationId,
        senderId
      })
      return {
        success: false,
        error: "No tienes acceso a esta conversación"
      }
    }

    // Crear el mensaje
    const messageData = {
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
      metadata: metadata || {}
    }

    console.log('📤 sendChatMessage: Datos del mensaje a insertar:', {
      messageData: {
        ...messageData,
        content: messageData.content.substring(0, 50) + '...'
      },
      fullContent: content
    })

    console.log('📤 sendChatMessage: Insertando mensaje en DB...')
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('*')
      .maybeSingle()

    console.log('📤 sendChatMessage: Resultado de inserción:', {
      success: !error,
      error,
      dataId: data?.id,
      dataCreatedAt: data?.created_at,
      dataContent: data?.content,
      dataSenderId: data?.sender_id,
      dataConversationId: data?.conversation_id
    })

    if (error) {
      console.log('❌ sendChatMessage: Error insertando mensaje:', error)
      console.log('🚀 ===== FIN SERVER ACTION sendChatMessage CON ERROR =====')
      return {
        success: false,
        error: error.message
      }
    }

    if (!data) {
      console.log('❌ sendChatMessage: No se obtuvo data después de inserción')
      console.log('🚀 ===== FIN SERVER ACTION sendChatMessage SIN DATA =====')
      return {
        success: false,
        error: "No se pudo crear el mensaje"
      }
    }

    // Crear notificación para el otro participante
    console.log('📤 sendChatMessage: Creando notificación...')
    try {
      await createChatNotification(
        conversationId,
        senderId,
        'message',
        'Nuevo mensaje',
        content?.substring(0, 100) || 'Mensaje recibido'
      )
      console.log('✅ sendChatMessage: Notificación creada exitosamente')
    } catch (notifError) {
      console.log('⚠️ sendChatMessage: Error creando notificación:', notifError)
      // No fallar el envío por error de notificación
    }

    revalidatePath('/dashboard')
    
    console.log('✅ sendChatMessage: Mensaje enviado exitosamente:', {
      messageId: data?.id,
      conversationId,
      senderId,
      timestamp: data?.created_at,
      content: data?.content,
      messageType: data?.message_type
    })
    
    console.log('🚀 ===== FIN SERVER ACTION sendChatMessage EXITOSO =====')
    
    return {
      success: true,
      data
    }
  } catch (error) {
    console.log('❌ sendChatMessage: Error inesperado:', error)
    return {
      success: false,
      error: "Error inesperado al enviar mensaje"
    }
  }
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit?: number,
  offset?: number
): Promise<ChatActionResult<ChatMessage[]>> {
  try {
    
    const supabase = await supabaseServer()
    console.log('📚 getConversationMessages: Cliente Supabase obtenido:', {
      hasSupabase: !!supabase
    })
    
    // Verificar acceso a la conversación
    console.log('📚 getConversationMessages: Verificando acceso a conversación...')
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .maybeSingle()

    console.log('📚 getConversationMessages: Verificación de acceso:', {
      conversation,
      convError,
      hasAccess: !!(conversation && !convError),
      conversationId,
      userId
    })

    if (convError || !conversation) {
      console.log('❌ getConversationMessages: Sin acceso a conversación')
      return {
        success: false,
        error: "No tienes acceso a esta conversación"
      }
    }

    // Obtener TODOS los mensajes (sin límites)
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true }) // Orden cronológico: más antiguos primero

    // Solo aplicar límites si se especifican
    if (limit && offset !== undefined) {
      query = query.range(offset, offset + limit - 1)
      console.log('📚 getConversationMessages: Aplicando límites:', { limit, offset })
    } else {
      console.log('📚 getConversationMessages: SIN LÍMITES - cargando todos los mensajes')
    }

    const { data, error } = await query

    console.log('📚 getConversationMessages: Consulta de mensajes:', {
      dataLength: data?.length || 0,
      error,
      firstMessage: data?.[0]?.id,
      lastMessage: data?.[data?.length - 1]?.id,
      primerMensaje: data?.[data?.length - 1]?.created_at,
      ultimoMensaje: data?.[0]?.created_at
    })

    if (error) {
      console.error('❌ getConversationMessages: Error obteniendo mensajes:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('✅ getConversationMessages: TODOS los mensajes obtenidos exitosamente:', {
      totalMensajes: data?.length || 0,
      mensajesIds: data?.map(m => m.id),
      mensajesContent: data?.map(m => m.content),
      primerMensaje: data?.[data.length - 1]?.created_at,
      ultimoMensaje: data?.[0]?.created_at
    })
    
    console.log('🔄 ===== FIN SERVER ACTION getConversationMessages EXITOSO =====')
    
    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('❌ getConversationMessages: Error inesperado obteniendo mensajes:', error)
    return {
      success: false,
      error: "Error inesperado al obtener mensajes"
    }
  }
}

// Función para obtener TODOS los mensajes de una conversación (sin límite)
export async function getAllConversationMessages(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<ChatMessage[]>> {
  try {
    console.log('📚 getAllConversationMessages: Iniciando consulta completa:', {
      conversationId,
      userId
    })
    
    const supabase = await supabaseServer()
    
    // Verificar acceso a la conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .maybeSingle()

    if (convError || !conversation) {
      console.log('❌ getAllConversationMessages: Sin acceso a conversación')
      return {
        success: false,
        error: "No tienes acceso a esta conversación"
      }
    }

    // Obtener TODOS los mensajes (sin límite)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true }) // Orden cronológico: más antiguos primero

    console.log('📚 getAllConversationMessages: Consulta completa:', {
      dataLength: data?.length || 0,
      error,
      primerMensaje: data?.[data?.length - 1]?.created_at,
      ultimoMensaje: data?.[0]?.created_at
    })

    if (error) {
      console.error('❌ getAllConversationMessages: Error obteniendo mensajes:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('✅ getAllConversationMessages: Todos los mensajes obtenidos:', data?.length || 0)
    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('❌ getAllConversationMessages: Error inesperado obteniendo mensajes:', error)
    return {
      success: false,
      error: "Error inesperado al obtener mensajes"
    }
  }
}

export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    // Usar la función SQL mejorada para marcar mensajes como leídos
    const { error } = await supabase.rpc('mark_messages_as_read_by_user', {
      p_conversation_id: conversationId,
      p_user_id: userId
    })
    
    if (error) {
      console.error('Error marcando mensajes como leídos:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('✅ Mensajes marcados como leídos para usuario:', userId, 'en conversación:', conversationId)
    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado marcando mensajes como leídos:', error)
    return {
      success: false,
      error: "Error inesperado al marcar mensajes como leídos"
    }
  }
}

export async function deleteChatMessage(
  messageId: string,
  userId: string
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar que el mensaje pertenece al usuario
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .eq('sender_id', userId)
      .maybeSingle()

    if (msgError || !message) {
      return {
        success: false,
        error: "No puedes eliminar este mensaje"
      }
    }

    // Marcar como eliminado
    const { error } = await supabase
      .from('chat_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', messageId)

    if (error) {
      console.error('Error eliminando mensaje:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado eliminando mensaje:', error)
    return {
      success: false,
      error: "Error inesperado al eliminar mensaje"
    }
  }
}

// =========================================================
// FUNCIONES DE ADJUNTOS
// =========================================================

export async function uploadChatAttachment(
  messageId: string,
  file: File,
  userId: string
): Promise<ChatActionResult<ChatAttachment>> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar que el mensaje pertenece al usuario
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .eq('sender_id', userId)
      .maybeSingle()

    if (msgError || !message) {
      return {
        success: false,
        error: "No puedes adjuntar archivos a este mensaje"
      }
    }

    // Generar nombre único para el archivo
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    // Subir archivo a storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Error subiendo archivo:', uploadError)
      return {
        success: false,
        error: uploadError.message
      }
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath)

    // Crear registro de adjunto
    const { data, error } = await supabase
      .from('chat_attachments')
      .insert({
        message_id: messageId,
        file_name: file.name,
        file_size: file.size,
        file_type: fileExt || 'unknown',
        mime_type: file.type,
        storage_path: filePath,
        public_url: urlData.publicUrl
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creando registro de adjunto:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('Error inesperado subiendo adjunto:', error)
    return {
      success: false,
      error: "Error inesperado al subir adjunto"
    }
  }
}

// =========================================================
// FUNCIONES DE ESTADO DE ESCRITURA
// =========================================================

export async function updateTypingStatus(
  conversationId: string,
  userId: string,
  isTyping: boolean
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar acceso a la conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .maybeSingle()

    if (convError || !conversation) {
      return {
        success: false,
        error: "No tienes acceso a esta conversación"
      }
    }

    // Actualizar o crear estado de escritura usando función SQL
    const { error } = await supabase.rpc('upsert_typing_status', {
      p_conversation_id: conversationId,
      p_user_id: userId,
      p_is_typing: isTyping
    })

    if (error) {
      console.error('Error actualizando estado de escritura:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado actualizando estado de escritura:', error)
    return {
      success: false,
      error: "Error inesperado al actualizar estado de escritura"
    }
  }
}

export async function getTypingStatus(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<ChatTypingStatus[]>> {
  try {
    const supabase = await supabaseServer()
    
    const { data, error } = await supabase
      .from('chat_typing_status')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('user_id', userId) // Excluir al usuario actual
      .eq('is_typing', true)

    if (error) {
      console.error('Error obteniendo estado de escritura:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Error inesperado obteniendo estado de escritura:', error)
    return {
      success: false,
      error: "Error inesperado al obtener estado de escritura"
    }
  }
}

// =========================================================
// FUNCIONES DE NOTIFICACIONES
// =========================================================

export async function createChatNotification(
  conversationId: string,
  senderId: string,
  type: 'message' | 'typing' | 'read',
  title?: string,
  content?: string
): Promise<ChatActionResult<ChatNotification>> {
  try {
    console.log('🔔 createChatNotification llamada con:', {
      conversationId,
      senderId,
      type,
      title,
      content: content?.substring(0, 50) + '...'
    })

    const supabase = await supabaseServer()
    
    // Obtener el otro participante de la conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('participant_1_id, participant_2_id')
      .eq('id', conversationId)
      .maybeSingle()

    console.log('🔍 Verificación de conversación para notificación:', { conversation, convError })

    if (convError || !conversation) {
      console.error('❌ Error de acceso a conversación para notificación:', convError)
      return {
        success: false,
        error: "Conversación no encontrada"
      }
    }

    const otherParticipantId = conversation.participant_1_id === senderId 
      ? conversation.participant_2_id 
      : conversation.participant_1_id

    console.log('👤 Otro participante identificado:', otherParticipantId)

    // Crear notificación usando 'content' en lugar de 'body'
    const notificationData = {
      user_id: otherParticipantId,
      conversation_id: conversationId,
      notification_type: type,
      title,
      content  // Usar 'content' en lugar de 'body'
    }

    console.log('📝 Insertando notificación:', notificationData)

    const { data, error } = await supabase
      .from('chat_notifications')
      .insert(notificationData)
      .select()
      .maybeSingle()

    console.log('📝 Resultado de inserción de notificación:', { data, error })

    if (error) {
      console.error('❌ Error creando notificación:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('✅ Notificación creada exitosamente:', data?.id)
    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('❌ Error inesperado creando notificación:', error)
    return {
      success: false,
      error: "Error inesperado al crear notificación"
    }
  }
}

export async function getUserNotifications(
  userId: string,
  limit?: number
): Promise<ChatActionResult<ChatNotification[]>> {
  try {
    const supabase = await supabaseServer()
    
    // Consulta directa sin usar función SQL problemática
    const { data, error } = await supabase
      .from('chat_notifications')
      .select(`
        id,
        user_id,
        conversation_id,
        message_id,
        notification_type,
        title,
        body,
        created_at,
        is_read
      `)
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo notificaciones:', error)
      return {
        success: false,
        error: error.message
      }
    }

    // Mapear los datos al formato esperado SIN LÍMITES
    const mappedData = (data || []).map((notif: any) => ({
      id: notif.id,
      user_id: userId,
      conversation_id: notif.conversation_id,
      message_id: notif.message_id,
      notification_type: notif.notification_type,
      title: notif.title,
      content: notif.body,
      is_read: notif.is_read,
      read_at: null,
      created_at: notif.created_at,
      updated_at: notif.created_at,
      // Información adicional del remitente
      sender_name: notif.sender_name,
      sender_avatar: notif.sender_avatar
    }))

    console.log('🔔 Notificaciones cargadas con detalles:', mappedData.length)
    return {
      success: true,
      data: mappedData
    }
  } catch (error) {
    console.error('Error inesperado obteniendo notificaciones:', error)
    return {
      success: false,
      error: "Error inesperado al obtener notificaciones"
    }
  }
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    const { error } = await supabase
      .from('chat_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error marcando notificación como leída:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado marcando notificación como leída:', error)
    return {
      success: false,
      error: "Error inesperado al marcar notificación como leída"
    }
  }
}

// =========================================================
// FUNCIONES DE ARCHIVADO Y LIMPIEZA
// =========================================================

export async function archiveConversation(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar acceso a la conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .maybeSingle()

    if (convError || !conversation) {
      return {
        success: false,
        error: "No tienes acceso a esta conversación"
      }
    }

    // Archivar conversación
    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'archived' })
      .eq('id', conversationId)

    if (error) {
      console.error('Error archivando conversación:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado archivando conversación:', error)
    return {
      success: false,
      error: "Error inesperado al archivar conversación"
    }
  }
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar acceso a la conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .maybeSingle()

    if (convError || !conversation) {
      return {
        success: false,
        error: "No tienes acceso a esta conversación"
      }
    }

    // Eliminar conversación (esto eliminará todos los mensajes relacionados por CASCADE)
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)

    if (error) {
      console.error('Error eliminando conversación:', error)
      return {
        success: false,
        error: error.message
      }
    }

    revalidatePath('/dashboard')
    
    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado eliminando conversación:', error)
    return {
      success: false,
      error: "Error inesperado al eliminar conversación"
    }
  }
}

// =========================================================
// FUNCIONES DE ELIMINACIÓN INDIVIDUAL DE CONVERSACIONES
// =========================================================

export async function deleteConversationForUser(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    const { error } = await supabase.rpc('delete_conversation_for_user', {
      p_conversation_id: conversationId,
      p_user_id: userId
    })

    if (error) {
      console.error('Error eliminando conversación para usuario:', error)
      return {
        success: false,
        error: error.message
      }
    }

    revalidatePath('/dashboard')
    
    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado eliminando conversación para usuario:', error)
    return {
      success: false,
      error: "Error inesperado al eliminar conversación"
    }
  }
}

export async function restoreConversationForUser(
  conversationId: string,
  userId: string
): Promise<ChatActionResult<boolean>> {
  try {
    const supabase = await supabaseServer()
    
    const { error } = await supabase.rpc('restore_conversation_for_user', {
      p_conversation_id: conversationId,
      p_user_id: userId
    })

    if (error) {
      console.error('Error restaurando conversación para usuario:', error)
      return {
        success: false,
        error: error.message
      }
    }

    revalidatePath('/dashboard')
    
    return {
      success: true,
      data: true
    }
  } catch (error) {
    console.error('Error inesperado restaurando conversación para usuario:', error)
    return {
      success: false,
      error: "Error inesperado al restaurar conversación"
    }
  }
}
