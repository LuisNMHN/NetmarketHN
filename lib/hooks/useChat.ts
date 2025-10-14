"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

// Tipos para el sistema de chat
export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  updated_at: string
  message_type?: string
  is_deleted?: boolean
  sender_name?: string
  sender_avatar?: string
}

// Tipo para mensajes recibidos en tiempo real desde Supabase
interface RealtimeChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at: string
  message_type?: string
  is_deleted?: boolean
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
  const [currentConversation, setCurrentConversationState] = useState<ChatConversation | null>(null)
  
  // Wrapper para setCurrentConversation que también actualiza la referencia
  const setCurrentConversation = useCallback((conversation: ChatConversation | null) => {
    console.log('🔄 setCurrentConversation: Actualizando conversación:', {
      conversationId: conversation?.id,
      hasConversation: !!conversation,
      timestamp: new Date().toISOString()
    })
    
    // Limpiar estados de escritura al cambiar de conversación
    setTypingUsers([])
    console.log('⌨️ Estados de escritura limpiados al cambiar conversación')
    
    setCurrentConversationState(conversation)
    currentConversationRef.current = conversation
    // Persistir conversación activa para restaurarla al reabrir la ventana
    try {
      if (conversation?.id) {
        localStorage.setItem('currentConversationId', conversation.id)
      } else {
        localStorage.removeItem('currentConversationId')
      }
    } catch {}
    console.log('🔄 setCurrentConversation: Referencia actualizada:', {
      refId: currentConversationRef.current?.id,
      refHasConversation: !!currentConversationRef.current
    })
  }, [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  
  
  // Wrapper para setMessages que logea mensajes vacíos pero NO los filtra
  const setMessagesWithLogging = useCallback((newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages(prev => {
      const messagesToSet = typeof newMessages === 'function' ? newMessages(prev) : newMessages
      
      // Solo logear mensajes vacíos, pero NO filtrarlos
      messagesToSet.forEach(msg => {
        const hasBody = msg.body !== null && msg.body !== undefined
        const isString = typeof msg.body === 'string'
        const hasLength = isString && msg.body.length > 0
        const hasContent = hasLength && msg.body.trim().length > 0
        const isValid = hasBody && isString && hasLength && hasContent
        
        if (!isValid) {
          console.warn('⚠️ useChat: MENSAJE VACÍO DETECTADO (NO FILTRADO):', {
            id: msg.id,
            body: msg.body,
            bodyType: typeof msg.body,
            bodyLength: msg.body?.length || 0,
            hasBody,
            isString,
            hasLength,
            hasContent,
            isValid,
            senderId: msg.sender_id,
            createdAt: msg.created_at,
            timestamp: new Date().toISOString()
          })
        }
      })
      
      return messagesToSet // Retornar TODOS los mensajes, sin filtrar
    })
  }, [])
  
  const [typingUsers, setTypingUsers] = useState<ChatTypingStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  
  const supabase = supabaseBrowser()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentConversationRef = useRef<ChatConversation | null>(null)

  // Verificar si el usuario puede usar el chat (simplificado)
  const canUseChat = useCallback(() => {
    // Por ahora, permitir que todos los usuarios autenticados usen el chat
    return true
  }, [])

  // Cargar conversaciones del usuario
  const loadConversations = useCallback(async () => {
    console.log('📚 loadConversations: Iniciando carga de conversaciones')
    
    if (!canUseChat()) {
      console.log('❌ loadConversations: Usuario no puede usar chat')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('❌ loadConversations: No hay sesión activa')
        throw new Error('No hay sesión activa')
      }
      
      console.log('✅ loadConversations: Sesión encontrada:', {
        userId: session.user.id,
        email: session.user.email
      })

      // Obtener conversaciones del usuario EXCLUYENDO las eliminadas por el propio usuario
      const { data: conversationsData, error: conversationsError } = await supabase
        .rpc('get_user_conversations_with_deletion', { p_user_id: session.user.id })

      if (conversationsError) {
        console.log('❌ loadConversations: Error obteniendo conversaciones:', conversationsError)
        throw conversationsError
      }

      console.log('📚 loadConversations: Conversaciones obtenidas:', {
        count: conversationsData?.length || 0,
        conversations: conversationsData?.map((c: any) => ({
          id: c.id,
          participant_1_id: c.participant_1_id,
          participant_2_id: c.participant_2_id
        }))
      })

      // Obtener información de participantes
      const conversationIds = conversationsData?.map((c: any) => c.id) || []
      
      if (conversationIds.length > 0) {
        // Obtener información de participantes desde profiles y user_profiles
        const participantIds = conversationsData?.flatMap((c: any) => [c.participant_1_id, c.participant_2_id]) || []
        const uniqueParticipantIds = [...new Set(participantIds)]
        
        // Consulta separada para evitar problemas de RLS
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name
          `)
          .in('id', uniqueParticipantIds)

        if (profilesError) throw profilesError

        const { data: userProfilesData, error: userProfilesError } = await supabase
          .from('user_profiles')
          .select(`
            user_id,
            avatar_url,
            display_name
          `)
          .in('user_id', uniqueParticipantIds)

        if (userProfilesError) throw userProfilesError

        // Combinar datos de profiles y user_profiles
        const participantsData = profilesData?.map(profile => {
          const userProfile = userProfilesData?.find(up => up.user_id === profile.id)
          
          // Si no hay user_profiles, crear uno básico
          if (!userProfile) {
            console.log('⚠️ loadConversations: Usuario sin user_profiles, creando uno básico para:', profile.id)
            
            // Crear user_profiles básico
            supabase
              .from('user_profiles')
              .insert({
                user_id: profile.id,
                display_name: profile.full_name,
                avatar_url: null,
                bio: null,
                theme: 'system',
                notification_email: true,
                notification_push: true,
                notification_sms: false
              })
              .then(({ error }) => {
                if (error) {
                  console.error('❌ Error creando user_profiles:', error)
                } else {
                  console.log('✅ User_profiles creado para:', profile.id)
                }
              })
            
            // Retornar datos con user_profiles básico que incluya el nombre
            return {
              ...profile,
              user_profiles: [{
                user_id: profile.id,
                display_name: profile.full_name,
                avatar_url: null
              }]
            }
          }
          
          return {
            ...profile,
            user_profiles: [userProfile]
          }
        })

        console.log('📚 loadConversations: Datos de participantes obtenidos:', {
          count: participantsData?.length || 0,
          participants: participantsData?.map(p => ({
            id: p.id,
            full_name: p.full_name,
            user_profiles: p.user_profiles?.[0] ? {
              avatar_url: p.user_profiles[0].avatar_url,
              display_name: p.user_profiles[0].display_name
            } : null
          }))
        })

        console.log('📚 loadConversations: Datos raw de profiles:', {
          profilesData: profilesData?.map(p => ({
            id: p.id,
            full_name: p.full_name
          }))
        })

        console.log('📚 loadConversations: Datos raw de user_profiles:', {
          userProfilesData: userProfilesData?.map(up => ({
            user_id: up.user_id,
            avatar_url: up.avatar_url,
            display_name: up.display_name
          }))
        })

        console.log('📚 loadConversations: Datos combinados de participantes:', {
          participantsData: participantsData?.map(p => ({
            id: p.id,
            full_name: p.full_name,
            user_profiles: p.user_profiles?.map(up => ({
              user_id: up.user_id,
              avatar_url: up.avatar_url,
              display_name: up.display_name
            }))
          }))
        })

        // Obtener último mensaje de cada conversación
        const { data: lastMessagesData, error: lastMessagesError } = await supabase
          .from('chat_messages')
          .select(`
            id,
            conversation_id,
            sender_id,
            content,
            message_type,
            is_deleted,
            created_at,
            updated_at
          `)
          .in('conversation_id', conversationIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })

        if (lastMessagesError) throw lastMessagesError

        // Procesar datos
        const processedConversations: ChatConversation[] = conversationsData?.map((conv: any) => {
          // Encontrar participantes individuales
          const participant1 = participantsData?.find(p => p.id === conv.participant_1_id)
          const participant2 = participantsData?.find(p => p.id === conv.participant_2_id)
          const lastMessage = lastMessagesData?.find(m => m.conversation_id === conv.id)
          
          // Calcular mensajes no leídos (simplificado por ahora)
          const unreadCount = 0

          // Debug: Log de datos de participantes para esta conversación
          console.log('📚 loadConversations: Procesando conversación:', {
            conversationId: conv.id,
            participant1Id: conv.participant_1_id,
            participant2Id: conv.participant_2_id,
            participant1Data: participant1 ? {
              id: participant1.id,
              full_name: participant1.full_name,
              avatar_url: participant1.user_profiles?.[0]?.avatar_url,
              display_name: participant1.user_profiles?.[0]?.display_name
            } : null,
            participant2Data: participant2 ? {
              id: participant2.id,
              full_name: participant2.full_name,
              avatar_url: participant2.user_profiles?.[0]?.avatar_url,
              display_name: participant2.user_profiles?.[0]?.display_name
            } : null
          })

          return {
            id: conv.id,
            solicitud_id: conv.purchase_request_id || '',
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            participants: [
              {
                conversation_id: conv.id,
                user_id: conv.participant_1_id,
                last_read_at: conv.created_at,
                cleared_at: undefined,
                created_at: conv.created_at,
                user_name: participant1?.user_profiles?.[0]?.display_name || participant1?.full_name || 'Usuario',
                user_avatar: participant1?.user_profiles?.[0]?.avatar_url
              },
              {
                conversation_id: conv.id,
                user_id: conv.participant_2_id,
                last_read_at: conv.created_at,
                cleared_at: undefined,
                created_at: conv.created_at,
                user_name: participant2?.user_profiles?.[0]?.display_name || participant2?.full_name || 'Usuario',
                user_avatar: participant2?.user_profiles?.[0]?.avatar_url
              }
            ],
            last_message: lastMessage ? {
              id: lastMessage.id,
              conversation_id: lastMessage.conversation_id,
              sender_id: lastMessage.sender_id,
              body: lastMessage.content || '',
              attachment_url: undefined,
              attachment_type: undefined,
              attachment_size: undefined,
              is_author_deleted: lastMessage.is_deleted,
              created_at: lastMessage.created_at,
              updated_at: lastMessage.updated_at,
              sender_name: (() => {
                const sender = participantsData?.find(p => p.id === lastMessage.sender_id)
                return sender?.user_profiles?.[0]?.display_name || sender?.full_name
              })(),
              sender_avatar: (() => {
                const sender = participantsData?.find(p => p.id === lastMessage.sender_id)
                return sender?.user_profiles?.[0]?.avatar_url
              })()
            } : undefined,
            unread_count: unreadCount
          }
        }) || []

        console.log('✅ loadConversations: Conversaciones procesadas:', {
          count: processedConversations.length,
          conversations: processedConversations.map(c => ({
            id: c.id,
            solicitud_id: c.solicitud_id,
            participants: c.participants.length
          }))
        })
        setConversations(processedConversations)
      } else {
        console.log('📚 loadConversations: No hay conversaciones para procesar')
        setConversations([])
      }
    } catch (error) {
      console.error('❌ loadConversations: Error cargando conversaciones:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
      console.log('🔄 loadConversations: Finalizando carga')
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
    console.log('📚 loadMessages: Iniciando carga de mensajes:', {
      conversationId,
      timestamp: new Date().toISOString()
    })
    
    if (!canUseChat()) {
      console.log('❌ loadMessages: Usuario no puede usar chat')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('❌ loadMessages: No hay sesión activa')
        throw new Error('No hay sesión activa')
      }

      console.log('✅ loadMessages: Sesión encontrada:', {
        userId: session.user.id,
        email: session.user.email
      })

      // Obtener mensajes usando la estructura correcta
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          is_deleted,
          created_at,
          updated_at
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (messagesError) {
        console.log('❌ loadMessages: Error obteniendo mensajes:', messagesError)
        throw messagesError
      }

      console.log('📚 loadMessages: Mensajes obtenidos de la BD:', {
        count: messagesData?.length || 0,
        messages: messagesData?.map(m => ({
          id: m.id,
          content: m.content,
          contentType: typeof m.content,
          contentLength: m.content?.length || 0,
          isNull: m.content === null,
          isUndefined: m.content === undefined,
          isEmpty: m.content === '',
          sender_id: m.sender_id,
          created_at: m.created_at
        }))
      })

      // Obtener información de participantes para los mensajes
      const senderIds = [...new Set(messagesData?.map(msg => msg.sender_id) || [])]
      
      // Obtener datos de participantes si no los tenemos
      let participantsData: any[] = []
      if (senderIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name
          `)
          .in('id', senderIds)

        if (profilesError) throw profilesError

        const { data: userProfilesData, error: userProfilesError } = await supabase
          .from('user_profiles')
          .select(`
            user_id,
            avatar_url,
            display_name
          `)
          .in('user_id', senderIds)

        if (userProfilesError) throw userProfilesError

        // Combinar datos de profiles y user_profiles
        participantsData = profilesData?.map(profile => {
          const userProfile = userProfilesData?.find(up => up.user_id === profile.id)
          return {
            ...profile,
            user_profiles: userProfile ? [userProfile] : []
          }
        }) || []
      }

      // Procesar mensajes usando la estructura correcta
      const processedMessages: ChatMessage[] = messagesData?.map(msg => {
        // Usar el contenido original del mensaje tal como está
        const cleanContent = msg.content || ''
        
        // Obtener información del remitente
        const senderParticipant = participantsData?.find(p => p.id === msg.sender_id)
        const senderName = senderParticipant?.user_profiles?.[0]?.display_name || senderParticipant?.full_name || 'Usuario'
        const senderAvatar = senderParticipant?.user_profiles?.[0]?.avatar_url
        
        // Detectar mensajes vacíos en el procesamiento
        const isEmpty = !cleanContent || cleanContent.trim().length === 0
        if (isEmpty) {
          console.error('🚨 loadMessages: MENSAJE VACÍO EN PROCESAMIENTO:', {
            id: msg.id,
            originalContent: msg.content,
            originalContentType: typeof msg.content,
            originalContentLength: msg.content?.length || 0,
            cleanContent: cleanContent,
            cleanContentType: typeof cleanContent,
            cleanContentLength: cleanContent?.length || 0,
            isOriginalNull: msg.content === null,
            isOriginalUndefined: msg.content === undefined,
            isOriginalEmpty: msg.content === '',
            isCleanNull: cleanContent === null,
            isCleanUndefined: cleanContent === undefined,
            isCleanEmpty: cleanContent === '',
            senderName,
            senderAvatar: !!senderAvatar,
            timestamp: new Date().toISOString()
          })
        }
        
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          body: cleanContent,
          created_at: msg.created_at,
          updated_at: msg.updated_at,
          message_type: msg.message_type || 'text',
          is_deleted: msg.is_deleted || false,
          // Agregar información del remitente al mensaje
          sender_name: senderName,
          sender_avatar: senderAvatar
        }
      }) || []

      // Filtrar mensajes vacíos antes de establecer el estado
      const validMessages = processedMessages.filter(m => {
        const hasContent = m.body && m.body.trim().length > 0
        if (!hasContent) {
          console.error('🚨 loadMessages: FILTRANDO MENSAJE VACÍO:', {
            id: m.id,
            body: m.body,
            bodyType: typeof m.body,
            bodyLength: m.body?.length || 0,
            sender_id: m.sender_id,
            created_at: m.created_at
          })
        }
        return hasContent
      })

      console.log('📚 loadMessages: Mensajes procesados finales:', {
        originalCount: processedMessages.length,
        validCount: validMessages.length,
        filteredCount: processedMessages.length - validMessages.length,
        validMessages: validMessages.map(m => ({
          id: m.id,
          body: m.body,
          bodyType: typeof m.body,
          bodyLength: m.body?.length || 0,
          sender_id: m.sender_id,
          created_at: m.created_at
        }))
      })

      setMessagesWithLogging(validMessages)

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
    console.log('📤 sendMessage: Iniciando envío de mensaje:', {
      conversationId,
      body: body.substring(0, 50) + (body.length > 50 ? '...' : ''),
      hasAttachment: !!attachment,
      timestamp: new Date().toISOString()
    })
    
    if (!canUseChat()) {
      console.log('❌ sendMessage: Acceso denegado - usuario no puede usar chat')
      return null
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('❌ sendMessage: No hay sesión activa')
        throw new Error('No hay sesión activa')
      }

      console.log('✅ sendMessage: Sesión encontrada:', {
        userId: session.user.id,
        email: session.user.email
      })

      // Insertar mensaje usando la estructura correcta
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: session.user.id,
          content: body, // Usar content en lugar de body
          message_type: 'text',
          is_deleted: false
        })
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          is_deleted,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        console.log('❌ sendMessage: Error insertando mensaje:', error)
        throw error
      }

      console.log('✅ sendMessage: Mensaje insertado exitosamente:', {
        messageId: data.id,
        conversationId: data.conversation_id,
        senderId: data.sender_id,
        content: data.content?.substring(0, 50) + (data.content?.length > 50 ? '...' : ''),
        createdAt: data.created_at
      })

      // Usar el contenido original del mensaje tal como está
      const cleanContent = data.content || ''
      
      console.log('📤 sendMessage: Procesando mensaje enviado:', {
        id: data.id,
        originalContent: data.content?.substring(0, 50) + '...',
        cleanContent: cleanContent.substring(0, 50) + '...',
        contentLength: data.content?.length || 0
      })
      
      // Obtener información del remitente para el mensaje nuevo
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      let senderName = 'Tú'
      let senderAvatar = ''
      
      if (currentSession) {
        // Obtener datos del usuario actual
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentSession.user.id)
          .single()
          
        const { data: userProfileData } = await supabase
          .from('user_profiles')
          .select('display_name, avatar_url')
          .eq('user_id', currentSession.user.id)
          .single()
          
        // Para mensajes propios, usar el nombre real del usuario
        senderName = userProfileData?.display_name || profileData?.full_name || 'Usuario'
        senderAvatar = userProfileData?.avatar_url || ''
      }

      // Actualizar mensajes localmente usando la estructura correcta
      const newMessage: ChatMessage = {
        id: data.id,
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        body: cleanContent,
        created_at: data.created_at,
        updated_at: data.updated_at,
        message_type: data.message_type || 'text',
        is_deleted: data.is_deleted || false,
        sender_name: senderName,
        sender_avatar: senderAvatar
      }

      setMessagesWithLogging(prev => {
        // Verificar si el mensaje ya existe para evitar duplicados
        const messageExists = prev.some(msg => msg.id === newMessage.id)
        if (messageExists) {
          // Log solo ocasionalmente para evitar spam
          if (Math.random() < 0.1) { // 10% de probabilidad
            console.log('📤 sendMessage: Mensaje ya existe, evitando duplicado:', {
              messageId: newMessage.id,
              existingCount: prev.length
            })
          }
          return prev
        }
        
        console.log('📤 sendMessage: Agregando mensaje nuevo:', {
          messageId: newMessage.id,
          currentCount: prev.length,
          content: newMessage.body?.substring(0, 30) + '...'
        })
        
        const newMessages = [...prev, newMessage]
        console.log('📤 sendMessage: Mensajes actualizados:', {
          previousCount: prev.length,
          newCount: newMessages.length,
          addedMessageId: newMessage.id
        })
        
        // Retornar mensajes (el filtrado se hará en setMessagesFiltered)
        return newMessages
      })

      // Scroll al final
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)

      return newMessage
    } catch (error) {
      console.error('❌ sendMessage: Error enviando mensaje:', error)
      return null
    }
  }, [supabase, canUseChat])

  // Marcar mensajes como leídos
  const markAsRead = useCallback(async (conversationId: string) => {
    console.log('📖 markAsRead: Iniciando marcado de mensajes como leídos:', {
      conversationId,
      timestamp: new Date().toISOString()
    })
    
    if (!canUseChat()) {
      console.log('❌ markAsRead: Usuario no puede usar chat')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('❌ markAsRead: No hay sesión activa')
        return
      }

      console.log('✅ markAsRead: Sesión encontrada:', {
        userId: session.user.id,
        email: session.user.email
      })

      // Registrar lecturas sin afectar visibilidad de mensajes
      try {
        const start = performance.now()
        const { error: rpcError } = await supabase.rpc('mark_conversation_messages_read', {
          p_conversation_id: conversationId,
          p_user_id: session.user.id
        })
        const elapsed = Math.round(performance.now() - start)
        if (rpcError) {
          console.warn('⚠️ markAsRead: Error en mark_conversation_messages_read:', rpcError)
        } else {
          console.log('📖 markAsRead: Lecturas registradas (ms):', elapsed)
        }
      } catch (e) {
        console.warn('⚠️ markAsRead: Excepción registrando lecturas:', e)
      }

      console.log('✅ markAsRead: Mensajes marcados como leídos exitosamente')

      // Actualizar localmente sin tocar la lista de mensajes (evitar parpadeos/limpieza)
      setConversations(prev => prev.map(conv =>
        conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
      ))
    } catch (error) {
      console.error('❌ markAsRead: Error marcando mensajes como leídos:', error)
      // No lanzar el error para evitar interrumpir la carga de mensajes
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
      setMessagesWithLogging([])
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
      setMessagesWithLogging(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, is_author_deleted: true }
          : msg
      ))

      console.log('Mensaje eliminado')
    } catch (error) {
      console.error('Error eliminando mensaje:', error)
    }
  }, [supabase, canUseChat])

  // Indicar que está escribiendo ultra fluido y optimizado
  const setTyping = useCallback(async (conversationId: string, isTyping: boolean) => {
    if (!canUseChat()) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Limpiar timeout anterior
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }

      // Llamada RPC optimizada sin await para máxima fluidez
      const rpcCall = supabase.rpc('upsert_typing_status', {
        p_conversation_id: conversationId,
        p_user_id: session.user.id,
        p_is_typing: isTyping
      })

      if (isTyping) {
        // Auto-limpiar después de 2 segundos (ultra rápido)
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(conversationId, false)
        }, 2000)
      }

      // No esperar la respuesta para mejor fluidez
      // Silenciar errores para mejor fluidez
    } catch (error) {
      // Silenciar errores para mejor fluidez
    }
  }, [supabase, canUseChat])

  // Inicializar rol como 'user' por defecto
  useEffect(() => {
    setUserRole('user')
  }, [])

  // Eliminar conversación individualmente para el usuario actual
  const deleteConversationForUser = useCallback(async (conversationId: string) => {
    console.log('🗑️ deleteConversationForUser: Iniciando eliminación individual:', {
      conversationId,
      timestamp: new Date().toISOString()
    })
    
    if (!canUseChat()) {
      console.log('❌ deleteConversationForUser: Usuario no puede usar chat')
      return { success: false, error: 'Acceso denegado' }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('❌ deleteConversationForUser: No hay sesión activa')
        return { success: false, error: 'No hay sesión activa' }
      }

      console.log('✅ deleteConversationForUser: Sesión encontrada:', {
        userId: session.user.id,
        email: session.user.email
      })

      // Llamar a la función SQL para eliminar individualmente
      const { error } = await supabase.rpc('delete_conversation_for_user', {
        p_conversation_id: conversationId,
        p_user_id: session.user.id
      })

      if (error) {
        console.log('❌ deleteConversationForUser: Error en RPC:', error)
        return { success: false, error: error.message }
      }

      console.log('✅ deleteConversationForUser: Conversación eliminada individualmente')

      // Actualizar estado local - remover la conversación de la lista
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
      
      // Si la conversación eliminada era la actual, limpiar estado
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null)
        setMessagesWithLogging([])
        localStorage.removeItem('currentConversationId')
      }

      return { success: true }
    } catch (error) {
      console.error('❌ deleteConversationForUser: Error inesperado:', error)
      return { success: false, error: 'Error inesperado al eliminar conversación' }
    }
  }, [supabase, canUseChat, currentConversation])

  // Restaurar conversación eliminada individualmente
  const restoreConversationForUser = useCallback(async (conversationId: string) => {
    console.log('🔄 restoreConversationForUser: Iniciando restauración individual:', {
      conversationId,
      timestamp: new Date().toISOString()
    })
    
    if (!canUseChat()) {
      console.log('❌ restoreConversationForUser: Usuario no puede usar chat')
      return { success: false, error: 'Acceso denegado' }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('❌ restoreConversationForUser: No hay sesión activa')
        return { success: false, error: 'No hay sesión activa' }
      }

      console.log('✅ restoreConversationForUser: Sesión encontrada:', {
        userId: session.user.id,
        email: session.user.email
      })

      // Llamar a la función SQL para restaurar individualmente
      const { error } = await supabase.rpc('restore_conversation_for_user', {
        p_conversation_id: conversationId,
        p_user_id: session.user.id
      })

      if (error) {
        console.log('❌ restoreConversationForUser: Error en RPC:', error)
        return { success: false, error: error.message }
      }

      console.log('✅ restoreConversationForUser: Conversación restaurada individualmente')

      // Recargar conversaciones para incluir la restaurada
      await loadConversations()

      return { success: true }
    } catch (error) {
      console.error('❌ restoreConversationForUser: Error inesperado:', error)
      return { success: false, error: 'Error inesperado al restaurar conversación' }
    }
  }, [supabase, canUseChat, loadConversations])

  // Limpiar estados de escritura obsoletos automáticamente (ultra fluido)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = new Date()
      setTypingUsers(prev => {
        const cleaned = prev.filter(typing => {
          const typingTime = new Date(typing.updated_at)
          const timeDiff = now.getTime() - typingTime.getTime()
          const isStale = timeDiff > 1500 // 1.5 segundos sin actualizar (ultra rápido)
          
          return !(isStale && typing.is_typing)
        })
        
        return cleaned
      })
    }, 250) // Verificar cada 250ms (ultra frecuente)

    return () => {
      clearInterval(cleanupInterval)
    }
  }, [])

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
        const newMessage = payload.new as RealtimeChatMessage
        console.log('📨 Nuevo mensaje recibido:', newMessage)
        
        // Solo agregar si pertenece a la conversación actual
        const currentConv = currentConversationRef.current
        console.log('📨 Estado de conversación actual:', {
          hasCurrentConv: !!currentConv,
          currentConvId: currentConv?.id,
          messageConvId: newMessage.conversation_id,
          match: currentConv?.id === newMessage.conversation_id
        })
        if (currentConv && newMessage.conversation_id === currentConv.id) {
          console.log('📨 Agregando mensaje a conversación actual:', {
            messageId: newMessage.id,
            conversationId: newMessage.conversation_id,
            content: newMessage.content?.substring(0, 50) + (newMessage.content?.length > 50 ? '...' : '')
          })
          setMessagesWithLogging(prev => {
            // Evitar duplicados con verificación más robusta
            const messageExists = prev.some(msg => msg.id === newMessage.id)
            if (messageExists) {
              // Log solo ocasionalmente para evitar spam
              if (Math.random() < 0.1) { // 10% de probabilidad
                console.log('📨 Mensaje ya existe, evitando duplicado:', {
                  messageId: newMessage.id,
                  existingCount: prev.length,
                  content: newMessage.content?.substring(0, 30) + '...'
                })
              }
              return prev
            }
            
            console.log('📨 Agregando mensaje nuevo desde tiempo real:', {
              messageId: newMessage.id,
              currentCount: prev.length,
              content: newMessage.content?.substring(0, 30) + '...'
            })
            
            // Usar el contenido original del mensaje tal como está
            const cleanContent = newMessage.content || ''
            
            // Detectar mensajes vacíos en tiempo real
            const isEmpty = !cleanContent || cleanContent.trim().length === 0
            if (isEmpty) {
              console.error('🚨 Realtime: MENSAJE VACÍO EN TIEMPO REAL:', {
                id: newMessage.id,
                originalContent: newMessage.content,
                originalContentType: typeof newMessage.content,
                originalContentLength: newMessage.content?.length || 0,
                cleanContent: cleanContent,
                cleanContentType: typeof cleanContent,
                cleanContentLength: cleanContent?.length || 0,
                isOriginalNull: newMessage.content === null,
                isOriginalUndefined: newMessage.content === undefined,
                isOriginalEmpty: newMessage.content === '',
                isCleanNull: cleanContent === null,
                isCleanUndefined: cleanContent === undefined,
                isCleanEmpty: cleanContent === '',
                timestamp: new Date().toISOString()
              })
            }
            
            // Obtener información del remitente para mensajes de tiempo real
            let senderName = 'Usuario'
            let senderAvatar = ''
            
            // Buscar en los participantes de la conversación actual
            const senderParticipant = currentConversationRef.current?.participants?.find((p: ChatParticipant) => p.user_id === newMessage.sender_id)
            if (senderParticipant) {
              senderName = senderParticipant.user_name || 'Usuario'
              senderAvatar = senderParticipant.user_avatar || ''
            }

            // Mapear el mensaje de tiempo real a la estructura correcta
            const mappedMessage: ChatMessage = {
              id: newMessage.id,
              conversation_id: newMessage.conversation_id,
              sender_id: newMessage.sender_id,
              body: cleanContent,
              created_at: newMessage.created_at,
              updated_at: newMessage.updated_at,
              message_type: newMessage.message_type || 'text',
              is_deleted: newMessage.is_deleted || false,
              sender_name: senderName,
              sender_avatar: senderAvatar
            }
            
            // Filtrar mensajes vacíos antes de agregar
            const hasContent = mappedMessage.body && mappedMessage.body.trim().length > 0
            if (!hasContent) {
              console.error('🚨 Realtime: FILTRANDO MENSAJE VACÍO DE TIEMPO REAL:', {
                id: mappedMessage.id,
                body: mappedMessage.body,
                bodyType: typeof mappedMessage.body,
                bodyLength: mappedMessage.body?.length || 0,
                sender_id: mappedMessage.sender_id,
                created_at: mappedMessage.created_at
              })
              return prev // No agregar mensaje vacío
            }

            // Agregar al final para mantener orden cronológico
            const newMessages = [...prev, mappedMessage]
            console.log('📨 Mensajes actualizados:', {
              previousCount: prev.length,
              newCount: newMessages.length,
              addedMessageId: mappedMessage.id
            })
            
            // Retornar mensajes (el filtrado se hará en setMessagesFiltered)
            return newMessages
          })
          
          // Scroll al final
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        } else {
          console.log('📨 Mensaje no pertenece a conversación actual:', {
            messageConversationId: newMessage.conversation_id,
            currentConversationId: currentConv?.id,
            hasCurrentConversation: !!currentConv
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const updatedMessage = payload.new as ChatMessage
        setMessagesWithLogging(prev => prev.map(msg => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        ))
      })
      .subscribe((status) => {
        console.log('🔌 Estado de suscripción de mensajes:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción de mensajes establecida correctamente')
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Error en suscripción de mensajes')
        } else if (status === 'TIMED_OUT') {
          console.log('⏰ Timeout en suscripción de mensajes')
        } else if (status === 'CLOSED') {
          console.log('🔒 Suscripción de mensajes cerrada')
        }
      })

    // Suscripción a estado de escritura optimizada
    const typingSubscription = supabase
      .channel('chat_typing')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_typing_status'
      }, async (payload) => {
        const typingStatus = payload.new as ChatTypingStatus
        console.log('⌨️ Realtime INSERT: Estado de typing recibido:', {
          userId: typingStatus.user_id,
          conversationId: typingStatus.conversation_id,
          isTyping: typingStatus.is_typing,
          timestamp: new Date().toISOString()
        })
        
        // Obtener sesión actual para filtrar
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        
        // Solo mostrar typing de otros usuarios, no del usuario actual
        if (typingStatus.user_id === session.user.id) {
          console.log('⌨️ Realtime INSERT: Ignorando estado propio')
          return
        }
        
        // Solo mostrar si pertenece a la conversación actual
        const currentConv = currentConversationRef.current
        if (!currentConv || typingStatus.conversation_id !== currentConv.id) {
          console.log('⌨️ Realtime INSERT: No pertenece a conversación actual')
          return
        }
        
        console.log('⌨️ Realtime INSERT: Agregando estado de typing de otro usuario')
        
        // Actualización directa para máxima fluidez
        setTypingUsers(prev => {
          const filtered = prev.filter(t => !(t.conversation_id === typingStatus.conversation_id && t.user_id === typingStatus.user_id))
          return [...filtered, typingStatus]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_typing_status'
      }, async (payload) => {
        const typingStatus = payload.new as ChatTypingStatus
        console.log('⌨️ Realtime UPDATE: Estado de typing actualizado:', {
          userId: typingStatus.user_id,
          conversationId: typingStatus.conversation_id,
          isTyping: typingStatus.is_typing,
          timestamp: new Date().toISOString()
        })
        
        // Obtener sesión actual para filtrar
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        
        // Solo mostrar typing de otros usuarios, no del usuario actual
        if (typingStatus.user_id === session.user.id) {
          console.log('⌨️ Realtime UPDATE: Ignorando actualización propia')
          return
        }
        
        // Solo mostrar si pertenece a la conversación actual
        const currentConv = currentConversationRef.current
        if (!currentConv || typingStatus.conversation_id !== currentConv.id) {
          console.log('⌨️ Realtime UPDATE: No pertenece a conversación actual')
          return
        }
        
        console.log('⌨️ Realtime UPDATE: Actualizando estado de typing de otro usuario')
        
        // Actualización directa para máxima fluidez
        setTypingUsers(prev => prev.map(t => 
          t.conversation_id === typingStatus.conversation_id && t.user_id === typingStatus.user_id
            ? typingStatus
            : t
        ))
      })
      .subscribe()

    return () => {
      console.log('🔌 Limpiando suscripciones de tiempo real')
      messagesSubscription.unsubscribe()
      typingSubscription.unsubscribe()
    }
  }, [supabase]) // Remover canUseChat para evitar bucles

  // Cargar conversaciones al inicializar
  useEffect(() => {
    console.log('🔄 useChat: Inicializando carga de conversaciones')
    loadConversations()
  }, [])

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
    unreadCount,
    
    // Acciones
    createOrGetConversation,
    loadMessages,
    sendMessage,
    markAsRead,
    clearHistory,
    deleteOwnMessage,
    setTyping,
    setCurrentConversation,
    loadConversations,
    deleteConversationForUser,
    restoreConversationForUser,
    
    // Referencias
    messagesEndRef
  }
}
