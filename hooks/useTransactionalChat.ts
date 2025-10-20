"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabaseBrowser } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"
import { ChatThread, ChatMessage, ChatContextType, ChatMessageKind } from "@/lib/chat/service"

export interface UseTransactionalChatParams {
  contextType: ChatContextType
  contextId: string
  partyA: string
  partyB: string
  contextTitle?: string
  contextData?: Record<string, any>
  supportUserId?: string
}

export interface UseTransactionalChatReturn {
  // Estado del chat
  thread: ChatThread | null
  messages: ChatMessage[]
  isLoading: boolean
  isConnected: boolean
  isSending: boolean
  unreadCount: number
  
  // Acciones
  send: (body: string, kind?: ChatMessageKind, metadata?: Record<string, any>) => Promise<boolean>
  emitAction: (action: string, metadata?: Record<string, any>) => Promise<boolean>
  loadOlder: () => Promise<void>
  markAsRead: () => Promise<void>
  close: () => Promise<void>
  
  // Estado de typing
  setTyping: (isTyping: boolean) => void
  typingUsers: string[]
  
  // Utilidades
  refresh: () => Promise<void>
  scrollToBottom: () => void
}

/**
 * Hook para manejar chat transaccional
 */
export function useTransactionalChat(params: UseTransactionalChatParams): UseTransactionalChatReturn {
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  
  const realtimeChannel = useRef<RealtimeChannel | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentUserId = useRef<string | null>(null)

  // Obtener usuario actual
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseBrowser().auth.getUser()
      currentUserId.current = user?.id || null
    }
    getUser()
  }, [])

  // Inicializar chat
  useEffect(() => {
    if (currentUserId.current) {
      initializeChat()
    }
  }, [params.contextType, params.contextId, params.partyA, params.partyB, currentUserId.current])

  // Configurar realtime
  useEffect(() => {
    if (thread) {
      setupRealtimeSubscription()
    }

    return () => {
      if (realtimeChannel.current) {
        realtimeChannel.current.unsubscribe()
      }
    }
  }, [thread])

  const initializeChat = async () => {
    if (!currentUserId.current) return

    setIsLoading(true)
    try {
      // Abrir o obtener hilo
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open_thread',
          ...params
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setThread(result.data)
        
        // Cargar mensajes iniciales
        await loadMessages()
        
        // Marcar como leído
        await markAsRead()
      } else {
        console.error('Error inicializando chat:', result.error)
      }
    } catch (error) {
      console.error('Error inicializando chat:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async (offset = 0) => {
    if (!thread || !currentUserId.current) return

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_messages',
          threadId: thread.id,
          userId: currentUserId.current,
          limit: 50,
          offset
        })
      })

      const result = await response.json()
      
      if (result.success) {
        const newMessages = result.data.reverse() // Los mensajes vienen en orden descendente
        
        if (offset === 0) {
          setMessages(newMessages)
        } else {
          setMessages(prev => [...newMessages, ...prev])
        }
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    }
  }

  const setupRealtimeSubscription = () => {
    if (!thread || !currentUserId.current) return

    // Cancelar suscripción anterior
    if (realtimeChannel.current) {
      realtimeChannel.current.unsubscribe()
    }

    const supabase = supabaseBrowser()
    
    // Suscripción a mensajes
    realtimeChannel.current = supabase
      .channel(`chat:${thread.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${thread.id}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          
          // Solo agregar si no es nuestro propio mensaje (para evitar duplicados)
          if (newMessage.sender_id !== currentUserId.current) {
            setMessages(prev => [...prev, newMessage])
            
            // Actualizar contador de no leídos
            setUnreadCount(prev => prev + 1)
            
            // Scroll automático si estamos en la parte inferior
            setTimeout(() => scrollToBottom(), 100)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_threads',
          filter: `id=eq.${thread.id}`
        },
        (payload) => {
          const updatedThread = payload.new as ChatThread
          setThread(updatedThread)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_typing_status',
          filter: `thread_id=eq.${thread.id}`
        },
        (payload) => {
          const typingStatus = payload.new as any
          if (typingStatus.user_id !== currentUserId.current && typingStatus.is_typing) {
            setTypingUsers(prev => [...prev.filter(id => id !== typingStatus.user_id), typingStatus.user_id])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_typing_status',
          filter: `thread_id=eq.${thread.id}`
        },
        (payload) => {
          const typingStatus = payload.new as any
          if (typingStatus.user_id !== currentUserId.current) {
            if (typingStatus.is_typing) {
              setTypingUsers(prev => [...prev.filter(id => id !== typingStatus.user_id), typingStatus.user_id])
            } else {
              setTypingUsers(prev => prev.filter(id => id !== typingStatus.user_id))
            }
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })
  }

  const send = useCallback(async (
    body: string, 
    kind: ChatMessageKind = 'user', 
    metadata: Record<string, any> = {}
  ): Promise<boolean> => {
    if (!thread || !currentUserId.current || isSending) return false

    setIsSending(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          threadId: thread.id,
          senderId: currentUserId.current,
          body,
          kind,
          metadata
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // El mensaje se agregará automáticamente via realtime
        // Pero lo agregamos inmediatamente para mejor UX
        const newMessage: ChatMessage = {
          id: result.data.id,
          thread_id: thread.id,
          sender_id: currentUserId.current,
          kind,
          body,
          metadata,
          is_deleted: false,
          created_at: result.data.created_at,
          updated_at: result.data.updated_at
        }
        
        setMessages(prev => [...prev, newMessage])
        scrollToBottom()
        
        return true
      } else {
        console.error('Error enviando mensaje:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      return false
    } finally {
      setIsSending(false)
    }
  }, [thread, isSending])

  const emitAction = useCallback(async (
    action: string, 
    metadata: Record<string, any> = {}
  ): Promise<boolean> => {
    if (!thread) return false

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'emit_system_message',
          threadId: thread.id,
          action,
          metadata
        })
      })

      const result = await response.json()
      return result.success
    } catch (error) {
      console.error('Error emitiendo acción:', error)
      return false
    }
  }, [thread])

  const loadOlder = useCallback(async (): Promise<void> => {
    if (!thread || isLoading) return

    await loadMessages(messages.length)
  }, [thread, messages.length, isLoading])

  const markAsRead = useCallback(async (): Promise<void> => {
    if (!thread || !currentUserId.current) return

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          threadId: thread.id,
          userId: currentUserId.current
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marcando como leído:', error)
    }
  }, [thread])

  const close = useCallback(async (): Promise<void> => {
    if (!thread || !currentUserId.current) return

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_thread',
          threadId: thread.id,
          userId: currentUserId.current
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Actualizar estado local
        setThread(prev => prev ? { ...prev, status: 'closed' } : null)
      }
    } catch (error) {
      console.error('Error cerrando chat:', error)
    }
  }, [thread])

  const setTyping = useCallback((isTyping: boolean) => {
    if (!thread || !currentUserId.current) return

    // Limpiar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Actualizar estado de typing
    const supabase = supabaseBrowser()
    supabase
      .from('chat_typing_status')
      .upsert({
        thread_id: thread.id,
        user_id: currentUserId.current,
        is_typing: isTyping,
        updated_at: new Date().toISOString()
      })

    // Auto-limpiar después de 3 segundos
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false)
      }, 3000)
    }
  }, [thread])

  const refresh = useCallback(async (): Promise<void> => {
    if (!thread) return

    setIsLoading(true)
    try {
      await loadMessages()
      await markAsRead()
    } finally {
      setIsLoading(false)
    }
  }, [thread, markAsRead])

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return {
    thread,
    messages,
    isLoading,
    isConnected,
    isSending,
    unreadCount,
    send,
    emitAction,
    loadOlder,
    markAsRead,
    close,
    setTyping,
    typingUsers,
    refresh,
    scrollToBottom
  }
}


