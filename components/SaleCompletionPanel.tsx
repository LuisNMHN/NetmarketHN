'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  User,
  DollarSign,
  Timer,
  FileText,
  CreditCard,
  X,
  Lock,
  CheckCircle2,
  Circle,
  HelpCircle
} from 'lucide-react'
import { 
  getSaleTransaction,
  lockHnldInEscrowSale,
  debitHnldFromSeller,
  markSaleRequestCompleted,
  type SaleTransaction
} from '@/lib/actions/sale_requests'
import { supabaseBrowser } from '@/lib/supabase/client'

// =========================================================
// TIPOS E INTERFACES
// =========================================================

interface SaleCompletionPanelProps {
  requestId: string
  transactionId?: string
  sellerId: string
  buyerId: string
  amount: number
  currency: string
  paymentMethod: string
  isOpen: boolean
  onClose: () => void
  onTransactionCreated?: (transactionId: string) => void
}

interface TransactionStep {
  id: string
  transaction_id: string
  step_name: string
  step_order: number
  step_description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  completed_at?: string
  completed_by?: string
  notes?: string
  created_at: string
  updated_at: string
}

interface TransactionData extends SaleTransaction {
  transaction_steps: TransactionStep[]
  seller: { id: string; full_name: string; avatar_url?: string }
  buyer: { id: string; full_name: string; avatar_url?: string }
  request: {
    id: string
    seller_id: string
    amount: number
    currency_type: string
    payment_method: string
    status: string
    unique_code: string
    description?: string
    created_at: string
    updated_at: string
    buyer_id?: string
    accepted_at?: string
  }
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export function SaleCompletionPanel({
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
}: SaleCompletionPanelProps) {
  const [transaction, setTransaction] = useState<TransactionData | null>(null)
  const [requestData, setRequestData] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [hasPaymentProof, setHasPaymentProof] = useState(false)
  const [paymentProofViewed, setPaymentProofViewed] = useState(false)
  const { toast } = useToast()
  
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const transactionRealtimeChannelRef = React.useRef<any>(null)
  const currentSubscribedTransactionIdRef = React.useRef<string | null>(null)
  const transactionCompletionHandledRef = React.useRef<boolean>(false)
  const step1ToastShownRef = React.useRef<boolean>(false)
  const step2ToastShownRef = React.useRef<boolean>(false)
  const step3ToastShownRef = React.useRef<boolean>(false)
  const step4ToastShownRef = React.useRef<boolean>(false)
  const pendingToastsRef = React.useRef<Array<{ step: number; role: 'buyer' | 'seller' | null; isVentaAceptada?: boolean }>>([])

  // Obtener usuario actual
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        if (user.id === sellerId) {
          setUserRole('seller')
        } else if (user.id === buyerId) {
          setUserRole('buyer')
        }
      }
    }
    getCurrentUser()
  }, [sellerId, buyerId])

  // Cargar transacción
  useEffect(() => {
    if (isOpen && transactionId) {
      // Resetear referencias cuando se abre el panel
      step1ToastShownRef.current = false
      step2ToastShownRef.current = false
      step3ToastShownRef.current = false
      step4ToastShownRef.current = false
      transactionCompletionHandledRef.current = false
      setPaymentProofViewed(false) // Resetear el estado de comprobante visto
      loadTransaction()
    }
  }, [isOpen, transactionId])

  // Cargar datos de solicitud
  useEffect(() => {
    if (isOpen && requestId) {
      loadRequestData()
    }
  }, [isOpen, requestId])

  // Configurar suscripción realtime para transaction_steps y sale_transactions
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
        .channel(`sale_transaction:${transactionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'sale_transaction_steps',
          filter: `transaction_id=eq.${transactionId}`
        }, (payload: any) => {
          try {
            console.log('📊 Cambio en sale_transaction_steps recibido:', payload)
            const updatedStep = payload.new
            const eventType = payload.eventType || (payload.old ? 'UPDATE' : 'INSERT')
            
            // Verificar que el paso tiene los datos necesarios
            if (!updatedStep || !updatedStep.id) {
              console.warn('⚠️ Paso recibido sin datos válidos:', updatedStep)
              return
            }
            
            // Verificar si el paso 1 se completó (vendedor aceptó el trato)
            const isStep1Completed = updatedStep?.step_order === 1 && updatedStep?.status === 'completed'
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
              
              // Si el paso 1 se completó, programar toast naranja "Venta aceptada" según el rol (solo una vez)
              if (isStep1Completed && !step1ToastShownRef.current) {
                step1ToastShownRef.current = true
                // Programar toast para "Venta aceptada" cuando se completa el paso 1
                pendingToastsRef.current.push({ step: 1, role: userRole, isVentaAceptada: true })
              }
              
              // Si el paso 2 se completó, programar toast azul según el rol (solo una vez)
              const isStep2Completed = updatedStep?.step_order === 2 && updatedStep?.status === 'completed'
              if (isStep2Completed && !step2ToastShownRef.current) {
                step2ToastShownRef.current = true
                // Programar toast para después del render
                pendingToastsRef.current.push({ step: 2, role: userRole })
              }
              
              // Si el paso 3 se completó, programar toast azul según el rol (solo una vez)
              const isStep3Completed = updatedStep?.step_order === 3 && updatedStep?.status === 'completed'
              if (isStep3Completed && !step3ToastShownRef.current) {
                step3ToastShownRef.current = true
                // Programar toast para después del render
                pendingToastsRef.current.push({ step: 3, role: userRole })
              }
              
              // Si el paso 4 se completó, programar toast de éxito según el rol (solo una vez)
              // IMPORTANTE: Esto se ejecuta para ambas partes cuando detectan el cambio en Realtime
              if (isStep4Completed && !step4ToastShownRef.current) {
                step4ToastShownRef.current = true
                // Agregar toast para el rol actual (comprador o vendedor)
                pendingToastsRef.current.push({ step: 4, role: userRole })
              }
              
              // Si el paso 2 cambió a 'completed' o 'in_progress', verificar payment_proof_url
              if (updatedStep?.step_order === 2 && (updatedStep?.status === 'completed' || updatedStep?.status === 'in_progress')) {
                // Verificar si hay comprobante en la transacción
                const supabase = supabaseBrowser()
                supabase
                  .from('sale_transactions')
                  .select('payment_proof_url')
                  .eq('id', transactionId)
                  .single()
                  .then(({ data }) => {
                    if (data?.payment_proof_url) {
                      setHasPaymentProof(true)
                    }
                  })
                  .catch(err => {
                    // No es crítico si falla, solo un log
                    console.log('⚠️ Error verificando payment_proof_url en realtime:', err)
                  })
              }
              
              // Si el paso 4 se completó, verificar el estado de la transacción antes de completar
              if (isStep4Completed && !transactionCompletionHandledRef.current) {
                console.log('✅ Paso 4 completado detectado en realtime - verificando estado de transacción')
                
                // Verificar el estado actual de la transacción antes de intentar completarla
                const supabase = supabaseBrowser()
                supabase
                  .from('sale_transactions')
                  .select('status')
                  .eq('id', transactionId)
                  .single()
                  .then(({ data: transactionData, error: fetchError }) => {
                    if (fetchError) {
                      console.error('⚠️ Error obteniendo estado de transacción:', fetchError)
                      return
                    }
                    
                    // Solo completar si la transacción está en estado 'hnld_released'
                    if (transactionData?.status === 'hnld_released') {
                      console.log('✅ Transacción en estado hnld_released, completando solicitud')
                      transactionCompletionHandledRef.current = true
                      
                      // Detener el temporizador
                      if (timerIntervalRef.current) {
                        clearInterval(timerIntervalRef.current)
                        timerIntervalRef.current = null
                      }
                      setTimeRemaining(null)
                      
                      // Actualizar solicitud a completada
                      supabase
                        .rpc('mark_sale_request_completed', {
                          p_transaction_id: transactionId
                        })
                        .then(({ error: rpcError }) => {
                          if (rpcError) {
                            console.warn('⚠️ Error en RPC mark_sale_request_completed:', rpcError.message || 'Error desconocido')
                            // Fallback: actualizar directamente
                            supabase
                              .from('sale_requests')
                              .update({
                                status: 'completed',
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', requestId)
                              .select()
                              .then(({ error: directError }) => {
                                if (directError) {
                                  console.error('⚠️ Error en fallback de actualización:', directError)
                                } else {
                                  console.log('✅ Solicitud actualizada directamente a completada (fallback)')
                                }
                              })
                          } else {
                            console.log('✅ Solicitud actualizada a completada via RPC')
                          }
                          
                          // Disparar evento para actualizar la UI
                          const updateNotification = new CustomEvent('sale-request-status-changed', {
                            detail: { requestId, newStatus: 'completed' }
                          })
                          window.dispatchEvent(updateNotification)
                          
                          // Cerrar el panel después de 3 segundos
                          setTimeout(() => {
                            console.log('🔒 Cerrando panel de transacción después de completar (realtime)')
                            onClose()
                          }, 3000)
                        })
                    } else {
                      console.log('⏳ Transacción aún no está en estado hnld_released, esperando...', transactionData?.status)
                      // No hacer nada, esperar a que la transacción cambie a 'hnld_released'
                      // El listener de sale_transactions manejará esto
                    }
                  })
              }
              
              return {
                ...prev,
                transaction_steps: updatedSteps
              }
            })
          } catch (error) {
            console.error('❌ Error procesando cambio en sale_transaction_steps:', error)
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'sale_transactions',
          filter: `id=eq.${transactionId}`
        }, (payload: any) => {
          try {
            console.log('📊 Cambio en sale_transactions recibido:', payload)
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
              
              // Si la transacción cambió a 'hnld_released' o 'completed', completar la solicitud
              const isHnldReleased = updatedTransaction?.status === 'hnld_released'
              const wasHnldReleased = prev.status === 'hnld_released'
              
              // Si la transacción acaba de cambiar a 'hnld_released' (no estaba antes)
              if (isHnldReleased && !wasHnldReleased && !transactionCompletionHandledRef.current) {
                console.log('✅ Transacción en estado hnld_released detectada en realtime - completando solicitud')
                transactionCompletionHandledRef.current = true
                
                // Detener el temporizador
                if (timerIntervalRef.current) {
                  clearInterval(timerIntervalRef.current)
                  timerIntervalRef.current = null
                }
                setTimeRemaining(null)
                
                // Actualizar solicitud a completada
                const supabase = supabaseBrowser()
                supabase
                  .rpc('mark_sale_request_completed', {
                    p_transaction_id: transactionId
                  })
                  .then(({ error: rpcError }) => {
                    if (rpcError) {
                      console.warn('⚠️ Error en RPC mark_sale_request_completed:', rpcError.message || 'Error desconocido')
                      // Fallback: actualizar directamente
                      supabase
                        .from('sale_requests')
                        .update({
                          status: 'completed',
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', requestId)
                        .select()
                        .then(({ error: directError }) => {
                          if (directError) {
                            console.error('⚠️ Error en fallback de actualización:', directError)
                          } else {
                            console.log('✅ Solicitud actualizada directamente a completada (fallback)')
                          }
                        })
                    } else {
                      console.log('✅ Solicitud actualizada a completada via RPC')
                    }
                    
                    // Disparar evento para actualizar la UI
                    const updateNotification = new CustomEvent('sale-request-status-changed', {
                      detail: { requestId, newStatus: 'completed' }
                    })
                    window.dispatchEvent(updateNotification)
                    
                    // Cerrar el panel después de 3 segundos
                    setTimeout(() => {
                      console.log('🔒 Cerrando panel de transacción después de completar (realtime - transaction status)')
                      onClose()
                    }, 3000)
                  })
              }
              
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
                
                // Disparar evento para actualizar la UI
                const updateNotification = new CustomEvent('sale-request-status-changed', {
                  detail: { requestId, newStatus: 'completed' }
                })
                window.dispatchEvent(updateNotification)
                
                // Cerrar el panel después de 3 segundos
                setTimeout(() => {
                  console.log('🔒 Cerrando panel de transacción después de completar (realtime - transaction completed)')
                  onClose()
                }, 3000)
              }
              
              // Actualizar hasPaymentProof si cambió el payment_proof_url
              if (updatedTransaction.payment_proof_url !== prev.payment_proof_url) {
                setHasPaymentProof(!!updatedTransaction.payment_proof_url)
              }
              
              return {
                ...prev,
                ...updatedTransaction,
                // Mantener transaction_steps si están en el estado anterior
                transaction_steps: prev.transaction_steps || []
              }
            })
          } catch (error) {
            console.error('❌ Error procesando cambio en sale_transactions:', error)
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
  }, [requestId, onClose])
  
  // Limpiar suscripción al desmontar
  useEffect(() => {
    return () => {
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
      if (transactionRealtimeChannelRef.current) {
        console.log('🧹 Limpiando suscripción realtime (panel cerrado o sin transacción)')
        try {
          transactionRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo:', error)
        }
        transactionRealtimeChannelRef.current = null
        currentSubscribedTransactionIdRef.current = null
      }
      return
    }
    
    // Configurar suscripción realtime para la transacción actual
    setupTransactionRealtimeSubscription(transaction.id)
    
    return () => {
      if (transactionRealtimeChannelRef.current && currentSubscribedTransactionIdRef.current === transaction.id) {
        console.log('🧹 Limpiando suscripción realtime (cambio de transacción)')
        try {
          transactionRealtimeChannelRef.current.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo:', error)
        }
        transactionRealtimeChannelRef.current = null
        currentSubscribedTransactionIdRef.current = null
      }
    }
  }, [isOpen, transaction?.id, setupTransactionRealtimeSubscription])

  // Timer para deadlines
  useEffect(() => {
    if (!transaction) return

    const updateTimer = () => {
      if (transaction.payment_deadline) {
        const deadline = new Date(transaction.payment_deadline).getTime()
        const now = Date.now()
        const remaining = Math.max(0, deadline - now)
        setTimeRemaining(remaining)
      }
    }

    updateTimer()
    timerIntervalRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [transaction])

  // Procesar toasts pendientes después del render
  useEffect(() => {
    if (pendingToastsRef.current.length > 0) {
      const toastsToShow = [...pendingToastsRef.current]
      pendingToastsRef.current = []
      
      // Usar setTimeout para asegurar que se ejecute después del render
      setTimeout(() => {
        toastsToShow.forEach(({ step, role, isVentaAceptada }, index) => {
          if (step === 1 && isVentaAceptada) {
            // Toast cuando se completa el paso 1: Venta aceptada
            if (role === 'buyer') {
              toast({
                title: "Venta aceptada",
                description: "La venta ha sido aceptada. El proceso de transacción ha comenzado.",
                variant: "info",
              })
            } else if (role === 'seller') {
              toast({
                title: "Venta aceptada",
                description: "Has aceptado la venta. El proceso de transacción ha comenzado.",
                variant: "info",
              })
            }
          } else if (step === 2) {
            if (role === 'buyer') {
              toast({
                title: "Pago confirmado",
                description: "Has confirmado tu pago. El vendedor será notificado para verificar el comprobante.",
                variant: "success",
              })
            } else if (role === 'seller') {
              toast({
                title: "Pago confirmado",
                description: "El comprador ha confirmado el pago y subido el comprobante. Verifica el pago para continuar.",
                variant: "success",
              })
            }
          } else if (step === 3) {
            if (role === 'buyer') {
              toast({
                title: "Pago verificado",
                description: "El vendedor ha verificado tu pago. Los HNLD serán liberados pronto.",
                variant: "success",
              })
            } else if (role === 'seller') {
              toast({
                title: "Pago verificado",
                description: "Has verificado el pago del comprador. Ahora puedes liberar los HNLD.",
                variant: "success",
              })
            }
          } else if (step === 4) {
            // Toast de éxito cuando se completa el paso 4 (verde)
            if (role === 'buyer') {
              toast({
                title: "Transacción completada",
                description: "¡Felicidades! Has recibido los HNLD. La transacción ha sido completada exitosamente.",
                variant: "created",
              })
            } else if (role === 'seller') {
              toast({
                title: "Transacción completada",
                description: "¡Felicidades! Has liberado los HNLD al comprador. La transacción ha sido completada exitosamente.",
                variant: "created",
              })
            }
          }
        })
      }, 0)
    }
  }, [transaction?.transaction_steps, toast])

  const loadRequestData = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('sale_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (error) throw error
      setRequestData(data)
    } catch (error) {
      console.error('Error cargando solicitud:', error)
    }
  }

  const loadTransaction = async () => {
    if (!transactionId) return

    try {
      setLoading(true)
      const result = await getSaleTransaction(transactionId)
      
      if (result.success && result.data) {
        // Cargar pasos de la transacción
        const supabase = supabaseBrowser()
        const { data: steps } = await supabase
          .from('sale_transaction_steps')
          .select('*')
          .eq('transaction_id', transactionId)
          .order('step_order', { ascending: true })

        // Cargar información de usuarios
        const { data: sellerData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', result.data.seller_id)
          .single()

        const { data: buyerData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', result.data.buyer_id)
          .single()

        const transactionWithSteps: TransactionData = {
          ...result.data,
          transaction_steps: steps || [],
          seller: sellerData || { id: result.data.seller_id, full_name: 'Vendedor' },
          buyer: buyerData || { id: result.data.buyer_id, full_name: 'Comprador' },
          request: requestData || {
            id: requestId,
            seller_id: result.data.seller_id,
            amount: result.data.amount,
            currency_type: result.data.currency,
            payment_method: result.data.payment_method,
            status: 'accepted',
            unique_code: result.data.unique_code || '',
            created_at: result.data.created_at,
            updated_at: result.data.updated_at
          }
        }

        setTransaction(transactionWithSteps)
        setHasPaymentProof(!!result.data.payment_proof_url)

        // Determinar paso actual
        const currentStepIndex = transactionWithSteps.transaction_steps.findIndex(
          step => step.status !== 'completed'
        )
        setCurrentStep(currentStepIndex >= 0 ? currentStepIndex : 3)
        
        // Configurar suscripción realtime para transaction_steps y sale_transactions
        setupTransactionRealtimeSubscription(transactionId)
      }
    } catch (error) {
      console.error('Error cargando transacción:', error)
      toast({
        title: "Error",
        description: "No se pudo cargar la transacción",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStepAction = async (stepOrder: number) => {
    if (!transaction || !userRole) return
    
    // Prevenir doble clic
    if (loading) return

    try {
      setLoading(true)
      const supabase = supabaseBrowser()
      const now = new Date()

      if (stepOrder === 1 && userRole === 'seller') {
        // Paso 1: Vendedor acepta y bloquea HNLD en escrow
        const result = await lockHnldInEscrowSale(transaction.id)
        
        if (result.success) {
          // Emitir notificación al comprador
          try {
            await supabase.rpc('emit_notification', {
              p_user_id: transaction.buyer_id,
              p_event: 'SALE_ACCEPTED',
              p_title: 'Vendedor aceptó el trato',
              p_body: `El vendedor ${transaction.seller_name} ha aceptado tu solicitud de compra y bloqueado L. ${transaction.final_amount_hnld.toFixed(2)} HNLD en escrow. Código: ${transaction.unique_code}`,
              p_priority: 'high',
              p_cta_label: 'Ver transacción',
              p_cta_href: `/dashboard/ventas`,
              p_dedupe_key: `sale_accepted_${requestId}_${transaction.id}`,
              p_payload: {
                transaction_id: transaction.id,
                request_id: requestId,
                amount: transaction.final_amount_hnld,
                unique_code: transaction.unique_code
              }
            })
          } catch (err) {
            console.error('Error emitiendo notificación:', err)
          }

          await loadTransaction()
        } else {
          toast({
            title: "Error",
            description: result.error || "Error bloqueando HNLD",
            variant: "destructive",
          })
        }
      } else if (stepOrder === 2 && userRole === 'buyer') {
        // Paso 2: Comprador confirma pago (ya subió comprobante)
        if (!hasPaymentProof) {
          toast({
            title: "Comprobante requerido",
            description: "Debes subir un comprobante de pago primero",
            variant: "destructive",
          })
          return
        }

        const { error: stepError } = await supabase
          .from('sale_transaction_steps')
          .update({
            status: 'completed',
            completed_at: now.toISOString()
          })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 2)

        if (stepError) throw stepError

        // Actualizar paso 3 a in_progress
        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'in_progress' })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 3)

        // Actualizar transacción
        await supabase
          .from('sale_transactions')
          .update({
            status: 'payment_in_progress',
            payment_started_at: now.toISOString()
          })
          .eq('id', transaction.id)

        // Emitir notificación al vendedor
        try {
          await supabase.rpc('emit_notification', {
            p_user_id: transaction.seller_id,
            p_event: 'SALE_PAYMENT_STARTED',
            p_title: 'Comprador inició el pago',
            p_body: `El comprador ${transaction.buyer_name} ha confirmado el pago. Código: ${transaction.unique_code}`,
            p_priority: 'high',
            p_cta_label: 'Ver transacción',
            p_cta_href: `/dashboard/mis-ventas`,
            p_dedupe_key: `sale_payment_started_${requestId}_${transaction.id}`,
            p_payload: {
              transaction_id: transaction.id,
              request_id: requestId,
              amount: transaction.final_amount_hnld,
              unique_code: transaction.unique_code
            }
          })
        } catch (err) {
          console.error('Error emitiendo notificación:', err)
        }

        await loadTransaction()
      } else if (stepOrder === 3 && userRole === 'seller') {
        // Paso 3: Vendedor verifica pago
        // Verificar que el paso 3 aún no esté completado para evitar doble procesamiento
        const { data: currentStep, error: checkError } = await supabase
          .from('sale_transaction_steps')
          .select('status')
          .eq('transaction_id', transaction.id)
          .eq('step_order', 3)
          .single()
        
        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 es "no rows returned", que es normal si el paso no existe aún
          throw checkError
        }
        
        if (currentStep?.status === 'completed') {
          console.log('⚠️ Paso 3 ya está completado, evitando doble procesamiento')
          return
        }
        
        const { error: stepError } = await supabase
          .from('sale_transaction_steps')
          .update({
            status: 'completed',
            completed_at: now.toISOString()
          })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 3)

        if (stepError) throw stepError

        // Actualizar paso 4 a in_progress
        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'in_progress' })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 4)

        // Actualizar transacción
        await supabase
          .from('sale_transactions')
          .update({
            status: 'payment_verified',
            payment_verified_at: now.toISOString()
          })
          .eq('id', transaction.id)

        // Emitir notificación al comprador
        try {
          await supabase.rpc('emit_notification', {
            p_user_id: transaction.buyer_id,
            p_event: 'SALE_PAYMENT_VERIFIED',
            p_title: 'Pago verificado',
            p_body: `El vendedor ${transaction.seller_name} ha verificado tu pago. Los HNLD serán liberados pronto. Código: ${transaction.unique_code}`,
            p_priority: 'high',
            p_cta_label: 'Ver transacción',
            p_cta_href: `/dashboard/ventas`,
            p_dedupe_key: `sale_payment_verified_${requestId}_${transaction.id}`,
            p_payload: {
              transaction_id: transaction.id,
              request_id: requestId,
              amount: transaction.final_amount_hnld,
              unique_code: transaction.unique_code
            }
          })
        } catch (err) {
          console.error('Error emitiendo notificación:', err)
        }

        await loadTransaction()
      } else if (stepOrder === 4 && userRole === 'seller') {
        // Paso 4: Vendedor libera HNLD al comprador
        const result = await debitHnldFromSeller(transaction.id)
        
        if (result.success) {
          // Actualizar paso 4 a completado
          await supabase
            .from('sale_transaction_steps')
            .update({
              status: 'completed',
              completed_at: now.toISOString()
            })
            .eq('transaction_id', transaction.id)
            .eq('step_order', 4)

          // Marcar transacción como completada
          await markSaleRequestCompleted(transaction.id)

          // Emitir notificaciones a ambas partes
          try {
            const formattedAmount = `L. ${transaction.final_amount_hnld.toFixed(2)} HNLD`
            
            // Notificación al comprador
            await supabase.rpc('emit_notification', {
              p_user_id: transaction.buyer_id,
              p_event: 'SALE_COMPLETED',
              p_title: 'Compra completada',
              p_body: `Has recibido ${formattedAmount} del vendedor ${transaction.seller_name}. Código: ${transaction.unique_code}`,
              p_priority: 'high',
              p_cta_label: 'Ver transacción',
              p_cta_href: `/dashboard/ventas`,
              p_dedupe_key: `sale_completed_buyer_${requestId}_${transaction.id}`,
              p_payload: {
                transaction_id: transaction.id,
                request_id: requestId,
                amount: transaction.final_amount_hnld,
                unique_code: transaction.unique_code
              }
            })

            // Notificación al vendedor
            await supabase.rpc('emit_notification', {
              p_user_id: transaction.seller_id,
              p_event: 'SALE_COMPLETED',
              p_title: 'Venta completada',
              p_body: `Has vendido ${formattedAmount} al comprador ${transaction.buyer_name}. Código: ${transaction.unique_code}`,
              p_priority: 'high',
              p_cta_label: 'Ver transacción',
              p_cta_href: `/dashboard/mis-ventas`,
              p_dedupe_key: `sale_completed_seller_${requestId}_${transaction.id}`,
              p_payload: {
                transaction_id: transaction.id,
                request_id: requestId,
                amount: transaction.final_amount_hnld,
                unique_code: transaction.unique_code
              }
            })
          } catch (err) {
            console.error('Error emitiendo notificaciones:', err)
          }

          await loadTransaction()
        } else {
          toast({
            title: "Error",
            description: result.error || "Error liberando HNLD",
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      console.error('Error en acción de paso:', error)
      toast({
        title: "Error",
        description: error.message || "Error procesando la acción",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!transaction) return

    try {
      setUploadingFile(true)
      const supabase = supabaseBrowser()

      // Subir archivo a Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${transaction.id}_${Date.now()}.${fileExt}`
      const filePath = `payment-proofs/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('transaction-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('transaction-documents')
        .getPublicUrl(filePath)

      // Actualizar transacción con comprobante
      const { error: updateError } = await supabase
        .from('sale_transactions')
        .update({
          payment_proof_url: publicUrl,
          payment_proof_uploaded_at: new Date().toISOString()
        })
        .eq('id', transaction.id)

      if (updateError) throw updateError

      setHasPaymentProof(true)
      toast({
        title: "Comprobante Subido",
        description: "El comprobante de pago ha sido subido exitosamente",
        variant: "created",
      })

      await loadTransaction()
    } catch (error: any) {
      console.error('Error subiendo archivo:', error)
      toast({
        title: "Error",
        description: error.message || "Error subiendo el comprobante",
        variant: "destructive",
      })
    } finally {
      setUploadingFile(false)
    }
  }

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const getPaymentMethodDisplayName = (method: string) => {
    const methodMap: Record<string, string> = {
      'local_transfer': 'Transferencia local',
      'digital_balance': 'Saldo digital',
      'international_transfer': 'Transferencia internacional',
      'card': 'Tarjeta',
      'cash': 'Efectivo'
    }
    return methodMap[method] || method
  }

  if (!isOpen) return null

  const allSteps = transaction?.transaction_steps || []
  const completedSteps = allSteps.filter(s => s.status === 'completed').length
  const progress = (completedSteps / 4) * 100

  // Determinar paso actual a mostrar
  const getCurrentStepToShow = () => {
    for (let order = 1; order <= 4; order++) {
      const step = allSteps.find(s => s.step_order === order)
      if (step && step.status !== 'completed') {
        return { order, step }
      }
    }
    return { order: 4, step: allSteps.find(s => s.step_order === 4) }
  }

  const currentStepInfo = getCurrentStepToShow()
  const { order: stepOrder, step } = currentStepInfo
  const stepStatus = step?.status || 'pending'
  const isInProgress = stepStatus === 'in_progress'
  const isCompleted = stepStatus === 'completed'

  // Determinar si el usuario puede realizar la acción
  const canPerformAction = 
    (stepOrder === 1 && userRole === 'seller' && stepStatus === 'pending') ||
    (stepOrder === 2 && userRole === 'buyer' && isInProgress && hasPaymentProof) ||
    (stepOrder === 3 && userRole === 'seller' && isInProgress && paymentProofViewed) ||
    (stepOrder === 4 && userRole === 'seller' && isInProgress)

  const panelContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 py-0" 
      style={{ filter: 'none', backdropFilter: 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        className="bg-card text-foreground rounded-lg shadow-2xl w-full max-w-md sm:max-w-lg md:max-w-xl h-[92vh] overflow-hidden relative flex flex-col"
        style={{ filter: 'none !important', backdropFilter: 'none !important' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-muted border-b border-border px-3 sm:px-6 py-1 sm:py-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <h1 className="text-sm sm:text-base font-bold text-foreground">
                Venta de HNLD
              </h1>
              <span className="text-sm sm:text-base font-bold text-foreground">-</span>
              <span className="text-sm sm:text-base font-bold text-muted-foreground">
                L. {transaction?.final_amount_hnld?.toFixed(2) || amount.toFixed(2)} HNLD
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
          
          <div className="bg-card rounded-lg p-1.5 sm:p-3 border border-border">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="pr-2 sm:pr-3 border-r border-border">
                <div className="flex items-center space-x-1.5 sm:space-x-2 mb-0.5 sm:mb-1">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Código</span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-foreground">
                  {transaction?.unique_code || requestData?.unique_code || 'NMHNV-XXXXXX'}
                </div>
              </div>
              <div className="pl-2 sm:pl-3">
                <div className="flex items-center space-x-1.5 sm:space-x-2 mb-0.5 sm:mb-1">
                  <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Método</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-foreground">
                  {getPaymentMethodDisplayName(transaction?.payment_method || paymentMethod)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
          {/* Progress Bar */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                Progreso de la transacción
              </span>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                {completedSteps} de 4 pasos
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Información de participantes */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Card className="p-3">
              <div className="flex items-center space-x-2 mb-1">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-muted-foreground">Vendedor</span>
              </div>
              <p className="text-sm font-semibold">{transaction?.seller_name || 'Vendedor'}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center space-x-2 mb-1">
                <User className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground">Comprador</span>
              </div>
              <p className="text-sm font-semibold">{transaction?.buyer_name || 'Comprador'}</p>
            </Card>
          </div>

          {/* Pasos de la transacción */}
          <div className="space-y-3 sm:space-y-4">
            {/* Paso 1: Vendedor acepta y bloquea HNLD */}
            <Card className={`p-4 ${stepOrder === 1 ? 'border-2 border-orange-500' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {allSteps.find(s => s.step_order === 1)?.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : stepOrder === 1 ? (
                    <Circle className="h-5 w-5 text-orange-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Paso 1: {userRole === 'seller' ? 'Acepta el trato y bloquea tus HNLD' : 'Espera a que el vendedor acepte'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {userRole === 'seller' ? 'Bloquea tus HNLD en escrow para proteger la transacción' : 'El vendedor debe aceptar y bloquear HNLD en escrow'}
                    </p>
                  </div>
                </div>
                {allSteps.find(s => s.step_order === 1)?.status === 'completed' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Completado
                  </Badge>
                )}
              </div>
              {stepOrder === 1 && userRole === 'seller' && stepStatus === 'pending' && (
                <Button
                  onClick={() => handleStepAction(1)}
                  disabled={loading}
                  className="w-full mt-3"
                >
                  {loading ? "Procesando..." : "Aceptar y Bloquear HNLD"}
                </Button>
              )}
            </Card>

            {/* Paso 2: Comprador paga */}
            <Card className={`p-4 ${stepOrder === 2 ? 'border-2 border-blue-500' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {allSteps.find(s => s.step_order === 2)?.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : stepOrder === 2 ? (
                    <Circle className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Paso 2: {userRole === 'buyer' ? 'Realiza el pago' : 'Espera a que el comprador pague'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {userRole === 'buyer' ? 'Sube el comprobante de pago que realizaste' : 'El comprador debe realizar el pago y subir el comprobante'}
                    </p>
                  </div>
                </div>
                {allSteps.find(s => s.step_order === 2)?.status === 'completed' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Completado
                  </Badge>
                )}
              </div>
              {stepOrder === 2 && userRole === 'buyer' && (
                <div className="space-y-3 mt-3">
                  {!hasPaymentProof && (
                    <>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file)
                        }}
                        className="hidden"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        variant="outline"
                        className="w-full"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadingFile ? "Subiendo..." : "Subir Comprobante"}
                      </Button>
                    </>
                  )}
                  {hasPaymentProof && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Comprobante subido. Confirma el pago cuando esté listo.
                      </AlertDescription>
                    </Alert>
                  )}
                  {hasPaymentProof && isInProgress && (
                    <Button
                      onClick={() => handleStepAction(2)}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? "Procesando..." : "Confirmar Pago Realizado"}
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Paso 3: Vendedor verifica pago */}
            <Card className={`p-4 ${stepOrder === 3 ? 'border-2 border-blue-500' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {allSteps.find(s => s.step_order === 3)?.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : stepOrder === 3 ? (
                    <Circle className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Paso 3: {userRole === 'seller' ? 'Verifica el pago del comprador' : 'Espera verificación del vendedor'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {userRole === 'seller' ? 'Revisa y verifica el comprobante de pago subido' : 'El vendedor está verificando tu comprobante de pago'}
                    </p>
                  </div>
                </div>
                {allSteps.find(s => s.step_order === 3)?.status === 'completed' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Completado
                  </Badge>
                )}
              </div>
              {stepOrder === 3 && userRole === 'seller' && isInProgress && (
                <div className="space-y-3 mt-3">
                  {transaction?.payment_proof_url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setPaymentProofViewed(true)
                        window.open(transaction.payment_proof_url, '_blank', 'noopener,noreferrer')
                      }}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="h-4 w-4" />
                      Ver comprobante de pago
                    </button>
                  )}
                  {!paymentProofViewed && transaction?.payment_proof_url && (
                    <p className="text-xs text-muted-foreground">
                      Debes abrir y revisar el comprobante de pago antes de verificar
                    </p>
                  )}
                  <Button
                    onClick={() => handleStepAction(3)}
                    disabled={loading || !paymentProofViewed}
                    className="w-full"
                  >
                    {loading ? "Verificando..." : "Verificar Pago"}
                  </Button>
                </div>
              )}
            </Card>

            {/* Paso 4: Liberar HNLD */}
            <Card className={`p-4 ${stepOrder === 4 ? 'border-2 border-green-500' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {allSteps.find(s => s.step_order === 4)?.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : stepOrder === 4 ? (
                    <Circle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Paso 4: {userRole === 'seller' ? 'Libera los HNLD al comprador' : 'Recibe los HNLD'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {userRole === 'seller' ? 'Transfiere los HNLD bloqueados al comprador' : 'El vendedor liberará los HNLD que compraste'}
                    </p>
                  </div>
                </div>
                {allSteps.find(s => s.step_order === 4)?.status === 'completed' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Completado
                  </Badge>
                )}
              </div>
              {stepOrder === 4 && userRole === 'seller' && isInProgress && (
                <Button
                  onClick={() => handleStepAction(4)}
                  disabled={loading}
                  className="w-full mt-3"
                >
                  {loading ? "Procesando..." : "Liberar HNLD"}
                </Button>
              )}
            </Card>
          </div>

          {/* Timer si hay deadline */}
          {timeRemaining !== null && timeRemaining > 0 && (
            <Alert className="mt-4">
              <Timer className="h-4 w-4" />
              <AlertDescription>
                Tiempo restante: {formatTimeRemaining(timeRemaining)}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(panelContent, document.body)
}

