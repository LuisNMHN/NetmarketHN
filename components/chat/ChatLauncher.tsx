"use client"

import { useState, useEffect } from 'react'

// Función helper para logs en color negro
const logBlack = (message: string, ...args: any[]) => {
  console.log(`%c${message}`, 'color: black; font-weight: bold;', ...args)
}
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useChat } from '@/lib/hooks/useChat'
import { ChatWindow } from './ChatWindow'

interface ChatLauncherProps {
  userId: string
  className?: string
}

export function ChatLauncher({ userId, className = '' }: ChatLauncherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  
  const {
    conversations,
    currentConversation,
    messages,
    typingUsers,
    loading,
    error,
    userRole,
    canUseChat,
    unreadCount,
    createOrGetConversation,
    loadMessages,
    sendMessage,
    markAsRead,
    clearHistory,
    deleteOwnMessage,
    setTyping,
    setCurrentConversation,
    messagesEndRef
  } = useChat()

  // Función local para marcar todas las notificaciones como leídas
  const markAllNotificationsAsRead = async () => {
    try {
      // Marcar mensajes como leídos para la conversación actual
      if (currentConversation) {
        await markAsRead(currentConversation.id)
      }
      console.log('✅ Notificaciones marcadas como leídas')
    } catch (error) {
      console.error('❌ Error marcando notificaciones como leídas:', error)
    }
  }

  useEffect(() => {
    const handleOpenChat = async (event: CustomEvent) => {
      const { conversationId } = event.detail
      logBlack('🔄 ChatLauncher: Abriendo chat desde evento:', {
        conversationId,
        timestamp: new Date().toISOString()
      })
      
      await markAllNotificationsAsRead()
      
      setSelectedConversationId(conversationId)
      setIsOpen(true)
      
      logBlack('🔄 ChatLauncher: Chat abierto desde evento')
    }

    window.addEventListener('openChat', handleOpenChat as EventListener)
    
    return () => {
      window.removeEventListener('openChat', handleOpenChat as EventListener)
    }
  }, []) // Sin dependencias para evitar re-renders


  const handleToggleChat = async () => {
    const wasOpen = isOpen
    logBlack('🔄 ChatLauncher: Cambiando estado del chat:', {
      wasOpen,
      willBeOpen: !wasOpen,
      selectedConversationId,
      currentConversationId: currentConversation?.id,
      timestamp: new Date().toISOString()
    })
    
    setIsOpen(!isOpen)
    
    if (!wasOpen) {
      logBlack('🔄 ChatLauncher: Chat abierto - marcando notificaciones como leídas')
      await markAllNotificationsAsRead()
      
      // Si hay una conversación seleccionada, restaurarla
      if (selectedConversationId && currentConversation?.id !== selectedConversationId) {
        const conversation = conversations.find(c => c.id === selectedConversationId)
        if (conversation) {
          logBlack('🔄 ChatLauncher: Restaurando conversación seleccionada:', {
            conversationId: selectedConversationId,
            conversationName: conversation.other_participant_name
          })
          setCurrentConversation(conversation)
        }
      }
    } else {
      logBlack('🔄 ChatLauncher: Chat cerrado - manteniendo estado de conversación')
    }
  }


  return (
    <>
      {/* Botón flotante principal */}
      <div 
        className={`fixed bottom-6 right-6 transition-all duration-300 ease-in-out ${
          isOpen ? 'scale-95 opacity-80' : 'scale-100 opacity-100'
        } ${className}`}
        style={{ zIndex: isOpen ? 9998 : 10000 }}
      >
        <div className="relative group">
          {/* Tooltip */}
          <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-3 px-3 py-2 bg-black/80 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
            {isOpen ? 'Cerrar chat' : 'Abrir chat'}
            <div className="absolute left-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-4 border-l-black/80 border-t-4 border-t-transparent border-b-4 border-b-transparent" />
          </div>
          
          <Button
            onClick={handleToggleChat}
            size="lg"
            className="h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-primary hover:bg-primary/90 border-2 border-primary/20 hover:border-primary/40 group"
          >
            <div className="h-8 w-8 flex items-center justify-center">
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="white" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="transition-transform duration-300 group-hover:scale-110"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <path d="M8 9h8"/>
                <path d="M8 13h6"/>
              </svg>
            </div>
          </Button>

          {/* Badge de mensajes no leídos */}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-3 -right-3 h-7 w-7 rounded-full p-0 flex items-center justify-center text-xs font-bold border-2 border-background shadow-lg animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}

        </div>
      </div>

      {/* Overlay de fondo oscurecido */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md transition-all duration-500 ease-in-out"
          onClick={handleToggleChat}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999
          }}
        />
      )}

      {/* Ventana de chat */}
      {isOpen && (
        <div 
          className="fixed inset-y-0 right-0 w-full max-w-2xl bg-card border-l-2 border-border/80 shadow-2xl transform transition-all duration-500 ease-in-out"
          style={{ 
            zIndex: 100000,
            position: 'fixed',
            pointerEvents: 'auto'
          }}
        >
          <ChatWindow
            userId={userId}
            selectedConversationId={selectedConversationId}
            onClose={() => {
              setIsOpen(false)
              setSelectedConversationId(null)
            }}
            className="h-full w-full rounded-none border-0 shadow-none"
          />
        </div>
      )}

    </>
  )
}