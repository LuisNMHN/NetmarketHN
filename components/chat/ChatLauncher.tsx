"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import ChatWindow from './ChatWindow'

interface ChatLauncherProps {
  className?: string
}

export default function ChatLauncher({ className }: ChatLauncherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<any>(null)

  const openChat = () => setIsOpen(true)
  const closeChat = () => {
    setIsOpen(false)
    setSelectedConversation(null)
  }

  // Verificar rol del usuario una sola vez
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const supabase = supabaseBrowser()
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
  }, [])

  // Escuchar evento global para abrir chat
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent) => {
      console.log('Evento recibido para abrir chat:', event.detail)
      setSelectedConversation(event.detail)
      openChat()
    }

    window.addEventListener('openChat', handleOpenChat as EventListener)
    
    return () => {
      window.removeEventListener('openChat', handleOpenChat as EventListener)
    }
  }, [])

  // Solo usuarios con rol 'user' pueden usar el chat
  const canUseChat = userRole === 'user'

  // No renderizar si el usuario no puede usar el chat
  if (!isInitialized || !canUseChat) {
    return null
  }

  return (
    <>
      {/* Botón flotante */}
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <Button
          onClick={openChat}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
          aria-label="Abrir chat"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </div>

      {/* Panel de chat */}
      {isOpen && (
        <ChatWindow
          isOpen={isOpen}
          onClose={closeChat}
          globalUnreadCount={0}
          onUnreadCountChange={() => {}}
          initialConversation={selectedConversation}
        />
      )}
    </>
  )
}
