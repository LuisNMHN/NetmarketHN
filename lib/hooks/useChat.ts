"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

// Tipos para el sistema de chat
export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  attachment_url?: string
  attachment_type?: string
  attachment_size?: number
  client_message_id?: string
  is_author_deleted: boolean
  created_at: string
  updated_at: string
  sender_name?: string
  sender_avatar?: string
}

export interface ChatConversation {
  id: string
  solicitud_id: string
  created_at: string
  updated_at: string
  participants: ChatParticipant[]
  last_message?: ChatMessage
  unread_count: number
}

export interface ChatParticipant {
  conversation_id: string
  user_id: string
  last_read_at: string
  cleared_at?: string
  created_at: string
  user_name?: string
  user_avatar?: string
}

export interface ChatTypingStatus {
  conversation_id: string
  user_id: string
  is_typing: boolean
  updated_at: string
  user_name?: string
}

// Hook principal del chat
export function useChat() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<ChatTypingStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null)
  
  const supabase = supabaseBrowser()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Verificar rol del usuario
  const checkUserRole = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner(name)
        `)
        .eq('user_id', session.user.id)
        .maybeSingle()

      return userRoles?.roles?.name === 'admin' ? 'admin' : 'user'
    } catch (error) {
      console.error('Error verificando rol:', error)
      return null
    }
  }, [supabase])

  // Verificar si el usuario puede usar el chat
  const canUseChat = useCallback(() => {
    return userRole === 'user'
  }, [userRole])

  // Cargar conversaciones del usuario
  const loadConversations = useCallback(async () => {
    if (!canUseChat()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      // Obtener conversaciones del usuario
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('chat_conversation_participants')
        .select(`
          conversation_id,
          last_read_at,
          cleared_at,
          created_at,
          chat_conversations!inner(
            id,
            solicitud_id,
            created_at,
            updated_at,
            purchase_requests!inner(
              id,
              amount,
              currency,
              description,
              status
            )
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (conversationsError) throw conversationsError

      // Obtener información de participantes
      const conversationIds = conversationsData?.map(c => c.conversation_id) || []
      
      if (conversationIds.length > 0) {
        const { data: participantsData, error: participantsError } = await supabase
          .from('chat_conversation_participants')
          .select(`
            conversation_id,
            user_id,
            last_read_at,
            cleared_at,
            created_at,
            profiles!inner(
              id,
              full_name
            )
          `)
          .in('conversation_id', conversationIds)

        if (participantsError) throw participantsError

        // Obtener último mensaje de cada conversación
        const { data: lastMessagesData, error: lastMessagesError } = await supabase
          .from('chat_messages')
          .select(`
            id,
            conversation_id,
            sender_id,
            body,
            attachment_url,
            attachment_type,
            attachment_size,
            is_author_deleted,
            created_at,
            updated_at,
            profiles!inner(
              id,
              full_name
            ),
            user_profiles!inner(
              user_id,
              avatar_url
            )
          `)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })

        if (lastMessagesError) throw lastMessagesError

        // Calcular mensajes no leídos
        const { data: unreadCountsData, error: unreadCountsError } = await supabase
          .from('chat_messages')
          .select('conversation_id, created_at')
          .in('conversation_id', conversationIds)
          .gt('created_at', conversationsData?.find(c => c.conversation_id === 'conversation_id')?.last_read_at || '1970-01-01')

        if (unreadCountsError) throw unreadCountsError

        // Procesar datos
        const processedConversations: ChatConversation[] = conversationsData?.map(conv => {
          const participants = participantsData?.filter(p => p.conversation_id === conv.conversation_id) || []
          const lastMessage = lastMessagesData?.find(m => m.conversation_id === conv.conversation_id)
          const unreadCount = unreadCountsData?.filter(m => m.conversation_id === conv.conversation_id).length || 0

          return {
            id: conv.conversation_id,
            solicitud_id: conv.chat_conversations.solicitud_id,
            created_at: conv.chat_conversations.created_at,
            updated_at: conv.chat_conversations.updated_at,
            participants: participants.map(p => ({
              conversation_id: p.conversation_id,
              user_id: p.user_id,
              last_read_at: p.last_read_at,
              cleared_at: p.cleared_at,
              created_at: p.created_at,
              user_name: p.profiles?.full_name || p.user_id?.slice(0, 8) || 'Usuario',
              user_avatar: null
            })),
            last_message: lastMessage ? {
              id: lastMessage.id,
              conversation_id: lastMessage.conversation_id,
              sender_id: lastMessage.sender_id,
              body: lastMessage.body,
              attachment_url: lastMessage.attachment_url,
              attachment_type: lastMessage.attachment_type,
              attachment_size: lastMessage.attachment_size,
              is_author_deleted: lastMessage.is_author_deleted,
              created_at: lastMessage.created_at,
              updated_at: lastMessage.updated_at,
              sender_name: lastMessage.profiles?.full_name,
              sender_avatar: lastMessage.user_profiles?.avatar_url
            } : undefined,
            unread_count: unreadCount
          }
        }) || []

        setConversations(processedConversations)
      } else {
        setConversations([])
      }
    } catch (error) {
      console.error('Error cargando conversaciones:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [supabase, canUseChat])

  // Crear o obtener conversación
  const createOrGetConversation = useCallback(async (solicitudId: string, targetUserId: string) => {
    if (!canUseChat()) {
      console.error('Acceso denegado: solo usuarios pueden usar el chat')
      return null
    }

    try {
      const { data, error } = await supabase.rpc('create_or_get_chat_conversation', {
        p_solicitud_id: solicitudId,
        p_target_user_id: targetUserId
      })

      if (error) throw error

      // Recargar conversaciones
      await loadConversations()

      return data
    } catch (error) {
      console.error('Error creando conversación:', error)
      return null
    }
  }, [supabase, canUseChat, loadConversations])

  // Cargar mensajes de una conversación
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!canUseChat()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      // Obtener mensajes
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          body,
          attachment_url,
          attachment_type,
          attachment_size,
          client_message_id,
          is_author_deleted,
          created_at,
          updated_at,
          profiles!inner(
            id,
            full_name
          ),
          user_profiles!inner(
            user_id,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      // Procesar mensajes
      const processedMessages: ChatMessage[] = messagesData?.map(msg => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        body: msg.body,
        attachment_url: msg.attachment_url,
        attachment_type: msg.attachment_type,
        attachment_size: msg.attachment_size,
        client_message_id: msg.client_message_id,
        is_author_deleted: msg.is_author_deleted,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        sender_name: msg.profiles?.full_name,
        sender_avatar: msg.user_profiles?.avatar_url
      })) || []

      setMessages(processedMessages)

      // Marcar mensajes como leídos
      await markAsRead(conversationId)

      // Scroll al final
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.error('Error cargando mensajes:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [supabase, canUseChat])

  // Enviar mensaje
  const sendMessage = useCallback(async (
    conversationId: string,
    body: string,
    attachment?: File
  ) => {
    if (!canUseChat()) {
      console.error('Acceso denegado: solo usuarios pueden enviar mensajes')
      return null
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      const clientMessageId = crypto.randomUUID()
      let attachmentUrl: string | undefined

      // Subir adjunto si existe
      if (attachment) {
        // Convertir archivo a bytes
        const arrayBuffer = await attachment.arrayBuffer()
        const fileBytes = new Uint8Array(arrayBuffer)
        
        // Llamar a la función RPC para subir
        const { data: uploadResult, error: uploadError } = await supabase.rpc('upload_chat_attachment', {
          p_conversation_id: conversationId,
          p_filename: attachment.name,
          p_file_data: fileBytes,
          p_content_type: attachment.type
        })

        if (uploadError) throw uploadError
        attachmentUrl = uploadResult
      }

      // Insertar mensaje
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: session.user.id,
          body,
          attachment_url: attachmentUrl,
          attachment_type: attachment?.type,
          attachment_size: attachment?.size,
          client_message_id: clientMessageId
        })
        .select()
        .single()

      if (error) throw error

      // Actualizar mensajes localmente
      setMessages(prev => [...prev, {
        id: data.id,
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        body: data.body,
        attachment_url: data.attachment_url,
        attachment_type: data.attachment_type,
        attachment_size: data.attachment_size,
        client_message_id: data.client_message_id,
        is_author_deleted: data.is_author_deleted,
        created_at: data.created_at,
        updated_at: data.updated_at
      }])

      // Scroll al final
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)

      return data
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      return null
    }
  }, [supabase, canUseChat])

  // Marcar mensajes como leídos
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!canUseChat()) return

    try {
      const { error } = await supabase.rpc('mark_chat_messages_read', {
        p_conversation_id: conversationId
      })

      if (error) throw error

      // Actualizar conversaciones localmente
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      ))
    } catch (error) {
      console.error('Error marcando mensajes como leídos:', error)
    }
  }, [supabase, canUseChat])

  // Limpiar historial
  const clearHistory = useCallback(async (conversationId: string) => {
    if (!canUseChat()) {
      console.error('Acceso denegado: solo usuarios pueden limpiar historial')
      return
    }

    try {
      const { error } = await supabase.rpc('clear_chat_history', {
        p_conversation_id: conversationId
      })

      if (error) throw error

      // Limpiar mensajes localmente
      setMessages([])
      console.log('Historial limpiado')
    } catch (error) {
      console.error('Error limpiando historial:', error)
    }
  }, [supabase, canUseChat])

  // Eliminar mensaje propio
  const deleteOwnMessage = useCallback(async (messageId: string) => {
    if (!canUseChat()) {
      console.error('Acceso denegado: solo usuarios pueden eliminar mensajes')
      return
    }

    try {
      const { error } = await supabase.rpc('delete_own_chat_message', {
        p_message_id: messageId
      })

      if (error) throw error

      // Actualizar mensajes localmente
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, is_author_deleted: true }
          : msg
      ))

      console.log('Mensaje eliminado')
    } catch (error) {
      console.error('Error eliminando mensaje:', error)
    }
  }, [supabase, canUseChat])

  // Indicar que está escribiendo
  const setTyping = useCallback(async (conversationId: string, isTyping: boolean) => {
    if (!canUseChat()) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Limpiar timeout anterior
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (isTyping) {
        // Insertar/actualizar estado de escritura
        await supabase
          .from('chat_typing_status')
          .upsert({
            conversation_id: conversationId,
            user_id: session.user.id,
            is_typing: true,
            updated_at: new Date().toISOString()
          })

        // Auto-limpiar después de 3 segundos
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(conversationId, false)
        }, 3000)
      } else {
        // Limpiar estado de escritura
        await supabase
          .from('chat_typing_status')
          .update({ is_typing: false })
          .eq('conversation_id', conversationId)
          .eq('user_id', session.user.id)
      }
    } catch (error) {
      console.error('Error actualizando estado de escritura:', error)
    }
  }, [supabase, canUseChat])

  // Verificar rol al montar
  useEffect(() => {
    checkUserRole().then(setUserRole)
  }, [checkUserRole])

  // Suscripciones en tiempo real (solo cuando el usuario puede usar chat)
  useEffect(() => {
    if (!canUseChat()) return

    // Suscripción a mensajes
    const messagesSubscription = supabase
      .channel('chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const newMessage = payload.new as ChatMessage
        setMessages(prev => [...prev, newMessage])
        
        // Scroll al final
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const updatedMessage = payload.new as ChatMessage
        setMessages(prev => prev.map(msg => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        ))
      })
      .subscribe()

    // Suscripción a estado de escritura
    const typingSubscription = supabase
      .channel('chat_typing')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_typing_status'
      }, (payload) => {
        const typingStatus = payload.new as ChatTypingStatus
        setTypingUsers(prev => {
          const filtered = prev.filter(t => !(t.conversation_id === typingStatus.conversation_id && t.user_id === typingStatus.user_id))
          return [...filtered, typingStatus]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_typing_status'
      }, (payload) => {
        const typingStatus = payload.new as ChatTypingStatus
        setTypingUsers(prev => prev.map(t => 
          t.conversation_id === typingStatus.conversation_id && t.user_id === typingStatus.user_id
            ? typingStatus
            : t
        ))
      })
      .subscribe()

    return () => {
      messagesSubscription.unsubscribe()
      typingSubscription.unsubscribe()
    }
  }, [supabase, canUseChat])

  // Cargar conversaciones cuando el usuario puede usar chat
  useEffect(() => {
    if (canUseChat()) {
      loadConversations()
    }
  }, [canUseChat, loadConversations])

  return {
    // Estado
    conversations,
    currentConversation,
    messages,
    typingUsers,
    loading,
    error,
    userRole,
    canUseChat,
    
    // Acciones
    createOrGetConversation,
    loadMessages,
    sendMessage,
    markAsRead,
    clearHistory,
    deleteOwnMessage,
    setTyping,
    setCurrentConversation,
    
    // Referencias
    messagesEndRef
  }
}
