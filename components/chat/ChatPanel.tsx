"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Send, Cat, Dog, Fish, Bird, Rabbit, Turtle, Heart, Star, Zap, Circle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useTransactionalChat, UseTransactionalChatParams } from "@/hooks/useTransactionalChat"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { supabaseBrowser } from "@/lib/supabase/client"

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  chatParams: UseTransactionalChatParams
  className?: string
  requestInfo?: {
    amount: number
    paymentMethod: string
    uniqueCode?: string
    currency?: string
  }
}

export function ChatPanel({ isOpen, onClose, chatParams, className, requestInfo }: ChatPanelProps) {
  // Avatares de animales disponibles
  const animalAvatars = {
    cat: { name: 'Gato', icon: Cat, color: '#f59e0b' },
    dog: { name: 'Perro', icon: Dog, color: '#ef4444' },
    bird: { name: 'Pájaro', icon: Bird, color: '#8b5cf6' },
    fish: { name: 'Pez', icon: Fish, color: '#06b6d4' },
    rabbit: { name: 'Conejo', icon: Rabbit, color: '#ec4899' },
    turtle: { name: 'Tortuga', icon: Turtle, color: '#10b981' },
    heart: { name: 'Corazón', icon: Heart, color: '#ec4899' },
    star: { name: 'Estrella', icon: Star, color: '#fbbf24' },
    zap: { name: 'Rayo', icon: Zap, color: '#f59e0b' },
    circle: { name: 'Círculo', icon: Circle, color: '#6b7280' },
    alert: { name: 'Alerta', icon: AlertTriangle, color: '#ef4444' }
  }
  
  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'local_transfer':
        return 'Transferencia Local'
      case 'international_transfer':
        return 'Transferencia Internacional'
      case 'card':
        return 'Tarjeta de Crédito/Débito'
      case 'digital_balance':
        return 'Saldo Digital'
      default:
        return method
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-HN').format(amount)
  }

  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'USD':
        return 'USD'
      case 'EUR':
        return 'EUR'
      default:
        return 'L.'
    }
  }
  
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userProfiles, setUserProfiles] = useState<Record<string, { avatar_url: string | null, full_name: string | null }>>({})
  const userProfilesRef = useRef<Record<string, { avatar_url: string | null, full_name: string | null }>>({})

  const scrollToBottomLocal = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  const {
    thread,
    messages,
    isLoading,
    isSending,
    send,
    markAsRead,
    close,
    refresh
  } = useTransactionalChat(chatParams)

  // Obtener userId del usuario actual
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseBrowser().auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getUser()
  }, [])

  // Cargar perfiles de usuarios cuando cambian los mensajes
  useEffect(() => {
    const loadUserProfiles = async () => {
      if (messages.length === 0) return
      
      const userIds = [...new Set(messages.map(msg => msg.sender_id))]
      
      // Filtrar IDs que ya tenemos usando el ref
      const missingIds = userIds.filter(id => !userProfilesRef.current[id])
      
      if (missingIds.length === 0) return
      
      console.log('🔍 Cargando perfiles de usuarios:', missingIds)
      console.log('📊 Total de mensajes:', messages.length)
      console.log('👥 IDs únicos de usuarios:', userIds)
      
      try {
        const { data: profiles, error } = await supabaseBrowser()
          .from('user_profiles')
          .select('user_id, avatar_url, display_name')
          .in('user_id', missingIds)
        
        if (error) {
          console.error('❌ Error cargando perfiles:', error)
          return
        }
        
        console.log('✅ Perfiles cargados:', profiles)
        
        if (profiles) {
          const newProfiles: Record<string, { avatar_url: string | null, full_name: string | null }> = {}
          profiles.forEach(profile => {
            console.log('📝 Perfil:', {
              user_id: profile.user_id,
              avatar_url: profile.avatar_url,
              display_name: profile.display_name
            })
            newProfiles[profile.user_id] = {
              avatar_url: profile.avatar_url,
              full_name: profile.display_name
            }
          })
          
          console.log('📦 Nuevos perfiles procesados:', newProfiles)
          
          // Actualizar tanto el estado como el ref
          setUserProfiles(prev => {
            const updated = { ...prev, ...newProfiles }
            userProfilesRef.current = updated
            console.log('✅ Estado actualizado:', updated)
            return updated
          })
        }
      } catch (error) {
        console.error('❌ Error cargando perfiles de usuarios:', error)
      }
    }
    
    loadUserProfiles()
  }, [messages])

  // Limpiar input al cerrar
  useEffect(() => {
    if (!isOpen) {
      setMessage("")
    }
  }, [isOpen])

  // Scroll al recibir mensajes
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollToBottomLocal()
      }, 100)
    }
  }, [messages.length, scrollToBottomLocal])

  // Scroll al abrir el chat
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => {
        scrollToBottomLocal()
      }, 500)
    }
  }, [isOpen, messages.length, scrollToBottomLocal])

  // Focus en input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Marcar como leído
  useEffect(() => {
    if (isOpen && thread) {
      markAsRead()
    }
  }, [isOpen, thread, markAsRead])

  const handleSend = async () => {
    if (!message.trim() || isSending) return

    const messageText = message.trim()
    setMessage("")
    await send(messageText)
    
    // Scroll al enviar mensaje
    setTimeout(() => {
      scrollToBottomLocal()
    }, 300)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false}
        className={cn(
          "p-0 max-w-4xl h-[90vh] md:h-[80vh] flex flex-col",
          className
        )}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold mb-1">
                {thread?.context_title || 'Chat'}
              </DialogTitle>
              {requestInfo && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">
                      {getCurrencySymbol(requestInfo.currency)}{formatAmount(requestInfo.amount)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">•</span>
                    <span>{getPaymentMethodLabel(requestInfo.paymentMethod)}</span>
                  </span>
                  {requestInfo.uniqueCode && (
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">•</span>
                      <span className="font-semibold text-foreground">{requestInfo.uniqueCode}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 ml-4">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Mensajes - Área con scroll */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 chat-scroll"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent'
            }}
          >
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
                {messages.map((msg) => {
                  const isOwnMessage = msg.sender_id === currentUserId
                  const userProfile = userProfiles[msg.sender_id]
                  const userName = userProfile?.full_name || 'Usuario'
                  const userAvatar = userProfile?.avatar_url
                  
                  // Construir URL del avatar usando Supabase Storage
                  let avatarUrl: string | null = null
                  let selectedAnimalAvatar: string | null = null
                  
                  if (userAvatar) {
                    if (userAvatar.startsWith('http')) {
                      // Ya es una URL completa
                      avatarUrl = userAvatar
                    } else if (userAvatar.startsWith('animal_')) {
                      // Es un avatar de animal, extraer el tipo de animal
                      const animalMatch = userAvatar.match(/animal_(\w+)_/)
                      if (animalMatch) {
                        selectedAnimalAvatar = animalMatch[1]
                      }
                    } else {
                      // Es un nombre de archivo, construir URL usando Supabase Storage
                      const supabase = supabaseBrowser()
                      const { data } = supabase.storage
                        .from('profiles')
                        .getPublicUrl(`avatars/${userAvatar}.svg`)
                      avatarUrl = data.publicUrl
                    }
                  }
                  
                  return (
                    <div key={msg.id} className={cn(
                      "flex gap-3",
                      isOwnMessage && "flex-row-reverse"
                    )}>
                      {/* Avatar */}
                      <Avatar className="h-8 w-8 flex-shrink-0 border border-border">
                        {selectedAnimalAvatar ? (
                          // Mostrar icono de animal
                          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.color || '#6b7280' }}>
                            {(() => {
                              const IconComponent = animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.icon
                              return IconComponent ? <IconComponent className="w-5 h-5 text-white" /> : null
                            })()}
                          </div>
                        ) : (
                          // Mostrar imagen normal o fallback
                          <>
                            {avatarUrl && (
                              <AvatarImage 
                                src={avatarUrl} 
                                alt={userName}
                                className="rounded-full"
                              />
                            )}
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                              {userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </>
                        )}
                      </Avatar>
                      
                      {/* Mensaje */}
                      <div className={cn(
                        "flex flex-col max-w-[80%]",
                        isOwnMessage && "items-end"
                      )}>
                        <div className={cn(
                          "inline-block p-3 rounded-lg",
                          msg.kind === 'system' 
                            ? "bg-muted text-muted-foreground text-sm"
                            : isOwnMessage
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                        )}>
                          <p className="text-sm">{msg.body}</p>
                        </div>
                        <div className={cn(
                          "text-xs text-muted-foreground mt-1",
                          isOwnMessage && "text-right"
                        )}>
                          {formatTimeAgo(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input - Siempre visible */}
        {thread?.status === 'active' && (
          <div className="p-4 border-t flex-shrink-0 bg-background">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                disabled={isSending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
