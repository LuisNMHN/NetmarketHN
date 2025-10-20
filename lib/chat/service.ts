import { supabaseAdmin } from "@/lib/supabase/server"
import { emitNotification } from "@/lib/notifications/emitter"

export type ChatContextType = 'order' | 'auction' | 'ticket' | 'dispute'
export type ChatMessageKind = 'user' | 'system' | 'support'
export type ChatThreadStatus = 'active' | 'closed' | 'cancelled' | 'disputed'

export interface ChatThread {
  id: string
  context_type: ChatContextType
  context_id: string
  party_a: string
  party_b: string
  support_user_id?: string
  context_title?: string
  context_data: Record<string, any>
  status: ChatThreadStatus
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  sender_id: string
  kind: ChatMessageKind
  body: string
  metadata: Record<string, any>
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface ChatReadStatus {
  id: string
  thread_id: string
  user_id: string
  last_read_message_id?: string
  last_read_at: string
}

export interface ChatTypingStatus {
  id: string
  thread_id: string
  user_id: string
  is_typing: boolean
  updated_at: string
}

export interface OpenThreadParams {
  contextType: ChatContextType
  contextId: string
  partyA: string
  partyB: string
  contextTitle?: string
  contextData?: Record<string, any>
  supportUserId?: string
}

export interface SendMessageParams {
  threadId: string
  senderId: string
  body: string
  kind?: ChatMessageKind
  metadata?: Record<string, any>
}

export interface GetMessagesParams {
  threadId: string
  userId: string
  limit?: number
  offset?: number
}

export interface GetUserThreadsParams {
  userId: string
  limit?: number
  offset?: number
}

/**
 * Servicios del servidor para el sistema de chat transaccional
 */
export class ChatService {
  private supabase = supabaseAdmin()

  /**
   * Abrir o obtener un hilo de chat existente
   */
  async openOrGetThread(params: OpenThreadParams): Promise<ChatThread> {
    try {
      const { data, error } = await this.supabase.rpc('open_or_get_thread', {
        p_context_type: params.contextType,
        p_context_id: params.contextId,
        p_party_a: params.partyA,
        p_party_b: params.partyB,
        p_context_title: params.contextTitle || null,
        p_context_data: params.contextData || {}
      })

      if (error) {
        throw new Error(`Error abriendo hilo: ${error.message}`)
      }

      // Obtener el hilo completo
      const { data: thread, error: threadError } = await this.supabase
        .from('chat_threads')
        .select('*')
        .eq('id', data)
        .single()

      if (threadError) {
        throw new Error(`Error obteniendo hilo: ${threadError.message}`)
      }

      return thread as ChatThread
    } catch (error) {
      console.error('Error en openOrGetThread:', error)
      throw error
    }
  }

  /**
   * Enviar un mensaje en un hilo
   */
  async sendMessage(params: SendMessageParams): Promise<ChatMessage> {
    try {
      const { data, error } = await this.supabase.rpc('send_chat_message', {
        p_thread_id: params.threadId,
        p_sender_id: params.senderId,
        p_body: params.body,
        p_kind: params.kind || 'user',
        p_metadata: params.metadata || {}
      })

      if (error) {
        throw new Error(`Error enviando mensaje: ${error.message}`)
      }

      // Obtener el mensaje completo
      const { data: message, error: messageError } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('id', data)
        .single()

      if (messageError) {
        throw new Error(`Error obteniendo mensaje: ${messageError.message}`)
      }

      // Emitir notificación si es un mensaje de usuario
      if (params.kind === 'user' || !params.kind) {
        await this.emitMessageNotification(params.threadId, params.senderId, params.body)
      }

      return message as ChatMessage
    } catch (error) {
      console.error('Error en sendMessage:', error)
      throw error
    }
  }

  /**
   * Emitir mensaje del sistema (acciones de negociación)
   */
  async emitSystemMessage(
    threadId: string,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<ChatMessage> {
    try {
      // Obtener información del hilo para determinar el emisor del sistema
      const { data: thread, error: threadError } = await this.supabase
        .from('chat_threads')
        .select('party_a, party_b, support_user_id')
        .eq('id', threadId)
        .single()

      if (threadError) {
        throw new Error(`Error obteniendo hilo: ${threadError.message}`)
      }

      // Determinar el mensaje según la acción
      const systemMessages = {
        'mark_paid': 'Marcó como pagado',
        'confirm_received': 'Confirmó haber recibido',
        'request_support': 'Solicitó soporte',
        'open_dispute': 'Abrió una disputa',
        'cancel_order': 'Canceló la orden',
        'release_funds': 'Liberó los fondos',
        'close_thread': 'Cerro el chat'
      }

      const body = systemMessages[action as keyof typeof systemMessages] || `Acción: ${action}`

      const message = await this.sendMessage({
        threadId,
        senderId: thread.party_a, // Usar party_a como emisor del sistema
        body,
        kind: 'system',
        metadata: {
          action,
          ...metadata
        }
      })

      // Emitir notificación para acciones críticas
      if (['open_dispute', 'mark_paid', 'release_funds'].includes(action)) {
        await this.emitActionNotification(threadId, action, metadata)
      }

      return message
    } catch (error) {
      console.error('Error en emitSystemMessage:', error)
      throw error
    }
  }

  /**
   * Obtener mensajes de un hilo
   */
  async getMessages(params: GetMessagesParams): Promise<ChatMessage[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_thread_messages', {
        p_thread_id: params.threadId,
        p_user_id: params.userId,
        p_limit: params.limit || 50,
        p_offset: params.offset || 0
      })

      if (error) {
        throw new Error(`Error obteniendo mensajes: ${error.message}`)
      }

      return data as ChatMessage[]
    } catch (error) {
      console.error('Error en getMessages:', error)
      throw error
    }
  }

  /**
   * Marcar hilo como leído
   */
  async markAsRead(threadId: string, userId: string, lastMessageId?: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('mark_thread_as_read', {
        p_thread_id: threadId,
        p_user_id: userId,
        p_last_message_id: lastMessageId || null
      })

      if (error) {
        throw new Error(`Error marcando como leído: ${error.message}`)
      }

      return true
    } catch (error) {
      console.error('Error en markAsRead:', error)
      throw error
    }
  }

  /**
   * Obtener hilos del usuario
   */
  async getUserThreads(params: GetUserThreadsParams): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_user_threads', {
        p_user_id: params.userId,
        p_limit: params.limit || 20,
        p_offset: params.offset || 0
      })

      if (error) {
        throw new Error(`Error obteniendo hilos: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error en getUserThreads:', error)
      throw error
    }
  }

  /**
   * Cerrar un hilo
   */
  async closeThread(threadId: string, userId: string): Promise<boolean> {
    try {
      // Verificar permisos
      const { data: thread, error: threadError } = await this.supabase
        .from('chat_threads')
        .select('party_a, party_b, support_user_id, status')
        .eq('id', threadId)
        .single()

      if (threadError) {
        throw new Error(`Error obteniendo hilo: ${threadError.message}`)
      }

      if (![thread.party_a, thread.party_b, thread.support_user_id].includes(userId)) {
        throw new Error('No tienes permisos para cerrar este chat')
      }

      if (thread.status !== 'active') {
        throw new Error('El chat ya está cerrado')
      }

      // Cerrar el hilo
      const { error } = await this.supabase
        .from('chat_threads')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId)

      if (error) {
        throw new Error(`Error cerrando hilo: ${error.message}`)
      }

      // Emitir mensaje del sistema
      await this.emitSystemMessage(threadId, 'close_thread')

      return true
    } catch (error) {
      console.error('Error en closeThread:', error)
      throw error
    }
  }

  /**
   * Agregar soporte a un hilo
   */
  async addSupport(threadId: string, supportUserId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('chat_threads')
        .update({ 
          support_user_id: supportUserId,
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId)

      if (error) {
        throw new Error(`Error agregando soporte: ${error.message}`)
      }

      // Crear estado de lectura para el soporte
      await this.supabase
        .from('chat_read_status')
        .upsert({
          thread_id: threadId,
          user_id: supportUserId,
          last_read_at: new Date().toISOString()
        })

      return true
    } catch (error) {
      console.error('Error en addSupport:', error)
      throw error
    }
  }

  /**
   * Emitir notificación de nuevo mensaje
   */
  private async emitMessageNotification(
    threadId: string,
    senderId: string,
    messageBody: string
  ): Promise<void> {
    try {
      // Obtener información del hilo
      const { data: thread, error: threadError } = await this.supabase
        .from('chat_threads')
        .select('party_a, party_b, support_user_id, context_type, context_title')
        .eq('id', threadId)
        .single()

      if (threadError) {
        console.error('Error obteniendo hilo para notificación:', threadError)
        return
      }

      // Determinar el receptor
      const receiverId = senderId === thread.party_a ? thread.party_b : thread.party_a

      // Emitir notificación
      await emitNotification({
        user_id: receiverId,
        topic: 'chat',
        event: 'NEW_MESSAGE',
        title: 'Nuevo mensaje recibido',
        body: `Tienes un nuevo mensaje en ${thread.context_title || 'el chat'}`,
        priority: 'normal',
        cta_label: 'Abrir chat',
        cta_href: `/chat/${threadId}`,
        payload: {
          threadId,
          senderId,
          contextType: thread.context_type,
          messagePreview: messageBody.substring(0, 100)
        },
        dedupe_key: `new_message_${threadId}_${Date.now()}`
      })
    } catch (error) {
      console.error('Error emitiendo notificación de mensaje:', error)
    }
  }

  /**
   * Emitir notificación de acción crítica
   */
  private async emitActionNotification(
    threadId: string,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Obtener información del hilo
      const { data: thread, error: threadError } = await this.supabase
        .from('chat_threads')
        .select('party_a, party_b, support_user_id, context_type, context_title')
        .eq('id', threadId)
        .single()

      if (threadError) {
        console.error('Error obteniendo hilo para notificación de acción:', threadError)
        return
      }

      const actionNotifications = {
        'open_dispute': {
          event: 'DISPUTE_OPENED',
          title: 'Disputa abierta',
          body: 'Se ha abierto una disputa en el chat',
          priority: 'high' as const,
          cta_label: 'Responder disputa',
          cta_href: `/chat/${threadId}`
        },
        'mark_paid': {
          event: 'ORDER_PAID',
          title: 'Orden marcada como pagada',
          body: 'La orden ha sido marcada como pagada',
          priority: 'high' as const,
          cta_label: 'Ver orden',
          cta_href: `/chat/${threadId}`
        },
        'release_funds': {
          event: 'ORDER_RELEASED',
          title: 'Fondos liberados',
          body: 'Los fondos han sido liberados',
          priority: 'high' as const,
          cta_label: 'Ver detalles',
          cta_href: `/chat/${threadId}`
        }
      }

      const notificationConfig = actionNotifications[action as keyof typeof actionNotifications]
      if (!notificationConfig) return

      // Notificar a ambas partes
      const participants = [thread.party_a, thread.party_b]
      if (thread.support_user_id) {
        participants.push(thread.support_user_id)
      }

      for (const participantId of participants) {
        await emitNotification({
          user_id: participantId,
          topic: 'order',
          event: notificationConfig.event,
          title: notificationConfig.title,
          body: notificationConfig.body,
          priority: notificationConfig.priority,
          cta_label: notificationConfig.cta_label,
          cta_href: notificationConfig.cta_href,
          payload: {
            threadId,
            action,
            ...metadata
          },
          dedupe_key: `action_${action}_${threadId}_${Date.now()}`
        })
      }
    } catch (error) {
      console.error('Error emitiendo notificación de acción:', error)
    }
  }
}

// Instancia global del servicio
export const chatService = new ChatService()


