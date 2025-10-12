"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  MessageSquare, 
  X, 
  Send, 
  Paperclip, 
  MoreVertical,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ChatWindowSimpleProps {
  isOpen: boolean
  onClose: () => void
  globalUnreadCount: number
  onUnreadCountChange: (count: number) => void
}

interface ChatConversation {
  id: string
  solicitud_id: string
  created_at: string
  updated_at: string
  participants: ChatParticipant[]
  last_message?: ChatMessage
  unread_count: number
}

interface ChatParticipant {
  conversation_id: string
  user_id: string
  last_read_at: string
  cleared_at?: string
  created_at: string
  user_name?: string
  user_avatar?: string
}

interface ChatMessage {
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

export default function ChatWindowSimple({ isOpen, onClose, globalUnreadCount, onUnreadCountChange }: ChatWindowSimpleProps) {
  const [activeView, setActiveView] = useState<'conversations' | 'chat'>('conversations')
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout>()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const supabase = supabaseBrowser()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Verificar rol del usuario
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setUserRole(null)
          setIsInitialized(true)
          return
        }

        const { data: userRoles } = await supabase
          .from('user_roles')
          .select(`
            role_id,
            roles!inner(name)
          `)
          .eq('user_id', session.user.id)
          .maybeSingle()

        const role = (userRoles as any)?.roles?.name === 'admin' ? 'admin' : 'user'
        setUserRole(role)
        setIsInitialized(true)
      } catch (error) {
        console.error('Error verificando rol:', error)
        setUserRole(null)
        setIsInitialized(true)
      }
    }

    checkUserRole()
  }, [supabase])

  // Solo usuarios con rol 'user' pueden usar el chat
  const canUseChat = userRole === 'user'

  // Cargar conversaciones
  useEffect(() => {
    if (!isInitialized || !canUseChat) return

    const loadConversations = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data, error } = await supabase.rpc('get_chat_conversations')
        if (error) throw error

        setConversations(data || [])
      } catch (error) {
        console.error('Error cargando conversaciones:', error)
        setError('Error cargando conversaciones')
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [isInitialized, canUseChat, supabase])

  // Actualizar contador global cuando cambien las conversaciones
  useEffect(() => {
    if (!isInitialized) return
    const totalUnread = conversations.reduce((total, conv) => total + conv.unread_count, 0)
    onUnreadCountChange(totalUnread)
  }, [conversations, onUnreadCountChange, isInitialized])

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }
    }
  }, [typingTimeout])

  // Seleccionar conversación
  const handleSelectConversation = async (conversation: ChatConversation) => {
    setSelectedConversation(conversation)
    setActiveView('chat')
    
    // Cargar mensajes de la conversación
    try {
      const { data, error } = await supabase.rpc('get_chat_messages', {
        p_conversation_id: conversation.id
      })
      if (error) throw error
      
      setMessages(data || [])
      
      // Marcar mensajes como leídos
      await supabase.rpc('mark_chat_messages_read', {
        p_conversation_id: conversation.id
      })
    } catch (error) {
      console.error('Error cargando mensajes:', error)
      toast.error('Error cargando mensajes')
    }
  }

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return

    const messageText = messageInput.trim()
    setMessageInput('')

    try {
      const { data, error } = await supabase.rpc('send_chat_message', {
        p_conversation_id: selectedConversation.id,
        p_body: messageText
      })
      
      if (error) throw error
      
      // El mensaje se agregará automáticamente via Realtime
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      toast.error('Error enviando mensaje')
      setMessageInput(messageText) // Restaurar el texto
    }
  }

  // Manejar tecla Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Limpiar historial
  const handleClearHistory = async () => {
    if (!selectedConversation) return
    
    if (confirm('¿Estás seguro de que quieres limpiar el historial de esta conversación?')) {
      try {
        const { error } = await supabase.rpc('clear_chat_history', {
          p_conversation_id: selectedConversation.id
        })
        if (error) throw error
        
        toast.success('Historial limpiado')
      } catch (error) {
        console.error('Error limpiando historial:', error)
        toast.error('Error limpiando historial')
      }
    }
  }

  // Eliminar mensaje
  const handleDeleteMessage = async (messageId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
      try {
        const { error } = await supabase.rpc('delete_own_chat_message', {
          p_message_id: messageId
        })
        if (error) throw error
        
        toast.success('Mensaje eliminado')
      } catch (error) {
        console.error('Error eliminando mensaje:', error)
        toast.error('Error eliminando mensaje')
      }
    }
  }

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true, 
      locale: es 
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Chat</h2>
            {globalUnreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {globalUnreadCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {activeView === 'conversations' ? (
            /* Lista de conversaciones */
            <div className="w-full flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-medium">Conversaciones</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {loading ? (
                    <div className="text-center py-8">Cargando conversaciones...</div>
                  ) : error ? (
                    <div className="text-center py-8 text-red-500">{error}</div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay conversaciones
                    </div>
                  ) : (
                    conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        onClick={() => handleSelectConversation(conversation)}
                        className="p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={conversation.participants[0]?.user_avatar} />
                            <AvatarFallback>
                              {conversation.participants[0]?.user_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium truncate">
                                {conversation.participants[0]?.user_name || 'Usuario'}
                              </p>
                              {conversation.unread_count > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {conversation.last_message?.body || 'Sin mensajes'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            /* Chat individual */
            <div className="w-full flex flex-col">
              {/* Header del chat */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveView('conversations')}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedConversation?.participants[0]?.user_avatar} />
                    <AvatarFallback>
                      {selectedConversation?.participants[0]?.user_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {selectedConversation?.participants[0]?.user_name || 'Usuario'}
                    </p>
                    <p className="text-xs text-muted-foreground">En línea</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleClearHistory}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Limpiar historial
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mensajes */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === 'current_user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${message.sender_id === 'current_user' ? 'order-2' : 'order-1'}`}>
                        <div className={`p-3 rounded-lg ${
                          message.sender_id === 'current_user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          {message.is_author_deleted ? (
                            <p className="text-sm italic">Mensaje eliminado</p>
                          ) : (
                            <p className="text-sm">{message.body}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(message.created_at)}
                        </p>
                      </div>
                      {message.sender_id !== 'current_user' && (
                        <Avatar className="h-6 w-6 order-1 mr-2">
                          <AvatarImage src={message.sender_avatar} />
                          <AvatarFallback>
                            {message.sender_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input de mensaje */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe un mensaje..."
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
