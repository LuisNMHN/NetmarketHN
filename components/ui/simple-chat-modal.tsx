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
  Send,
  Trash2
} from "lucide-react"
import supabaseBrowser from "@/lib/supabase/client"

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
  const supabase = supabaseBrowser()
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Obtener currentUserId al montar el componente
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      setCurrentUserId(userId || null)
    }
    getCurrentUser()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return

    const messageToSend = newMessage.trim()
    setNewMessage("")
    setSending(true)
    
    // Validar datos antes de continuar
    if (!requestId || !otherUserId) {
      console.error('❌ Datos de conversación incompletos:', { requestId, otherUserId })
      setNewMessage(messageToSend)
      setSending(false)
      toast({
        title: "❌ Error",
        description: "Datos de conversación incompletos",
        variant: "destructive",
      })
      return
    }
    
    let tempId = `tmp_${Date.now()}`
    
    try {
      if (!currentUserId) {
        throw new Error("Usuario no autenticado")
      }

      // Optimista
      const optimisticMsg = {
        id: tempId,
        message: messageToSend,
        sender_id: currentUserId,
        receiver_id: otherUserId,
        created_at: new Date().toISOString(),
        sender_name: 'Tú'
      }
      setMessages(prev => [...prev, optimisticMsg])
      scrollToBottom()

      // Insertar en la tabla real
      const { data, error } = await supabase
        .from('purchase_chat_messages')
        .insert({
          request_id: requestId,
          sender_id: currentUserId,
          receiver_id: otherUserId,
          message: messageToSend,
          message_type: 'text',
        })
        .select('id')

      if (error) {
        console.error('Error de Supabase:', error)
        throw new Error(`Error de base de datos: ${error.message || 'Error desconocido'}`)
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo insertar el mensaje - respuesta vacía')
      }

      // Reemplazar mensaje optimista con el real
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...msg, id: data[0].id }
          : msg
      ))
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      setNewMessage(messageToSend) // Restaurar mensaje
      
      // Remover mensaje optimista si falló
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
      
      // Manejo seguro del error
      let errorMessage = "No se pudo enviar el mensaje"
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message)
      }
      
      toast({
        title: "❌ Error",
        description: errorMessage,
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

  const handleDeleteHistory = async () => {
    if (!currentUserId || deleting) return

    const confirmed = window.confirm(
      '¿Estás seguro de que quieres eliminar todo el historial de mensajes? Esta acción no se puede deshacer.'
    )

    if (!confirmed) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('purchase_chat_messages')
        .update({ 
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('request_id', requestId)
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)

      if (error) {
        throw error
      }

      // Limpiar mensajes localmente
      setMessages([])
      
      toast({
        title: "✅ Historial eliminado",
        description: "Todos los mensajes han sido eliminados",
      })
    } catch (error) {
      console.error('❌ Error eliminando historial:', error)
      toast({
        title: "❌ Error",
        description: "No se pudo eliminar el historial",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Cargar mensajes iniciales cuando se abre
  useEffect(() => {
    if (!isOpen) return

    const load = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id || ''
        setCurrentUserId(userId)
        
        const { data, error } = await supabase
          .from('purchase_chat_messages')
          .select(`
            id, 
            sender_id, 
            receiver_id, 
            message, 
            created_at,
            user_profiles!sender_id(
              display_name
            )
          `)
          .eq('request_id', requestId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true })

        if (error) throw error

        const mapped = (data || []).map((m: any) => ({
          id: m.id,
          message: m.message,
          sender_id: m.sender_id,
          receiver_id: m.receiver_id,
          created_at: m.created_at,
          sender_name: m.sender_id === userId ? 'Tú' : (m.user_profiles?.display_name || 'Usuario'),
        }))
        setMessages(mapped)
        scrollToBottom()
      } catch (e) {
        console.error('❌ Error cargando mensajes:', e)
      }
    }

    load()
  }, [isOpen, requestId, otherUserName, supabase])

  // Suscripción realtime por request_id
  useEffect(() => {
    if (!isOpen || !currentUserId) {
      console.log('🚫 Suscripción Realtime no iniciada:', { isOpen, currentUserId })
      return
    }

    console.log('🔄 Iniciando suscripción Realtime para requestId:', requestId)
    
    const channel = supabase
      .channel(`chat-${requestId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'purchase_chat_messages',
        filter: `request_id=eq.${requestId}`
      }, (payload) => {
        const newRow: any = payload.new
        console.log('📨 Nuevo mensaje recibido via Realtime:', newRow)
        
        // Solo procesar mensajes que NO sean del usuario actual
        // (el usuario actual ya ve su mensaje optimista)
        if (newRow.sender_id === currentUserId) {
          console.log('🚫 Ignorando mensaje propio en Realtime:', newRow.id)
          return
        }
        
        // Evitar duplicados verificando si el mensaje ya existe
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === newRow.id)
          if (exists) {
            console.log('⚠️ Mensaje duplicado ignorado:', newRow.id)
            return prev
          }
          
          console.log('✅ Agregando nuevo mensaje de otro usuario:', newRow.id)
          
          // Obtener el nombre real del usuario
          const getSenderName = async () => {
            try {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('user_id', newRow.sender_id)
                .single()
              
              return profile?.display_name || 'Usuario'
            } catch {
              return 'Usuario'
            }
          }
          
          // Actualizar el mensaje con el nombre real
          getSenderName().then(senderName => {
            setMessages(currentMessages => 
              currentMessages.map(msg => 
                msg.id === newRow.id 
                  ? { ...msg, sender_name: senderName }
                  : msg
              )
            )
          })
          
          return [...prev, {
            id: newRow.id,
            message: newRow.message,
            sender_id: newRow.sender_id,
            receiver_id: newRow.receiver_id,
            created_at: newRow.created_at,
            sender_name: 'Cargando...' // Temporal hasta obtener el nombre real
          }]
        })
        scrollToBottom()
      })
      .subscribe((status) => {
        console.log('📡 Estado de suscripción Realtime:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción Realtime activa para requestId:', requestId)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en canal Realtime')
        }
      })

    subscriptionRef.current = channel

    return () => {
      console.log('🔄 Limpiando suscripción Realtime')
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [isOpen, requestId, currentUserId, otherUserName, supabase])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="w-full h-full max-w-none max-h-none p-0 m-0 rounded-none sm:w-[95vw] sm:max-w-4xl sm:h-[85vh] sm:rounded-lg sm:m-4 flex flex-col">
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
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDeleteHistory}
                disabled={deleting || messages.length === 0}
                className="text-primary-foreground hover:bg-primary-foreground/20"
                title="Eliminar historial de mensajes"
              >
                {deleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
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
