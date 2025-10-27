'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  Plus
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
  
  // Cargar mensajes del chat
  const loadChatMessages = async () => {
    if (!transaction?.id || !chatEnabled) return
    
    try {
      setChatLoading(true)
      const supabase = supabaseBrowser()
      
      // Intentar obtener o crear un thread simple
      const { data: threads } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('context_id', transaction.id)
        .eq('context_type', 'order')
        .limit(1)
      
      if (threads && threads.length > 0) {
        const thread = threads[0]
        
        // Cargar mensajes del thread
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', thread.id)
          .order('created_at', { ascending: true })
        
        setChatMessages(messages || [])
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    } finally {
      setChatLoading(false)
    }
  }
  
  // Enviar mensaje
  const sendChatMessage = async (message: string) => {
    if (!transaction?.id || chatSending || !message.trim() || !chatEnabled) return
    
    try {
      setChatSending(true)
      const supabase = supabaseBrowser()
      
      // Obtener o crear thread
      let { data: threads } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('context_id', transaction.id)
        .eq('context_type', 'order')
        .limit(1)
      
      let threadId = threads?.[0]?.id
      
      if (!threadId) {
        // Crear thread simple
        const { data: newThread, error: threadError } = await supabase
          .from('chat_threads')
          .insert({
            context_type: 'order',
            context_id: transaction.id,
            party_a: transaction.buyer_id,
            party_b: transaction.seller_id,
            context_title: 'Chat de Negociación'
          })
          .select()
          .single()
        
        if (threadError) throw threadError
        threadId = newThread.id
      }
      
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      
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
      
      if (msgError) throw msgError
      
      // Agregar mensaje a la lista
      setChatMessages(prev => [...prev, newMessage])
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
    } finally {
      setChatSending(false)
    }
  }
  
  // Cargar mensajes cuando se abre el panel y el chat está habilitado
  useEffect(() => {
    if (isOpen && transaction?.id && chatEnabled) {
      loadChatMessages()
    }
  }, [isOpen, transaction?.id, chatEnabled])
  
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
    if (isOpen) {
      loadRequestData()
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
    if (isOpen && requestData && !initialized) {
      loadExistingTransaction()
      setInitialized(true)
    }
    
    // NO resetear cuando el panel se cierra - mantener el estado de la transacción
    // Esto permite que al reabrir el panel, se mantenga el progreso
  }, [isOpen, requestData, initialized])

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
    console.log('⏰ Tiempo agotado - cerrando panel y reactivando solicitud')
    console.log('📋 Request ID:', requestId)
    console.log('📋 Transaction ID:', transaction?.id)
    
    try {
      const supabase = supabaseBrowser()
      
      // Llamar a la función RPC para reactivar la solicitud específica
      console.log('🔄 Llamando a función RPC para reactivar solicitud...')
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('reactivate_expired_request', { p_request_id: requestId })
      
      if (rpcError) {
        console.error('❌ Error en función RPC:', rpcError)
        console.error('📋 Detalles del error:', JSON.stringify(rpcError, null, 2))
        console.error('📋 Código del error:', rpcError.code)
        console.error('📋 Mensaje del error:', rpcError.message)
        console.error('📋 Hint del error:', rpcError.hint)
      } else {
        console.log('✅ Solicitud reactivada exitosamente vía RPC:', rpcResult)
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
      
      // Notificar para que se recargue la lista de solicitudes
      const reactivateNotification = new CustomEvent('request-status-changed', {
        detail: { requestId, newStatus: 'active' }
      })
      window.dispatchEvent(reactivateNotification)
      
    } catch (error) {
      console.error('❌ Error manejando expiración:', error)
      // Continuar con el cierre del panel
    }
    
    // Cerrar el panel y mostrar toast
    onClose()
    
    toast({
      title: "Tiempo agotado",
      description: "El tiempo para completar la transacción ha expirado. La solicitud está disponible nuevamente para negociación.",
      variant: "destructive",
      duration: 10000,
    })
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
    try {
      const supabase = supabaseBrowser()
      
      console.log('🔍 Cargando información completa de la solicitud:', requestId)
      
      // Intentar obtener información completa de la solicitud
      const { data: request, error: requestError } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      // Si hay error o no hay datos, lanzar error
      if (requestError || !request) {
        console.error('❌ No se encontró la solicitud en BD:', requestError)
        throw new Error(`No se pudo cargar la solicitud: ${requestError?.message || 'Solicitud no encontrada'}`)
      }

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
      setRequestData(requestWithUsers)

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


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden relative">
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
                  Compra {requestData?.amount?.toLocaleString() || amount.toLocaleString()} HNLD @ 1.00
                </h2>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  Total: {requestData?.currency_type || currency} {requestData?.amount?.toLocaleString() || amount.toLocaleString()}
                </div>
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
                  
                  console.log('🔍 DEBUG DETALLADO - Panel renderizando:', {
                    userRole,
                    transaction_id: transaction?.id,
                    transaction_buyer_id: transaction?.buyer_id,
                    transaction_seller_id: transaction?.seller_id,
                    all_steps: allSteps,
                    step1_full: step1,
                    step2_full: step2,
                    buyerId,
                    sellerId,
                    steps_count: allSteps.length
                  })
                  
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
                              accepted_at: now.toISOString()
                            })
                            .eq('id', requestId)
                            .select()
                          
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
                          
                          if (buyerId) {
                            // Llamar a la función emit_notification en la BD
                            const { data: notificationData, error: notificationError } = await supabase.rpc('emit_notification', {
                              p_user_id: buyerId,
                              p_topic: 'order',
                              p_event: 'ORDER_ACCEPTED',
                              p_title: 'Solicitud aceptada',
                              p_body: 'El vendedor ha aceptado tu solicitud. Inicia el proceso de pago.',
                              p_priority: 'high',
                              p_cta_label: 'Ver transacción',
                              p_cta_href: `/dashboard/mis-solicitudes`,
                              p_payload: {
                                transaction_id: transaction?.id,
                                request_id: requestId
                              }
                            })
                            
                            if (notificationError) {
                              console.error('❌ Error enviando notificación:', notificationError)
                              console.error('📋 Detalles del error:', JSON.stringify(notificationError, null, 2))
                            } else {
                              console.log('✅ Notificación enviada al comprador:', notificationData)
                            }
                          } else {
                            console.warn('⚠️ No se encontró buyer_id en la transacción')
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
              <div className="flex space-x-2">
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
} 
