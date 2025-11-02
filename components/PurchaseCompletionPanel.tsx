'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Shield, 
  Upload, 
  MessageSquare,
  User,
  DollarSign,
  Timer,
  FileText,
  CreditCard,
  ArrowRight,
  Star,
  TrendingUp,
  Award,
  X,
  ChevronRight,
  Lock,
  CheckCircle2,
  Circle,
  HelpCircle,
  Send,
  Plus,
  Paperclip,
  File
} from 'lucide-react'
// import { toast } from 'sonner' // No se usa en este componente
import { ReputationSection } from '@/components/reputation/ReputationSection'
import { usePurchaseTransactionClient } from '@/hooks/usePurchaseTransactionClient'
import { type PurchaseTransaction, type TransactionStep } from '@/lib/actions/purchase_transactions'
import { supabaseBrowser } from '@/lib/supabase/client'

// =========================================================
// TIPOS E INTERFACES
// =========================================================

interface PurchaseCompletionPanelProps {
  requestId: string
  transactionId?: string  // ID de la transacción existente (si ya fue creada)
  sellerId: string
  buyerId: string
  amount: number
  currency: string
  paymentMethod: string
  isOpen: boolean
  onClose: () => void
  onTransactionCreated?: (transactionId: string) => void
}

interface TransactionData extends PurchaseTransaction {
  transaction_steps: TransactionStep[]
  buyer: { id: string; full_name: string; avatar_url?: string }
  seller: { id: string; full_name: string; avatar_url?: string }
  request: {
    id: string
    user_id: string
    amount: number
    currency_type: string
    payment_method: string
    status: string
    unique_code: string
    description?: string
    created_at: string
    updated_at: string
    seller_id?: string
    accepted_at?: string
  }
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export function PurchaseCompletionPanel({
  requestId,
  transactionId,
  sellerId,
  buyerId,
  amount,
  currency,
  paymentMethod,
  isOpen,
  onClose,
  onTransactionCreated
}: PurchaseCompletionPanelProps) {
  // Estados
  const [transaction, setTransaction] = useState<TransactionData | null>(null)
  const [requestData, setRequestData] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Hook del cliente
  const { 
    loading, 
    error,
    createTransaction,
    updateStatus,
    uploadDocument,
    clearError
  } = usePurchaseTransactionClient()
  
  // Hook de toast
  const { toast } = useToast()

  // Estados para el chat local
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [chatEnabled, setChatEnabled] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [chatThreadId, setChatThreadId] = useState<string | null>(null)
  const chatRealtimeChannelRef = React.useRef<any>(null)
  const currentSubscribedThreadIdRef = React.useRef<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  
  // Cargar mensajes del chat
  const loadChatMessages = async () => {
    if (!chatEnabled || !requestId) return
    
    try {
      setChatLoading(true)
      const supabase = supabaseBrowser()
      
      // Usar requestId como context_id en lugar de transaction.id
      console.log('🔍 Buscando thread con requestId:', requestId)
      
      // Intentar obtener thread existente
      const { data: threads } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('context_id', requestId)  // ⭐ USAR REQUESTID EN LUGAR DE TRANSACTION.ID
        .eq('context_type', 'order')
        .limit(1)
      
      console.log('📋 Threads encontrados:', threads)
      
      let threadId: string | null = null
      
      if (threads && threads.length > 0) {
        // Thread existente encontrado
        const thread = threads[0]
        threadId = thread.id
        console.log('✅ Thread encontrado:', threadId)
      } else {
        // Crear thread inmediatamente si no existe
        console.log('🆕 Creando thread inmediatamente...')
        const actualBuyerId = buyerId
        const actualSellerId = sellerId
        
        if (!actualBuyerId || !actualSellerId) {
          console.warn('⚠️ No se pueden obtener buyer_id o seller_id para crear thread')
          return
        }
        
        const { data: newThread, error: threadError } = await supabase
          .from('chat_threads')
          .insert({
            context_type: 'order',
            context_id: requestId,
            party_a: actualBuyerId,
            party_b: actualSellerId,
            context_title: 'Chat de Negociación'
          })
          .select()
          .single()
        
        if (threadError) {
          console.error('❌ Error creando thread:', threadError)
          throw threadError
        }
        
        threadId = newThread.id
        console.log('✅ Thread creado:', threadId)
      }
      
      // Establecer el threadId en el estado
      if (threadId) {
        setChatThreadId(threadId)
        
        // Cargar mensajes del thread
        const { data: messages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
        
        console.log('📨 Mensajes encontrados:', messages)
        if (messagesError) console.error('❌ Error cargando mensajes:', messagesError)
        
        setChatMessages(messages || [])
        
        // Configurar suscripción realtime para nuevos mensajes
        // Usar setTimeout para asegurar que la suscripción se configure completamente
        setTimeout(() => {
          setupRealtimeSubscription(threadId!)
        }, 100)
      }
    } catch (error) {
      console.error('❌ Error cargando mensajes:', error)
    } finally {
      setChatLoading(false)
    }
  }

  // Subir documento al chat
  const handleFileUpload = async (file: File) => {
    if (!chatEnabled || !chatThreadId || uploadingFile) return

    setUploadingFile(true)
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          title: "Error",
          description: "Debes estar autenticado para subir documentos",
          variant: "destructive",
        })
        return
      }

      // Validar tamaño del archivo (máximo 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast({
          title: "Error",
          description: "El archivo es demasiado grande. Máximo 10MB",
          variant: "destructive",
        })
        return
      }

      // Validar tipo de archivo (imágenes y PDFs)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Error",
          description: "Solo se permiten imágenes (JPG, PNG, GIF, WEBP) y PDFs",
          variant: "destructive",
        })
        return
      }

      // Generar nombre único para el archivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      // Crear bucket si no existe (usaremos 'transaction-documents')
      const bucket = 'transaction-documents'
      
      // Subir archivo a Supabase Storage
      const filePath = `${requestId}/${fileName}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (uploadError) {
        console.error('Error subiendo archivo:', uploadError)
        toast({
          title: "Error",
          description: "No se pudo subir el documento. Inténtalo de nuevo.",
          variant: "destructive",
        })
        return
      }

      // Obtener URL pública del archivo
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      // Crear mensaje en el chat con el documento adjunto
      const messageBody = `📎 Documento: ${file.name}`
      
      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: chatThreadId,
          sender_id: user.id,
          body: messageBody,
          message_type: 'document',
          attachments: [{
            type: file.type,
            name: file.name,
            url: publicUrl,
            size: file.size
          }]
        })
        .select()
        .single()

      if (messageError) {
        console.error('Error creando mensaje con documento:', messageError)
        toast({
          title: "Error",
          description: "Documento subido pero error al crear el mensaje",
          variant: "destructive",
        })
        return
      }

      // Agregar el mensaje al estado local inmediatamente
      setChatMessages(prev => [...prev, messageData])

      // Guardar también en transaction_documents si hay una transacción
      if (transaction?.id) {
        await supabase
          .from('transaction_documents')
          .insert({
            transaction_id: transaction.id,
            document_type: 'payment_proof',
            document_name: file.name,
            document_url: publicUrl,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id
          })
      }

      toast({
        title: "Documento enviado",
        description: "El documento se ha enviado correctamente",
      })

      // Limpiar el input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error en handleFileUpload:', error)
      toast({
        title: "Error",
        description: "Error inesperado al subir el documento",
        variant: "destructive",
      })
    } finally {
      setUploadingFile(false)
    }
  }
  
  // Enviar mensaje
  const sendChatMessage = async (message: string) => {
    if (chatSending || !message.trim() || !chatEnabled) return
    
    try {
      setChatSending(true)
      const supabase = supabaseBrowser()
      
      console.log('📤 Enviando mensaje con requestId:', requestId)
      
      // Obtener o crear thread usando requestId
      let { data: threads, error: threadsError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('context_id', requestId)  // ⭐ USAR REQUESTID EN LUGAR DE TRANSACTION.ID
        .eq('context_type', 'order')
        .limit(1)
      
      if (threadsError) console.error('❌ Error buscando threads:', threadsError)
      console.log('📋 Threads encontrados:', threads)
      
      let threadId = threads?.[0]?.id || chatThreadId
      
      if (!threadId) {
        console.log('🆕 Creando nuevo thread...')
        // Determinar buyer y seller correctamente
        const actualBuyerId = buyerId
        const actualSellerId = sellerId
        
        if (!actualBuyerId || !actualSellerId) {
          console.error('❌ No se pueden obtener buyer_id o seller_id')
          throw new Error('No se pueden obtener los IDs de comprador o vendedor')
        }
        
        // Crear thread simple usando requestId como context_id
        const { data: newThread, error: threadError } = await supabase
          .from('chat_threads')
          .insert({
            context_type: 'order',
            context_id: requestId,  // ⭐ USAR REQUESTID
            party_a: actualBuyerId,
            party_b: actualSellerId,
            context_title: 'Chat de Negociación'
          })
          .select()
          .single()
        
        if (threadError) {
          console.error('❌ Error creando thread:', threadError)
          throw threadError
        }
        threadId = newThread.id
        console.log('✅ Thread creado:', threadId)
        setChatThreadId(threadId)
        
        // Configurar suscripción realtime para el nuevo thread
        // Esperar un momento para asegurar que la suscripción esté lista
        await new Promise(resolve => setTimeout(resolve, 150))
        setupRealtimeSubscription(threadId)
        
        // Esperar un poco más para que la suscripción se active completamente
        await new Promise(resolve => setTimeout(resolve, 100))
      } else {
        // Si el thread ya existe, asegurarse de que la suscripción esté activa
        if (threadId !== chatThreadId) {
          setChatThreadId(threadId)
          setupRealtimeSubscription(threadId)
        }
      }
      
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      
      console.log('📤 Enviando mensaje al thread:', threadId)
      
      // Insertar mensaje
      const { data: newMessage, error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          body: message,
          kind: 'user'
        })
        .select()
        .single()
      
      if (msgError) {
        console.error('❌ Error insertando mensaje:', msgError)
        throw msgError
      }
      
      console.log('✅ Mensaje enviado:', newMessage)
      
      // Agregar mensaje localmente para feedback inmediato
      // realtime lo recibirá también pero verificará duplicados
      setChatMessages(prev => [...prev, newMessage])
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Verifica tu conexión.",
        variant: "destructive",
      })
    } finally {
      setChatSending(false)
    }
  }
  
  // Configurar suscripción realtime para el chat (memoizada)
  const setupRealtimeSubscription = useCallback((threadId: string) => {
    // Verificar si ya tenemos una suscripción activa para este thread
    if (chatRealtimeChannelRef.current && currentSubscribedThreadIdRef.current === threadId) {
      console.log('✅ Suscripción ya existe para este thread, reutilizando')
      return // Ya tenemos una suscripción activa para este thread
    }
    
    // Limpiar suscripción anterior si es para un thread diferente
    if (chatRealtimeChannelRef.current) {
      console.log('🧹 Limpiando suscripción realtime anterior (thread diferente)')
      chatRealtimeChannelRef.current.unsubscribe()
      chatRealtimeChannelRef.current = null
      currentSubscribedThreadIdRef.current = null
    }
    
    const supabase = supabaseBrowser()
    console.log('🔌 Configurando suscripción realtime para thread:', threadId)
    
    // Obtener el usuario actual
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id
    }
    
    // Crear nueva suscripción
    const channel = supabase
      .channel(`chat:${threadId}`, {
        config: {
          broadcast: { self: false }
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`
      }, async (payload) => {
        console.log('📨 Nuevo mensaje recibido via realtime:', payload.new)
        const newMessage = payload.new as any
        
        // Obtener el usuario actual para verificar si es nuestro propio mensaje
        const userId = await getUserId()
        
        // Verificar que no esté duplicado y que no sea nuestro propio mensaje
        setChatMessages(prev => {
          const alreadyExists = prev.some(m => m.id === newMessage.id)
          if (alreadyExists) {
            console.log('⚠️ Mensaje duplicado ignorado:', newMessage.id)
            return prev
          }
          
          // Solo agregar si no es nuestro propio mensaje
          const isOwnMessage = newMessage.sender_id === userId
          if (isOwnMessage) {
            console.log('⚠️ Mensaje propio del emisor, ya existe localmente')
            return prev
          }
          
          console.log('✅ Mensaje agregado (de otro usuario):', newMessage.id)
          return [...prev, newMessage]
        })
      })
      .subscribe((status) => {
        console.log('🔌 Estado de suscripción chat realtime:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción realtime activa para thread:', threadId)
          currentSubscribedThreadIdRef.current = threadId
        }
      })
    
    chatRealtimeChannelRef.current = channel
  }, [])
  
  // Limpiar suscripción al desmontar o cuando cambia el thread
  useEffect(() => {
    return () => {
      if (chatRealtimeChannelRef.current) {
        chatRealtimeChannelRef.current.unsubscribe()
      }
    }
  }, [])
  
  // Cargar mensajes cuando se abre el panel y el chat está habilitado
  useEffect(() => {
    if (isOpen && chatEnabled && requestId) {
      loadChatMessages()
    }
  }, [isOpen, chatEnabled, requestId])
  
  // Mock del chat hook para compatibilidad
  const chatHook = {
    isLoading: chatLoading,
    thread: null,
    messages: chatMessages,
    isSending: chatSending,
    send: sendChatMessage,
    markAsRead: async () => {},
    close: async () => {},
    refresh: async () => { loadChatMessages() }
  }

  // Información para el chat
  const requestInfo = {
    amount: requestData?.amount || amount,
    paymentMethod: requestData?.payment_method || paymentMethod,
    uniqueCode: requestData?.unique_code,
    currency: requestData?.currency_type || currency
  }

  // =========================================================
  // EFECTOS
  // =========================================================

  useEffect(() => {
    console.log('🔍 useEffect loadRequestData:', { isOpen, requestId })
    if (isOpen) {
      console.log('📞 Llamando loadRequestData...')
      loadRequestData()
    } else {
      console.log('⚠️ Panel cerrado, no se carga requestData')
    }
  }, [isOpen, requestId])

  // Obtener currentUserId del usuario autenticado
  useEffect(() => {
    const getUser = async () => {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getUser()
  }, [])

  useEffect(() => {
    console.log('🔍 useEffect del panel:', { isOpen, hasRequestData: !!requestData, initialized, requestId })
    
    // Resetear initialized cuando el panel se cierra
    if (!isOpen) {
      console.log('🔄 Panel cerrado, reseteando estado')
      setInitialized(false)
      setTransaction(null)
      setRequestData(null)
      
      // Limpiar estado del chat
      setChatMessages([])
      setChatEnabled(false)
      setChatThreadId(null)
      
      // Limpiar suscripción realtime
      if (chatRealtimeChannelRef.current) {
        console.log('🧹 Limpiando suscripción realtime')
        chatRealtimeChannelRef.current.unsubscribe()
        chatRealtimeChannelRef.current = null
        currentSubscribedThreadIdRef.current = null
      }
      return
    }
    
    // Cuando el panel se abre, cargar datos
    if (isOpen && requestData && !initialized) {
      console.log('🔄 Panel abierto - cargando transacción')
      loadExistingTransaction()
      setInitialized(true)
    } else if (isOpen) {
      console.log('⚠️ Panel abierto pero no se carga transacción:', { hasRequestData: !!requestData, initialized })
    }
  }, [isOpen, requestData, initialized, requestId])

  // Estado para saber si el portal está montado
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // 🌫️ Efecto para DESENFOCAR SOLO EL CONTENIDO DE FONDO (no el panel)
  // El panel se renderiza en un Portal fuera del DOM principal, así que NO se ve afectado
  useEffect(() => {
    if (isOpen && mounted) {
      // Aplicar desenfoque solo al contenido de fondo
      // Como el panel está en un Portal fuera del DOM principal, no se ve afectado
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'blur(20px)'
        pageContent.style.transition = 'filter 0.3s ease-out'
        console.log('🌫️ Desenfoque aplicado al contenido de fondo:', pageContent)
      }
    } else {
      // Remover desenfoque cuando se cierra el panel
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'none'
        pageContent.style.transition = 'filter 0.3s ease-out'
      }
      
      if (!isOpen) {
        console.log('🌫️ Desenfoque removido del contenido de la página')
      }
    }
    
    // Cleanup: remover blur cuando el componente se desmonte
    return () => {
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'none'
      }
    }
  }, [isOpen, mounted])

  // Escuchar cambios en el status de la solicitud para cerrar el panel si se cancela
  useEffect(() => {
    if (!isOpen || !requestId) return

    const supabase = supabaseBrowser()
    
    console.log('🔔 Configurando listener para cambios de status de solicitud:', requestId)
    
    const channel = supabase
      .channel(`request_status_${requestId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'purchase_requests',
        filter: `id=eq.${requestId}`
      }, (payload) => {
        const updatedRequest = payload.new as any
        const oldRequest = payload.old as any
        
        console.log('🔔 Cambio de status detectado en solicitud:', {
          requestId,
          oldStatus: oldRequest?.status,
          newStatus: updatedRequest.status
        })
        
        // Si la solicitud fue cancelada, cerrar el panel y detener el temporizador
        if (updatedRequest.status === 'cancelled' && oldRequest?.status !== 'cancelled') {
          console.log('🚫 Solicitud cancelada detectada, cerrando panel y deteniendo temporizador')
          
          // Detener el temporizador limpiando el estado
          setTimeRemaining(null)
          
          // Cerrar el panel
          onClose()
          
          // Mostrar toast informativo
          toast({
            title: "Solicitud Cancelada",
            description: "El comprador ha cancelado esta solicitud de compra. El panel se ha cerrado.",
            variant: "destructive",
            duration: 5000,
          })
        }
      })
      .subscribe((status) => {
        console.log('🔔 Estado de suscripción para cambios de status:', status)
      })

    return () => {
      console.log('🧹 Limpiando suscripción de cambios de status')
      channel.unsubscribe()
    }
  }, [isOpen, requestId, onClose, toast])

  const loadExistingTransaction = async () => {
    if (!requestData) return
    
    try {
      const supabase = supabaseBrowser()
      
      console.log('🔍 Cargando transacción existente...')
      console.log('📋 transactionId prop:', transactionId)
      console.log('📋 requestData.id:', requestData.id)
      
      // Si se proporciona transactionId, usarlo directamente
      let query = supabase
        .from('purchase_transactions')
        .select(`
          *,
          transaction_steps (*)
        `)
      
      if (transactionId) {
        console.log('✅ Usando transactionId específico:', transactionId)
        query = query.eq('id', transactionId)
      } else {
        console.log('⚠️ Usando request_id para buscar transacción')
        query = query.eq('request_id', requestData.id)
      }
      
      const { data: existingTransaction, error } = await query.single()
      
      if (error) {
        console.log('⚠️ No existe transacción aún, se creará cuando sea necesario')
        
        // Solo crear transacción si NO hay una ya en el estado local
        if (!transaction) {
          handleCreateTransaction()
        }
        return
      }
      
      if (existingTransaction) {
        console.log('✅ Transacción existente encontrada:', existingTransaction)
        
        // Si la transacción está 'cancelled', no cargarla y crear una nueva
        if (existingTransaction.status === 'cancelled') {
          console.log('⚠️ La transacción está cancelada, creando nueva negociación...')
          handleCreateTransaction()
          return
        }
        
        // Si el deadline ya expiró, no cargar la transacción antigua
        if (existingTransaction.payment_deadline) {
          const now = new Date().getTime()
          const deadline = new Date(existingTransaction.payment_deadline).getTime()
          if (deadline < now) {
            console.log('⚠️ La transacción está expirada, creando nueva negociación...')
            handleCreateTransaction()
            return
          }
        }
        
        // Determinar el rol del usuario autenticado
        const supabase = supabaseBrowser()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Verificar si el usuario actual es el comprador o vendedor
          const isBuyer = user.id === existingTransaction.buyer_id
          const isSeller = user.id === existingTransaction.seller_id
          
          if (isBuyer) {
            setUserRole('buyer')
            console.log('👤 Usuario autenticado es COMPRADOR')
          } else if (isSeller) {
            setUserRole('seller')
            console.log('👤 Usuario autenticado es VENDEDOR')
          } else {
            console.log('⚠️ Usuario autenticado no es ni comprador ni vendedor')
          }
        }
        
        // Agregar información de usuarios
        const transactionWithUsers = {
          ...existingTransaction,
          request: requestData,
          buyer: requestData.buyer,
          seller: requestData.seller
        }
        
        setTransaction(transactionWithUsers)
        
        // Si hay payment_deadline, habilitar el chat automáticamente
        if (existingTransaction.payment_deadline) {
          setChatEnabled(true)
          console.log('💬 Chat habilitado automáticamente (transacción en progreso)')
        }
        
        return
      }
      
      // Si llegamos aquí, no hay transacción existente y tampoco en el estado local
      // Solo crear si NO hay una transacción en el estado local
      if (!transaction) {
        handleCreateTransaction()
      }
      
    } catch (error) {
      console.error('❌ Error cargando transacción existente:', error)
      // En caso de error, intentar crear una nueva transacción
      if (!transaction) {
        handleCreateTransaction()
      }
    }
  }

  // Función para manejar la expiración del tiempo (memoizada)
  const handleTimeoutExpiration = useCallback(async () => {
    console.log('⏰ Tiempo agotado - marcando solicitud como expirada')
    console.log('📋 Request ID:', requestId)
    console.log('📋 Transaction ID:', transaction?.id)
    
    try {
      const supabase = supabaseBrowser()
      
      // Marcar la solicitud como "expired" en lugar de reactivarla
      console.log('🔄 Actualizando estado de solicitud a expired...')
      console.log('📋 Request ID a actualizar:', requestId)
      
      // Intentar usar función RPC primero (más confiable, evita problemas de RLS)
      let updateSuccess = false
      try {
        console.log('🔄 Intentando actualizar vía RPC...')
        console.log('📋 Parámetros RPC:', { p_request_id: requestId })
        
        let rpcData, rpcError
        try {
          const rpcResponse = await supabase.rpc('mark_request_expired', {
            p_request_id: requestId
          })
          
          rpcData = rpcResponse.data
          rpcError = rpcResponse.error
          
          console.log('📋 Respuesta RPC completa:', rpcResponse)
          console.log('📋 Respuesta RPC - data:', rpcData)
          console.log('📋 Respuesta RPC - data type:', typeof rpcData)
          console.log('📋 Respuesta RPC - error:', rpcError)
          console.log('📋 Respuesta RPC - error type:', typeof rpcError)
          console.log('📋 Respuesta RPC - error keys:', rpcError ? Object.keys(rpcError) : 'null')
        } catch (rpcCallError) {
          console.error('❌ Excepción al llamar RPC:', rpcCallError)
          rpcError = rpcCallError
        }
        
        // Verificar si hay error (incluyendo error vacío {})
        const hasError = rpcError !== null && rpcError !== undefined
        
        if (hasError) {
          // Log detallado del error
          const errorDetails: any = {
            code: rpcError.code,
            message: rpcError.message,
            details: rpcError.details,
            hint: rpcError.hint,
            raw: rpcError
          }
          console.error('❌ Error en RPC:', errorDetails)
          console.error('📋 Error completo stringified:', JSON.stringify(rpcError, Object.getOwnPropertyNames(rpcError), 2))
          
          // Si la función RPC no existe (código 42883), error vacío {}, o hay otro error, intentar actualización directa
          const errorKeys = rpcError ? Object.keys(rpcError) : []
          const isEmptyError = errorKeys.length === 0
          const isFunctionNotFound = rpcError?.code === '42883' || 
                                    rpcError?.message?.includes('does not exist') || 
                                    rpcError?.message?.includes('function') ||
                                    isEmptyError
          
          if (isFunctionNotFound || isEmptyError) {
            console.log('⚠️ Función RPC no disponible o error vacío, intentando actualización directa...')
            console.log('📋 Razón del fallback - isEmptyError:', isEmptyError, 'isFunctionNotFound:', isFunctionNotFound)
            
            // Obtener el usuario actual para verificar permisos
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
              console.error('❌ Usuario no autenticado')
            } else {
              console.log('👤 Usuario autenticado:', user.id)
              
              const { data: updateData, error: updateError } = await supabase
                .from('purchase_requests')
                .update({
                  status: 'expired',
                  updated_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .select()
              
              if (updateError) {
                console.error('❌ Error actualizando estado de solicitud directamente:', updateError)
                console.error('📋 Detalles del error:', JSON.stringify(updateError, Object.getOwnPropertyNames(updateError), 2))
              } else {
                console.log('✅ Solicitud marcada como expirada exitosamente (actualización directa):', updateData)
                updateSuccess = true
              }
            }
          }
        } else {
          // Verificar el resultado de la función RPC
          if (rpcData) {
            const result = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData
            if (result.success) {
              console.log('✅ Solicitud marcada como expirada vía RPC:', result)
              updateSuccess = true
            } else {
              console.warn('⚠️ RPC retornó success=false:', result)
              // Intentar actualización directa como fallback
              const { data: updateData, error: updateError } = await supabase
                .from('purchase_requests')
                .update({
                  status: 'expired',
                  updated_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .select()
              
              if (!updateError && updateData) {
                console.log('✅ Actualización directa exitosa después de RPC fallido:', updateData)
                updateSuccess = true
              }
            }
          } else {
            console.warn('⚠️ RPC retornó null/undefined, intentando actualización directa...')
            const { data: updateData, error: updateError } = await supabase
              .from('purchase_requests')
              .update({
                status: 'expired',
                updated_at: new Date().toISOString()
              })
              .eq('id', requestId)
              .select()
            
            if (!updateError && updateData) {
              console.log('✅ Actualización directa exitosa:', updateData)
              updateSuccess = true
            }
          }
        }
      } catch (rpcException) {
        console.error('❌ Excepción en RPC:', rpcException)
        // Intentar actualización directa como último recurso
        try {
          const { data: updateData, error: updateError } = await supabase
            .from('purchase_requests')
            .update({
              status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .select()
          
          if (updateError) {
            console.error('❌ Error en actualización directa (último intento):', updateError)
          } else {
            console.log('✅ Solicitud marcada como expirada (actualización directa):', updateData)
            updateSuccess = true
          }
        } catch (directError) {
          console.error('❌ Error crítico en actualización directa:', directError)
        }
      }
      
      if (!updateSuccess) {
        console.warn('⚠️ No se pudo actualizar el estado de la solicitud, pero se continuará con el flujo')
      }
      
      // Si hay una transacción, también actualizarla a 'cancelled'
      if (transaction?.id) {
        console.log('🔄 Actualizando transacción a cancelled...')
        await supabase
          .from('purchase_transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id)
      }
      
      // Notificar a vendedores sobre la expiración (si la actualización fue exitosa)
      if (updateSuccess) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            console.log('📬 Enviando notificación de expiración vía RPC...')
            const { error: notifyError } = await supabase.rpc('notify_request_expired', {
              p_request_id: requestId,
              p_buyer_id: user.id
            })
            
            if (notifyError) {
              console.error('❌ Error enviando notificación de expiración:', notifyError)
            } else {
              console.log('✅ Notificación de expiración enviada')
            }
          }
        } catch (notifyErr) {
          console.error('❌ Error en notificación de expiración:', notifyErr)
        }
      }
      
      // Notificar para que se recargue la lista de solicitudes
      const expirationNotification = new CustomEvent('request-status-changed', {
        detail: { requestId, newStatus: 'expired' }
      })
      window.dispatchEvent(expirationNotification)
      
    } catch (error) {
      console.error('❌ Error manejando expiración:', error)
      console.error('📋 Tipo de error:', typeof error)
      console.error('📋 Error completo:', error)
      if (error instanceof Error) {
        console.error('📋 Mensaje de error:', error.message)
        console.error('📋 Stack trace:', error.stack)
      }
      // Continuar con el cierre del panel aunque haya errores
    }
    
    // Cerrar el panel
    onClose()
    
    // Mostrar toast informativo
    toast({
      title: "Tiempo agotado",
      description: "El tiempo para completar la transacción ha expirado. La solicitud ha sido marcada como expirada. Recargando la página...",
      variant: "destructive",
      duration: 3000,
    })
    
    // Recargar la página automáticamente después de un breve delay
    // para evitar errores y asegurar que el estado esté sincronizado
    setTimeout(() => {
      console.log('🔄 Recargando página después de expiración...')
      window.location.reload()
    }, 1500) // Esperar 1.5 segundos para que el toast se vea y la actualización se complete
  }, [requestId, transaction?.id, onClose, toast])
  
  useEffect(() => {
    // Solo iniciar temporizador si el panel está abierto Y hay un payment_deadline definido
    if (!isOpen) {
      setTimeRemaining(null)
      return
    }
    
    if (transaction?.payment_deadline) {
      console.log('⏰ Iniciando temporizador con deadline:', transaction.payment_deadline)
      
      // Calcular tiempo restante inmediatamente
      const now = new Date().getTime()
      const deadline = new Date(transaction.payment_deadline).getTime()
      const initialRemaining = deadline - now
      
      if (initialRemaining > 0) {
        console.log('⏰ Tiempo restante inicial:', initialRemaining, 'ms')
        setTimeRemaining(initialRemaining)
        
        // Actualizar cada segundo
        const interval = setInterval(() => {
          const now2 = new Date().getTime()
          const deadline2 = new Date(transaction.payment_deadline).getTime()
          const remaining = deadline2 - now2
          
          if (remaining > 0) {
            setTimeRemaining(remaining)
          } else {
            console.log('⏰ Tiempo agotado, cerrando panel')
            setTimeRemaining(0)
            clearInterval(interval)
            
            // Cuando el tiempo se agota, cerrar el panel y reactivar la solicitud
            handleTimeoutExpiration()
          }
        }, 1000)

        return () => clearInterval(interval)
      } else {
        // Si el deadline ya expiró, NO cerrar el panel automáticamente
        // Solo marcar el temporizador como expirado
        console.warn('⏰ El deadline ya expiró al cargar, mostrando tiempo expirado sin cerrar panel')
        setTimeRemaining(0)
      }
    } else {
      // Si no hay deadline, no mostrar temporizador
      console.log('⏰ No hay deadline, no se inicia temporizador')
      setTimeRemaining(null)
    }
  }, [isOpen, transaction?.payment_deadline, handleTimeoutExpiration])

  // =========================================================
  // FUNCIONES
  // =========================================================

  // Obtener descripción del paso según el rol
  const getStepDescription = (stepIndex: number, stepStatus: string) => {
    if (!userRole) return ''
    
    const isCompleted = stepStatus === 'completed'
    const isInProgress = stepStatus === 'in_progress'
    const isPending = stepStatus === 'pending'
    
    switch (stepIndex) {
      case 0: // Paso 1: Aceptar el trato
        if (userRole === 'seller') {
          if (isCompleted) return 'Trato aceptado correctamente'
          return 'Haga clic en "Aceptar Trato" para comenzar la transacción'
        } else {
          if (isCompleted) return 'El vendedor aceptó el trato. Puede proceder con el pago'
          return 'Esperando a que el vendedor acepte el trato'
        }
      
      case 1: // Paso 2: Pago en proceso
        if (userRole === 'buyer') {
          if (isInProgress) return 'Realice el pago antes de que expire el temporizador'
          if (isCompleted) return 'Pago completado, a la espera de verificación'
          return 'Realice el pago una vez que el vendedor acepte el trato'
        } else {
          if (isInProgress) return 'Esperando a que el comprador realice el pago'
          if (isCompleted) return 'Pago recibido, a la espera de confirmación'
          return 'Esperando que el comprador inicie el pago'
        }
      
      case 2: // Paso 3: Verificación del recibo
        if (userRole === 'buyer') {
          if (isInProgress) return 'Esperando a que el vendedor verifique el recibo'
          if (isCompleted) return 'Recibo verificado correctamente'
          return 'Subida de comprobante pendiente'
        } else {
          if (isInProgress) return 'Verifique el comprobante de pago del comprador'
          if (isCompleted) return 'Recibo verificado y confirmado'
          return 'Esperando comprobante de pago del comprador'
        }
      
      case 3: // Paso 4: Liberación de fondos
        if (userRole === 'buyer') {
          if (isInProgress) return 'Esperando la liberación de fondos'
          if (isCompleted) return 'Fondos liberados exitosamente'
          return 'Los fondos se liberarán después de la verificación'
        } else {
          if (isInProgress) return 'Proceso de liberación de fondos en curso'
          if (isCompleted) return 'Fondos liberados al comprador'
          return 'Los fondos se liberarán después de verificar el pago'
        }
      
      default:
        return ''
    }
  }
  
  // Obtener acción disponible según el paso y rol
  const getStepAction = (stepIndex: number, stepStatus: string) => {
    if (!userRole || !transaction) return null
    
    const isCompleted = stepStatus === 'completed'
    const isInProgress = stepStatus === 'in_progress'
    
    switch (stepIndex) {
      case 0: // Paso 1: Aceptar trato
        if (userRole === 'seller' && !isCompleted) {
          return { 
            label: 'Aceptar Trato', 
            action: 'acceptDeal',
            disabled: false 
          }
        }
        return null
      
      case 1: // Paso 2: Realizar/verificar pago
        if (userRole === 'buyer' && isInProgress && !isCompleted) {
          return { 
            label: 'Confirmar Pago Realizado', 
            action: 'confirmPayment',
            disabled: false 
          }
        }
        return null
      
      case 2: // Paso 3: Verificar recibo
        if (userRole === 'seller' && isInProgress && !isCompleted) {
          return { 
            label: 'Verificar Recibo', 
            action: 'verifyReceipt',
            disabled: false 
          }
        }
        return null
      
      case 3: // Paso 4: Liberar fondos
        if (userRole === 'seller' && isInProgress && !isCompleted) {
          return { 
            label: 'Liberar Fondos', 
            action: 'releaseFunds',
            disabled: false 
          }
        }
        return null
      
      default:
        return null
    }
  }

  const loadRequestData = async () => {
    console.log('🚀 loadRequestData llamado con requestId:', requestId)
    try {
      const supabase = supabaseBrowser()
      
      console.log('🔍 Cargando información completa de la solicitud:', requestId)
      
      // Intentar obtener información completa de la solicitud
      const { data: request, error: requestError } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      
      console.log('📥 Respuesta de BD:', { request, error: requestError })

      // Si hay error o no hay datos, lanzar error
      if (requestError || !request) {
        console.error('❌ No se encontró la solicitud en BD:', requestError)
        console.error('📋 Detalles del error:', JSON.stringify(requestError, null, 2))
        throw new Error(`No se pudo cargar la solicitud: ${requestError?.message || 'Solicitud no encontrada'}`)
      }
      
      console.log('✅ Solicitud cargada:', request.id)

      // Intentar obtener información de usuarios
      let buyerInfo = { id: request.buyer_id, full_name: 'Comprador', avatar_url: null, verification_status: 'unverified' }
      let sellerInfo = { id: sellerId, full_name: 'Vendedor', avatar_url: null, verification_status: 'unverified' }

      // Intentar cargar información del comprador (buyer_id)
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', [request.buyer_id])

        if (profiles && profiles.length > 0) {
          const buyerProfile = profiles.find(p => p.id === request.buyer_id)
          if (buyerProfile) {
            buyerInfo.full_name = buyerProfile.full_name || 'Comprador'
            buyerInfo.avatar_url = buyerProfile.avatar_url
            buyerInfo.id = buyerProfile.id
            console.log('✅ Info del comprador cargada:', buyerInfo)
          }
        }
        
        // Intentar obtener el estado de verificación KYC del comprador
        try {
          const { data: kycData } = await supabase
            .from('kyc_submissions')
            .select('status')
            .eq('user_id', request.buyer_id)
            .single()
          
          if (kycData && kycData.status) {
            buyerInfo.verification_status = kycData.status
            console.log('✅ Estado de verificación del comprador:', kycData.status)
          }
        } catch (kycErr) {
          console.log('⚠️ No se pudo cargar el estado KYC del comprador:', kycErr)
        }
      } catch (err) {
        console.log('⚠️ Error cargando info del comprador desde profiles:', err)
        
        // Intentar con user_profiles como fallback
        try {
          const { data: buyerData } = await supabase
            .from('user_profiles')
            .select('full_name, avatar_url')
            .eq('id', request.buyer_id)
            .single()

          if (buyerData) {
            buyerInfo.full_name = buyerData.full_name || 'Comprador'
            buyerInfo.avatar_url = buyerData.avatar_url
            console.log('✅ Info del comprador cargada (user_profiles):', buyerInfo)
          }
        } catch (err2) {
          console.log('⚠️ No se pudo cargar info del comprador desde ninguna tabla')
        }
      }

      // Intentar cargar información del vendedor
      try {
        const { data: sellerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', [sellerId])

        if (sellerProfiles && sellerProfiles.length > 0) {
          const sellerProfile = sellerProfiles.find(p => p.id === sellerId)
          if (sellerProfile) {
            sellerInfo.full_name = sellerProfile.full_name || 'Vendedor'
            sellerInfo.avatar_url = sellerProfile.avatar_url
            console.log('✅ Info del vendedor cargada:', sellerInfo)
          }
        }
      } catch (err) {
        console.log('⚠️ Error cargando info del vendedor, intentando con user_profiles:', err)
        
        // Intentar con user_profiles como fallback
        try {
          const { data: sellerData } = await supabase
            .from('user_profiles')
            .select('full_name, avatar_url')
            .eq('id', sellerId)
            .single()

          if (sellerData) {
            sellerInfo.full_name = sellerData.full_name || 'Vendedor'
            sellerInfo.avatar_url = sellerData.avatar_url
          }
        } catch (err2) {
          console.log('⚠️ No se pudo cargar info del vendedor desde ninguna tabla')
        }
      }

      const requestWithUsers = {
        ...request,
        buyer: buyerInfo,
        seller: sellerInfo
      }

      console.log('✅ Solicitud cargada con usuarios:', requestWithUsers)
      console.log('📝 Estableciendo requestData...')
      setRequestData(requestWithUsers)
      console.log('✅ requestData establecido')

    } catch (error) {
      console.error('❌ Error inesperado cargando solicitud:', error)
      throw error
    }
  }

  const handleCreateTransaction = async () => {
    if (!requestData) return

    // Obtener el ID del usuario autenticado (vendedor que acepta la solicitud)
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('❌ No hay usuario autenticado')
      return
    }
    
    // LÓGICA CORREGIDA:
    // - El COMPRADOR es quien publicó la solicitud (requestData.buyer_id)
    // - El VENDEDOR es quien acepta/clica "Negociar" (user.id - usuario autenticado)
    
    const actualBuyerId = requestData.buyer_id  // Quien publicó la solicitud (COMPRADOR)
    const actualSellerId = user.id             // Quien acepta la solicitud (VENDEDOR)

    // Determinar el rol del usuario autenticado
    const isCurrentUserBuyer = user.id === actualBuyerId
    const isCurrentUserSeller = user.id === actualSellerId
    
    setUserRole(isCurrentUserBuyer ? 'buyer' : 'seller')

    console.log('📊 Identificación de roles:')
    console.log('👤 requestData.buyer_id:', requestData.buyer_id)
    console.log('👤 actualBuyerId (COMPRADOR):', actualBuyerId)
    console.log('👤 requestData.buyer:', requestData.buyer)
    console.log('👨‍💼 actualSellerId (VENDEDOR):', actualSellerId)
    console.log('💰 Monto:', requestData.amount)
    console.log('🎭 Rol del usuario actual:', isCurrentUserBuyer ? 'COMPRADOR' : 'VENDEDOR')

    const result = await createTransaction({
      request_id: requestData.id,
      seller_id: actualSellerId,      // Usuario autenticado = VENDEDOR
      buyer_id: actualBuyerId,        // Quien publicó = COMPRADOR
      amount: requestData.amount || amount,
      currency: requestData.currency_type || currency,
      payment_method: requestData.payment_method || paymentMethod,
      payment_details: {}
    })

    if (result.success) {
      // Si no hay pasos en la respuesta, crearlos desde cero
      let steps = result.data.transaction_steps || []
      
      // Si no hay pasos, crearlos manualmente
      if (steps.length === 0) {
        steps = [
          {
            id: `temp-step-1-${Date.now()}`,
            transaction_id: result.data.id,
            step_name: 'accept_deal',
            step_order: 1,
            step_description: 'Aceptar el trato',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: `temp-step-2-${Date.now() + 1}`,
            transaction_id: result.data.id,
            step_name: 'payment_process',
            step_order: 2,
            step_description: 'Proceso de pago',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: `temp-step-3-${Date.now() + 2}`,
            transaction_id: result.data.id,
            step_name: 'receipt_verification',
            step_order: 3,
            step_description: 'Verificación del recibo',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: `temp-step-4-${Date.now() + 3}`,
            transaction_id: result.data.id,
            step_name: 'fund_release',
            step_order: 4,
            step_description: 'Liberación de fondos',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        console.log('✅ Pasos creados manualmente:', steps)
      }
      
      // Agregar información de la solicitud a la transacción
      const transactionWithRequest = {
        ...result.data,
        request: requestData,
        buyer: requestData.buyer,
        seller: requestData.seller,
        transaction_steps: steps
      }
      console.log('✅ Transacción creada con pasos:', transactionWithRequest)
      setTransaction(transactionWithRequest)
      onTransactionCreated?.(result.data.id)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!transaction) return

    const result = await updateStatus({
      transaction_id: transaction.id,
      new_status: newStatus,
      user_id: buyerId
    })

    if (result.success) {
      setTransaction(result.data)
    }
  }

  const handleDocumentUpload = async (file: File) => {
    if (!transaction) return

    const documentUrl = `https://example.com/documents/${file.name}`
    
    const result = await uploadDocument({
      transaction_id: transaction.id,
      document_type: 'payment_proof',
      document_name: file.name,
      document_url: documentUrl,
      file_size: file.size,
      mime_type: file.type
    })

    if (result.success) {
      if (buyerId === transaction.buyer_id) {
        await handleUpdateStatus('payment_verified')
      }
    }
  }

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Función para traducir estados
  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': 'Activa',
      'pending': 'Pendiente',
      'completed': 'Completada',
      'cancelled': 'Cancelada',
      'negotiating': 'En negociación'
    }
    return statusMap[status] || status
  }

  // Función para obtener nombre amigable del método de pago
  const getPaymentMethodDisplayName = (method: string) => {
    const methodMap: Record<string, string> = {
      'local_transfer': 'Transferencia local',
      'bank_transfer': 'Transferencia bancaria',
      'paypal': 'PayPal',
      'wise': 'Wise',
      'zelle': 'Zelle',
      'cashapp': 'Cash App'
    }
    return methodMap[method] || method
  }

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      // Aquí implementarías el envío del mensaje
      console.log('Enviando mensaje:', chatMessage)
      setChatMessage('')
    }
  }


  // Renderizar el panel usando Portal directamente en el body
  // Esto asegura que esté completamente fuera del DOM principal y no se vea afectado por el blur
  const panelContent = (
    <div 
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${!isOpen ? 'hidden' : ''}`} 
      data-panel-overlay="true"
      style={{ 
        filter: 'none', 
        backdropFilter: 'none'
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden relative"
        data-panel-content="true"
        style={{
          filter: 'none !important',
          backdropFilter: 'none !important',
          isolation: 'isolate' // Crear nuevo contexto de apilamiento
        }}
      >
        {/* Botón de cerrar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex h-[90vh]">
          {/* Panel Izquierdo - Detalles de Compra */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 p-6">
            <div className="space-y-6">
              {/* Resumen de Compra */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Compra de HNLD
                </h2>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  Total: {requestData?.currency_type || currency} {requestData?.amount?.toLocaleString() || amount.toLocaleString()}
                </div>
                {/* Aviso sobre cambio de divisa para USD y EUR */}
                {(requestData?.currency_type === 'USD' || requestData?.currency_type === 'EUR' || currency === 'USD' || currency === 'EUR') && (
                  <div className="mb-2">
                    <Alert className="bg-blue-50 border-blue-200 py-2 px-3">
                      <AlertCircle className="h-3 w-3 text-blue-600 mr-1.5" />
                      <AlertDescription className="text-xs text-blue-800 leading-tight">
                        La cantidad de HNLD es equivalente al cambio de divisa actual.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Código: {requestData?.unique_code || `NMHN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(requestId.slice(-6)).toUpperCase()}`}
                </div>
              </div>

              {/* Método de Pago */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Método de Pago Aceptado:</h3>
                <div className="bg-white border border-gray-300 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-900">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">
                      {getPaymentMethodDisplayName(requestData?.payment_method || paymentMethod)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Información del Comprador o Vendedor (según el rol) */}
              {requestData && userRole && (
                (() => {
                  // Si es el comprador, mostrar información del vendedor
                  // Si es el vendedor, mostrar información del comprador
                  const counterpartyInfo = userRole === 'buyer' 
                    ? requestData.seller 
                    : requestData.buyer
                  
                  const counterpartyRole = userRole === 'buyer' ? 'Vendedor' : 'Comprador'
                  
                  return (
                    <div className={`${userRole === 'buyer' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                      <h3 className={`text-sm font-medium mb-2 ${userRole === 'buyer' ? 'text-green-800' : 'text-blue-800'}`}>
                        {counterpartyRole}
                      </h3>
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 ${userRole === 'buyer' ? 'bg-green-100' : 'bg-blue-100'} rounded-full flex items-center justify-center`}>
                          {counterpartyInfo?.avatar_url ? (
                            <img 
                              src={counterpartyInfo.avatar_url} 
                              alt={counterpartyInfo.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <User className={`h-5 w-5 ${userRole === 'buyer' ? 'text-green-600' : 'text-blue-600'}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className={`text-sm font-medium ${userRole === 'buyer' ? 'text-green-900' : 'text-blue-900'}`}>
                              {counterpartyInfo?.full_name || counterpartyRole}
                            </div>
                            <div className="flex space-x-1">
                              {(() => {
                                const verification = counterpartyInfo?.verification_status || 'unverified'
                                
                                // Mostrar nivel de verificación según el estado KYC
                                let verificationLevel = 0
                                if (verification === 'approved') {
                                  verificationLevel = 4
                                } else if (verification === 'review') {
                                  verificationLevel = 2
                                } else {
                                  verificationLevel = 0
                                }
                                
                                return Array.from({ length: 4 }, (_, i) => {
                                  if (i < verificationLevel) {
                                    return <CheckCircle key={i} className="h-3 w-3 text-green-500" />
                                  } else {
                                    return <Circle key={i} className="h-3 w-3 text-gray-300" />
                                  }
                                })
                              })()}
                            </div>
                          </div>
                          <div className={`text-xs mt-1 ${userRole === 'buyer' ? 'text-green-700' : 'text-blue-700'}`}>
                            Verificación: {
                              (() => {
                                const verification = counterpartyInfo?.verification_status || 'unverified'
                                if (verification === 'approved') return 'Verificado'
                                if (verification === 'review') return 'En revisión'
                                if (verification === 'rejected') return 'Rechazado'
                                return 'No verificado'
                              })()
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()
              )}

              {/* Temporizador */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                {transaction?.payment_deadline ? (
                  <>
                    <div className="flex items-center space-x-2 mb-2">
                      <Timer className="h-5 w-5 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Temporizador:</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {timeRemaining ? formatTimeRemaining(timeRemaining) : '00:00'}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-500">Esperando aceptación del trato</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel Central - Flujo de Transacción y Escrow */}
          <div className="flex-1 p-6">
            <div className="space-y-6">
              {/* Información de Escrow */}
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Lock className="h-6 w-6 text-green-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-green-800">Fondos en custodia NMHN</h3>
                      <p className="text-sm text-green-700">Estado: Protegidos</p>
                      <p className="text-xs text-green-600 mt-1">
                        Si surge una disputa, NMHN actuará como árbitro.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pasos de la Transacción */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Pasos de la Transacción</h3>
                {(() => {
                  // BUSCAR el paso con step_order === 1 (Paso 1) y step_order === 2 (Paso 2)
                  const allSteps = transaction?.transaction_steps || []
                  const step1 = allSteps.find(s => s.step_order === 1)
                  const step2 = allSteps.find(s => s.step_order === 2)
                  
                  // DEBUG removido para evitar re-renders infinitos
                  
                  return userRole && (
                    <div className="bg-blue-50 p-2 rounded text-xs">
                      <strong>Rol:</strong> {userRole === 'buyer' ? 'COMPRADOR' : 'VENDEDOR'}
                      {' | '}
                      <strong>Paso 1:</strong> {step1?.status || 'undefined'}
                      {' | '}
                      <strong>Paso 2:</strong> {step2?.status || 'undefined'}
                    </div>
                  )
                })()}
                
                {/* Paso 1 - Aceptar trato */}
                {(() => {
                  const allSteps = transaction?.transaction_steps || []
                  const step1 = allSteps.find(s => s.step_order === 1)
                  const step1Status = step1?.status || 'pending'
                  
                  return (
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step1Status === 'completed' 
                          ? 'bg-green-500' 
                          : 'bg-orange-500'
                      }`}>
                        {step1Status === 'completed' ? (
                          <CheckCircle className="h-4 w-4 text-white" />
                        ) : (
                          <Clock className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${
                          step1Status === 'completed' 
                            ? 'text-gray-900' 
                            : 'text-orange-700'
                        }`}>
                          Aceptar el trato
                        </h4>
                        <p className="text-sm text-gray-600">
                          {getStepDescription(0, step1Status)}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Paso 2 - Pago en proceso */}
                {(() => {
                  const allSteps = transaction?.transaction_steps || []
                  const step2 = allSteps.find(s => s.step_order === 2)
                  const step2Status = step2?.status || 'pending'
                  
                  return (
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step2Status === 'in_progress' 
                          ? 'bg-blue-500' 
                          : 'bg-gray-300'
                      }`}>
                        {step2Status === 'in_progress' ? (
                          <AlertCircle className="h-4 w-4 text-white" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${
                          step2Status === 'in_progress' 
                            ? 'text-gray-900' 
                            : 'text-gray-500'
                        }`}>
                          Pago en proceso
                        </h4>
                        <p className={`text-sm ${
                          step2Status === 'in_progress' 
                            ? 'text-gray-600' 
                            : 'text-gray-400'
                        }`}>
                          {getStepDescription(1, step2Status)}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Paso 3 - Verificación del recibo */}
                {(() => {
                  const allSteps = transaction?.transaction_steps || []
                  const step3 = allSteps.find(s => s.step_order === 3)
                  const step3Status = step3?.status || 'pending'
                  
                  return (
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <Circle className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-500">Verificación del recibo</h4>
                        <p className="text-sm text-gray-400">
                          {getStepDescription(2, step3Status)}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Paso 4 - Liberación de fondos */}
                {(() => {
                  const allSteps = transaction?.transaction_steps || []
                  const step4 = allSteps.find(s => s.step_order === 4)
                  const step4Status = step4?.status || 'pending'
                  
                  return (
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <Circle className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-500">Liberación de fondos</h4>
                        <p className="text-sm text-gray-400">
                          {getStepDescription(3, step4Status)}
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Botones de Acción según el Paso Actual */}
              {/* Botón para Paso 1 - Aceptar Trato (solo vendedor) */}
              {(() => {
                const allSteps = transaction?.transaction_steps || []
                const step1 = allSteps.find(s => s.step_order === 1)
                const step1Status = step1?.status || 'pending'
                return step1Status !== 'completed'
              })() && (
                <div className="pt-4">
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 text-lg font-semibold"
                    onClick={async () => {
                      try {
                        console.log('✅ Vendedor aceptando el trato')
                        
                        const now = new Date()
                        const paymentDeadline = new Date(now.getTime() + 15 * 60 * 1000).toISOString() // 15 minutos
                        const verificationDeadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString() // 30 minutos
                        
                        const supabase = supabaseBrowser()
                        
                        // 1. Actualizar transacción en la base de datos
                        const { error: updateError } = await supabase
                          .from('purchase_transactions')
                          .update({
                            payment_deadline: paymentDeadline,
                            verification_deadline: verificationDeadline,
                            agreement_confirmed_at: now.toISOString(),
                            status: 'agreement_confirmed'
                          })
                          .eq('id', transaction?.id)
                        
                        if (updateError) {
                          console.error('Error actualizando transacción:', updateError)
                          return
                        }
                        
                        // 2. Actualizar transacción localmente
                        setTransaction(prev => {
                          if (!prev) return prev
                          console.log('🔄 Pasos antes de actualizar:', prev.transaction_steps)
                          
                          const updatedSteps = prev.transaction_steps?.map((step, idx) => {
                            if (idx === 0) {
                              // Paso 1: Completado
                              console.log('✅ Actualizando paso 1 a completado')
                              return { ...step, status: 'completed', completed_at: now.toISOString() }
                            } else if (idx === 1) {
                              // Paso 2: En progreso
                              console.log('⏳ Actualizando paso 2 a en progreso')
                              return { ...step, status: 'in_progress' }
                            }
                            return step
                          }) || []
                          
                          console.log('🔄 Pasos después de actualizar:', updatedSteps)
                          
                          const updatedTransaction = {
                            ...prev,
                            payment_deadline: paymentDeadline,
                            verification_deadline: verificationDeadline,
                            agreement_confirmed_at: now.toISOString(),
                            status: 'agreement_confirmed',
                            transaction_steps: updatedSteps
                          }
                          
                          console.log('✅ Transacción actualizada:', updatedTransaction)
                          return updatedTransaction
                        })
                        
                        // 3. Actualizar estado de la solicitud a "accepted" en la BD (sin cambiar negotiating fields)
                        try {
                          console.log('🔄 Actualizando estado de solicitud a "accepted"')
                          console.log('📋 Request ID:', requestId)
                          console.log('📋 Seller ID:', sellerId)
                          
                          const { data: updateData, error: requestUpdateError } = await supabase
                            .from('purchase_requests')
                            .update({
                              status: 'accepted',
                              seller_id: sellerId,
                              accepted_at: now.toISOString(),
                              updated_at: now.toISOString()
                            })
                            .eq('id', requestId)
                            .select()
                            
                          console.log('📊 Intentando actualizar solicitud:', {
                            requestId,
                            sellerId,
                            updateData,
                            error: requestUpdateError
                          })
                          
                          if (requestUpdateError) {
                            console.error('❌ No se pudo actualizar el estado en la BD:', requestUpdateError)
                            console.error('📋 Detalles del error:', JSON.stringify(requestUpdateError, null, 2))
                            // No es crítico, continuamos con el flujo
                          } else {
                            console.log('✅ Estado de solicitud actualizado a "accepted" en la BD:', updateData)
                          }
                          
                          // Notificar al comprador para que recargue la página
                          const updateNotification = new CustomEvent('request-status-changed', {
                            detail: { requestId, newStatus: 'accepted' }
                          })
                          window.dispatchEvent(updateNotification)
                          
                          console.log('✅ Evento request-status-changed disparado')
                        } catch (requestErr) {
                          console.error('❌ Error en actualización de solicitud:', requestErr)
                          // Continuar con el flujo aunque falle la actualización
                        }
                        
                        // 4. HABILITAR EL CHAT
                        setChatEnabled(true)
                        console.log('💬 Chat habilitado')
                        
                        // 4. INICIAR EL TEMPORIZADOR (se iniciará automáticamente con el useEffect que depende de payment_deadline)
                        
                        // 5. ENVIAR NOTIFICACIÓN AL COMPRADOR
                        try {
                          // Obtener el buyer_id de la transacción
                          const buyerId = transaction?.buyer_id
                          
                          console.log('📬 Intentando enviar notificación al comprador:', buyerId)
                          
                          if (buyerId && requestData) {
                            // Obtener información del vendedor y formatear datos
                            const sellerName = requestData.seller?.full_name || 
                                             (requestData.seller_id ? 'Vendedor' : 'Un vendedor')
                            
                            // Formatear monto según moneda
                            const currencySymbol = requestData.currency_type === 'USD' ? '$' : 
                                                 requestData.currency_type === 'EUR' ? '€' : 'L.'
                            const formattedAmount = currencySymbol + 
                              new Intl.NumberFormat('es-HN').format(requestData.amount || amount || 0)
                            
                            // Construir el título con el código (si existe)
                            let notificationTitle = 'Solicitud aceptada'
                            if (requestData.unique_code) {
                              notificationTitle = notificationTitle + '\n' + requestData.unique_code
                            }
                            
                            // Construir el cuerpo con formato: (nombre) aceptó tu solicitud por (cantidad).
                            let notificationBody = sellerName + ' aceptó tu solicitud por ' + formattedAmount + '.'
                            
                            // Llamar a la función emit_notification en la BD
                            const { data: notificationData, error: notificationError } = await supabase.rpc('emit_notification', {
                              p_user_id: buyerId,
                              p_topic: 'order',
                              p_event: 'ORDER_ACCEPTED',
                              p_title: notificationTitle,
                              p_body: notificationBody,
                              p_priority: 'high',
                              p_cta_label: 'Ver transacción',
                              p_cta_href: `/dashboard/mis-solicitudes`,
                              p_payload: {
                                transaction_id: transaction?.id,
                                request_id: requestId,
                                amount: requestData.amount || amount,
                                currency_type: requestData.currency_type || currency,
                                unique_code: requestData.unique_code,
                                formatted_amount: formattedAmount
                              }
                            })
                            
                            if (notificationError) {
                              console.error('❌ Error enviando notificación:', notificationError)
                              console.error('📋 Detalles del error:', JSON.stringify(notificationError, null, 2))
                            } else {
                              console.log('✅ Notificación enviada al comprador:', notificationData)
                            }
                          } else {
                            console.warn('⚠️ No se encontró buyer_id en la transacción o requestData no está disponible')
                          }
                        } catch (notificationErr) {
                          console.error('❌ Error en envío de notificación:', notificationErr)
                        }
                        
                        // 6. Actualizar pasos en la BD (no crítico si falla)
                        try {
                          // Actualizar paso 1 a completado
                          await supabase
                            .from('transaction_steps')
                            .update({
                              status: 'completed',
                              completed_at: now.toISOString()
                            })
                            .eq('transaction_id', transaction?.id)
                            .eq('step_order', 1)
                          
                          // Actualizar paso 2 a en progreso
                          await supabase
                            .from('transaction_steps')
                            .update({
                              status: 'in_progress'
                            })
                            .eq('transaction_id', transaction?.id)
                            .eq('step_order', 2)
                          
                          console.log('✅ Pasos actualizados en la base de datos')
                          
                          // Recargar la transacción desde la base de datos para sincronizar
                          if (transaction?.id) {
                            const { data: updatedTransaction, error: fetchError } = await supabase
                              .from('purchase_transactions')
                              .select(`
                                *,
                                transaction_steps (*)
                              `)
                              .eq('id', transaction.id)
                              .single()
                            
                            if (!fetchError && updatedTransaction) {
                              const transactionWithUsers = {
                                ...updatedTransaction,
                                request: requestData,
                                buyer: requestData.buyer,
                                seller: requestData.seller
                              }
                              setTransaction(transactionWithUsers)
                              console.log('🔄 Transacción recargada desde la BD:', transactionWithUsers)
                            }
                          }
                        } catch (stepError) {
                          console.log('⚠️ No se pudieron actualizar los pasos (problema de permisos RLS):', stepError)
                        }
                        
                      } catch (error) {
                        console.error('Error en aceptar trato:', error)
                      }
                    }}
                    disabled={loading || userRole !== 'seller'}
                  >
                    {userRole === 'seller' ? 'Aceptar Trato' : 'Esperando aceptación del vendedor'}
                  </Button>
                </div>
              )}
              
              {/* Botón para Paso 2 - Confirmar Pago (solo comprador) */}
              {(() => {
                const allSteps = transaction?.transaction_steps || []
                const step1 = allSteps.find(s => s.step_order === 1)
                const step2 = allSteps.find(s => s.step_order === 2)
                const step1Completed = step1?.status === 'completed'
                const step2InProgress = step2?.status === 'in_progress'
                return step1Completed && step2InProgress && userRole === 'buyer'
              })() && (
                <div className="pt-4">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                    onClick={async () => {
                      try {
                        console.log('✅ Comprador confirmando pago realizado')
                        
                        const now = new Date()
                        const supabase = supabaseBrowser()
                        
                        // 1. Actualizar paso 2 a completado
                        const { error: stepUpdateError } = await supabase
                          .from('transaction_steps')
                          .update({
                            status: 'completed',
                            completed_at: now.toISOString()
                          })
                          .eq('transaction_id', transaction?.id)
                          .eq('step_order', 2)
                        
                        if (stepUpdateError) {
                          console.error('❌ Error actualizando paso 2:', stepUpdateError)
                          return
                        }
                        
                        // 2. Actualizar paso 3 a en progreso
                        await supabase
                          .from('transaction_steps')
                          .update({
                            status: 'in_progress'
                          })
                          .eq('transaction_id', transaction?.id)
                          .eq('step_order', 3)
                        
                        // 3. Actualizar transacción local
                        setTransaction(prev => {
                          if (!prev) return prev
                          const updatedSteps = prev.transaction_steps?.map((step, idx) => {
                            if (idx === 1) {
                              return { ...step, status: 'completed', completed_at: now.toISOString() }
                            } else if (idx === 2) {
                              return { ...step, status: 'in_progress' }
                            }
                            return step
                          }) || []
                          
                          return {
                            ...prev,
                            transaction_steps: updatedSteps
                          }
                        })
                        
                        console.log('✅ Pago confirmado por el comprador')
                        
                        // 4. Recargar transacción desde la BD
                        const { data: updatedTransaction, error: fetchError } = await supabase
                          .from('purchase_transactions')
                          .select(`
                            *,
                            transaction_steps (*)
                          `)
                          .eq('id', transaction.id)
                          .single()
                        
                        if (!fetchError && updatedTransaction) {
                          const transactionWithUsers = {
                            ...updatedTransaction,
                            request: requestData,
                            buyer: requestData.buyer,
                            seller: requestData.seller
                          }
                          setTransaction(transactionWithUsers)
                          console.log('🔄 Transacción recargada desde la BD:', transactionWithUsers)
                        }
                        
                      } catch (error) {
                        console.error('Error confirmando pago:', error)
                      }
                    }}
                    disabled={loading || userRole !== 'buyer'}
                  >
                    Confirmar Pago Realizado
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Panel Derecho - Chat entre las Partes */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
            {/* Header del Chat */}
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Chat de Negociación
              </h3>
              {requestInfo && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mt-2">
                  <span className="font-semibold text-gray-900">
                    {requestInfo.currency} {requestInfo.amount?.toLocaleString()}
                  </span>
                  <span>•</span>
                  <span>{getPaymentMethodDisplayName(requestInfo.paymentMethod)}</span>
                </div>
              )}
            </div>

            {/* Contenido del Chat */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {!chatEnabled ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm text-gray-500 text-center">
                    El chat se habilitará cuando el vendedor acepte el trato
                  </p>
                </div>
              ) : chatHook.isLoading ? (
                <div className="text-center text-sm text-gray-500 py-8">
                  Cargando chat...
                </div>
              ) : chatHook.messages && chatHook.messages.length > 0 ? (
                <div className="space-y-3">
                  {chatHook.messages.map((msg: any) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs rounded-lg px-3 py-2 ${
                        msg.sender_id === currentUserId 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}>
                        <p className="text-sm">{msg.body}</p>
                        
                        {/* Mostrar adjuntos/documentos si existen */}
                        {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map((attachment: any, idx: number) => (
                              <a
                                key={idx}
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center space-x-2 p-2 rounded ${
                                  msg.sender_id === currentUserId 
                                    ? 'bg-blue-700 hover:bg-blue-800' 
                                    : 'bg-gray-100 hover:bg-gray-200'
                                } transition-colors`}
                              >
                                <File className={`h-4 w-4 ${
                                  msg.sender_id === currentUserId ? 'text-white' : 'text-gray-600'
                                }`} />
                                <span className={`text-xs truncate ${
                                  msg.sender_id === currentUserId ? 'text-white' : 'text-gray-700'
                                }`}>
                                  {attachment.name || 'Documento'}
                                </span>
                              </a>
                            ))}
                            {msg.attachments.some((att: any) => att.type?.startsWith('image/')) && (
                              <div className="mt-2">
                                {msg.attachments
                                  .filter((att: any) => att.type?.startsWith('image/'))
                                  .map((attachment: any, idx: number) => (
                                    <img 
                                      key={idx}
                                      src={attachment.url} 
                                      alt={attachment.name || 'Imagen'}
                                      className="max-w-full max-h-32 rounded"
                                    />
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <p className={`text-xs mt-1 ${
                          msg.sender_id === currentUserId 
                            ? 'text-blue-100' 
                            : 'text-gray-500'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500 py-8">
                  No hay mensajes todavía
                </div>
              )}
            </div>

            {/* Input del Chat */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileUpload(file)
                  }
                }}
                disabled={!chatEnabled || uploadingFile}
              />
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!chatEnabled || uploadingFile}
                  title="Adjuntar documento"
                >
                  {uploadingFile ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Input
                  placeholder={chatEnabled ? "Escribe tu mensaje..." : "El chat se habilitará al aceptar el trato"}
                  className="flex-1"
                  disabled={!chatEnabled}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter' && chatMessage.trim() && chatEnabled) {
                      await chatHook.send(chatMessage)
                      setChatMessage('')
                    }
                  }}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    if (chatMessage.trim() && chatEnabled) {
                      await chatHook.send(chatMessage)
                      setChatMessage('')
                    }
                  }}
                  disabled={chatHook.isSending || !chatEnabled}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // NO retornar null - el componente debe montarse para que los useEffect funcionen
  // Solo renderizar el panel si está montado (SSR-safe)
  if (!mounted) {
    return null
  }

  // Renderizar el panel usando Portal directamente en document.body
  // Esto asegura que esté completamente fuera del DOM principal y NO se vea afectado por el blur
  // El panel está en position: fixed y se renderiza fuera del árbol DOM principal
  return isOpen ? createPortal(panelContent, document.body) : null
} 
