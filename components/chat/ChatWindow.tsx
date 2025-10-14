"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  Phone,
  Video,
  Search,
  Archive,
  Trash2,
  Users,
  ChevronLeft,
  X
} from 'lucide-react'
import { ConversationActions } from './ConversationActions'
import AvatarTest from './AvatarTest'
import AvatarDebug from './AvatarDebug'
import { useChat, ChatMessage, ChatParticipant } from '@/lib/hooks/useChat'
import { useToast } from '@/hooks/use-toast'
import { getAvatarUrl } from '@/lib/utils/avatar-utils'

interface ChatWindowProps {
  userId: string
  selectedConversationId?: string | null
  onClose: () => void
  onShowNotifications: () => void
  onShowSettings: () => void
  className?: string
}

export function ChatWindow({ 
  userId, 
  selectedConversationId,
  onClose, 
  onShowNotifications, 
  onShowSettings, 
  className = '' 
}: ChatWindowProps) {
  const [message, setMessage] = useState('')
  const [showConversations, setShowConversations] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [lastMessageCount, setLastMessageCount] = useState(0)
  const [localTypingState, setLocalTypingState] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingRef = useRef<boolean>(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Función helper para logs en color negro
  const logBlack = (message: string, ...args: any[]) => {
    console.log(`%c${message}`, 'color: black; font-weight: bold;', ...args)
  }
  

  const {
    conversations,
    currentConversation,
    messages,
    loading,
    typingUsers,
    unreadCount,
    setCurrentConversation,
    loadMessages,
    sendMessage,
    setTyping,
    deleteConversationForUser,
    restoreConversationForUser
  } = useChat()

  // Estados locales para manejar el envío de mensajes
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)

  const { toast } = useToast()

  // Funciones locales para reemplazar las que no están en el hook actual
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Ahora'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
    return `${Math.floor(diffInSeconds / 86400)}d`
  }

  const getOtherParticipant = (conversation: any) => {
    if (!conversation || !conversation.participants) return null
    return conversation.participants.find((p: any) => p.user_id !== userId) || null
  }

  // Evitar auto-entrada a conversación: se mostrará primero la lista
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      logBlack('ℹ️ ChatWindow: selectedConversationId presente, esperando interacción del usuario', {
        selectedConversationId,
        timestamp: new Date().toISOString()
      })
      setShowConversations(true)
    }
  }, [selectedConversationId, conversations])

  // Deshabilitar restauración automática: iniciar en listado
  useEffect(() => {
    setShowConversations(true)
  }, [])

  // Función para hacer scroll inteligente
  const scrollToBottom = useCallback((behavior: 'smooth' | 'instant' = 'smooth') => {
    if (messagesEndRef.current && shouldAutoScroll) {
      // Intentar scroll con el elemento de referencia
      messagesEndRef.current.scrollIntoView({ behavior })
      
      // También hacer scroll del viewport de ScrollArea
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: behavior
          })
        }
      }
    }
  }, [shouldAutoScroll])

  // Detectar si el usuario está cerca del final
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = element
    
    // Detectar si está cerca del final (dentro de 100px)
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    
    if (isNearBottom) {
      setIsUserScrolling(false)
      setShouldAutoScroll(true)
    } else {
      setIsUserScrolling(true)
      setShouldAutoScroll(false)
    }
    
    // Limpiar timeout anterior
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    // Resetear estado después de 2 segundos sin scroll
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false)
    }, 2000)
  }, [])

  // Función para detectar scroll en el viewport de ScrollArea
  const handleScrollAreaScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 50
        
        console.log('🔄 Scroll detectado:', {
          scrollTop,
          scrollHeight,
          clientHeight,
          isNearBottom,
          currentUserScrolling: isUserScrolling,
          currentShouldAutoScroll: shouldAutoScroll
        })
        
        // Solo cambiar estado si hay una diferencia significativa
        if (isNearBottom && isUserScrolling) {
          console.log('📍 Usuario cerca del final - habilitando scroll automático')
          setIsUserScrolling(false)
          setShouldAutoScroll(true)
        } else if (!isNearBottom && !isUserScrolling) {
          console.log('📍 Usuario scrolleando hacia arriba - deshabilitando scroll automático')
          setIsUserScrolling(true)
          setShouldAutoScroll(false)
        }
        
        // Limpiar timeout anterior
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        
        // Resetear estado después de 3 segundos sin scroll
        scrollTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Timeout de scroll - reseteando estado')
          setIsUserScrolling(false)
        }, 3000)
      }
    }
  }, []) // Sin dependencias para evitar bucles

  // Detectar mensajes nuevos
  useEffect(() => {
    if (messages.length > lastMessageCount) {
      console.log('📨 Nuevo mensaje detectado:', {
        previousCount: lastMessageCount,
        currentCount: messages.length,
        shouldAutoScroll,
        isUserScrolling
      })
      
      // Diagnóstico detallado del renderizado
      logBlack('🔍 DIAGNÓSTICO: ChatWindow detectando cambios en mensajes:', {
        messagesCount: messages.length,
        previousCount: lastMessageCount,
        currentConversationId: currentConversation?.id,
        shouldAutoScroll,
        isUserScrolling,
        lastMessage: messages[0] ? {
          id: messages[0].id,
          content: messages[0].body,
          sender_id: messages[0].sender_id,
          created_at: messages[0].created_at
        } : null,
        timestamp: new Date().toISOString()
      })
      
      
      setLastMessageCount(messages.length)
      
      // Solo hacer scroll automático si el usuario no está scrolleando manualmente
      if (shouldAutoScroll && !isUserScrolling) {
        setTimeout(() => {
          console.log('📜 Ejecutando scroll automático por mensaje nuevo')
          scrollToBottom('smooth')
        }, 100)
        setHasNewMessages(false)
      } else if (isUserScrolling) {
        // Indicar que hay mensajes nuevos cuando el usuario está scrolleando
        setHasNewMessages(true)
      }
    }
  }, [messages.length, lastMessageCount]) // Simplificar dependencias

  // Scroll inmediato cuando se carga una nueva conversación
  useEffect(() => {
    if (currentConversation) {
      console.log('🔄 Nueva conversación cargada:', currentConversation.id)
      
      // Diagnóstico detallado del cambio de conversación
      logBlack('🔍 DIAGNÓSTICO: ChatWindow cambiando conversación:', {
        conversationId: currentConversation.id,
        conversationName: getOtherParticipant(currentConversation)?.user_name || 'Usuario',
        messagesCount: messages.length,
        lastMessageCount,
        shouldAutoScroll,
        isUserScrolling,
        timestamp: new Date().toISOString()
      })
      
      
      setShouldAutoScroll(true)
      setIsUserScrolling(false)
      setLastMessageCount(messages.length) // Inicializar contador
      
      // Limpiar estado de typing al cambiar conversación
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      typingRef.current = false // Resetear estado de typing
      setLocalTypingState(false) // Estado local inmediato
      
      setTimeout(() => {
        scrollToBottom('instant')
      }, 100)
    }
  }, [currentConversation?.id]) // Solo depender del ID de la conversación

  // Configurar listener de scroll en el viewport de ScrollArea
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
      if (viewport) {
        viewport.addEventListener('scroll', handleScrollAreaScroll)
        
        return () => {
          viewport.removeEventListener('scroll', handleScrollAreaScroll)
        }
      }
    }
  }, []) // Sin dependencias para evitar bucles

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  // Focus en el input cuando se abre el chat
  useEffect(() => {
    if (currentConversation) {
      inputRef.current?.focus()
    }
  }, [currentConversation?.id]) // Solo depender del ID para evitar bucles

  // Log de estados de escritura cuando cambian (eliminado para evitar bucles)
  // useEffect(() => {
  //   const currentTypingUsers = typingUsers.filter(typing => 
  //     typing.conversation_id === currentConversation?.id && 
  //     typing.is_typing &&
  //     typing.user_id !== userId
  //   )
  //   
  //   console.log('⌨️ ChatWindow: Estados de escritura actualizados:', {
  //     totalTypingUsers: typingUsers.length,
  //     currentConversationId: currentConversation?.id,
  //     currentTypingUsers: currentTypingUsers.length,
  //     typingUsers: currentTypingUsers.map(t => ({
  //       userId: t.user_id,
  //       conversationId: t.conversation_id,
  //       isTyping: t.is_typing
  //     }))
  //   })
  // }, [typingUsers, currentConversation?.id, userId])

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || sendingMessage || !currentConversation) return

    setSendingMessage(true)
    const messageToSend = message.trim()
    
    try {
      const result = await sendMessage(currentConversation.id, messageToSend)
      const success = !!result
      
      if (success) {
        setMessage('')
        
        // Limpiar estado de typing al enviar mensaje
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = null
        }
        if (typingRef.current) {
          typingRef.current = false
          setLocalTypingState(false) // Estado local inmediato
          setTyping(currentConversation.id, false).catch(console.error)
        }
        
        // Forzar scroll al final después de enviar mensaje
        setShouldAutoScroll(true)
        setIsUserScrolling(false)
        setTimeout(() => {
          scrollToBottom('smooth')
        }, 100)
      } else {
        toast({
          title: "❌ Error",
          description: "No se pudo enviar el mensaje",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      toast({
        title: "❌ Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      })
    } finally {
      setSendingMessage(false)
    }
  }, [message, sendingMessage, currentConversation, sendMessage, toast, scrollToBottom])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessage(value)
    
    // Sistema de typing ultra fluido con estado local
    if (currentConversation) {
      const isTyping = value.length > 0
      
      // Actualizar estado local inmediatamente para UI fluida
      if (isTyping !== typingRef.current) {
        typingRef.current = isTyping
        setLocalTypingState(isTyping) // Estado local inmediato
        
        // Si empieza a escribir, activar typing en servidor
        if (isTyping) {
          setTyping(currentConversation.id, true).catch(() => {})
        }
      }
      
      // Limpiar timeout anterior
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Si está escribiendo, renovar timeout
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          if (typingRef.current) {
            typingRef.current = false
            setLocalTypingState(false) // Estado local inmediato
            setTyping(currentConversation.id, false).catch(() => {})
          }
        }, 1000) // Timeout ultra corto para mejor fluidez
      } else {
        // Si no está escribiendo, desactivar typing inmediatamente
        if (typingRef.current) {
          typingRef.current = false
          setLocalTypingState(false) // Estado local inmediato
          setTyping(currentConversation.id, false).catch(() => {})
        }
      }
    }
  }, [currentConversation, setTyping])

  const handleConversationSelect = (conversation: any) => {
    console.log('🔄 ChatWindow: handleConversationSelect llamada:', {
      conversationId: conversation.id,
      conversationName: conversation.other_participant_name || 'Usuario',
      timestamp: new Date().toISOString()
    })
    
    // Verificar que la conversación existe y es válida
    if (!conversation || !conversation.id) {
      console.error('❌ ChatWindow: Conversación inválida:', conversation)
      return
    }
    
    // Evitar seleccionar la misma conversación
    if (currentConversation?.id === conversation.id) {
      console.log('ℹ️ ChatWindow: Conversación ya seleccionada, ignorando')
      return
    }
    
    console.log('🔄 ChatWindow: Ejecutando setCurrentConversation...')
    setCurrentConversation(conversation)
    
    console.log('🔄 ChatWindow: Ejecutando setShowConversations(false)...')
    setShowConversations(false) // Cambiar a vista de chat individual
    
    console.log('🔄 ChatWindow: Ejecutando loadMessages...')
    // Cargar mensajes para la conversación seleccionada
    loadMessages(conversation.id)
    
    console.log('✅ ChatWindow: Conversación seleccionada exitosamente')
  }

  const filteredConversations = useMemo(() => {
    console.log('🔍 ChatWindow: Conversaciones disponibles:', {
      count: conversations.length,
      conversations: conversations.map(c => ({
        id: c.id,
        solicitud_id: c.solicitud_id,
        participants: c.participants?.length || 0,
        last_message: c.last_message?.body || 'Sin mensaje'
      }))
    })
    
    return conversations.filter(conv => {
      // Buscar en nombres de participantes
      const participantMatch = conv.participants?.some((p: any) => 
        p.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      
      // Buscar en contenido del último mensaje
      const messageMatch = conv.last_message?.body?.toLowerCase().includes(searchTerm.toLowerCase())
      
      return participantMatch || messageMatch
    })
  }, [conversations, searchTerm])

  // Componente memoizado para mensajes individuales
  const MessageItem = React.memo(({ 
    msg, 
    index, 
    userId, 
    messages,
    currentConversation
  }: { 
    msg: ChatMessage
    index: number
    userId: string
    messages: ChatMessage[]
    currentConversation: any
  }) => {
    const isOwn = msg.sender_id === userId
    
    // Obtener información del remitente - priorizar datos del mensaje, luego de la conversación
    let senderName = 'Usuario'
    let senderAvatar = ''
    
    // Obtener el nombre del remitente - usar datos del mensaje o de la conversación
    if (msg.sender_name) {
      senderName = msg.sender_name
    } else {
      const senderParticipant = currentConversation?.participants?.find((p: ChatParticipant) => p.user_id === msg.sender_id)
      if (senderParticipant?.user_name) {
        senderName = senderParticipant.user_name
      } else {
        senderName = 'Usuario'
      }
    }
    
    if (msg.sender_avatar) {
      senderAvatar = getAvatarUrl(msg.sender_avatar)
    } else {
      const senderParticipant = currentConversation?.participants?.find((p: ChatParticipant) => p.user_id === msg.sender_id)
      senderAvatar = getAvatarUrl(senderParticipant?.user_avatar)
    }
    
    // Si es un mensaje propio y no tenemos avatar, intentar obtenerlo del usuario actual
    if (isOwn && !senderAvatar) {
      // Buscar el participante que corresponde al usuario actual
      const currentUserParticipant = currentConversation?.participants?.find((p: ChatParticipant) => p.user_id === userId)
      if (currentUserParticipant?.user_avatar) {
        senderAvatar = getAvatarUrl(currentUserParticipant.user_avatar)
      }
    }
    
    // Debug: Log de datos del avatar para identificar el problema (solo para el primer mensaje)
    if (index === 0 && Math.random() < 0.1) { // Solo 10% de las veces para evitar spam
      console.log('🖼️ MessageItem: Datos del avatar (muestra aleatoria):', {
        isOwn,
        senderId: msg.sender_id,
        userId,
        senderAvatar,
        msgSenderAvatar: msg.sender_avatar
      })
    }

    // Debug: Log de datos del remitente
    if (index === 0) { // Solo log del primer mensaje para evitar spam
      const senderParticipant = currentConversation?.participants?.find((p: ChatParticipant) => p.user_id === msg.sender_id)
      console.log('👤 MessageItem: Datos del remitente:', {
        senderId: msg.sender_id,
        senderParticipant: senderParticipant ? {
          user_id: senderParticipant.user_id,
          user_name: senderParticipant.user_name,
          user_avatar: senderParticipant.user_avatar
        } : null,
        senderName,
        senderAvatar,
        conversationId: currentConversation?.id,
        allParticipants: currentConversation?.participants?.map((p: any) => ({
          user_id: p.user_id,
          user_name: p.user_name,
          user_avatar: p.user_avatar
        }))
      })
    }
    
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
           {/* Avatar - Mostrar en TODOS los mensajes para identificación completa */}
           <Avatar className="h-8 w-8 flex-shrink-0">
             <AvatarImage src={senderAvatar || ''} alt={senderName} />
             <AvatarFallback className="text-xs bg-primary/10 text-primary">
               {senderName.charAt(0).toUpperCase()}
             </AvatarFallback>
           </Avatar>
          
          {/* Mensaje */}
          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
            {/* Contenido del mensaje */}
            <div className={`px-4 py-3 rounded-2xl shadow-sm ${
              isOwn 
                ? 'bg-primary text-primary-foreground border border-primary/20' 
                : 'bg-muted text-muted-foreground border border-border/30'
            }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.body || ''}
                    </p>
              
              {/* Adjuntos - No disponible en la estructura actual */}
            </div>
            
            {/* Timestamp */}
            <span className="text-xs text-muted-foreground mt-1 px-2">
              {formatTime(msg.created_at)}
            </span>
          </div>
        </div>
      </div>
    )
  })

  MessageItem.displayName = 'MessageItem'

  // Componente optimizado para hover y clic más reactivos
  const ConversationItem = ({ 
    conversation, 
    currentConversation, 
    formatTimeAgo, 
    onSelect 
  }: { 
    conversation: any
    currentConversation: any
    formatTimeAgo: (dateString: string) => string
    onSelect: (conversation: any) => void
  }) => {
    const isSelected = currentConversation?.id === conversation.id
    const otherParticipant = getOtherParticipant(conversation)

    const handleDelete = async () => {
      const result = await deleteConversationForUser(conversation.id)
      if (result.success) {
        console.log('✅ Conversación eliminada individualmente')
      } else {
        console.error('❌ Error eliminando conversación:', result.error)
      }
    }

    const handleRestore = async () => {
      const result = await restoreConversationForUser(conversation.id)
      if (result.success) {
        console.log('✅ Conversación restaurada individualmente')
      } else {
        console.error('❌ Error restaurando conversación:', result.error)
      }
    }

    const handleClick = () => {
      console.log('🖱️ ConversationItem: Click detectado:', {
        conversationId: conversation.id,
        conversationName: otherParticipant?.user_name || 'Usuario',
        timestamp: new Date().toISOString()
      })
      alert('¡Conversación clickeada!')
      onSelect(conversation)
    }

    return (
      <div
        onClick={handleClick}
        className="p-3 m-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
        style={{
          minHeight: '60px',
          position: 'relative',
          zIndex: 100001
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold">{otherParticipant?.user_name?.charAt(0) || 'U'}</span>
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold">
                {otherParticipant?.user_name || 'Usuario'}
              </p>
              <div className="flex items-center gap-2">
                {conversation.unread_count && conversation.unread_count > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {conversation.unread_count}
                  </span>
                )}
                <p className="text-xs opacity-75">
                  {formatTimeAgo(conversation.updated_at)}
                </p>
              </div>
            </div>
            
            <p className="text-xs opacity-75 mt-1">
              {conversation.last_message?.body || 'Sin mensajes'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  ConversationItem.displayName = 'ConversationItem'

  const renderMessage = useCallback((msg: ChatMessage, index: number) => {
    return (
      <MessageItem 
        key={msg.id}
        msg={msg}
        index={index}
        userId={userId}
        messages={messages}
        currentConversation={currentConversation}
      />
    )
  }, [userId, messages, currentConversation])

  // Memoizar mensajes renderizados - MOSTRAR TODOS LOS MENSAJES SIN EXCEPCIÓN
  const renderedMessages = useMemo(() => {
    console.log('🔍 ChatWindow: Renderizando TODOS los mensajes:', {
      totalMessages: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        body: m.body,
        bodyLength: m.body?.length || 0,
        senderId: m.sender_id,
        createdAt: m.created_at
      }))
    })
    
    // Renderizar TODOS los mensajes sin filtrar ni eliminar ninguno
    return messages.map((msg, index) => {
      return renderMessage(msg, index)
    })
  }, [messages, renderMessage])

  return (
    <div className={`h-[100dvh] md:h-full bg-card flex flex-col relative overflow-hidden ${className}`}>
      {/* Header - fijo en móvil y con altura/offset garantizados */}
      <div className="p-4 border-b border-border/50 sticky top-0 z-[100005] bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 min-h-14">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Botón volver al listado de conversaciones - solo cuando estamos dentro de un chat */}
            {!showConversations && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (currentConversation) {
                    console.log('🔙 Volver: limpiando conversación actual para permitir nueva selección')
                    setCurrentConversation(null)
                  }
                  setShowConversations(true)
                }}
                className="p-1 hover:bg-muted/50"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConversations(!showConversations)}
              className="p-1 hover:bg-muted/50"
            >
              <Users className="h-4 w-4 text-muted-foreground" />
            </Button>
            
             {currentConversation ? (
               <div className="flex items-center gap-2">
                 <Avatar className="h-8 w-8">
                   <AvatarImage src={getAvatarUrl(getOtherParticipant(currentConversation)?.user_avatar) || ''} alt={getOtherParticipant(currentConversation)?.user_name || 'Usuario'} />
                   <AvatarFallback className="text-xs bg-primary/10 text-primary">
                     {getOtherParticipant(currentConversation)?.user_name?.charAt(0) || 'U'}
                   </AvatarFallback>
                 </Avatar>
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">
                    {getOtherParticipant(currentConversation)?.user_name || 'Usuario'}
                  </h3>
                </div>
              </div>
            ) : (
              <h3 className="text-sm font-semibold text-card-foreground">Chat</h3>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Borrar historial individual (lado del usuario) */}
            {!showConversations && currentConversation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const ok = window.confirm('¿Deseas borrar tu historial de esta conversación? Esta acción solo te afecta a ti.')
                  if (!ok) return
                  const id = currentConversation.id
                  try {
                    const result = await deleteConversationForUser(id)
                    if (result.success) {
                      setCurrentConversation(null)
                      setShowConversations(true)
                      console.log('🗑️ Historial individual borrado para conversación:', id)
                    } else {
                      console.error('❌ Error borrando historial individual:', result.error)
                    }
                  } catch (e) {
                    console.error('❌ Excepción borrando historial individual:', e)
                  }
                }}
                className="p-1 hover:bg-muted/50"
                title="Borrar mi historial"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            
            <Button variant="ghost" size="sm" onClick={onClose} className="p-1 hover:bg-muted/50">
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {showConversations ? (
          /* Vista de lista de conversaciones */
          <div className="h-full flex flex-col">
            <div className="p-3 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm border-border/50 focus:border-primary/50 rounded-lg"
                />
              </div>
            </div>
            
            <div 
              className="flex-1 overflow-y-auto p-2"
              style={{
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 100002
              }}
            >
              <div 
                className="space-y-2"
                style={{
                  pointerEvents: 'auto',
                  position: 'relative',
                  zIndex: 100003
                }}
              >
                {filteredConversations.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">No hay conversaciones</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Las conversaciones aparecerán aquí cuando recibas mensajes
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => {
                        console.log('✅ REAL CONVERSATION CLICK:', conversation.id)
                        handleConversationSelect(conversation)
                      }}
                      className={`p-3 m-2 rounded-lg cursor-pointer transition-colors ${
                        currentConversation?.id === conversation.id
                          ? 'bg-primary/10 border-primary/20 shadow-sm border' 
                          : 'bg-card hover:bg-muted/50 border-border border'
                      }`}
                      style={{
                        minHeight: '60px',
                        position: 'relative',
                        zIndex: 100001
                      }}
                    >
                       <div className="flex items-center gap-3">
                         <Avatar className="h-10 w-10">
                           <AvatarImage src={getAvatarUrl(getOtherParticipant(conversation)?.user_avatar) || ''} alt={getOtherParticipant(conversation)?.user_name || 'Usuario'} />
                           <AvatarFallback className="text-sm bg-primary/10 text-primary">
                             {getOtherParticipant(conversation)?.user_name?.charAt(0) || 'U'}
                           </AvatarFallback>
                         </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-semibold truncate text-card-foreground">
                              {getOtherParticipant(conversation)?.user_name || 'Usuario'}
                            </p>
                            <div className="flex items-center gap-2">
                              {conversation.unread_count && conversation.unread_count > 0 && (
                                <Badge variant="destructive" className="h-5 w-5 p-0 text-xs flex items-center justify-center">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {formatTimeAgo(conversation.updated_at)}
                              </p>
                              {/* Borrar conversación desde listado (individual) */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-1 hover:bg-muted/50"
                                title="Borrar mi historial"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const ok = window.confirm('¿Deseas borrar tu historial de esta conversación? Esta acción solo te afecta a ti.')
                                  if (!ok) return
                                  try {
                                    const result = await deleteConversationForUser(conversation.id)
                                    if (result.success) {
                                      if (currentConversation?.id === conversation.id) {
                                        setCurrentConversation(null)
                                      }
                                      setShowConversations(true)
                                      console.log('🗑️ Conversación borrada individualmente desde listado:', conversation.id)
                                    } else {
                                      console.error('❌ Error borrando conversación (individual):', result.error)
                                    }
                                  } catch (err) {
                                    console.error('❌ Excepción borrando conversación (individual):', err)
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conversation.last_message?.body || 'Sin mensajes'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Vista de chat individual */
          <div className="h-full flex flex-col">
          {currentConversation ? (
            <>
              {/* Mensajes */}
              <div className="flex-1 relative overflow-hidden">
                <ScrollArea 
                  ref={scrollAreaRef}
                  className="h-full w-full pt-2"
                  style={{ scrollBehavior: 'smooth' }}
                >
                  <div className="p-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-full min-h-[400px]">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Cargando mensajes...</p>
                        </div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[400px]">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">No hay mensajes aún</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Envía el primer mensaje para comenzar la conversación
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 pb-4">
                        {renderedMessages}
                        
                        {/* Indicador de escritura - solo para otros usuarios */}
                        {(() => {
                          // Filtrar usuarios escribiendo para la conversación actual (servidor)
                          const currentTypingUsers = typingUsers.filter(typing => 
                            typing.conversation_id === currentConversation?.id && 
                            typing.is_typing &&
                            typing.user_id !== userId // No mostrar el propio estado de escritura
                          )
                          
                          // Debug: Log para verificar filtrado
                          if (currentTypingUsers.length > 0) {
                            console.log('⌨️ ChatWindow: Mostrando typing de otros usuarios:', {
                              currentUserId: userId,
                              typingUsers: currentTypingUsers.map(t => ({
                                userId: t.user_id,
                                userName: t.user_name,
                                isTyping: t.is_typing,
                                conversationId: t.conversation_id
                              }))
                            })
                          }
                          
                          // Solo mostrar typing de otros usuarios, NO el propio
                          return currentTypingUsers.length > 0 ? (
                            <div className="flex justify-start mb-4 animate-in slide-in-from-left-2 duration-200">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {currentTypingUsers[0]?.user_name?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="bg-muted px-4 py-3 rounded-2xl border border-border/30 shadow-sm">
                                  <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDuration: '0.4s' }} />
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.4s' }} />
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '0.4s' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null
                        })()}
                        
                        {/* Elemento de referencia para scroll */}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Botón para volver al final cuando el usuario está scrolleando */}
                {isUserScrolling && !shouldAutoScroll && (
                  <div className="absolute bottom-20 right-6 z-10">
                    <Button
                      onClick={() => {
                        setShouldAutoScroll(true)
                        setIsUserScrolling(false)
                        scrollToBottom('smooth')
                      }}
                      size="sm"
                      className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white"
                    >
                      <Send className="h-4 w-4 rotate-45" />
                    </Button>
                  </div>
                )}
                
                {/* Botón para volver al final cuando el usuario está scrolleando */}
                {isUserScrolling && !shouldAutoScroll && (
                  <div className="absolute bottom-4 right-6 z-10">
                    <Button
                      onClick={() => {
                        setShouldAutoScroll(true)
                        setIsUserScrolling(false)
                        setHasNewMessages(false)
                        scrollToBottom('smooth')
                      }}
                      size="sm"
                      className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white relative"
                    >
                      <Send className="h-4 w-4 rotate-45" />
                      {hasNewMessages && (
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Input de mensaje */}
              <div className="p-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="p-2 hover:bg-muted/50">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  
                  <Input
                    ref={inputRef}
                    value={message}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe un mensaje..."
                    disabled={sendingMessage}
                    className="flex-1 border-border/50 focus:border-primary/50 rounded-xl"
                  />
                  
                  <Button variant="ghost" size="sm" className="p-2 hover:bg-muted/50">
                    <Smile className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sendingMessage}
                    size="sm"
                    className="p-2 bg-primary hover:bg-primary/90 rounded-xl"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
           ) : (
             <div className="flex-1 flex items-center justify-center">
               <div className="text-center">
                 <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                 <h3 className="text-lg font-semibold mb-2 text-card-foreground">Selecciona una conversación</h3>
                 <p className="text-sm text-muted-foreground">
                   Elige una conversación de la lista para comenzar a chatear
                 </p>
                 
                 {/* Componente de prueba para avatares */}
                 <div className="mt-6 space-y-4">
                   <AvatarTest userId={userId} />
                   
                   {/* Debug de avatares específicos */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <AvatarDebug avatarName="animal_cat_a1b2c3" />
                     <AvatarDebug avatarName="animal_heart_ec4899" />
                   </div>
                 </div>
               </div>
             </div>
           )}
          </div>
        )}
        
      </div>
    </div>
  )
}
