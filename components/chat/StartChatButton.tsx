"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'

interface StartChatButtonProps {
  solicitudId: string
  targetUserId: string
  targetUserName?: string
  className?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  onChatStarted?: () => void
}

export default function StartChatButton({
  solicitudId,
  targetUserId,
  targetUserName,
  className,
  variant = 'outline',
  size = 'sm',
  onChatStarted
}: StartChatButtonProps) {
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const supabase = supabaseBrowser()

  // Función para abrir chat
  const openChat = () => {
    // Disparar evento global para abrir chat
    window.dispatchEvent(new CustomEvent('openChat', { 
      detail: { 
        solicitudId, 
        targetUserId, 
        targetUserName 
      } 
    }))
    onChatStarted?.()
  }

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

  // No renderizar si el usuario no puede usar el chat
  if (!isInitialized || !canUseChat) {
    return null
  }

  const handleStartChat = async () => {
    setLoading(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error('No hay sesión activa')
        return
      }

      // Verificar si ya existe una conversación para esta solicitud
      const { data: existingConversation } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('solicitud_id', solicitudId)
        .maybeSingle()

      if (existingConversation) {
        // Verificar si el usuario actual es participante
        const { data: participant } = await supabase
          .from('chat_conversation_participants')
          .select('user_id')
          .eq('conversation_id', existingConversation.id)
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (participant) {
          console.log(`Chat existente con ${targetUserName || 'usuario'}`)
          // Abrir ventana de chat
          openChat()
          onChatStarted?.()
          return
        }
      }

      // Crear nueva conversación
      const { data: newConversation, error: conversationError } = await supabase
        .from('chat_conversations')
        .insert({
          solicitud_id: solicitudId
        })
        .select('id')
        .single()

      if (conversationError) {
        console.error('Error creando conversación:', conversationError)
        throw conversationError
      }

      // Agregar participantes
      const { error: participantsError } = await supabase
        .from('chat_conversation_participants')
        .insert([
          {
            conversation_id: newConversation.id,
            user_id: session.user.id,
            last_read_at: new Date().toISOString()
          },
          {
            conversation_id: newConversation.id,
            user_id: targetUserId,
            last_read_at: new Date().toISOString()
          }
        ])

      if (participantsError) {
        console.error('Error agregando participantes:', participantsError)
        throw participantsError
      }

      console.log(`Chat iniciado con ${targetUserName || 'usuario'}`)
      // Abrir ventana de chat
      openChat()
      onChatStarted?.()
    } catch (error) {
      console.error('Error iniciando chat:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleStartChat}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      <MessageSquare className="h-4 w-4 mr-2" />
      {loading ? 'Iniciando...' : 'Negociar'}
    </Button>
  )
}
