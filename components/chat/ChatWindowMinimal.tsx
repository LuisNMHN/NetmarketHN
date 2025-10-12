"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  MessageSquare, 
  X, 
  Send, 
  MoreVertical,
  RotateCcw
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

interface ChatWindowMinimalProps {
  isOpen: boolean
  onClose: () => void
  globalUnreadCount: number
  onUnreadCountChange: (count: number) => void
}

export default function ChatWindowMinimal({ isOpen, onClose, globalUnreadCount, onUnreadCountChange }: ChatWindowMinimalProps) {
  const [activeView, setActiveView] = useState<'conversations' | 'chat'>('conversations')
  const [messageInput, setMessageInput] = useState('')
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = supabaseBrowser()

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
        setCurrentUserId(session.user.id)
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

  // Cargar conversaciones (versión simplificada)
  useEffect(() => {
    if (!isInitialized || !canUseChat) return

    const loadConversations = async () => {
      setLoading(true)
      setError(null)

      try {
        // Verificar si las tablas existen primero
        const { data: tables } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .in('table_name', ['chat_conversations', 'chat_conversation_participants', 'chat_messages'])

        if (!tables || tables.length < 3) {
          setError('Las tablas del chat no están configuradas. Ejecuta INSTALL_CHAT_SYSTEM.sql primero.')
          return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // Intentar cargar conversaciones
        const { data: conversationsData, error: conversationsError } = await supabase
          .from('chat_conversations')
          .select(`
            id,
            solicitud_id,
            created_at,
            updated_at
          `)
          .order('updated_at', { ascending: false })
          .limit(10)

        if (conversationsError) {
          console.error('Error específico:', conversationsError)
          throw conversationsError
        }

        // Simular datos para testing
        const mockConversations = [
          {
            id: 'test-1',
            solicitud_id: 'solicitud-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            participants: [
              {
                conversation_id: 'test-1',
                user_id: currentUserId,
                last_read_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                user_name: 'Usuario Test',
                user_avatar: null
              }
            ],
            last_message: {
              id: 'msg-1',
              conversation_id: 'test-1',
              sender_id: 'other-user',
              body: 'Hola, ¿cómo estás?',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_author_deleted: false,
              sender_name: 'Usuario Test',
              sender_avatar: null
            },
            unread_count: 1
          }
        ]

        setConversations(mockConversations)
        onUnreadCountChange(1)
      } catch (error) {
        console.error('Error cargando conversaciones:', error)
        console.error('Detalles del error:', JSON.stringify(error, null, 2))
        setError(`Error cargando conversaciones: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [isInitialized, canUseChat, supabase, currentUserId, onUnreadCountChange])

  // Seleccionar conversación
  const handleSelectConversation = async (conversation: any) => {
    setActiveView('chat')
    
    // Simular mensajes para testing
    const mockMessages = [
      {
        id: 'msg-1',
        conversation_id: conversation.id,
        sender_id: 'other-user',
        body: 'Hola, ¿cómo estás?',
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date(Date.now() - 60000).toISOString(),
        is_author_deleted: false,
        sender_name: 'Usuario Test',
        sender_avatar: null
      },
      {
        id: 'msg-2',
        conversation_id: conversation.id,
        sender_id: currentUserId,
        body: 'Hola! Estoy bien, gracias por preguntar.',
        created_at: new Date(Date.now() - 30000).toISOString(),
        updated_at: new Date(Date.now() - 30000).toISOString(),
        is_author_deleted: false,
        sender_name: 'Tú',
        sender_avatar: null
      }
    ]
    
    setMessages(mockMessages)
  }

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!messageInput.trim()) return

    const messageText = messageInput.trim()
    setMessageInput('')

    try {
      // Simular envío de mensaje
      const newMessage = {
        id: `msg-${Date.now()}`,
        conversation_id: 'test-1',
        sender_id: currentUserId,
        body: messageText,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_author_deleted: false,
        sender_name: 'Tú',
        sender_avatar: null
      }

      setMessages(prev => [...prev, newMessage])
      toast.success('Mensaje enviado (modo demo)')
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      toast.error('Error enviando mensaje')
      setMessageInput(messageText)
    }
  }

  // Manejar tecla Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
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
            <h2 className="text-lg font-semibold">Chat (Modo Demo)</h2>
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
                {error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {error}
                  </div>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {loading ? (
                    <div className="text-center py-8">Cargando conversaciones...</div>
                  ) : error ? (
                    <div className="text-center py-8 text-red-500">
                      <p>{error}</p>
                      <p className="text-xs mt-2">Ejecuta INSTALL_CHAT_SYSTEM.sql para configurar el chat</p>
                    </div>
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
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">Usuario Test</p>
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
                    <DropdownMenuItem>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Limpiar historial
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mensajes */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isCurrentUser = message.sender_id === currentUserId
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                          <div className={`p-3 rounded-lg ${
                            isCurrentUser 
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
                        {!isCurrentUser && (
                          <Avatar className="h-6 w-6 order-1 mr-2">
                            <AvatarImage src={message.sender_avatar} />
                            <AvatarFallback>
                              {message.sender_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Input de mensaje */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe un mensaje... (modo demo)"
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
