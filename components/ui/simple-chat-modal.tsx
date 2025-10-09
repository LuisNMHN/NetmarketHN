"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { 
  X, 
  Send
} from "lucide-react"

interface SimpleChatModalProps {
  isOpen: boolean
  onClose: () => void
  requestId: string
  otherUserId: string
  otherUserName: string
  requestAmount: number
}

export function SimpleChatModal({
  isOpen,
  onClose,
  requestId,
  otherUserId,
  otherUserName,
  requestAmount
}: SimpleChatModalProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return

    const messageToSend = newMessage.trim()
    setNewMessage("")
    setSending(true)
    
    try {
      // Simular envío de mensaje
      const newMsg = {
        id: Date.now().toString(),
        message: messageToSend,
        sender_id: 'current-user',
        created_at: new Date().toISOString(),
        sender_name: 'Tú'
      }
      
      setMessages(prev => [...prev, newMsg])
      scrollToBottom()
      
      // Simular respuesta del servidor
      setTimeout(() => {
        const responseMsg = {
          id: (Date.now() + 1).toString(),
          message: `Respuesta a: ${messageToSend}`,
          sender_id: otherUserId,
          created_at: new Date().toISOString(),
          sender_name: otherUserName
        }
        setMessages(prev => [...prev, responseMsg])
        scrollToBottom()
      }, 1000)
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      setNewMessage(messageToSend) // Restaurar mensaje
      toast({
        title: "❌ Error",
        description: "No se pudo enviar el mensaje",
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
    return date.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full h-full max-w-none max-h-none p-0 m-0 rounded-none sm:w-[95vw] sm:max-w-4xl sm:h-[85vh] sm:rounded-lg sm:m-4 flex flex-col">
        {/* Header */}
        <div className="bg-primary p-4 sm:p-6 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold">
                Chat con {otherUserName}
              </DialogTitle>
              <p className="text-primary-foreground/80 text-sm">
                Solicitud: L.{requestAmount.toFixed(2)}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose} 
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 bg-muted/30 p-4 sm:p-6 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-xl font-bold mb-2">No hay mensajes aún</h3>
                <p className="text-muted-foreground">Envía el primer mensaje para comenzar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === otherUserId ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] ${message.sender_id === otherUserId ? 'order-1' : 'order-2'}`}>
                    {message.sender_id === otherUserId && (
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-semibold">{message.sender_name}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
                      </div>
                    )}
                    
                    <div
                      className={`p-3 rounded-lg ${
                        message.sender_id === otherUserId
                          ? 'bg-background text-foreground border border-border'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                    </div>
                    
                    {message.sender_id !== otherUserId && (
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-background border-t border-border p-4 sm:p-6">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <Textarea
                placeholder="💬 Escribe tu mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="min-h-[60px] max-h-[120px] resize-none text-base border-2 focus:border-primary rounded-xl p-4"
                disabled={sending}
              />
            </div>
            <Button 
              onClick={handleSendMessage} 
              disabled={!newMessage.trim() || sending}
              className="h-12 w-12 rounded-xl"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
            <span>Enter: enviar • Shift+Enter: nueva línea</span>
            <div className="flex items-center space-x-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-700 dark:text-green-400">En vivo</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
