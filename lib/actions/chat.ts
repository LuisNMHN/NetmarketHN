'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ChatMessage {
  id: string
  request_id: string
  sender_id: string
  receiver_id: string
  message: string
  message_type: 'text' | 'offer' | 'system' | 'file'
  is_read: boolean
  is_edited: boolean
  is_deleted: boolean
  metadata?: any
  created_at: string
  updated_at: string
  sender_name?: string
  sender_email?: string
}

export interface Conversation {
  id: string
  request_id: string
  buyer_id: string
  seller_id: string
  is_active: boolean
  last_message_at: string
  last_message_id?: string
  created_at: string
  other_user_name?: string
  other_user_email?: string
  request_amount: number
  unread_count: number
}

export interface OnlineUser {
  user_id: string
  is_online: boolean
  last_seen: string
  user_name?: string
  user_email?: string
}

export interface SystemMessage {
  id: string
  conversation_id: string
  message_type: 'offer_sent' | 'offer_accepted' | 'offer_rejected' | 'payment_sent' | 'payment_confirmed' | 'transaction_completed' | 'conversation_started'
  title: string
  message: string
  metadata?: any
  created_at: string
}

// Enviar mensaje de chat
export async function sendChatMessage(
  requestId: string,
  receiverId: string,
  message: string,
  messageType: 'text' | 'offer' | 'system' | 'file' = 'text',
  metadata?: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!message.trim()) {
      return { success: false, error: 'El mensaje no puede estar vacío' }
    }

    // Verificar que el usuario no esté enviando mensaje a sí mismo
    if (user.id === receiverId) {
      return { success: false, error: 'No puedes enviar mensajes a ti mismo' }
    }

    // Validación simplificada - solo verificar que la solicitud existe
    const { data: requestData, error: requestError } = await supabase
      .from('purchase_requests')
      .select('id, buyer_id')
      .eq('id', requestId)
      .single()

    if (requestError || !requestData) {
      console.error('❌ Error validando solicitud:', requestError)
      return { success: false, error: 'Solicitud no encontrada' }
    }

    // Insertar mensaje directamente en la tabla (optimizado)
    const { data, error } = await supabase
      .from('purchase_chat_messages')
      .insert({
        request_id: requestId,
        sender_id: user.id,
        receiver_id: receiverId,
        message: message.trim(),
        message_type: messageType,
        metadata: metadata || null
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ Error enviando mensaje:', error)
      return { success: false, error: error.message || 'Error enviando mensaje' }
    }

    return { success: true, messageId: data.id }
  } catch (error) {
    console.error('❌ Error en sendChatMessage:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener mensajes de una conversación
export async function getConversationMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: ChatMessage[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo mensajes:', error)
      return { success: false, error: 'Error obteniendo mensajes' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getConversationMessages:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener mensajes por request_id (función alternativa)
export async function getMessagesByRequestId(
  requestId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: ChatMessage[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener mensajes directamente de la tabla por request_id (optimizado)
    const { data, error } = await supabase
      .from('purchase_chat_messages')
      .select('id, sender_id, receiver_id, message, message_type, is_read, created_at')
      .eq('request_id', requestId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Error obteniendo mensajes por request_id:', error)
      return { success: false, error: 'Error obteniendo mensajes' }
    }

    // Transformar los datos de forma optimizada
    const transformedData = data?.map(msg => ({
      id: msg.id,
      request_id: requestId, // Usar el requestId que ya tenemos
      sender_id: msg.sender_id,
      receiver_id: msg.receiver_id,
      message: msg.message,
      message_type: msg.message_type,
      is_read: msg.is_read,
      is_edited: false, // Valor por defecto
      is_deleted: false, // Ya filtrado
      metadata: null, // Valor por defecto
      created_at: msg.created_at,
      updated_at: msg.created_at, // Usar created_at como fallback
      sender_name: 'Usuario',
      sender_email: 'usuario@ejemplo.com'
    })) || []

    return { success: true, data: transformedData }
  } catch (error) {
    console.error('❌ Error en getMessagesByRequestId:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener conversaciones del usuario
export async function getUserConversations(
  limit: number = 20,
  offset: number = 0
): Promise<{ success: boolean; data?: Conversation[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_conversations', {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo conversaciones:', error)
      return { success: false, error: 'Error obteniendo conversaciones' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getUserConversations:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Marcar mensajes como leídos
export async function markMessagesAsRead(
  conversationId: string
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: user.id
      })

    if (error) {
      console.error('❌ Error marcando mensajes como leídos:', error)
      return { success: false, error: 'Error marcando mensajes como leídos' }
    }

    revalidatePath('/dashboard/chat')
    return { success: true, updatedCount: data }
  } catch (error) {
    console.error('❌ Error en markMessagesAsRead:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Marcar mensajes como leídos por request_id
export async function markMessagesAsReadByRequestId(
  requestId: string
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Actualizar mensajes directamente en la tabla
    const { data, error } = await supabase
      .from('purchase_chat_messages')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
      .eq('receiver_id', user.id)
      .eq('is_read', false)

    if (error) {
      console.error('❌ Error marcando mensajes como leídos:', error)
      return { success: false, error: 'Error marcando mensajes como leídos' }
    }

    return { success: true, updatedCount: data?.length || 0 }
  } catch (error) {
    console.error('❌ Error en markMessagesAsReadByRequestId:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Actualizar estado en línea
export async function updateUserOnlineStatus(
  conversationId?: string,
  isOnline: boolean = true,
  connectionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { error } = await supabase
      .rpc('update_user_online_status', {
        p_user_id: user.id,
        p_conversation_id: conversationId,
        p_is_online: isOnline,
        p_connection_id: connectionId
      })

    if (error) {
      console.error('❌ Error actualizando estado en línea:', error)
      return { success: false, error: 'Error actualizando estado en línea' }
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Error en updateUserOnlineStatus:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener usuarios en línea
export async function getOnlineUsers(
  conversationId?: string
): Promise<{ success: boolean; data?: OnlineUser[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_online_users', {
        p_conversation_id: conversationId
      })

    if (error) {
      console.error('❌ Error obteniendo usuarios en línea:', error)
      return { success: false, error: 'Error obteniendo usuarios en línea' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getOnlineUsers:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Crear mensaje de sistema
export async function createSystemMessage(
  conversationId: string,
  messageType: 'offer_sent' | 'offer_accepted' | 'offer_rejected' | 'payment_sent' | 'payment_confirmed' | 'transaction_completed' | 'conversation_started',
  title: string,
  message: string,
  metadata?: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('create_system_message', {
        p_conversation_id: conversationId,
        p_message_type: messageType,
        p_title: title,
        p_message: message,
        p_metadata: metadata || null
      })

    if (error) {
      console.error('❌ Error creando mensaje de sistema:', error)
      return { success: false, error: 'Error creando mensaje de sistema' }
    }

    revalidatePath('/dashboard/chat')
    return { success: true, messageId: data }
  } catch (error) {
    console.error('❌ Error en createSystemMessage:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Iniciar conversación desde una oferta
export async function startConversationFromOffer(
  requestId: string,
  sellerId: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_or_create_conversation', {
        p_request_id: requestId,
        p_buyer_id: user.id,
        p_seller_id: sellerId
      })

    if (error) {
      console.error('❌ Error iniciando conversación:', error)
      return { success: false, error: 'Error iniciando conversación' }
    }

    return { success: true, conversationId: data }
  } catch (error) {
    console.error('❌ Error en startConversationFromOffer:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Función de prueba para verificar la conexión a la base de datos
export async function testChatConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    console.log('🧪 Probando conexión a la base de datos...')
    
    // Probar si la tabla existe
    const { data, error } = await supabase
      .from('purchase_chat_messages')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Error accediendo a la tabla:', error)
      return { success: false, error: 'Error accediendo a la tabla de mensajes' }
    }

    console.log('✅ Conexión a la base de datos exitosa')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en testChatConnection:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Enviar oferta a través del chat
export async function sendOfferThroughChat(
  requestId: string,
  receiverId: string,
  offeredAmount: number,
  exchangeRate: number = 1.0000,
  terms?: string,
  message?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const offerMetadata = {
      offered_amount: offeredAmount,
      exchange_rate: exchangeRate,
      terms: terms,
      timestamp: new Date().toISOString()
    }

    const offerMessage = `💰 Nueva oferta: L.${offeredAmount.toFixed(2)} HNLD${terms ? `\n\nTérminos: ${terms}` : ''}${message ? `\n\nMensaje: ${message}` : ''}`

    const result = await sendChatMessage(
      requestId,
      receiverId,
      offerMessage,
      'offer',
      offerMetadata
    )

    if (result.success) {
      // También crear la oferta formal en el sistema
      const { error: offerError } = await supabase
        .rpc('create_purchase_offer', {
          p_request_id: requestId,
          p_seller_id: user.id,
          p_offered_amount: offeredAmount,
          p_exchange_rate: exchangeRate,
          p_terms: terms,
          p_message: message
        })

      if (offerError) {
        console.error('❌ Error creando oferta formal:', offerError)
        // No fallar aquí, el mensaje de chat ya se envió
      }
    }

    return result
  } catch (error) {
    console.error('❌ Error en sendOfferThroughChat:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
