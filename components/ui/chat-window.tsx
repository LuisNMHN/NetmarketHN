"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  sendChatMessage,
  getConversationMessages,
  markMessagesAsRead,
  updateUserOnlineStatus,
  getOnlineUsers,
  type ChatMessage,
  type OnlineUser
} from "@/lib/actions/chat"
import { 
  Send, 
  Paperclip, 
  Smile, 
  Circle, 
  Check, 
  CheckCheck,
  Clock,
  DollarSign,
  User,
  MessageSquare
} from "lucide-react"

interface ChatWindowProps {
  requestId: string
  otherUserId: string
  otherUserName: string
  otherUserEmail: string
  requestAmount: number
  isOpen: boolean
  onClose: () => void
  className?: string
}

export function ChatWindow({
  requestId,
  otherUserId,
  otherUserName,
  otherUserEmail,
  requestAmount,
  isOpen,
  onClose,
  className
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadMessages = async () => {
    if (!isOpen) return
    
    setLoading(true)
    try {
      // Obtener conversación (simulada por ahora)
      const conversationId = `conv_${requestId}_${otherUserId}`
      const result = await getConversationMessages(conversationId, 50, 0)
      
      if (result.success && result.data) {
        setMessages(result.data.reverse()) // Invertir para mostrar más recientes abajo
        scrollToBottom()
        
        // Marcar mensajes como leídos
        await markMessagesAsRead(conversationId)
      }
    } catch (error) {
      console.error('❌ Error cargando mensajes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOnlineUsers = async () => {
    try {
      const result = await getOnlineUsers()
      if (result.success && result.data) {
        setOnlineUsers(result.data)
        setIsOtherUserOnline(result.data.some(user => user.user_id === otherUserId))
      }
    } catch (error) {
      console.error('❌ Error cargando usuarios en línea:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const result = await sendChatMessage(
        requestId,
        otherUserId,
        newMessage.trim(),
        'text'
      )

      if (result.success) {
        setNewMessage("")
        await loadMessages() // Recargar mensajes
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return "Ahora"
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`
    return date.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
  }

  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case 'offer':
        return <DollarSign className="h-4 w-4 text-green-600" />
      case 'system':
        return <MessageSquare className="h-4 w-4 text-blue-600" />
      default:
        return null
    }
  }

  const getReadStatus = (message: ChatMessage) => {
    if (message.is_read) {
      return <CheckCheck className="h-4 w-4 text-blue-600" />
    }
    return <Check className="h-4 w-4 text-gray-400" />
  }

  useEffect(() => {
    if (isOpen) {
      loadMessages()
      loadOnlineUsers()
      updateUserOnlineStatus(requestId, true)
      
      // Recargar mensajes cada 5 segundos
      const interval = setInterval(() => {
        loadMessages()
        loadOnlineUsers()
      }, 5000)
      
      return () => {
        clearInterval(interval)
        updateUserOnlineStatus(requestId, false)
      }
    }
  }, [isOpen, requestId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 ${className}`}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`/api/avatar/${otherUserId}`} />
              <AvatarFallback>
                {otherUserName?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold">{otherUserName}</h3>
                {isOtherUserOnline && (
                  <div className="flex items-center space-x-1">
                    <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                    <span className="text-xs text-green-600">En línea</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{otherUserEmail}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="flex items-center space-x-1">
              <DollarSign className="h-3 w-3" />
              <span>L.{requestAmount.toFixed(2)}</span>
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando mensajes...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay mensajes aún</p>
                <p className="text-sm text-muted-foreground">Envía el primer mensaje para comenzar la conversación</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === otherUserId ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[70%] ${message.sender_id === otherUserId ? 'order-1' : 'order-2'}`}>
                    {message.sender_id === otherUserId && (
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium">{message.sender_name}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
                      </div>
                    )}
                    
                    <div
                      className={`p-3 rounded-lg ${
                        message.sender_id === otherUserId
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {getMessageIcon(message.message_type)}
                        <div className="flex-1">
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                          {message.metadata && message.message_type === 'offer' && (
                            <div className="mt-2 p-2 bg-background/50 rounded text-xs">
                              <p><strong>Monto:</strong> L.{message.metadata.offered_amount?.toFixed(2)}</p>
                              {message.metadata.terms && (
                                <p><strong>Términos:</strong> {message.metadata.terms}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {message.sender_id !== otherUserId && (
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
                        {getReadStatus(message)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <Textarea
                placeholder="Escribe tu mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="min-h-[60px] max-h-[120px] resize-none"
                disabled={sending}
              />
            </div>
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" disabled={sending}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" disabled={sending}>
                <Smile className="h-4 w-4" />
              </Button>
              <Button 
                onClick={handleSendMessage} 
                disabled={!newMessage.trim() || sending}
                size="sm"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Presiona Enter para enviar, Shift+Enter para nueva línea</span>
            <div className="flex items-center space-x-1">
              {isOtherUserOnline ? (
                <>
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  <span>En línea</span>
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  <span>Última vez: {onlineUsers.find(u => u.user_id === otherUserId)?.last_seen ? formatTime(onlineUsers.find(u => u.user_id === otherUserId)!.last_seen) : 'Desconocido'}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
