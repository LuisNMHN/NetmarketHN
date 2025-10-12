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
  RotateCcw,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
  globalUnreadCount: number
  onUnreadCountChange: (count: number) => void
  initialConversation?: any
}

export default function ChatWindow({ isOpen, onClose, globalUnreadCount, onUnreadCountChange, initialConversation }: ChatWindowProps) {
  const [activeView, setActiveView] = useState<'conversations' | 'chat'>('conversations')
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [messageInput, setMessageInput] = useState('')
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteType, setDeleteType] = useState<'messages' | 'conversation' | null>(null)

  const supabase = supabaseBrowser()

  // Deshabilitar scroll del body cuando el chat está abierto
  useEffect(() => {
    if (isOpen) {
      // Guardar el scroll actual
      const scrollY = window.scrollY
      
      // Deshabilitar scroll del body
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      
      return () => {
        // Restaurar scroll del body
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        
        // Restaurar posición de scroll
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

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

  // Manejar conversación inicial
  useEffect(() => {
    if (initialConversation && isOpen) {
      console.log('Conversación inicial recibida:', initialConversation)
      
      // Obtener nombre real del usuario desde profiles
      const getRealUserName = async () => {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', initialConversation.targetUserId)
            .maybeSingle()
          
          console.log('Debug nombre real obtenido:', {
            targetUserId: initialConversation.targetUserId,
            profileData,
            realName: profileData?.full_name
          })
          
          return profileData?.full_name || 'Usuario'
        } catch (error) {
          console.error('Error obteniendo nombre real:', error)
          return 'Usuario'
        }
      }
      
      // Crear conversación simulada con nombre real
      const createMockConversation = async () => {
        const realUserName = await getRealUserName()
        
        const mockConversation = {
          id: `temp_${initialConversation.solicitudId}`,
          solicitud_id: initialConversation.solicitudId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          participants: [
            {
              conversation_id: `temp_${initialConversation.solicitudId}`,
              user_id: initialConversation.targetUserId,
              last_read_at: new Date().toISOString(),
              cleared_at: null,
              created_at: new Date().toISOString(),
              user_name: realUserName,
              user_avatar: null
            }
          ],
          last_message: null,
          unread_count: 0
        }
        
        console.log('Debug mockConversation creada:', mockConversation)
        setSelectedConversation(mockConversation)
        setActiveView('chat')
      }
      
      createMockConversation()
    }
  }, [initialConversation, isOpen, supabase])

  // Cargar conversaciones
  useEffect(() => {
    if (!isInitialized || !canUseChat) return

    const loadConversations = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // Obtener conversaciones del usuario actual directamente
        const { data: conversationsData, error: conversationsError } = await supabase
          .from('chat_conversation_participants')
          .select(`
            conversation_id,
            last_read_at,
            cleared_at,
            created_at,
            chat_conversations!inner(
              id,
              solicitud_id,
              created_at,
              updated_at
            )
          `)
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })

        if (conversationsError) {
          console.error('Error obteniendo conversaciones:', conversationsError)
          throw conversationsError
        }

        console.log('Debug conversaciones obtenidas:', {
          currentUserId,
          conversationsData,
          count: conversationsData?.length
        })

        // Obtener participantes para cada conversación
        const conversationsWithParticipants = await Promise.all(
          (conversationsData || []).map(async (conv) => {
            // Obtener todos los participantes de esta conversación
            console.log('Debug consultando participantes para:', conv.conversation_id)
            
            const { data: participantsData, error: participantsError } = await supabase
              .from('chat_conversation_participants')
              .select(`
                user_id,
                last_read_at,
                cleared_at,
                created_at
              `)
              .eq('conversation_id', conv.conversation_id)
            
            if (participantsError) {
              console.error('Error obteniendo participantes:', participantsError)
              return null
            }

            console.log('Debug participantes raw:', {
              conversationId: conv.conversation_id,
              participantsData,
              count: participantsData?.length,
              allUserIds: participantsData?.map(p => p.user_id),
              currentUserId,
              isCurrentUserInParticipants: participantsData?.some(p => p.user_id === currentUserId)
            })

            // Obtener nombres de participantes desde profiles
            const participantIds = participantsData?.map(p => p.user_id) || []
            let participantNames = {}
            let profilesData = null
            
            if (participantIds.length > 0) {
              const { data: profilesDataResult, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', participantIds)
              
              profilesData = profilesDataResult
              
              if (profilesError) {
                console.error('Error obteniendo profiles:', profilesError)
              } else {
                participantNames = profilesData?.reduce((acc, profile) => {
                  acc[profile.id] = profile.full_name
                  return acc
                }, {}) || {}
              }
            }

            console.log('Debug nombres obtenidos:', {
              participantIds,
              participantNames,
              profilesData: profilesData
            })

            // Procesar participantes
            const participantsWithInfo = (participantsData || []).map((participant) => {
              const userName = participantNames[participant.user_id] || 
                              participant.user_id?.slice(0, 8) || 
                              'Usuario'
              
              console.log('Debug participante individual:', {
                user_id: participant.user_id,
                found_name: participantNames[participant.user_id],
                final_userName: userName,
                all_participantNames: participantNames,
                isCurrentUser: participant.user_id === currentUserId
              })
              
              return {
                conversation_id: conv.conversation_id,
                user_id: participant.user_id,
                last_read_at: participant.last_read_at,
                cleared_at: participant.cleared_at,
                created_at: participant.created_at,
                user_name: userName,
                user_avatar: null
              }
            })

            console.log('Debug participantes procesados:', {
              conversationId: conv.conversation_id,
              participantsWithInfo,
              count: participantsWithInfo.length,
              allUserIds: participantsWithInfo.map(p => p.user_id),
              currentUserId
            })

            const finalConversation = {
              id: conv.conversation_id,
              solicitud_id: conv.chat_conversations.solicitud_id,
              created_at: conv.chat_conversations.created_at,
              updated_at: conv.chat_conversations.updated_at,
              participants: participantsWithInfo,
              unread_count: 0 // Por ahora sin contador
            }

            console.log('Debug conversación final:', {
              conversationId: conv.conversation_id,
              finalConversation,
              participantsCount: finalConversation.participants.length,
              participantUserIds: finalConversation.participants.map(p => p.user_id),
              currentUserId
            })

            return finalConversation
          })
        )

        // Filtrar conversaciones válidas
        const userConversations = conversationsWithParticipants.filter(conv => conv !== null)

        // Obtener último mensaje y contador de no leídos para cada conversación
        const conversationsWithMessages = await Promise.all(
          userConversations.map(async (conv) => {
            // Obtener último mensaje
            const { data: lastMessageData } = await supabase
              .from('chat_messages')
              .select(`
                id,
                body,
                created_at,
                sender_id,
                full_name,
                is_author_deleted
              `)
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            // Obtener información del remitente si existe el mensaje
            let lastMessage = null
            if (lastMessageData) {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', lastMessageData.sender_id)
                .maybeSingle()

              const { data: senderUserProfile } = await supabase
                .from('user_profiles')
                .select('avatar_url')
                .eq('user_id', lastMessageData.sender_id)
                .maybeSingle()

              lastMessage = {
                id: lastMessageData.id,
                conversation_id: conv.id,
                sender_id: lastMessageData.sender_id,
                body: lastMessageData.body,
                created_at: lastMessageData.created_at,
                updated_at: lastMessageData.created_at,
                is_author_deleted: lastMessageData.is_author_deleted,
                sender_name: senderProfile?.full_name || 'Usuario',
                sender_avatar: senderUserProfile?.avatar_url || null
              }
            }

            // Calcular mensajes no leídos
            const participant = conv.participants.find(p => p.user_id === session.user.id)
            const { count: unreadCount } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .gt('created_at', participant?.last_read_at || '1970-01-01')
              .neq('sender_id', session.user.id)
              .eq('is_author_deleted', false)

            return {
              id: conv.id,
              solicitud_id: conv.solicitud_id,
              created_at: conv.created_at,
              updated_at: conv.updated_at,
              participants: conv.participants,
              last_message: lastMessage,
              unread_count: unreadCount || 0
            }
          })
        )

        setConversations(conversationsWithMessages)
        
        // Actualizar contador global
        const totalUnread = conversationsWithMessages.reduce((total, conv) => total + conv.unread_count, 0)
        onUnreadCountChange(totalUnread)
      } catch (error) {
        console.error('Error cargando conversaciones:', error)
        setError(`Error cargando conversaciones: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [isInitialized, canUseChat, supabase, currentUserId, onUnreadCountChange])

  // Seleccionar conversación
  const handleSelectConversation = async (conversation: any) => {
    setSelectedConversation(conversation)
    setActiveView('chat')
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Cargar mensajes de la conversación
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          body,
          attachment_url,
          attachment_type,
          attachment_size,
          client_message_id,
          is_author_deleted,
          full_name,
          created_at,
          updated_at
        `)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      if (messagesError) {
        console.error('Error cargando mensajes:', messagesError)
        return
      }
      
      console.log('Debug mensajes cargados:', {
        messagesData,
        count: messagesData?.length,
        firstMessage: messagesData?.[0],
        fullNames: messagesData?.map(m => ({ id: m.id, sender_id: m.sender_id, full_name: m.full_name }))
      })

      // Usar directamente full_name de chat_messages (ya no necesitamos consultar profiles)
      const formattedMessages = (messagesData || []).map((msg) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        body: msg.body,
        attachment_url: msg.attachment_url,
        attachment_type: msg.attachment_type,
        attachment_size: msg.attachment_size,
        client_message_id: msg.client_message_id,
        is_author_deleted: msg.is_author_deleted,
        full_name: msg.full_name,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        sender_name: msg.full_name || msg.sender_id?.slice(0, 8) || 'Usuario',
        sender_avatar: null
      }))

      console.log('Debug mensajes formateados:', {
        formattedMessages,
        firstFormatted: formattedMessages[0]
      })
      
      setMessages(formattedMessages)
      
      // Marcar mensajes como leídos
      try {
        await supabase.rpc('mark_chat_messages_read', {
          p_conversation_id: conversation.id
        })
        
        // Actualizar contador de no leídos
        const updatedConversations = conversations.map(conv => 
          conv.id === conversation.id 
            ? { ...conv, unread_count: 0 }
            : conv
        )
        setConversations(updatedConversations)
        
        const totalUnread = updatedConversations.reduce((total, conv) => total + conv.unread_count, 0)
        onUnreadCountChange(totalUnread)
      } catch (error) {
        console.error('Error marcando mensajes como leídos:', error)
      }
    } catch (error) {
      console.error('Error seleccionando conversación:', error)
      toast.error('Error cargando conversación')
    }
  }

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!messageInput.trim()) return

    const messageText = messageInput.trim()
    setMessageInput('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Verificar que hay una conversación seleccionada
      if (!selectedConversation) {
        console.error('No hay conversación seleccionada')
        setMessageInput(messageText)
        return
      }

      // Obtener el nombre completo del usuario actual
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle()

      // Insertar mensaje en la base de datos
      const { data: newMessageData, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: session.user.id,
          body: messageText,
          full_name: currentUserProfile?.full_name || 'Usuario'
        })
        .select(`
          id,
          conversation_id,
          sender_id,
          body,
          full_name,
          created_at,
          updated_at,
          is_author_deleted
        `)
        .single()

      if (insertError) {
        console.error('Error insertando mensaje:', insertError)
        throw insertError
      }

      // Obtener información del remitente
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', newMessageData.sender_id)
        .maybeSingle()

      const { data: senderUserProfile } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('user_id', newMessageData.sender_id)
        .maybeSingle()

      const newMessage = {
        id: newMessageData.id,
        conversation_id: newMessageData.conversation_id,
        sender_id: newMessageData.sender_id,
        body: newMessageData.body,
        created_at: newMessageData.created_at,
        updated_at: newMessageData.updated_at,
        is_author_deleted: newMessageData.is_author_deleted,
        sender_name: senderProfile?.full_name || 'Usuario',
        sender_avatar: senderUserProfile?.avatar_url || null
      }

      // El mensaje ya está formateado correctamente

      // Agregar mensaje a la lista local
      setMessages(prev => [...prev, newMessage])
      
      // Actualizar la conversación con el último mensaje
      const updatedConversations = conversations.map(conv => 
        conv.id === selectedConversation.id 
          ? { 
              ...conv, 
              last_message: newMessage,
              updated_at: newMessage.created_at
            }
          : conv
      )
      setConversations(updatedConversations)
      
      console.log('Mensaje enviado')
    } catch (error) {
      console.error('Error enviando mensaje:', error)
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

  // Borrar mensajes del usuario actual
  const handleDeleteMyMessages = async () => {
    if (!selectedConversation || !currentUserId) return

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_author_deleted: true })
        .eq('conversation_id', selectedConversation.id)
        .eq('sender_id', currentUserId)

      if (error) {
        console.error('Error borrando mensajes:', error)
        return
      }

      // Actualizar mensajes locales
      setMessages(prev => prev.map(msg => 
        msg.sender_id === currentUserId 
          ? { ...msg, is_author_deleted: true }
          : msg
      ))

      console.log('Mensajes del usuario borrados')
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error borrando mensajes:', error)
    }
  }

  // Borrar conversación completa (solo admin)
  const handleDeleteConversation = async () => {
    if (!selectedConversation || userRole !== 'admin') return

    try {
      // Eliminar mensajes de la conversación
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', selectedConversation.id)

      if (messagesError) {
        console.error('Error borrando mensajes:', messagesError)
        return
      }

      // Eliminar participantes de la conversación
      const { error: participantsError } = await supabase
        .from('chat_conversation_participants')
        .delete()
        .eq('conversation_id', selectedConversation.id)

      if (participantsError) {
        console.error('Error borrando participantes:', participantsError)
        return
      }

      // Eliminar la conversación
      const { error: conversationError } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', selectedConversation.id)

      if (conversationError) {
        console.error('Error borrando conversación:', conversationError)
        return
      }

      // Remover de la lista local
      setConversations(prev => prev.filter(conv => conv.id !== selectedConversation.id))
      setSelectedConversation(null)
      setActiveView('conversations')
      setMessages([])

      console.log('Conversación completamente eliminada')
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error borrando conversación:', error)
    }
  }

  // Limpiar historial (marcar como leído)
  const handleClearHistory = async () => {
    if (!selectedConversation || !currentUserId) return

    try {
      const { error } = await supabase
        .from('chat_conversation_participants')
        .update({ 
          cleared_at: new Date().toISOString(),
          last_read_at: new Date().toISOString()
        })
        .eq('conversation_id', selectedConversation.id)
        .eq('user_id', currentUserId)

      if (error) {
        console.error('Error limpiando historial:', error)
        return
      }

      // Limpiar mensajes locales
      setMessages([])

      console.log('Historial limpiado')
    } catch (error) {
      console.error('Error limpiando historial:', error)
    }
  }

  // Borrar mensaje individual
  const handleDeleteSingleMessage = async (messageId: string) => {
    if (!currentUserId) return

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_author_deleted: true })
        .eq('id', messageId)
        .eq('sender_id', currentUserId)

      if (error) {
        console.error('Error borrando mensaje:', error)
        return
      }

      // Actualizar mensaje local
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, is_author_deleted: true }
          : msg
      ))

      console.log('Mensaje individual borrado')
    } catch (error) {
      console.error('Error borrando mensaje:', error)
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
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="absolute right-0 top-0 h-full w-full max-w-sm sm:max-w-md lg:max-w-lg bg-background shadow-xl flex flex-col border-l border-border"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex-1 flex flex-col overflow-hidden">
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
              <ScrollArea className="flex-1" style={{ touchAction: 'pan-y' }}>
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
                            <AvatarImage src={conversation.participants?.find(p => currentUserId && p.user_id !== currentUserId)?.user_avatar} />
                            <AvatarFallback>
                              {conversation.participants?.find(p => currentUserId && p.user_id !== currentUserId)?.user_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium truncate">
                                {(() => {
                                  const otherParticipant = conversation.participants?.find(p => currentUserId && p.user_id !== currentUserId)
                                  console.log('Debug UI lista:', {
                                    conversationId: conversation.id,
                                    participants: conversation.participants,
                                    currentUserId,
                                    otherParticipant,
                                    finalName: otherParticipant?.user_name || 'Usuario'
                                  })
                                  return otherParticipant?.user_name || 'Usuario'
                                })()}
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
                    <AvatarImage src={selectedConversation?.participants?.find(p => currentUserId && p.user_id !== currentUserId)?.user_avatar} />
                    <AvatarFallback>
                      {selectedConversation?.participants?.find(p => currentUserId && p.user_id !== currentUserId)?.user_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {(() => {
                        const otherParticipant = selectedConversation?.participants?.find(p => currentUserId && p.user_id !== currentUserId)
                        console.log('Debug UI header:', {
                          selectedConversation,
                          participants: selectedConversation?.participants,
                          currentUserId,
                          otherParticipant,
                          finalName: otherParticipant?.user_name || 'Usuario'
                        })
                        return otherParticipant?.user_name || 'Usuario'
                      })()}
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
                    <DropdownMenuItem 
                      onClick={() => {
                        setDeleteType('messages')
                        setShowDeleteConfirm(true)
                      }}
                      className="text-orange-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Borrar mis mensajes
                    </DropdownMenuItem>
                    {userRole === 'admin' && (
                      <DropdownMenuItem 
                        onClick={() => {
                          setDeleteType('conversation')
                          setShowDeleteConfirm(true)
                        }}
                        className="text-red-600"
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Eliminar conversación
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

          {/* Mensajes */}
          <ScrollArea className="flex-1 p-4" style={{ touchAction: 'pan-y' }}>
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isCurrentUser = message.sender_id === currentUserId
                    return (
                      <div
                        key={message.id}
                        className={`flex group ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
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
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">
                              {formatDate(message.created_at)}
                            </p>
                            {isCurrentUser && !message.is_author_deleted && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteSingleMessage(message.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Borrar mensaje
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        {!isCurrentUser && (
                          <Avatar className="h-6 w-6 order-1 mr-2">
                            <AvatarImage src={message.sender_avatar} />
                            <AvatarFallback>
                              {message.sender_name?.charAt(0) || message.full_name?.charAt(0) || 'U'}
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

      {/* Diálogo de confirmación de borrado */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold">
                {deleteType === 'messages' ? 'Borrar mis mensajes' : 'Borrar conversación'}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {deleteType === 'messages' 
                ? '¿Estás seguro de que quieres borrar todos tus mensajes de esta conversación? Esta acción no se puede deshacer.'
                : '¿Estás seguro de que quieres eliminar completamente esta conversación? Esta acción eliminará TODOS los mensajes, participantes y la conversación misma. Esta acción es IRREVERSIBLE.'
              }
            </p>
            <div className="flex space-x-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteType(null)
                }}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={deleteType === 'messages' ? handleDeleteMyMessages : handleDeleteConversation}
              >
                {deleteType === 'messages' ? 'Borrar mensajes' : 'Eliminar conversación'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
