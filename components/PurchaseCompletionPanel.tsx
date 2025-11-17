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
import { toast as sonnerToast } from 'sonner'
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
  const transactionRealtimeChannelRef = React.useRef<any>(null)
  const currentSubscribedTransactionIdRef = React.useRef<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const chatMessagesContainerRef = React.useRef<HTMLDivElement>(null)
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const transactionCompletionHandledRef = React.useRef<boolean>(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [hasPaymentProof, setHasPaymentProof] = useState(false)
  
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
        
        // Verificar si hay documentos de verificación de pago del comprador
        if (messages && messages.length > 0 && userRole === 'buyer' && transaction) {
          const buyerDocuments = messages.filter(msg => 
            msg.sender_id === currentUserId && 
            msg.attachments && 
            Array.isArray(msg.attachments) && 
            msg.attachments.length > 0
          )
          if (buyerDocuments.length > 0) {
            setHasPaymentProof(true)
          } else {
            // También verificar en transaction_documents
            const { data: transactionDocs } = await supabase
              .from('transaction_documents')
              .select('*')
              .eq('transaction_id', transaction.id)
              .eq('document_type', 'payment_proof')
              .eq('uploaded_by', currentUserId)
            
            if (transactionDocs && transactionDocs.length > 0) {
              setHasPaymentProof(true)
            } else {
              setHasPaymentProof(false)
            }
          }
        }
        
        // Scroll al final después de cargar mensajes
        setTimeout(() => {
          if (chatMessagesContainerRef.current) {
            chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight
          }
        }, 200)
        
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
        sonnerToast.error('Debes estar autenticado para subir documentos')
        return
      }

      // Validar tamaño del archivo (máximo 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        sonnerToast.error('El archivo es demasiado grande. Máximo 10MB')
        return
      }

      // Validar tipo de archivo (imágenes y PDFs)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        sonnerToast.error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP) y PDFs')
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
        sonnerToast.error('No se pudo subir el documento. Inténtalo de nuevo.')
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
        sonnerToast.error('Documento subido pero error al crear el mensaje')
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
        
        // Si el comprador subió un documento y el paso 2 está en progreso, marcar como disponible
        if (userRole === 'buyer') {
          const allSteps = transaction?.transaction_steps || []
          const step2 = allSteps.find(s => s.step_order === 2)
          if (step2?.status === 'in_progress') {
            setHasPaymentProof(true)
          }
        }
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
      sonnerToast.error('Error inesperado al subir el documento')
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
      
      // Si el comprador subió un documento y el paso 2 está en progreso, verificar si es comprobante de pago
      if (newMessage.sender_id === currentUserId && userRole === 'buyer' && newMessage.attachments && newMessage.attachments.length > 0) {
        const allSteps = transaction?.transaction_steps || []
        const step2 = allSteps.find(s => s.step_order === 2)
        if (step2?.status === 'in_progress') {
          setHasPaymentProof(true)
        }
      }
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      sonnerToast.error('No se pudo enviar el mensaje. Verifica tu conexión.')
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
          const updated = [...prev, newMessage]
          
          // Si el comprador subió un documento y el paso 2 está en progreso, verificar si es comprobante de pago
          if (newMessage.sender_id === currentUserId && userRole === 'buyer' && newMessage.attachments && Array.isArray(newMessage.attachments) && newMessage.attachments.length > 0) {
            const allSteps = transaction?.transaction_steps || []
            const step2 = allSteps.find(s => s.step_order === 2)
            if (step2?.status === 'in_progress') {
              setHasPaymentProof(true)
            }
          }
          
          return updated
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
  }, [currentUserId, userRole, transaction, setHasPaymentProof])
  
  // Configurar suscripción realtime para transaction_steps y purchase_transactions
  const setupTransactionRealtimeSubscription = useCallback((transactionId: string) => {
    // Validar que transactionId existe
    if (!transactionId) {
      console.error('❌ No se puede configurar realtime sin transactionId')
      return
    }
    
    // Verificar si ya tenemos una suscripción activa para esta transacción
    if (transactionRealtimeChannelRef.current && currentSubscribedTransactionIdRef.current === transactionId) {
      console.log('✅ Suscripción de transacción ya existe, reutilizando')
      return
    }
    
    // Limpiar suscripción anterior si es para una transacción diferente
    if (transactionRealtimeChannelRef.current) {
      console.log('🧹 Limpiando suscripción realtime de transacción anterior')
      try {
        transactionRealtimeChannelRef.current.unsubscribe()
      } catch (error) {
        console.error('⚠️ Error al desuscribir canal anterior:', error)
      }
      transactionRealtimeChannelRef.current = null
      currentSubscribedTransactionIdRef.current = null
    }
    
    const supabase = supabaseBrowser()
    console.log('🔌 Configurando suscripción realtime para transacción:', transactionId)
    
    try {
      const channel = supabase
        .channel(`transaction:${transactionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'transaction_steps',
          filter: `transaction_id=eq.${transactionId}`
        }, (payload: any) => {
          try {
            console.log('📊 Cambio en transaction_steps recibido:', payload)
            const updatedStep = payload.new
            const eventType = payload.eventType || (payload.old ? 'UPDATE' : 'INSERT')
            
            // Verificar que el paso tiene los datos necesarios
            if (!updatedStep || !updatedStep.id) {
              console.warn('⚠️ Paso recibido sin datos válidos:', updatedStep)
              return
            }
            
            // Verificar si el paso 4 se completó (para ambos usuarios)
            const isStep4Completed = updatedStep?.step_order === 4 && updatedStep?.status === 'completed'
            
            // Actualizar el paso en el estado local
            setTransaction(prev => {
              if (!prev) return prev
              
              let updatedSteps = prev.transaction_steps || []
              
              if (eventType === 'DELETE') {
                // Remover el paso eliminado
                updatedSteps = updatedSteps.filter(step => step.id !== updatedStep?.id)
              } else if (eventType === 'INSERT') {
                // Agregar nuevo paso si no existe
                if (!updatedSteps.find(s => s.id === updatedStep.id)) {
                  updatedSteps = [...updatedSteps, updatedStep]
                }
              } else {
                // UPDATE: actualizar el paso existente
                updatedSteps = updatedSteps.map(step => {
                  if (step.id === updatedStep.id) {
                    return { ...step, ...updatedStep }
                  }
                  return step
                })
              }
              
              // Si el paso 4 se completó, ejecutar acciones para ambos usuarios
              if (isStep4Completed && !transactionCompletionHandledRef.current) {
                console.log('✅ Paso 4 completado detectado en realtime - ejecutando acciones para ambos usuarios')
                transactionCompletionHandledRef.current = true
                
                // Detener el temporizador
                if (timerIntervalRef.current) {
                  clearInterval(timerIntervalRef.current)
                  timerIntervalRef.current = null
                }
                setTimeRemaining(null)
                
                // Actualizar solicitud a completada (para ambos usuarios)
                const updateRequestStatus = async () => {
                  try {
                    const supabase = supabaseBrowser()
                    const { error: requestUpdateError } = await supabase
                      .rpc('mark_request_completed', {
                        p_request_id: requestId
                      })
                    
                    if (requestUpdateError) {
                      console.error('⚠️ Error actualizando solicitud a completada:', requestUpdateError)
                      await supabase
                        .from('purchase_requests')
                        .update({
                          status: 'completed',
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', requestId)
                    }
                    
                    // Disparar evento para actualizar la UI
                    const updateNotification = new CustomEvent('request-status-changed', {
                      detail: { requestId, newStatus: 'completed' }
                    })
                    window.dispatchEvent(updateNotification)
                    
                    // Crear notificación persistente similar a las de crear/cancelar solicitudes
                    const transactionId = prev?.id
                    if (transactionId) {
                      try {
                        const { data: notificationResult, error: notificationError } = await supabase
                          .rpc('notify_request_completed', {
                            p_request_id: requestId,
                            p_transaction_id: transactionId
                          })
                        
                        if (notificationError) {
                          console.error('⚠️ Error creando notificación de solicitud completada:', notificationError)
                        } else {
                          console.log('✅ Notificación de solicitud completada creada:', notificationResult)
                        }
                      } catch (notifErr) {
                        console.error('⚠️ Error en creación de notificación:', notifErr)
                      }
                    }
                  } catch (requestErr) {
                    console.error('⚠️ Error en actualización de solicitud:', requestErr)
                  }
                }
                updateRequestStatus()
                
                // Nota: El toast de "Transacción completada" se muestra vía NotificationBell
                // cuando se recibe la notificación TRANSACTION_COMPLETED
                
                // Cerrar el panel después de 3 segundos (para ambos usuarios)
                setTimeout(() => {
                  console.log('🔒 Cerrando panel de transacción después de completar (realtime)')
                  onClose()
                }, 3000)
              }
              
              return {
                ...prev,
                transaction_steps: updatedSteps
              }
            })
          } catch (error) {
            console.error('❌ Error procesando cambio en transaction_steps:', error)
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'purchase_transactions',
          filter: `id=eq.${transactionId}`
        }, (payload: any) => {
          try {
            console.log('📊 Cambio en purchase_transactions recibido:', payload)
            const updatedTransaction = payload.new
            
            // Verificar que la transacción tiene los datos necesarios
            if (!updatedTransaction || !updatedTransaction.id) {
              console.warn('⚠️ Transacción recibida sin datos válidos:', updatedTransaction)
              return
            }
            
            // Verificar si la transacción se completó (para ambos usuarios)
            const isTransactionCompleted = updatedTransaction?.status === 'completed'
            
            // Actualizar la transacción completa
            setTransaction(prev => {
              if (!prev) return prev
              
              const wasCompleted = prev.status === 'completed'
              
              // Si la transacción acaba de completarse (no estaba completada antes)
              if (isTransactionCompleted && !wasCompleted && !transactionCompletionHandledRef.current) {
                console.log('✅ Transacción completada detectada en realtime - ejecutando acciones para ambos usuarios')
                transactionCompletionHandledRef.current = true
                
                // Detener el temporizador
                if (timerIntervalRef.current) {
                  clearInterval(timerIntervalRef.current)
                  timerIntervalRef.current = null
                }
                setTimeRemaining(null)
                
                // Actualizar solicitud a completada (para ambos usuarios)
                const updateRequestStatus = async () => {
                  try {
                    const supabase = supabaseBrowser()
                    const { error: requestUpdateError } = await supabase
                      .rpc('mark_request_completed', {
                        p_request_id: requestId
                      })
                    
                    if (requestUpdateError) {
                      console.error('⚠️ Error actualizando solicitud a completada:', requestUpdateError)
                      await supabase
                        .from('purchase_requests')
                        .update({
                          status: 'completed',
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', requestId)
                    }
                    
                    // Disparar evento para actualizar la UI
                    const updateNotification = new CustomEvent('request-status-changed', {
                      detail: { requestId, newStatus: 'completed' }
                    })
                    window.dispatchEvent(updateNotification)
                    
                    // Crear notificación persistente similar a las de crear/cancelar solicitudes
                    const transactionId = updatedTransaction?.id || prev?.id
                    if (transactionId) {
                      try {
                        const { data: notificationResult, error: notificationError } = await supabase
                          .rpc('notify_request_completed', {
                            p_request_id: requestId,
                            p_transaction_id: transactionId
                          })
                        
                        if (notificationError) {
                          console.error('⚠️ Error creando notificación de solicitud completada:', notificationError)
                        } else {
                          console.log('✅ Notificación de solicitud completada creada:', notificationResult)
                        }
                      } catch (notifErr) {
                        console.error('⚠️ Error en creación de notificación:', notifErr)
                      }
                    }
                  } catch (requestErr) {
                    console.error('⚠️ Error en actualización de solicitud:', requestErr)
                  }
                }
                updateRequestStatus()
                
                // Nota: El toast de "Transacción completada" se muestra vía NotificationBell
                // cuando se recibe la notificación TRANSACTION_COMPLETED
                
                // Cerrar el panel después de 3 segundos (para ambos usuarios)
                setTimeout(() => {
                  console.log('🔒 Cerrando panel de transacción después de completar (realtime - transaction status)')
                  onClose()
                }, 3000)
              }
              
              return {
                ...prev,
                ...updatedTransaction,
                // Mantener transaction_steps si están en el estado anterior
                transaction_steps: prev.transaction_steps || []
              }
            })
          } catch (error) {
            console.error('❌ Error procesando cambio en purchase_transactions:', error)
          }
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Suscripción realtime activa para transacción:', transactionId)
            currentSubscribedTransactionIdRef.current = transactionId
          } else if (status === 'CHANNEL_ERROR') {
            // Solo loggear si hay un error real, no si es undefined (desconexión temporal)
            if (err) {
              console.warn('⚠️ Error en canal realtime de transacción:', transactionId, err)
            }
          } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
            // Estados normales de desconexión, no son errores críticos
            console.log('📡 Canal realtime de transacción:', status, transactionId)
          }
        })
      
      transactionRealtimeChannelRef.current = channel
    } catch (error) {
      console.error('❌ Error configurando suscripción realtime de transacción:', error)
    }
  }, [requestId, amount, onClose])
  
  // Limpiar suscripción al desmontar o cuando cambia el thread
  useEffect(() => {
    return () => {
      if (chatRealtimeChannelRef.current) {
        try {
          chatRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal de chat:', error)
        }
      }
      if (transactionRealtimeChannelRef.current) {
        try {
          transactionRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal de transacción:', error)
        }
      }
    }
  }, [])
  
  // Limpiar y reconfigurar suscripción cuando cambia la transacción
  useEffect(() => {
    if (!isOpen || !transaction?.id) {
      // Si el panel está cerrado o no hay transacción, limpiar suscripciones
      if (transactionRealtimeChannelRef.current) {
        console.log('🧹 Limpiando suscripción realtime (panel cerrado o sin transacción)')
        try {
          transactionRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal de transacción:', error)
        }
        transactionRealtimeChannelRef.current = null
        currentSubscribedTransactionIdRef.current = null
      }
      return
    }
    
    // Configurar suscripción realtime para la transacción actual
    setupTransactionRealtimeSubscription(transaction.id)
    
    return () => {
      // Limpiar cuando cambia la transacción
      if (transactionRealtimeChannelRef.current && currentSubscribedTransactionIdRef.current === transaction.id) {
        console.log('🧹 Limpiando suscripción realtime (cambio de transacción)')
        try {
          transactionRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal de transacción:', error)
        }
        transactionRealtimeChannelRef.current = null
        currentSubscribedTransactionIdRef.current = null
      }
    }
  }, [isOpen, transaction?.id, setupTransactionRealtimeSubscription])
  
  // Cargar mensajes cuando se abre el panel y el chat está habilitado
  useEffect(() => {
    if (isOpen && chatEnabled && requestId) {
      loadChatMessages()
    }
  }, [isOpen, chatEnabled, requestId])
  
  // Scroll automático al último mensaje
  const scrollToBottom = React.useCallback(() => {
    if (chatMessagesContainerRef.current) {
      const container = chatMessagesContainerRef.current
      // Usar múltiples requestAnimationFrame para asegurar que el DOM se haya actualizado completamente
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight
          }
        })
      })
    }
  }, [])
  
  // Ejecutar scroll cuando cambien los mensajes (usando la longitud para detectar cambios)
  useEffect(() => {
    if (chatMessages.length > 0 && chatEnabled) {
      // Pequeño delay para asegurar que el DOM se actualizó
      const timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [chatMessages.length, chatEnabled, scrollToBottom])
  
  // También ejecutar cuando se completa el envío de un mensaje
  useEffect(() => {
    if (chatSending === false && chatMessages.length > 0 && chatEnabled) {
      const timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [chatSending, chatMessages.length, chatEnabled, scrollToBottom])
  
  // Verificar documentos de pago cuando cambia el paso 2 a in_progress o cuando cambian los mensajes
  useEffect(() => {
    if (transaction && userRole === 'buyer' && currentUserId) {
      const allSteps = transaction.transaction_steps || []
      const step2 = allSteps.find(s => s.step_order === 2)
      if (step2?.status === 'in_progress') {
        if (chatMessages.length > 0) {
          const buyerDocuments = chatMessages.filter(msg => 
            msg.sender_id === currentUserId && 
            msg.attachments && 
            Array.isArray(msg.attachments) && 
            msg.attachments.length > 0
          )
          setHasPaymentProof(buyerDocuments.length > 0)
        } else {
          // Si no hay mensajes todavía, verificar en transaction_documents
          const checkTransactionDocuments = async () => {
            const supabase = supabaseBrowser()
            const { data: transactionDocs } = await supabase
              .from('transaction_documents')
              .select('*')
              .eq('transaction_id', transaction.id)
              .eq('document_type', 'payment_proof')
              .eq('uploaded_by', currentUserId)
            
            setHasPaymentProof(transactionDocs && transactionDocs.length > 0)
          }
          checkTransactionDocuments()
        }
      } else {
        // Si el paso 2 no está en progreso, resetear el estado
        setHasPaymentProof(false)
      }
    } else {
      setHasPaymentProof(false)
    }
  }, [transaction?.transaction_steps, chatMessages, userRole, currentUserId, transaction?.id])
  
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
      setHasPaymentProof(false)
      transactionCompletionHandledRef.current = false
      
      // Limpiar suscripción realtime
      if (chatRealtimeChannelRef.current) {
        console.log('🧹 Limpiando suscripción realtime de chat')
        try {
          chatRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal de chat:', error)
        }
        chatRealtimeChannelRef.current = null
        currentSubscribedThreadIdRef.current = null
      }
      if (transactionRealtimeChannelRef.current) {
        console.log('🧹 Limpiando suscripción realtime de transacción')
        try {
          transactionRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal de transacción:', error)
        }
        transactionRealtimeChannelRef.current = null
        currentSubscribedTransactionIdRef.current = null
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
        }
      })
      .subscribe((status) => {
        console.log('🔔 Estado de suscripción para cambios de status:', status)
      })

    return () => {
      console.log('🧹 Limpiando suscripción de cambios de status')
      try {
      channel.unsubscribe()
      } catch (error) {
        console.error('⚠️ Error desuscribiendo canal de cambios de status:', error)
    }
    }
  }, [isOpen, requestId, onClose])

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
        
        // Configurar suscripción realtime para transaction_steps y purchase_transactions
        setupTransactionRealtimeSubscription(existingTransaction.id)
        
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
  sonnerToast.error('El tiempo para completar la transacción ha expirado. La solicitud ha sido marcada como expirada. Recargando la página...')
    
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
            timerIntervalRef.current = null
            
            // Cuando el tiempo se agota, cerrar el panel y reactivar la solicitud
            handleTimeoutExpiration()
          }
        }, 1000)
        
        timerIntervalRef.current = interval

        return () => {
          clearInterval(interval)
          timerIntervalRef.current = null
        }
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
          if (isInProgress) {
            // Verificar si hay documento de verificación de pago
            if (!hasPaymentProof) {
              return '⚠️ Adjunte una imagen o documento de verificación del depósito en el chat para completar este paso'
            }
            return 'Comprobante adjuntado. Haz clic para confirmar el pago realizado'
          }
          if (isCompleted) return 'Pago completado, a la espera de verificación'
          return 'Realice el pago una vez que el vendedor acepte el trato'
        } else {
          if (isInProgress) return 'Esperando a que el comprador realice el pago'
          if (isCompleted) return 'Pago recibido, a la espera de confirmación'
          return 'Esperando que el comprador inicie el pago'
        }
      
      case 2: // Paso 3: Verificación del recibo
        if (userRole === 'buyer') {
          if (isInProgress) return 'Esperando a que el vendedor verifique el recibo y el depósito en su cuenta'
          if (isCompleted) return 'Recibo verificado correctamente'
          return 'Subida de comprobante pendiente'
        } else {
          if (isInProgress) return 'Verifique el recibo del comprador y confirme que el depósito se recibió en su cuenta'
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
      
      // Configurar suscripción realtime para transaction_steps y purchase_transactions
      setupTransactionRealtimeSubscription(result.data.id)
      
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
    <>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.25), 0 0 30px rgba(59, 130, 246, 0.15), 0 0 45px rgba(59, 130, 246, 0.08);
          }
          50% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.35), 0 0 40px rgba(59, 130, 246, 0.2), 0 0 60px rgba(59, 130, 246, 0.12);
          }
        }
        @keyframes pulse-glow-orange {
          0%, 100% {
            box-shadow: 0 0 8px rgba(249, 115, 22, 0.25), 0 0 16px rgba(249, 115, 22, 0.15);
          }
          50% {
            box-shadow: 0 0 12px rgba(249, 115, 22, 0.35), 0 0 24px rgba(249, 115, 22, 0.2);
          }
        }
        @keyframes pulse-glow-orange-dark {
          0%, 100% {
            box-shadow: 0 0 8px rgba(251, 146, 60, 0.3), 0 0 16px rgba(251, 146, 60, 0.2);
          }
          50% {
            box-shadow: 0 0 12px rgba(251, 146, 60, 0.4), 0 0 24px rgba(251, 146, 60, 0.25);
          }
        }
        .step-1-card {
          animation: pulse-glow-orange 2s ease-in-out infinite;
          border-color: rgb(249, 115, 22);
        }
        .dark .step-1-card {
          animation: pulse-glow-orange-dark 2s ease-in-out infinite;
          border-color: rgb(251, 146, 60);
        }
        .step-card-title,
        .step-card-title * {
          color: #000000 !important;
        }
        .dark .step-card-title,
        .dark .step-card-title * {
          color: #ffffff !important;
        }
        .step-card-description,
        .step-card-description * {
          color: #000000 !important;
        }
        .dark .step-card-description,
        .dark .step-card-description * {
          color: #ffffff !important;
        }
      `}</style>
    <div 
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 py-0 ${!isOpen ? 'hidden' : ''}`} 
      data-panel-overlay="true"
      style={{ 
        filter: 'none', 
        backdropFilter: 'none'
      }}
    >
      <div 
        className="bg-card text-foreground rounded-lg shadow-2xl sm:rounded-lg w-full max-w-md sm:max-w-lg md:max-w-xl h-[92vh] overflow-hidden relative flex flex-col"
        data-panel-content="true"
        style={{
          filter: 'none !important',
          backdropFilter: 'none !important',
          isolation: 'isolate' // Crear nuevo contexto de apilamiento
        }}
      >
        {/* Header General del Panel */}
        <div className="bg-muted border-b border-border px-3 sm:px-6 py-1 sm:py-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <h1 className="text-sm sm:text-base font-bold text-foreground">
                Compra de HNLD
              </h1>
              <span className="text-sm sm:text-base font-bold text-foreground">
                -
              </span>
              <span className="text-sm sm:text-base font-bold text-muted-foreground">
                {requestData?.currency_type || currency} {requestData?.amount?.toLocaleString() || amount.toLocaleString()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="bg-card/80 hover:bg-card border border-border p-1 h-6 w-6 sm:h-7 sm:w-7"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
          
          {/* Código y Método de Pago - Card Combinada */}
          <div className="bg-card rounded-lg p-1.5 sm:p-3 border border-border">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Código Único */}
              <div className="pr-2 sm:pr-3 border-r border-border">
                <div className="flex items-center space-x-1.5 sm:space-x-2 mb-0.5 sm:mb-1">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Código</span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-foreground">
                  {requestData?.unique_code || `NMHNC-${new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2)}-${String(requestId.slice(-6)).toUpperCase()}`}
                </div>
              </div>

              {/* Método de Pago */}
              <div className="pl-2 sm:pl-3">
                <div className="flex items-center space-x-1.5 sm:space-x-2 mb-0.5 sm:mb-1">
                  <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Método de Pago</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-foreground">
                  {getPaymentMethodDisplayName(requestData?.payment_method || paymentMethod)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Panel Central - Flujo de Transacción */}
          <div className="px-3 sm:px-6 pt-3 sm:pt-6 pb-0 flex-shrink-0 flex justify-center -mt-2 sm:-mt-3">
            <div className="w-full max-w-2xl">
              {/* Paso Actual de la Transacción - Interactivo */}
              {(() => {
                const allSteps = transaction?.transaction_steps || []
                
                // Determinar qué paso mostrar: el primero que no esté completado, o el último si todos están completos
                const getCurrentStepToShow = () => {
                  // Buscar el primer paso que no esté completado
                  for (let order = 1; order <= 4; order++) {
                    const step = allSteps.find(s => s.step_order === order)
                    const status = step?.status || 'pending'
                    if (status !== 'completed') {
                      return { order, status, step }
                    }
                  }
                  // Si todos están completos, mostrar el último paso
                  const lastStep = allSteps.find(s => s.step_order === 4)
                  return { 
                    order: 4, 
                    status: lastStep?.status || 'completed',
                    step: lastStep
                  }
                }
                
                const currentStepInfo = getCurrentStepToShow()
                const { order: stepOrder, status: stepStatus } = currentStepInfo
                
                // Configuración de cada paso
                const stepConfig = {
                  1: {
                    title: 'Aceptar el trato',
                    descriptionIndex: 0,
                    defaultColor: 'orange',
                    completedColor: 'green',
                    actionRole: 'seller' as const
                  },
                  2: {
                    title: 'Pago en proceso',
                    descriptionIndex: 1,
                    defaultColor: 'blue',
                    completedColor: 'green',
                    actionRole: 'buyer' as const
                  },
                  3: {
                    title: 'Verificación del recibo',
                    descriptionIndex: 2,
                    defaultColor: 'blue',
                    completedColor: 'green',
                    actionRole: 'seller' as const // Vendedor verifica el depósito
                  },
                  4: {
                    title: 'Liberación de fondos',
                    descriptionIndex: 3,
                    defaultColor: 'blue',
                    completedColor: 'green',
                    actionRole: null // Este paso no tiene acción directa
                  }
                }
                
                const config = stepConfig[stepOrder as keyof typeof stepConfig]
                const isCompleted = stepStatus === 'completed'
                const isInProgress = stepStatus === 'in_progress'
                // Para el paso 2, el comprador necesita haber subido un documento de verificación
                const canPerformAction = config.actionRole && !isCompleted && userRole === config.actionRole && 
                  (stepOrder !== 2 || userRole !== 'buyer' || hasPaymentProof)
                
                // Funciones de acción para cada paso
                const handleStepAction = async () => {
                  if (loading || !canPerformAction) return
                  
                  try {
                    if (stepOrder === 1 && userRole === 'seller') {
                      // Acción Paso 1: Aceptar Trato
                      console.log('✅ Vendedor aceptando el trato')
                      
                      const now = new Date()
                      const paymentDeadline = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
                      const verificationDeadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
                      
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
                        const updatedSteps = prev.transaction_steps?.map((step, idx) => {
                          if (idx === 0) {
                            return { ...step, status: 'completed', completed_at: now.toISOString() }
                          } else if (idx === 1) {
                            return { ...step, status: 'in_progress' }
                          }
                          return step
                        }) || []
                        
                        return {
                          ...prev,
                          payment_deadline: paymentDeadline,
                          verification_deadline: verificationDeadline,
                          agreement_confirmed_at: now.toISOString(),
                          status: 'agreement_confirmed',
                          transaction_steps: updatedSteps
                        }
                      })
                      
                      // 3. Actualizar estado de la solicitud
                      try {
                        const { error: requestUpdateError } = await supabase
                          .from('purchase_requests')
                          .update({
                            status: 'accepted',
                            seller_id: sellerId,
                            accepted_at: now.toISOString(),
                            updated_at: now.toISOString()
                          })
                          .eq('id', requestId)
                        
                        if (!requestUpdateError) {
                          const updateNotification = new CustomEvent('request-status-changed', {
                            detail: { requestId, newStatus: 'accepted' }
                          })
                          window.dispatchEvent(updateNotification)
                        }
                      } catch (requestErr) {
                        console.error('Error en actualización de solicitud:', requestErr)
                      }
                      
                      // 4. Habilitar el chat
                      setChatEnabled(true)
                      
                      // 5. Enviar notificación al comprador
                      try {
                        const buyerId = transaction?.buyer_id
                        if (buyerId && requestData) {
                          const sellerName = requestData.seller?.full_name || 'Un vendedor'
                          const currencySymbol = requestData.currency_type === 'USD' ? '$' : 
                                               requestData.currency_type === 'EUR' ? '€' : 'L.'
                          const formattedAmount = currencySymbol + 
                            new Intl.NumberFormat('es-HN').format(requestData.amount || amount || 0)
                          
                          let notificationTitle = 'Solicitud aceptada'
                          if (requestData.unique_code) {
                            notificationTitle = notificationTitle + '\n' + requestData.unique_code
                          }
                          
                          let notificationBody = sellerName + ' aceptó tu solicitud por ' + formattedAmount + '.'
                          
                          await supabase.rpc('emit_notification', {
                            p_user_id: buyerId,
                            p_topic: 'order',
                            p_event: 'ORDER_ACCEPTED',
                            p_title: notificationTitle,
                            p_body: notificationBody,
                            p_priority: 'high',
                            p_cta_label: 'Ver transacción',
                            p_cta_href: `/dashboard/mis-solicitudes`,
                            p_dedupe_key: `order_accepted_${requestId}_${transaction?.id}`, // Evitar duplicados
                            p_payload: {
                              transaction_id: transaction?.id,
                              request_id: requestId,
                              amount: requestData.amount || amount,
                              currency_type: requestData.currency_type || currency,
                              unique_code: requestData.unique_code,
                              formatted_amount: formattedAmount
                            }
                          })
                        }
                      } catch (notificationErr) {
                        console.error('Error en envío de notificación:', notificationErr)
                      }
                      
                      // 6. Actualizar pasos en la BD
                      try {
                        await supabase
                          .from('transaction_steps')
                          .update({
                            status: 'completed',
                            completed_at: now.toISOString()
                          })
                          .eq('transaction_id', transaction?.id)
                          .eq('step_order', 1)
                        
                        await supabase
                          .from('transaction_steps')
                          .update({
                            status: 'in_progress'
                          })
                          .eq('transaction_id', transaction?.id)
                          .eq('step_order', 2)
                        
                        // Recargar la transacción desde la BD
                        if (transaction?.id) {
                          const { data: updatedTransaction } = await supabase
                            .from('purchase_transactions')
                            .select(`
                              *,
                              transaction_steps (*)
                            `)
                            .eq('id', transaction.id)
                            .single()
                          
                          if (updatedTransaction) {
                            const transactionWithUsers = {
                              ...updatedTransaction,
                              request: requestData,
                              buyer: requestData.buyer,
                              seller: requestData.seller
                            }
                            setTransaction(transactionWithUsers)
                          }
                        }
                      } catch (stepError) {
                        console.log('⚠️ No se pudieron actualizar los pasos:', stepError)
                      }
                      
                    } else if (stepOrder === 2 && userRole === 'buyer') {
                      // Acción Paso 2: Confirmar Pago
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
                      
                      // 4. Recargar transacción desde la BD
                      const { data: updatedTransaction } = await supabase
                        .from('purchase_transactions')
                        .select(`
                          *,
                          transaction_steps (*)
                        `)
                        .eq('id', transaction.id)
                        .single()
                      
                      if (updatedTransaction) {
                        const transactionWithUsers = {
                          ...updatedTransaction,
                          request: requestData,
                          buyer: requestData.buyer,
                          seller: requestData.seller
                        }
                        setTransaction(transactionWithUsers)
                      }
                      
                      // 5. Enviar notificación al vendedor cuando se completa el paso 2
                      try {
                        const sellerIdToNotify = transaction?.seller_id || sellerId
                        if (sellerIdToNotify) {
                          // Obtener información de la solicitud y comprador
                          let buyerName = 'El comprador'
                          let uniqueCode = ''
                          
                          // Intentar obtener desde requestData primero
                          if (requestData) {
                            buyerName = requestData.buyer?.full_name || 'El comprador'
                            uniqueCode = requestData.unique_code || ''
                          }
                          
                          // Si no está disponible en requestData, obtener desde la BD
                          if (!buyerName || buyerName === 'El comprador' || !uniqueCode) {
                            try {
                              const { data: request } = await supabase
                                .from('purchase_requests')
                                .select('unique_code, buyer_id')
                                .eq('id', requestId)
                                .maybeSingle()
                              
                              if (request) {
                                if (!uniqueCode && request.unique_code) {
                                  uniqueCode = request.unique_code
                                }
                                
                                if ((!buyerName || buyerName === 'El comprador') && request.buyer_id) {
                                  // Obtener nombre del comprador
                                  const { data: profile } = await supabase
                                    .from('profiles')
                                    .select('full_name')
                                    .eq('id', request.buyer_id)
                                    .maybeSingle()
                                  
                                  if (profile?.full_name) {
                                    buyerName = profile.full_name
                                  } else {
                                    // Fallback: intentar con user_profiles
                                    const { data: userProfile } = await supabase
                                      .from('user_profiles')
                                      .select('full_name')
                                      .eq('id', request.buyer_id)
                                      .maybeSingle()
                                    
                                    if (userProfile?.full_name) {
                                      buyerName = userProfile.full_name
                                    }
                                  }
                                }
                              }
                            } catch (dbErr) {
                              console.error('Error obteniendo datos de BD para notificación:', dbErr)
                            }
                          }
                          
                          await supabase.rpc('emit_notification', {
                            p_user_id: sellerIdToNotify,
                            p_topic: 'order',
                            p_event: 'STEP_2_COMPLETED',
                            p_title: 'Paso 2 completado',
                            p_body: `${buyerName} ha completado el paso 2 (pago realizado)`,
                            p_priority: 'high',
                            p_cta_label: 'Ver transacción',
                            p_cta_href: `/dashboard/solicitudes`,
                            p_payload: {
                              transaction_id: transaction?.id,
                              request_id: requestId,
                              step_order: 2,
                              unique_code: uniqueCode,
                              buyer_name: buyerName
                            }
                          })
                        }
                      } catch (notificationErr) {
                        console.error('Error en envío de notificación paso 2:', notificationErr)
                      }
                    } else if (stepOrder === 3 && userRole === 'seller') {
                      // Acción Paso 3: Verificar Depósito
                      console.log('✅ Vendedor verificando depósito')
                      
                      const now = new Date()
                      const supabase = supabaseBrowser()
                      
                      // 1. Actualizar paso 3 a completado
                      const { error: step3Error } = await supabase
                        .from('transaction_steps')
                        .update({
                          status: 'completed',
                          completed_at: now.toISOString()
                        })
                        .eq('transaction_id', transaction?.id)
                        .eq('step_order', 3)
                      
                      if (step3Error) {
                        console.error('❌ Error actualizando paso 3:', step3Error)
                    sonnerToast.error('No se pudo completar la verificación. Inténtalo de nuevo.')
                        return
                      }
                      
                      // 2. Enviar notificación al comprador cuando se completa el paso 3
                      try {
                        const buyerIdToNotify = transaction?.buyer_id || buyerId
                        if (buyerIdToNotify) {
                          // Obtener información de la solicitud y vendedor
                          let sellerName = 'El vendedor'
                          let uniqueCode = ''
                          
                          // Intentar obtener desde requestData primero
                          if (requestData) {
                            sellerName = requestData.seller?.full_name || 'El vendedor'
                            uniqueCode = requestData.unique_code || ''
                          }
                          
                          // Si no está disponible en requestData, obtener desde la BD
                          if (!sellerName || sellerName === 'El vendedor' || !uniqueCode) {
                            try {
                              const { data: request } = await supabase
                                .from('purchase_requests')
                                .select('unique_code, seller_id')
                                .eq('id', requestId)
                                .maybeSingle()
                              
                              if (request) {
                                if (!uniqueCode && request.unique_code) {
                                  uniqueCode = request.unique_code
                                }
                                
                                if ((!sellerName || sellerName === 'El vendedor') && request.seller_id) {
                                  // Obtener nombre del vendedor
                                  const { data: profile } = await supabase
                                    .from('profiles')
                                    .select('full_name')
                                    .eq('id', request.seller_id)
                                    .maybeSingle()
                                  
                                  if (profile?.full_name) {
                                    sellerName = profile.full_name
                                  } else {
                                    // Fallback: intentar con user_profiles
                                    const { data: userProfile } = await supabase
                                      .from('user_profiles')
                                      .select('full_name')
                                      .eq('id', request.seller_id)
                                      .maybeSingle()
                                    
                                    if (userProfile?.full_name) {
                                      sellerName = userProfile.full_name
                                    }
                                  }
                                }
                              }
                            } catch (dbErr) {
                              console.error('Error obteniendo datos de BD para notificación paso 3:', dbErr)
                            }
                          }
                          
                          await supabase.rpc('emit_notification', {
                            p_user_id: buyerIdToNotify,
                            p_topic: 'order',
                            p_event: 'STEP_3_COMPLETED',
                            p_title: 'Paso 3 completado',
                            p_body: `${sellerName} ha verificado el pago`,
                            p_priority: 'high',
                            p_cta_label: 'Ver transacción',
                            p_cta_href: `/dashboard/mis-solicitudes`,
                            p_payload: {
                              transaction_id: transaction?.id,
                              request_id: requestId,
                              step_order: 3,
                              unique_code: uniqueCode,
                              seller_name: sellerName
                            }
                          })
                        }
                      } catch (notificationErr) {
                        console.error('Error en envío de notificación paso 3:', notificationErr)
                      }
                      
                      // 3. Acreditar HNLD al comprador automáticamente
                      try {
                        const buyerIdToCredit = transaction?.buyer_id || buyerId
                        const transactionAmount = transaction?.amount || amount
                        
                        console.log(`💰 Acreditando L.${transactionAmount} de HNLD al comprador ${buyerIdToCredit}`)
                        
                        // Obtener el código único de la solicitud desde múltiples fuentes posibles
                        const requestUniqueCode = transaction?.request?.unique_code || 
                                                  requestData?.unique_code || 
                                                  `NMHNC-${new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2)}-${String(requestId).slice(-6).toUpperCase()}`
                        
                        const historyDescription = `Compra completada - Solicitud ${requestUniqueCode} - Pago verificado por vendedor`
                        
                        console.log('📝 Descripción del historial:', historyDescription)
                        console.log('🔍 Código único usado:', requestUniqueCode)
                        console.log('📋 transaction?.request?.unique_code:', transaction?.request?.unique_code)
                        console.log('📋 requestData?.unique_code:', requestData?.unique_code)
                        
                        const { data: emitResult, error: emitError } = await supabase.rpc('emit_hnld', {
                          p_user_id: buyerIdToCredit,
                          p_amount: transactionAmount,
                          p_description: historyDescription
                        })
                        
                        if (emitError) {
                          console.error('❌ Error acreditando HNLD:', emitError)
                          sonnerToast.error('La verificación se completó pero hubo un error al acreditar los HNLD. Contacta al soporte.')
                        } else {
                          console.log('✅ HNLD acreditado exitosamente:', emitResult)
                        }
                      } catch (hnldError) {
                        console.error('❌ Error en acreditación de HNLD:', hnldError)
                        sonnerToast.error('La verificación se completó pero hubo un error al acreditar los HNLD. Contacta al soporte.')
                      }
                      
                      // 4. Completar paso 4 automáticamente
                      const { error: step4Error } = await supabase
                        .from('transaction_steps')
                        .update({
                          status: 'completed',
                          completed_at: now.toISOString()
                        })
                        .eq('transaction_id', transaction?.id)
                        .eq('step_order', 4)
                      
                      if (step4Error) {
                        console.error('❌ Error actualizando paso 4:', step4Error)
                      } else {
                        // Enviar notificaciones cuando se completa el paso 4 (transacción completada)
                        // Retrasar 3 segundos para que aparezca después del toast del paso 3
                        setTimeout(async () => {
                          try {
                          const buyerIdToNotify = transaction?.buyer_id || buyerId
                          const sellerIdToNotify = transaction?.seller_id || sellerId
                          
                          // Obtener el monto en HNLD (final_amount_hnld) de la transacción o del request
                          let hnldAmount = transaction?.final_amount_hnld || 
                                          requestData?.final_amount_hnld || 
                                          requestData?.amount || 
                                          transaction?.amount || 
                                          amount
                          
                          // Obtener información de la solicitud
                          let uniqueCode = ''
                          let buyerName = 'El comprador'
                          let sellerName = 'El vendedor'
                          
                          if (requestData) {
                            uniqueCode = requestData.unique_code || ''
                            buyerName = requestData.buyer?.full_name || 'El comprador'
                            sellerName = requestData.seller?.full_name || 'El vendedor'
                          }
                          
                          // Si no está disponible, obtener desde la BD
                          if (!uniqueCode || buyerName === 'El comprador' || sellerName === 'El vendedor' || !hnldAmount) {
                            try {
                              const { data: request } = await supabase
                                .from('purchase_requests')
                                .select('unique_code, buyer_id, seller_id, final_amount_hnld')
                                .eq('id', requestId)
                                .maybeSingle()
                              
                              if (request) {
                                if (!uniqueCode && request.unique_code) {
                                  uniqueCode = request.unique_code
                                }
                                
                                // Obtener monto en HNLD si no está disponible
                                if (!hnldAmount && request.final_amount_hnld) {
                                  hnldAmount = request.final_amount_hnld
                                }
                                
                                // Obtener nombres si no están disponibles
                                if (request.buyer_id && buyerName === 'El comprador') {
                                  const { data: buyerProfile } = await supabase
                                    .from('profiles')
                                    .select('full_name')
                                    .eq('id', request.buyer_id)
                                    .maybeSingle()
                                  
                                  if (buyerProfile?.full_name) {
                                    buyerName = buyerProfile.full_name
                                  }
                                }
                                
                                if (request.seller_id && sellerName === 'El vendedor') {
                                  const { data: sellerProfile } = await supabase
                                    .from('profiles')
                                    .select('full_name')
                                    .eq('id', request.seller_id)
                                    .maybeSingle()
                                  
                                  if (sellerProfile?.full_name) {
                                    sellerName = sellerProfile.full_name
                                  }
                                }
                              }
                              
                              // Si aún no tenemos el monto en HNLD, obtenerlo de la transacción
                              if (!hnldAmount && transaction?.id) {
                                const { data: transData } = await supabase
                                  .from('purchase_transactions')
                                  .select('final_amount_hnld')
                                  .eq('id', transaction.id)
                                  .maybeSingle()
                                
                                if (transData?.final_amount_hnld) {
                                  hnldAmount = transData.final_amount_hnld
                                }
                              }
                            } catch (dbErr) {
                              console.error('Error obteniendo datos de BD para notificación paso 4:', dbErr)
                            }
                          }
                          
                          // Formatear el monto en HNLD
                          const formattedHnldAmount = 'L. ' + 
                            new Intl.NumberFormat('es-HN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(hnldAmount || 0) + ' HNLD'
                          
                          // Notificación al comprador
                          if (buyerIdToNotify) {
                            await supabase.rpc('emit_notification', {
                              p_user_id: buyerIdToNotify,
                              p_topic: 'order',
                              p_event: 'TRANSACTION_COMPLETED',
                              p_title: 'Transacción completada',
                              p_body: `Se acreditó exitosamente ${formattedHnldAmount} a tu cuenta. La transacción ha finalizado correctamente.`,
                              p_priority: 'high',
                              p_cta_label: 'Ver transacción',
                              p_cta_href: `/dashboard/mis-solicitudes`,
                              p_payload: {
                                transaction_id: transaction?.id,
                                request_id: requestId,
                                step_order: 4,
                                unique_code: uniqueCode,
                                amount: hnldAmount,
                                formatted_amount: formattedHnldAmount,
                                role: 'buyer'
                              }
                            })
                          }
                          
                          // Notificación al vendedor
                          if (sellerIdToNotify) {
                            await supabase.rpc('emit_notification', {
                              p_user_id: sellerIdToNotify,
                              p_topic: 'order',
                              p_event: 'TRANSACTION_COMPLETED',
                              p_title: 'Transacción completada',
                              p_body: `La transacción con ${buyerName} ha finalizado exitosamente. Los fondos han sido liberados.`,
                              p_priority: 'high',
                              p_cta_label: 'Ver transacción',
                              p_cta_href: `/dashboard/solicitudes`,
                              p_payload: {
                                transaction_id: transaction?.id,
                                request_id: requestId,
                                step_order: 4,
                                unique_code: uniqueCode,
                                amount: hnldAmount,
                                formatted_amount: formattedHnldAmount,
                                buyer_name: buyerName,
                                role: 'seller'
                              }
                            })
                          }
                          } catch (notificationErr) {
                            console.error('Error en envío de notificaciones paso 4:', notificationErr)
                          }
                        }, 3000) // Retraso de 3 segundos
                      }
                      
                      // 5. Marcar transacción como completada
                      const transactionUpdatePayload: any = {
                        status: 'completed'
                      }
                      
                      // Solo agregar completed_at si la columna existe (evitar errores)
                      // Intentar actualizar primero sin completed_at
                      const { data: transactionUpdateData, error: transactionError } = await supabase
                        .from('purchase_transactions')
                        .update(transactionUpdatePayload)
                        .eq('id', transaction?.id)
                        .select()
                      
                      if (transactionError) {
                        console.error('❌ Error actualizando transacción:', {
                          error: transactionError,
                          message: transactionError.message,
                          details: transactionError.details,
                          hint: transactionError.hint,
                          code: transactionError.code
                        })
                        // Intentar actualizar solo el status si la primera actualización falló
                        const { error: simpleUpdateError } = await supabase
                          .from('purchase_transactions')
                          .update({ status: 'completed' })
                          .eq('id', transaction?.id)
                        
                        if (simpleUpdateError) {
                          console.error('❌ Error en actualización simple también:', simpleUpdateError)
                        } else {
                          console.log('✅ Transacción actualizada (sin completed_at)')
                        }
                      } else {
                        console.log('✅ Transacción actualizada exitosamente:', transactionUpdateData)
                      }
                      
                      // 5. Actualizar transacción local
                      setTransaction(prev => {
                        if (!prev) return prev
                        const updatedSteps = prev.transaction_steps?.map((step, idx) => {
                          if (idx === 2) { // Paso 3 (índice 2)
                            return { ...step, status: 'completed', completed_at: now.toISOString() }
                          } else if (idx === 3) { // Paso 4 (índice 3)
                            return { ...step, status: 'completed', completed_at: now.toISOString() }
                          }
                          return step
                        }) || []
                        
                        return {
                          ...prev,
                          status: 'completed',
                          completed_at: now.toISOString(),
                          transaction_steps: updatedSteps
                        }
                      })
                      
                      // 6. Recargar transacción desde la BD para asegurar sincronización
                      try {
                        const { data: updatedTransaction, error: reloadError } = await supabase
                          .from('purchase_transactions')
                          .select(`
                            *,
                            transaction_steps (*)
                          `)
                          .eq('id', transaction.id)
                          .single()
                        
                        if (reloadError) {
                          console.error('⚠️ Error recargando transacción (no crítico):', reloadError)
                          // Continuamos sin recargar, el estado local ya está actualizado
                        } else if (updatedTransaction) {
                          const transactionWithUsers = {
                            ...updatedTransaction,
                            request: requestData,
                            buyer: requestData.buyer,
                            seller: requestData.seller
                          }
                          setTransaction(transactionWithUsers)
                        }
                      } catch (reloadError) {
                        console.error('⚠️ Excepción al recargar transacción (no crítico):', reloadError)
                        // Continuamos sin recargar, el estado local ya está actualizado
                      }
                      
                      // 7. Actualizar estado de la solicitud a "completed"
                      try {
                        const { data: requestUpdateResult, error: requestUpdateError } = await supabase
                          .rpc('mark_request_completed', {
                            p_request_id: requestId
                          })
                        
                        if (requestUpdateError) {
                          console.error('⚠️ Error actualizando solicitud a completada:', requestUpdateError)
                          // Intentar actualización directa como fallback
                          await supabase
                            .from('purchase_requests')
                            .update({
                              status: 'completed',
                              updated_at: now.toISOString()
                            })
                            .eq('id', requestId)
                        } else {
                          console.log('✅ Solicitud actualizada a completada:', requestUpdateResult)
                        }
                        
                        // Disparar evento para actualizar la UI en otros componentes
                        const updateNotification = new CustomEvent('request-status-changed', {
                          detail: { requestId, newStatus: 'completed' }
                        })
                        window.dispatchEvent(updateNotification)
                        
                        // Crear notificación persistente similar a las de crear/cancelar solicitudes
                        if (transaction?.id) {
                          try {
                            const { data: notificationResult, error: notificationError } = await supabase
                              .rpc('notify_request_completed', {
                                p_request_id: requestId,
                                p_transaction_id: transaction.id
                              })
                            
                            if (notificationError) {
                              console.error('⚠️ Error creando notificación de solicitud completada:', notificationError)
                            } else {
                              console.log('✅ Notificación de solicitud completada creada:', notificationResult)
                            }
                          } catch (notifErr) {
                            console.error('⚠️ Error en creación de notificación:', notifErr)
                          }
                        }
                      } catch (requestErr) {
                        console.error('⚠️ Error en actualización de solicitud:', requestErr)
                      }
                      
                      // 8. Detener el temporizador
                      if (timerIntervalRef.current) {
                        clearInterval(timerIntervalRef.current)
                        timerIntervalRef.current = null
                      }
                      setTimeRemaining(null)
                      
                      // 9. Marcar que la finalización fue manejada (para evitar duplicados en realtime)
                      transactionCompletionHandledRef.current = true
                      
                      // 10. Nota: El toast de "Transacción completada" se muestra vía NotificationBell
                      // cuando se recibe la notificación TRANSACTION_COMPLETED (con retraso de 3 segundos)
                      
                      // 11. Cerrar el panel después de 3 segundos
                      setTimeout(() => {
                        console.log('🔒 Cerrando panel de transacción después de completar')
                        onClose()
                      }, 3000)
                    }
                  } catch (error) {
                    console.error('Error en acción del paso:', error)
                    sonnerToast.error('Ocurrió un error al procesar la acción. Inténtalo de nuevo.')
                  }
                }
                
                // Determinar colores según el estado
                let borderColor = ''
                let bgColor = ''
                let iconBgColor = ''
                let textColor = ''
                let hoverClasses = ''
                
                if (isCompleted) {
                  borderColor = 'border-emerald-500 dark:border-emerald-600 border-2'
                  bgColor = 'bg-card'
                  iconBgColor = 'bg-emerald-500 dark:bg-emerald-600'
                  textColor = 'text-emerald-900 dark:text-emerald-300'
                  hoverClasses = 'cursor-default'
                } else if (canPerformAction) {
                  if (stepOrder === 1) {
                    borderColor = 'border-orange-500 dark:border-orange-500 border-2'
                    bgColor = 'bg-card'
                    iconBgColor = 'bg-orange-500 dark:bg-orange-600'
                    textColor = 'text-orange-900 dark:text-orange-200'
                    hoverClasses = 'cursor-pointer hover:shadow-xl hover:bg-orange-50/50 dark:hover:bg-orange-950/20 hover:border-orange-600 dark:hover:border-orange-400 transition-all duration-200 active:scale-[0.98]'
                  } else {
                    borderColor = 'border-blue-500 dark:border-blue-500 border-2'
                    bgColor = 'bg-card'
                    iconBgColor = 'bg-blue-500 dark:bg-blue-600'
                    textColor = 'text-blue-900 dark:text-blue-200 group-hover:text-blue-950 dark:group-hover:text-blue-100'
                    hoverClasses = 'cursor-pointer hover:shadow-sm hover:bg-blue-50/20 dark:hover:bg-blue-950/10 group transition-all duration-200 active:scale-[0.99]'
                  }
                } else if (stepOrder === 2 && userRole === 'buyer' && isInProgress && !hasPaymentProof) {
                  // Paso 2 deshabilitado si no hay comprobante
                  borderColor = 'border-gray-300 dark:border-gray-700 border-2'
                  bgColor = 'bg-card'
                  iconBgColor = 'bg-gray-400 dark:bg-gray-700'
                  textColor = 'text-gray-600 dark:text-gray-400'
                  hoverClasses = 'cursor-not-allowed opacity-75'
                } else if (isInProgress) {
                  borderColor = 'border-blue-400 dark:border-blue-600 border-2'
                  bgColor = 'bg-card'
                  iconBgColor = 'bg-blue-500 dark:bg-blue-600'
                  textColor = 'text-blue-900 dark:text-blue-200'
                  hoverClasses = 'cursor-default'
                } else {
                  borderColor = 'border-gray-300 dark:border-gray-700 border-2'
                  bgColor = 'bg-card'
                  iconBgColor = 'bg-gray-400 dark:bg-gray-600'
                  textColor = 'text-gray-700 dark:text-gray-400'
                  hoverClasses = 'cursor-default'
                }
                
                return (
                  <div className="mb-0 pb-0">
                    <Card 
                      className={`${borderColor} ${bgColor} ${hoverClasses} ${canPerformAction ? 'shadow-md hover:shadow-lg dark:shadow-md dark:hover:shadow-lg' : ''} relative ${
                        (canPerformAction || (isInProgress && !(stepOrder === 2 && userRole === 'buyer' && !hasPaymentProof)))
                          ? (stepOrder === 1 
                              ? 'ring-2 ring-offset-2 ring-offset-background ring-orange-500/40 dark:ring-orange-500/50 step-1-card' 
                              : 'ring-2 ring-offset-2 ring-offset-background ring-blue-500/40 dark:ring-blue-500/50') 
                          : ''
                      }`}
                      onClick={canPerformAction ? handleStepAction : undefined}
                      style={(canPerformAction || (isInProgress && !(stepOrder === 2 && userRole === 'buyer' && !hasPaymentProof))) ? {
                        border: stepOrder === 1 ? '3px solid' : '2px solid',
                        borderColor: stepOrder === 1 
                          ? undefined 
                          : 'rgba(59, 130, 246, 0.7)',
                        transition: 'all 0.3s ease-in-out',
                        transform: 'scale(1)',
                        animation: stepOrder === 1 
                          ? undefined 
                          : 'pulse-glow 2s ease-in-out infinite'
                      } : undefined}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBgColor}`}>
                              {isCompleted ? (
                                <CheckCircle className="h-5 w-5 text-white" />
                              ) : isInProgress || stepOrder === 1 || canPerformAction ? (
                                stepOrder === 1 ? (
                                  <Clock className="h-5 w-5 text-white" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-white" />
                                )
                              ) : (
                                <Circle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap mt-1">
                              {stepOrder} de 4
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center mb-1">
                              <h4 className="text-base sm:text-lg font-semibold flex-1 step-card-title">
                                {config.title}
                                {canPerformAction && (
                                  <span className="ml-2 text-xs sm:text-sm font-normal">
                                    (Haz clic para completar)
                                  </span>
                                )}
                              </h4>
                            </div>
                            <p className="text-sm sm:text-base step-card-description">
                              {getStepDescription(config.descriptionIndex, stepStatus)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}

            </div>
          </div>

          {/* Panel de Chat - Debajo de los Pasos */}
          <div className="border-t border-border bg-background flex flex-col flex-1 min-h-0 overflow-hidden mt-2 sm:mt-3 flex-shrink">
            {/* Header del Chat - Información Completa en Dos Columnas */}
            <div className="bg-muted border-b border-border px-2 sm:px-4 py-1 sm:py-2 flex-shrink-0 overflow-y-auto max-h-[40vh]">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-1 sm:mb-2">
                Chat de Negociación
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* Temporizador */}
                <div className="bg-card rounded-lg p-2 sm:p-3 border border-border">
                  <div className="flex items-center space-x-2 mb-1">
                    <Timer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs font-medium text-muted-foreground">Tiempo Restante</span>
                  </div>
                  {transaction?.payment_deadline && timeRemaining ? (
                    <div className="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400">
                      {formatTimeRemaining(timeRemaining)}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Esperando aceptación</span>
                    </div>
                  )}
                </div>

                {/* Información del Usuario Contraparte */}
                {requestData && userRole && (
                    <div className={`bg-card border border-border rounded-lg p-2 sm:p-3`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0`}>
                          {(() => {
                            const counterpartyInfo = userRole === 'buyer' ? requestData.seller : requestData.buyer
                            return counterpartyInfo?.avatar_url ? (
                              <img 
                                src={counterpartyInfo.avatar_url} 
                                alt={counterpartyInfo.full_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <User className={`h-5 w-5 ${userRole === 'buyer' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
                            )
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${userRole === 'buyer' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-blue-500 dark:bg-blue-400'}`}></span>
                            <div className={`text-xs font-medium text-muted-foreground`}>
                              {userRole === 'buyer' ? 'Vendedor' : 'Comprador'}
                            </div>
                          </div>
                          <div className={`text-xs sm:text-sm font-semibold truncate text-foreground`}>
                            {(() => {
                              const counterpartyInfo = userRole === 'buyer' ? requestData.seller : requestData.buyer
                              return counterpartyInfo?.full_name || (userRole === 'buyer' ? 'Vendedor' : 'Comprador')
                            })()}
                          </div>
                          <div className="mt-1">
                            {(() => {
                              const counterpartyInfo = userRole === 'buyer' ? requestData.seller : requestData.buyer
                              const verification = counterpartyInfo?.verification_status || 'unverified'
                              const label = verification === 'approved' 
                                ? 'Verificado' 
                                : verification === 'review' 
                                  ? 'En revisión' 
                                  : 'No verificado'
                              const colorClasses = verification === 'approved'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
                                : verification === 'review'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700'
                                  : 'bg-muted text-muted-foreground border-border'
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses}`}>
                                  {label}
                                </span>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Contenido del Chat */}
            <div ref={chatMessagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-background">
              {!chatEnabled ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center">
                    {userRole === 'seller' 
                      ? 'Haz clic en "Aceptar Trato" para habilitar el chat y comenzar la comunicación'
                      : 'El chat se habilitará cuando el vendedor acepte el trato'}
                  </p>
                </div>
              ) : chatHook.isLoading ? (
                <div className="text-center text-sm text-muted-foreground py-8">
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
                          ? 'bg-blue-600 dark:bg-blue-600 text-white' 
                          : 'bg-card border border-border text-foreground'
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
                                    ? 'bg-blue-700 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-800' 
                                    : 'bg-muted hover:bg-muted/80'
                                } transition-colors`}
                              >
                                <File className={`h-4 w-4 ${
                                  msg.sender_id === currentUserId ? 'text-white' : 'text-muted-foreground'
                                }`} />
                                <span className={`text-xs truncate ${
                                  msg.sender_id === currentUserId ? 'text-white' : 'text-foreground'
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
                            ? 'text-blue-100 dark:text-blue-200' 
                            : 'text-muted-foreground'
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
                <div className="text-center text-sm text-muted-foreground py-8">
                  No hay mensajes todavía
                </div>
              )}
            </div>

            {/* Input del Chat */}
            <div className="p-4 border-t border-border bg-card">
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
    </>
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
