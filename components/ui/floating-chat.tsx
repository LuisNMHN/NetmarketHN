"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { type Conversation } from "@/lib/actions/chat"
import supabaseBrowser from "@/lib/supabase/client"
import { SimpleChatModal } from "./simple-chat-modal"
import { 
  MessageSquare, 
  X, 
  Minimize2, 
  Maximize2,
  Circle,
  Clock,
  Trash2
} from "lucide-react"

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFullChat, setShowFullChat] = useState(false)
  const { toast } = useToast()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [clearingNotifications, setClearingNotifications] = useState(false)
  const subscriptionRef = useRef<ReturnType<typeof supabaseBrowser>['channel'] | null>(null)

  const loadConversations = async () => {
    if (!currentUserId) return
    
    setLoading(true)
    try {
      const supabase = supabaseBrowser()

      // Obtener conversaciones reales basadas en mensajes de chat
      const { data, error } = await supabase
        .from('purchase_chat_messages')
        .select(`
          request_id,
          sender_id,
          receiver_id,
          created_at,
          is_read,
          purchase_requests(
            id,
            buyer_id,
            seller_id,
            amount
          )
        `)
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('❌ Error obteniendo conversaciones:', error)
        return
      }

      console.log('📊 Mensajes obtenidos:', data?.length || 0)
      console.log('📊 Primer mensaje:', data?.[0])

      // Agrupar por request_id
      const conversationMap = new Map()
      const userIds = new Set()
      
      for (const msg of data || []) {
        const requestId = msg.request_id
        const otherUserId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id
        userIds.add(otherUserId)
        
        // Validar que los datos de purchase_requests estén disponibles
        if (!msg.purchase_requests || !msg.purchase_requests.buyer_id) {
          console.warn('⚠️ Datos de purchase_requests incompletos para request_id:', msg.request_id)
          console.warn('⚠️ purchase_requests:', msg.purchase_requests)
          continue
        }
        
        if (!conversationMap.has(requestId)) {
          conversationMap.set(requestId, {
            id: `conv_${requestId}`,
            request_id: requestId,
            buyer_id: msg.purchase_requests.buyer_id,
            seller_id: msg.purchase_requests.seller_id || otherUserId, // Usar otherUserId si seller_id es null
            other_user_id: otherUserId,
            other_user_name: 'Usuario', // Temporal, se actualizará después
            request_amount: msg.purchase_requests.amount,
            last_message_at: msg.created_at,
            unread_count: 0,
            is_active: true,
            created_at: msg.created_at
          })
        }

        // Contar mensajes no leídos
        const conv = conversationMap.get(requestId)
        if (msg.receiver_id === currentUserId && !msg.is_read) {
          conv.unread_count++
        }
      }

      // Obtener nombres de usuarios en una sola consulta
      if (userIds.size > 0) {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', Array.from(userIds))

        const userMap = new Map(users?.map(u => [u.user_id, u.display_name]) || [])

        // Actualizar nombres de usuarios
        for (const conv of conversationMap.values()) {
          conv.other_user_name = userMap.get(conv.other_user_id) || 'Usuario'
        }
      }

      const list: Conversation[] = Array.from(conversationMap.values())
      // Ordenar por último mensaje
      list.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      setConversations(list)
      setUnreadCount(list.reduce((total, conv) => total + (conv.unread_count || 0), 0))
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

  const handleClearNotifications = async () => {
    if (!currentUserId || clearingNotifications) return

    const confirmed = window.confirm(
      '¿Estás seguro de que quieres marcar todas las conversaciones como leídas? Esto eliminará todas las notificaciones.'
    )

    if (!confirmed) return

    setClearingNotifications(true)
    try {
      const supabase = supabaseBrowser()
      
      // Marcar todos los mensajes no leídos como leídos para el usuario actual
      const { error } = await supabase
        .from('purchase_chat_messages')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('receiver_id', currentUserId)
        .eq('is_read', false)

      if (error) {
        throw error
      }

      // Actualizar contadores localmente
      setUnreadCount(0)
      setConversations(prev => prev.map(conv => ({ ...conv, unread_count: 0 })))
      
      toast({
        title: "✅ Notificaciones eliminadas",
        description: "Todas las conversaciones han sido marcadas como leídas",
      })
    } catch (error) {
      console.error('❌ Error eliminando notificaciones:', error)
      toast({
        title: "❌ Error",
        description: "No se pudieron eliminar las notificaciones",
        variant: "destructive",
      })
    } finally {
      setClearingNotifications(false)
    }
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

  // Obtener currentUserId al cargar el componente
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = supabaseBrowser()
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      setCurrentUserId(userId || null)
    }
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUserId) {
      loadConversations()
    }
  }, [currentUserId])

  // Cerrar panel al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen) {
        const target = event.target as Element
        const panel = document.querySelector('[data-floating-chat-panel]')
        const button = document.querySelector('[data-floating-chat-button]')
        
        // No cerrar si se hace clic en el panel o en el botón flotante
        if (panel && !panel.contains(target) && button && !button.contains(target)) {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Suscripción Realtime para actualizar conversaciones automáticamente
  useEffect(() => {
    if (!currentUserId) return

    const supabase = supabaseBrowser()
    console.log('🔄 Iniciando suscripción Realtime para conversaciones')

    const channel = supabase
      .channel('floating-chat-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'purchase_chat_messages',
        filter: `receiver_id=eq.${currentUserId}`
      }, (payload) => {
        console.log('📨 Nuevo mensaje recibido, actualizando conversaciones')
        // Recargar conversaciones cuando llega un mensaje nuevo
        loadConversations()
      })
      .subscribe((status) => {
        console.log('📡 Estado de suscripción conversaciones:', status)
      })

    subscriptionRef.current = channel

    return () => {
      console.log('🔄 Limpiando suscripción conversaciones')
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [currentUserId])


  return (
    <>
      {/* Botón Flotante */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          data-floating-chat-button
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
        <div 
          data-floating-chat-panel
          className="fixed bottom-20 sm:bottom-24 right-3 sm:right-6 z-40 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm h-[60vh] sm:h-[500px] bg-background border border-border rounded-lg shadow-2xl"
        >
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
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearNotifications}
                  disabled={clearingNotifications}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  title="Eliminar todas las notificaciones"
                >
                  {clearingNotifications ? (
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-primary border-t-transparent" />
                  ) : (
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullChat(true)}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                title="Abrir chat completo"
              >
                <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4" />
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
        </div>
      )}

      {/* Chat Modal */}
      {selectedConversation && currentUserId && (
        <SimpleChatModal
          requestId={selectedConversation.request_id}
          otherUserId={currentUserId === selectedConversation.buyer_id ? selectedConversation.seller_id : selectedConversation.buyer_id}
          otherUserName={selectedConversation.other_user_name || "Usuario"}
          requestAmount={selectedConversation.request_amount}
          isOpen={!!selectedConversation}
          onClose={() => {
            setSelectedConversation(null)
            loadConversations() // Recargar para actualizar contadores
          }}
        />
      )}

      {/* Modal de Chat Completo */}
      {showFullChat && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/50 rounded-t-lg">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Chat Completo</h2>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} no leídos
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearNotifications}
                    disabled={clearingNotifications}
                    className="h-8 w-8 p-0"
                    title="Eliminar todas las notificaciones"
                  >
                    {clearingNotifications ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullChat(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Cargando conversaciones...</p>
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay conversaciones</h3>
                    <p className="text-sm text-muted-foreground">Inicia una conversación desde una solicitud</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-full p-4">
                  <div className="space-y-3">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        onClick={() => {
                          setSelectedConversation(conversation)
                          setShowFullChat(false)
                        }}
                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-border"
                      >
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={`/api/avatar/${conversation.other_user_name}`} />
                          <AvatarFallback className="text-sm">
                            {conversation.other_user_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">
                              {conversation.other_user_name || "Usuario"}
                            </p>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                              {conversation.unread_count > 0 && (
                                <Badge variant="destructive" className="text-xs h-5 w-5 p-0 flex items-center justify-center">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            Solicitud: L.{conversation.request_amount.toFixed(0)}
                          </p>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="truncate">{formatTimeAgo(conversation.last_message_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                💡 Haz clic en una conversación para abrir el chat completo
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
