"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Send, MoreVertical, CheckCircle, AlertCircle, Clock, User, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTransactionalChat, UseTransactionalChatParams } from "@/hooks/useTransactionalChat"
import { ChatMessage, ChatMessageKind, ChatThreadStatus } from "@/lib/chat/service"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  chatParams: UseTransactionalChatParams
  className?: string
}

interface NegotiationAction {
  id: string
  label: string
  icon: React.ReactNode
  variant: "default" | "destructive" | "outline"
  disabled?: boolean
  action: string
}

const getStatusIcon = (status: ChatThreadStatus) => {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'closed':
      return <X className="h-4 w-4 text-gray-500" />
    case 'cancelled':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'disputed':
      return <AlertCircle className="h-4 w-4 text-orange-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

const getStatusLabel = (status: ChatThreadStatus) => {
  switch (status) {
    case 'active':
      return 'Activo'
    case 'closed':
      return 'Cerrado'
    case 'cancelled':
      return 'Cancelado'
    case 'disputed':
      return 'En disputa'
    default:
      return 'Desconocido'
  }
}

const getMessageKindIcon = (kind: ChatMessageKind) => {
  switch (kind) {
    case 'user':
      return <User className="h-3 w-3" />
    case 'system':
      return <CheckCircle className="h-3 w-3" />
    case 'support':
      return <Shield className="h-3 w-3" />
    default:
      return <User className="h-3 w-3" />
  }
}

const getMessageKindColor = (kind: ChatMessageKind) => {
  switch (kind) {
    case 'user':
      return 'bg-primary text-primary-foreground'
    case 'system':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'support':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

export function ChatPanel({ isOpen, onClose, chatParams, className }: ChatPanelProps) {
  const [message, setMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showOlderMessages, setShowOlderMessages] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    thread,
    messages,
    isLoading,
    isConnected,
    isSending,
    unreadCount,
    send,
    emitAction,
    loadOlder,
    markAsRead,
    close,
    setTyping,
    typingUsers,
    refresh,
    scrollToBottom
  } = useTransactionalChat(chatParams)

  // Scroll automático al recibir nuevos mensajes
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length, scrollToBottom])

  // Focus en input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Marcar como leído cuando se abre
  useEffect(() => {
    if (isOpen && thread) {
      markAsRead()
    }
  }, [isOpen, thread, markAsRead])

  // Manejar typing
  const handleTyping = useCallback((value: string) => {
    setMessage(value)
    
    if (value.length > 0 && !isTyping) {
      setIsTyping(true)
      setTyping(true)
    } else if (value.length === 0 && isTyping) {
      setIsTyping(false)
      setTyping(false)
    }

    // Limpiar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Auto-detener typing después de 2 segundos
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      setTyping(false)
    }, 2000)
  }, [isTyping, setTyping])

  const handleSend = async () => {
    if (!message.trim() || isSending) return

    const messageText = message.trim()
    setMessage("")
    setIsTyping(false)
    setTyping(false)

    await send(messageText)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAction = async (action: string) => {
    await emitAction(action)
  }

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: es 
      })
    } catch {
      return 'hace un momento'
    }
  }

  // Acciones de negociación según el contexto
  const getNegotiationActions = (): NegotiationAction[] => {
    if (!thread || thread.status !== 'active') return []

    const baseActions: NegotiationAction[] = [
      {
        id: 'mark_paid',
        label: 'Marcar pagado',
        icon: <CheckCircle className="h-4 w-4" />,
        variant: 'default',
        action: 'mark_paid'
      },
      {
        id: 'confirm_received',
        label: 'Confirmar recibido',
        icon: <CheckCircle className="h-4 w-4" />,
        variant: 'default',
        action: 'confirm_received'
      }
    ]

    if (thread.context_type === 'order') {
      baseActions.push(
        {
          id: 'request_support',
          label: 'Solicitar soporte',
          icon: <Shield className="h-4 w-4" />,
          variant: 'outline',
          action: 'request_support'
        },
        {
          id: 'open_dispute',
          label: 'Abrir disputa',
          icon: <AlertCircle className="h-4 w-4" />,
          variant: 'destructive',
          action: 'open_dispute'
        },
        {
          id: 'cancel_order',
          label: 'Cancelar orden',
          icon: <X className="h-4 w-4" />,
          variant: 'destructive',
          action: 'cancel_order'
        }
      )
    }

    return baseActions
  }

  const negotiationActions = getNegotiationActions()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn(
          "p-0 max-w-4xl h-[90vh] md:h-[80vh] flex flex-col",
          "backdrop-blur-md bg-background/95",
          className
        )}
        aria-describedby="chat-description"
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-semibold">
                {thread?.context_title || 'Chat'}
              </DialogTitle>
              {thread && (
                <div className="flex items-center gap-2">
                  {getStatusIcon(thread.status)}
                  <Badge variant="outline" className="text-xs">
                    {getStatusLabel(thread.status)}
                  </Badge>
                  {isConnected && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      En línea
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} no leídos
                </Badge>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={refresh}>
                    Actualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={markAsRead}>
                    Marcar como leído
                  </DropdownMenuItem>
                  {thread?.status === 'active' && (
                    <DropdownMenuItem onClick={() => close()} className="text-red-600">
                      Cerrar chat
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Acciones de negociación */}
        {negotiationActions.length > 0 && (
          <div className="p-3 border-b bg-muted/30 flex-shrink-0">
            <div className="flex flex-wrap gap-2">
              {negotiationActions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant}
                  size="sm"
                  onClick={() => handleAction(action.action)}
                  disabled={action.disabled || isSending}
                  className="text-xs h-8"
                >
                  {action.icon}
                  <span className="ml-1">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Área de mensajes */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>No hay mensajes aún. ¡Envía el primero!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Botón para cargar mensajes más antiguos */}
                {messages.length >= 50 && (
                  <div className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadOlder}
                      disabled={isLoading}
                    >
                      Cargar mensajes anteriores
                    </Button>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      msg.kind === 'system' && "justify-center"
                    )}
                  >
                    {msg.kind !== 'system' && (
                      <div className="flex-shrink-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                          getMessageKindColor(msg.kind)
                        )}>
                          {getMessageKindIcon(msg.kind)}
                        </div>
                      </div>
                    )}
                    
                    <div className={cn(
                      "flex-1 min-w-0",
                      msg.kind === 'system' && "text-center"
                    )}>
                      <div className={cn(
                        "inline-block max-w-[80%] p-3 rounded-lg",
                        msg.kind === 'system' 
                          ? "bg-muted text-muted-foreground text-sm"
                          : msg.kind === 'user'
                          ? "bg-primary text-primary-foreground ml-auto"
                          : "bg-muted"
                      )}>
                        <p className="text-sm">{msg.body}</p>
                        {msg.metadata && Object.keys(msg.metadata).length > 0 && (
                          <div className="mt-2 text-xs opacity-75">
                            {JSON.stringify(msg.metadata, null, 2)}
                          </div>
                        )}
                      </div>
                      
                      <div className={cn(
                        "text-xs text-muted-foreground mt-1",
                        msg.kind === 'user' && "text-right"
                      )}>
                        {formatTimeAgo(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Indicador de typing */}
                {typingUsers.length > 0 && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <div className="animate-pulse">...</div>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        {typingUsers.length === 1 ? 'Escribiendo...' : 'Varios usuarios escribiendo...'}
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Input de mensaje */}
        {thread?.status === 'active' && (
          <div className="p-4 border-t flex-shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                disabled={isSending}
                className="flex-1"
                maxLength={4000}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || isSending}
                size="sm"
                className="px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            {message.length > 3500 && (
              <p className="text-xs text-muted-foreground mt-1">
                {message.length}/4000 caracteres
              </p>
            )}
          </div>
        )}

        {/* Footer con estado */}
        <div className="px-4 py-2 border-t bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )} />
              {isConnected ? 'Conectado' : 'Desconectado'}
            </div>
            
            {thread && (
              <div>
                Contexto: {thread.context_type} - {thread.context_id}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


