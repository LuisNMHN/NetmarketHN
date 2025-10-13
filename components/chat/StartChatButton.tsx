"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2 } from 'lucide-react'
import { createChatConversation } from '@/lib/actions/chat'
import { useToast } from '@/hooks/use-toast'

interface StartChatButtonProps {
  currentUserId: string
  otherUserId: string
  purchaseRequestId?: string
  onChatStarted?: (conversationId: string) => void
  className?: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
}

export function StartChatButton({
  currentUserId,
  otherUserId,
  purchaseRequestId,
  onChatStarted,
  className = '',
  size = 'sm',
  variant = 'outline'
}: StartChatButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleStartChat = async () => {
    if (isLoading) return

    console.log('🚀 Iniciando chat con:', {
      currentUserId,
      otherUserId,
      purchaseRequestId
    })

    setIsLoading(true)
    try {
      console.log('📡 Llamando a createChatConversation...')
      const result = await createChatConversation(
        currentUserId,
        otherUserId,
        purchaseRequestId
      )

      console.log('📝 Resultado de crear conversación:', result)

      if (result.success && result.data) {
        toast({
          title: "✅ Chat iniciado",
          description: "La conversación ha sido creada correctamente"
        })
        
        if (onChatStarted) {
          onChatStarted(result.data.id)
        }

        // Abrir el chat automáticamente
        console.log('💬 Abriendo chat automáticamente para conversación:', result.data.id)
        // Aquí necesitamos una forma de comunicar al ChatLauncher que abra el chat
        // Por ahora, emitimos un evento personalizado
        window.dispatchEvent(new CustomEvent('openChat', { 
          detail: { conversationId: result.data.id } 
        }))
      } else {
        console.error('❌ Error creando conversación:', result.error)
        toast({
          title: "❌ Error",
          description: result.error || "No se pudo iniciar el chat",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('❌ Error inesperado iniciando chat:', error)
      
      // Detectar diferentes tipos de errores
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          console.error('🔌 Error de conexión - Failed to fetch')
          toast({
            title: "🔌 Error de conexión",
            description: "No se pudo conectar con el servidor. Verifica tu conexión a internet.",
            variant: "destructive"
          })
        } else if (error.message.includes('NetworkError')) {
          console.error('🌐 Error de red')
          toast({
            title: "🌐 Error de red",
            description: "Problema de conectividad. Intenta nuevamente.",
            variant: "destructive"
          })
        } else {
          console.error('⚠️ Error general:', error.message)
          toast({
            title: "❌ Error",
            description: error.message,
            variant: "destructive"
          })
        }
      } else {
        console.error('🚫 Error desconocido:', error)
        toast({
          title: "❌ Error desconocido",
          description: "Ocurrió un error inesperado. Intenta nuevamente.",
          variant: "destructive"
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleStartChat}
      disabled={isLoading}
      size={size}
      variant={variant}
      className={`rounded-lg transition-all duration-200 ${className}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <MessageSquare className="h-4 w-4 mr-2" />
      )}
      {isLoading ? 'Iniciando...' : 'Negociar'}
    </Button>
  )
}
