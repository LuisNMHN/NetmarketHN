"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  getUserConversations,
  type Conversation
} from "@/lib/actions/chat"
import { SimpleChatModal } from "./simple-chat-modal"
import { 
  MessageSquare, 
  X, 
  Minimize2, 
  Maximize2,
  Circle,
  Clock
} from "lucide-react"

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadConversations = async () => {
    setLoading(true)
    try {
      const result = await getUserConversations(5, 0) // Solo las 5 más recientes
      if (result.success && result.data) {
        setConversations(result.data)
        setUnreadCount(result.data.reduce((total, conv) => total + conv.unread_count, 0))
      }
    } catch (error) {
      console.error('❌ Error cargando conversaciones:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleOpenChat = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setIsOpen(false) // Cerrar el panel flotante
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !selectedConversation) return

    setSending(true)
    try {
      const result = await sendChatMessage(
        selectedConversation.request_id,
        selectedConversation.other_user_name === selectedConversation.buyer_id ? selectedConversation.seller_id : selectedConversation.buyer_id,
        newMessage.trim(),
        'text'
      )

      if (result.success) {
        setNewMessage("")
        await loadMessages(selectedConversation.id) // Recargar mensajes
        scrollToBottom()
      } else {
        toast({
          title: "❌ Error",
          description: result.error || "No se pudo enviar el mensaje",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al enviar mensaje",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return "Ahora"
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`
    return date.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
  }

  const getReadStatus = (message: ChatMessage) => {
    if (message.is_read) {
      return <CheckCheck className="h-3 w-3 text-blue-600" />
    }
    return <Check className="h-3 w-3 text-gray-400" />
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Ahora"
    if (diffInHours < 24) return `Hace ${diffInHours}h`
    const diffInDays = Math.floor(diffInHours / 24)
    return `Hace ${diffInDays}d`
  }

  useEffect(() => {
    loadConversations()
    
    // Recargar conversaciones cada 10 segundos para mejor tiempo real
    const interval = setInterval(loadConversations, 10000)
    return () => clearInterval(interval)
  }, [])


  return (
    <>
      {/* Botón Flotante */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-primary hover:bg-primary/90"
          size="lg"
        >
          <div className="relative">
            <MessageSquare className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </div>
        </Button>
      </div>

      {/* Panel Flotante */}
      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-3 sm:right-6 z-40 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm h-[60vh] sm:h-[500px] bg-background border border-border rounded-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-muted/50 rounded-t-lg">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">Chat</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {unreadCount} conversaciones nuevas
                  </p>
                )}
              </div>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              >
                {isMinimized ? <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4" /> : <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false)
                  setSelectedConversation(null)
                }}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex flex-col h-full">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Cargando...</p>
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay conversaciones</p>
                    <p className="text-xs text-muted-foreground">Inicia una desde una solicitud</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-1 sm:space-y-2">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        onClick={() => handleOpenChat(conversation)}
                        className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                          <AvatarImage src={`/api/avatar/${conversation.other_user_name}`} />
                          <AvatarFallback className="text-xs sm:text-sm">
                            {conversation.other_user_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs sm:text-sm font-medium truncate">
                              {conversation.other_user_name || "Usuario"}
                            </p>
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <Circle className="h-1.5 w-1.5 sm:h-2 sm:w-2 fill-green-500 text-green-500" />
                              {conversation.unread_count > 0 && (
                                <Badge variant="destructive" className="text-xs h-3 w-3 sm:h-4 sm:w-4 p-0 flex items-center justify-center">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            L.{conversation.request_amount.toFixed(0)}
                          </p>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            <span className="truncate">{formatTimeAgo(conversation.last_message_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Footer */}
              <div className="p-2 sm:p-3 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground text-center">
                  💡 Haz clic en una conversación para abrir el chat completo
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Modal */}
      {selectedConversation && (
        <SimpleChatModal
          requestId={selectedConversation.request_id}
          otherUserId={selectedConversation.other_user_name === selectedConversation.buyer_id ? selectedConversation.seller_id : selectedConversation.buyer_id}
          otherUserName={selectedConversation.other_user_name || "Usuario"}
          requestAmount={selectedConversation.request_amount}
          isOpen={!!selectedConversation}
          onClose={() => {
            setSelectedConversation(null)
            loadConversations() // Recargar para actualizar contadores
          }}
        />
      )}
    </>
  )
}
