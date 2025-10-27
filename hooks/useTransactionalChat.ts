"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabaseBrowser } from "@/lib/supabase/client"
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
  thread: ChatThread | null
  messages: ChatMessage[]
  isLoading: boolean
  isConnected: boolean
  isSending: boolean
  unreadCount: number
  send: (body: string, kind?: ChatMessageKind, metadata?: Record<string, any>) => Promise<boolean>
  markAsRead: () => Promise<void>
  close: () => Promise<void>
  refresh: () => Promise<void>
  scrollToBottom: () => void
}

export function useTransactionalChat(params: UseTransactionalChatParams): UseTransactionalChatReturn {
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const initializedRef = useRef<string | null>(null)

  // Obtener usuario
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabaseBrowser().auth.getUser()
        setCurrentUserId(user?.id || null)
      } catch (error) {
        console.error('Error obteniendo usuario:', error)
      }
    }
    getUser()
  }, [])

  // Scroll helper
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // Inicializar chat
  useEffect(() => {
    if (!currentUserId) return

    const initialize = async () => {
      try {
        setIsLoading(true)
        console.log('🚀 Iniciando chat con params:', params)
        
        // Abrir thread
        const threadRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'open_thread',
            contextType: params.contextType,
            contextId: params.contextId,
            partyA: params.partyA,
            partyB: params.partyB,
            contextTitle: params.contextTitle,
            contextData: params.contextData
          })
        })

        const threadData = await threadRes.json()
        console.log('📊 Thread response:', threadData)
        
        if (threadData.success) {
          setThread(threadData.data)
          console.log('✅ Thread creado:', threadData.data.id)
          
          // Evitar múltiples suscripciones al mismo thread
          if (initializedRef.current === threadData.data.id) {
            console.log('⚠️ Thread ya inicializado, omitiendo configuración')
            setIsLoading(false)
            return
          }
          initializedRef.current = threadData.data.id
          
          // Cargar mensajes
          const messagesRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get_messages',
              threadId: threadData.data.id,
              userId: currentUserId,
              limit: 50,
              offset: 0
            })
          })

          const messagesData = await messagesRes.json()
          console.log('📨 Messages response:', messagesData)
          
          if (messagesData.success) {
            setMessages(messagesData.data.reverse())
            console.log('✅ Mensajes cargados:', messagesData.data.length)
            
            // Marcar como leído cuando se abre el chat
            if (currentUserId) {
              try {
                await fetch('/api/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'mark_read',
                    threadId: threadData.data.id,
                    userId: currentUserId
                  })
                })
                console.log('✅ Chat marcado como leído')
              } catch (error) {
                console.error('❌ Error marcando chat como leído:', error)
              }
            }
          } else {
            console.error('❌ Error cargando mensajes:', messagesData.error)
          }
        } else {
          console.error('❌ Error creando thread:', threadData.error)
        }

        // Configurar realtime solo si el thread se creó exitosamente
        if (threadData.success) {
          // Limpiar suscripción anterior si existe
          if (channelRef.current) {
            console.log('🧹 Limpiando suscripción anterior')
            channelRef.current.unsubscribe()
          }
          
          const supabase = supabaseBrowser()
          console.log('🔌 Configurando realtime para thread:', threadData.data.id)
          
          channelRef.current = supabase
            .channel(`chat:${threadData.data.id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `thread_id=eq.${threadData.data.id}`
            }, async (payload) => {
              console.log('📨 Nuevo mensaje recibido via realtime:', payload.new)
              const newMessage = payload.new as ChatMessage
              setMessages(prev => {
                const alreadyExists = prev.some(m => m.id === newMessage.id)
                if (alreadyExists) {
                  console.log('⚠️ Mensaje duplicado ignorado:', newMessage.id)
                  return prev
                }
                console.log('✅ Mensaje agregado:', newMessage.id)
                return [...prev, newMessage]
              })
              setTimeout(() => scrollToBottom(), 100)
              
              // Marcar como leído cuando llega un nuevo mensaje mientras el chat está abierto
              if (currentUserId) {
                try {
                  await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'mark_read',
                      threadId: threadData.data.id,
                      userId: currentUserId
                    })
                  })
                  console.log('✅ Chat actualizado como leído al recibir mensaje')
                } catch (error) {
                  console.error('❌ Error actualizando chat como leído:', error)
                }
              }
            })
            .subscribe((status) => {
              console.log('🔌 Estado de conexión realtime:', status)
              setIsConnected(status === 'SUBSCRIBED')
            })
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error inicializando chat:', error)
        setIsLoading(false)
      }
    }

    initialize()

    return () => {
      console.log('🧹 Limpiando subscription realtime')
      initializedRef.current = null
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [currentUserId, params.contextId, params.partyA, params.partyB, params.contextType, params.contextTitle, scrollToBottom])

  // Enviar mensaje
  const send = useCallback(async (
    body: string, 
    kind: ChatMessageKind = 'user', 
    metadata: Record<string, any> = {}
  ): Promise<boolean> => {
    if (!thread || !currentUserId || isSending) return false

    setIsSending(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          threadId: thread.id,
          senderId: currentUserId,
          body,
          kind,
          metadata
        })
      })

      const result = await response.json()
      setIsSending(false)
      
      if (result.success) {
        scrollToBottom()
        return true
      }
      return false
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      setIsSending(false)
      return false
    }
  }, [thread, currentUserId, isSending, scrollToBottom])

  // Marcar como leído
  const markAsRead = useCallback(async (): Promise<void> => {
    if (!thread || !currentUserId) return

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          threadId: thread.id,
          userId: currentUserId
        })
      })
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marcando como leído:', error)
    }
  }, [thread, currentUserId])

  // Cerrar chat
  const close = useCallback(async (): Promise<void> => {
    if (!thread || !currentUserId) return

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_thread',
          threadId: thread.id,
          userId: currentUserId
        })
      })
      setThread(prev => prev ? { ...prev, status: 'closed' } : null)
    } catch (error) {
      console.error('Error cerrando chat:', error)
    }
  }, [thread, currentUserId])

  // Refresh
  const refresh = useCallback(async (): Promise<void> => {
    if (!thread || !currentUserId) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_messages',
          threadId: thread.id,
          userId: currentUserId,
          limit: 50,
          offset: 0
        })
      })

      const result = await response.json()
      if (result.success) {
        setMessages(result.data.reverse())
      }
    } catch (error) {
      console.error('Error refrescando mensajes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [thread, currentUserId])

  return {
    thread,
    messages,
    isLoading,
    isConnected,
    isSending,
    unreadCount,
    send,
    markAsRead,
    close,
    refresh,
    scrollToBottom
  }
}
