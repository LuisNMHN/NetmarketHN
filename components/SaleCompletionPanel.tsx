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
  X,
  ChevronRight,
  Lock,
  CheckCircle2,
  Circle,
  Send,
  Paperclip,
  File
} from 'lucide-react'
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

interface SaleTransactionStep {
  id: string
  transaction_id: string
  step_order: number
  step_name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  completed_at?: string
  created_at: string
  updated_at: string
}

interface SaleTransactionData {
  id: string
  request_id: string
  seller_id: string
  buyer_id: string
  amount: number
  currency: string
  exchange_rate: number
  hnld_amount: number
  payment_method: string
  payment_details?: any
  status: 'pending' | 'agreement_confirmed' | 'payment_in_progress' | 'payment_verified' | 'hnld_released' | 'completed' | 'cancelled' | 'disputed'
  payment_deadline?: string
  verification_deadline?: string
  escrow_amount?: number
  escrow_status?: 'protected' | 'released' | 'refunded'
  payment_proof_url?: string
  payment_proof_uploaded_at?: string
  payment_verified_at?: string
  hnld_released_at?: string
  agreement_confirmed_at?: string
  payment_started_at?: string
  created_at: string
  updated_at: string
  sale_transaction_steps?: SaleTransactionStep[]
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
  const [transaction, setTransaction] = useState<SaleTransactionData | null>(null)
  const [requestData, setRequestData] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasPaymentProof, setHasPaymentProof] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  // Obtener usuario actual
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
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
      } catch (error) {
        console.error('Error obteniendo usuario:', error)
      }
    }
    getCurrentUser()
  }, [sellerId, buyerId])

  // Cargar datos de la solicitud y transacción
  useEffect(() => {
    if (!isOpen || !requestId) return

    const loadData = async () => {
      try {
        setLoading(true)
        const supabase = supabaseBrowser()

        // Cargar solicitud de venta con datos del vendedor
        const { data: request, error: requestError } = await supabase
          .from('sale_requests')
          .select(`
            *,
            seller:profiles!sale_requests_seller_id_fkey(id, full_name, avatar_url),
            buyer:profiles!sale_requests_buyer_id_fkey(id, full_name, avatar_url)
          `)
          .eq('id', requestId)
          .single()

        if (requestError) {
          console.error('Error cargando solicitud de venta:', requestError)
          return
        }

        // Si no se obtuvieron los perfiles, intentar obtenerlos manualmente
        let sellerData = request.seller
        let buyerData = request.buyer

        if (!sellerData && request.seller_id) {
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', request.seller_id)
            .maybeSingle()
          sellerData = sellerProfile
        }

        if (!buyerData && request.buyer_id) {
          const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', request.buyer_id)
            .maybeSingle()
          buyerData = buyerProfile
        }

        setRequestData({
          ...request,
          seller: sellerData,
          buyer: buyerData
        })

        // Cargar transacción existente
        let query = supabase
          .from('sale_transactions')
          .select(`
            *,
            sale_transaction_steps (*)
          `)

        if (transactionId) {
          query = query.eq('id', transactionId)
        } else {
          query = query.eq('request_id', requestId)
        }

        const { data: existingTransaction, error: transError } = await query.maybeSingle()

        if (existingTransaction) {
          setTransaction(existingTransaction)
          const currentStepIndex = existingTransaction.sale_transaction_steps?.findIndex(
            step => step.status !== 'completed'
          ) ?? 0
          setCurrentStep(currentStepIndex >= 0 ? currentStepIndex : 3)
          setHasPaymentProof(!!existingTransaction.payment_proof_url)
        } else if (!transactionId) {
          // Crear transacción si no existe
          await createSaleTransaction()
        }
      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isOpen, requestId, transactionId])

  // Crear transacción de venta
  const createSaleTransaction = async () => {
    try {
      const supabase = supabaseBrowser()
      const now = new Date()

      const { data: newTransaction, error: createError } = await supabase
        .from('sale_transactions')
        .insert({
          request_id: requestId,
          seller_id: sellerId,
          buyer_id: buyerId,
          amount: requestData?.amount_in_original_currency || amount,
          currency: requestData?.currency_type || currency,
          exchange_rate: requestData?.exchange_rate_applied || 1.0,
          hnld_amount: requestData?.final_amount_hnld || amount,
          payment_method: paymentMethod,
          status: 'pending',
          escrow_amount: requestData?.final_amount_hnld || amount,
          escrow_status: 'protected'
        })
        .select(`
          *,
          sale_transaction_steps (*)
        `)
        .single()

      if (createError) {
        console.error('Error creando transacción de venta:', createError)
        return
      }

      // Crear pasos de la transacción
      await supabase.from('sale_transaction_steps').insert([
        { transaction_id: newTransaction.id, step_order: 1, step_name: 'Trato aceptado', status: 'completed' },
        { transaction_id: newTransaction.id, step_order: 2, step_name: 'Pago iniciado', status: 'pending' },
        { transaction_id: newTransaction.id, step_order: 3, step_name: 'Pago verificado', status: 'pending' },
        { transaction_id: newTransaction.id, step_order: 4, step_name: 'HNLD liberados', status: 'pending' }
      ])

      // Recargar transacción con pasos
      const { data: transactionWithSteps } = await supabase
        .from('sale_transactions')
        .select(`
          *,
          sale_transaction_steps (*)
        `)
        .eq('id', newTransaction.id)
        .single()

      if (transactionWithSteps) {
        setTransaction(transactionWithSteps)
        onTransactionCreated?.(newTransaction.id)
      }
    } catch (error) {
      console.error('Error creando transacción:', error)
    }
  }

  // Manejar acción de paso
  const handleStepAction = async (stepOrder: number) => {
    if (loading || !transaction) return

    try {
      setLoading(true)
      const supabase = supabaseBrowser()
      const now = new Date()

      if (stepOrder === 1 && userRole === 'seller') {
        // Paso 1: Aceptar trato (vendedor)
        // Bloquear HNLD en escrow
        const { error: lockError } = await supabase.rpc('lock_hnld_in_escrow', {
          p_user_id: sellerId,
          p_amount: transaction.hnld_amount,
          p_transaction_id: transaction.id
        })

        if (lockError) {
          console.error('Error bloqueando HNLD en escrow:', lockError)
          toast({
            title: "Error",
            description: "No se pudo bloquear el HNLD en escrow. Verifica tu saldo.",
            variant: "destructive",
          })
          return
        }

        const paymentDeadline = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
        const verificationDeadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

        await supabase
          .from('sale_transactions')
          .update({
            payment_deadline: paymentDeadline,
            verification_deadline: verificationDeadline,
            agreement_confirmed_at: now.toISOString(),
            status: 'agreement_confirmed',
            escrow_amount: transaction.hnld_amount,
            escrow_status: 'protected'
          })
          .eq('id', transaction.id)

        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'completed', completed_at: now.toISOString() })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 1)

        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'in_progress' })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 2)

        // Enviar notificación al comprador
        const sellerName = requestData?.seller?.full_name || 'El vendedor'
        const uniqueCode = requestData?.unique_code || ''
        await supabase.rpc('emit_notification', {
          p_user_id: buyerId,
          p_topic: 'order',
          p_event: 'SALE_ACCEPTED',
          p_title: 'Venta aceptada',
          p_body: `${sellerName} ha aceptado tu compra de HNLD`,
          p_priority: 'high',
          p_dedupe_key: `sale_accepted_${requestId}_${transaction.id}`,
          p_payload: {
            transaction_id: transaction.id,
            request_id: requestId,
            unique_code: uniqueCode,
            seller_name: sellerName
          }
        })

        loadTransaction()
      } else if (stepOrder === 2 && userRole === 'buyer' && hasPaymentProof) {
        // Paso 2: Confirmar pago (comprador)
        await supabase
          .from('sale_transactions')
          .update({
            payment_started_at: now.toISOString(),
            status: 'payment_in_progress'
          })
          .eq('id', transaction.id)

        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'completed', completed_at: now.toISOString() })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 2)

        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'in_progress' })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 3)

        // Enviar notificación al vendedor
        const buyerName = requestData?.buyer?.full_name || 'El comprador'
        const uniqueCode = requestData?.unique_code || ''
        await supabase.rpc('emit_notification', {
          p_user_id: sellerId,
          p_topic: 'order',
          p_event: 'SALE_PAYMENT_STARTED',
          p_title: 'Pago iniciado',
          p_body: `${buyerName} ha iniciado el pago`,
          p_priority: 'high',
          p_payload: {
            transaction_id: transaction.id,
            request_id: requestId,
            unique_code: uniqueCode,
            buyer_name: buyerName
          }
        })

        loadTransaction()
      } else if (stepOrder === 3 && userRole === 'seller') {
        // Paso 3: Verificar pago (vendedor)
        await supabase
          .from('sale_transactions')
          .update({
            payment_verified_at: now.toISOString(),
            status: 'payment_verified'
          })
          .eq('id', transaction.id)

        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'completed', completed_at: now.toISOString() })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 3)

        await supabase
          .from('sale_transaction_steps')
          .update({ status: 'in_progress' })
          .eq('transaction_id', transaction.id)
          .eq('step_order', 4)

        // Liberar HNLD al comprador automáticamente
        setTimeout(async () => {
          await releaseHnldToBuyer()
        }, 1000)

        // Enviar notificación al comprador
        const sellerName = requestData?.seller?.full_name || 'El vendedor'
        const uniqueCode = requestData?.unique_code || ''
        await supabase.rpc('emit_notification', {
          p_user_id: buyerId,
          p_topic: 'order',
          p_event: 'SALE_PAYMENT_VERIFIED',
          p_title: 'Pago verificado',
          p_body: `${sellerName} ha verificado tu pago`,
          p_priority: 'high',
          p_payload: {
            transaction_id: transaction.id,
            request_id: requestId,
            unique_code: uniqueCode,
            seller_name: sellerName
          }
        })

        loadTransaction()
      }
    } catch (error) {
      console.error('Error en acción de paso:', error)
      toast({
        title: "Error",
        description: "Error al procesar la acción",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Liberar HNLD al comprador
  const releaseHnldToBuyer = async () => {
    if (!transaction) return

    try {
      const supabase = supabaseBrowser()
      const now = new Date()

      // 1. Los HNLD ya están bloqueados en escrow cuando se crea la transacción
      // Solo necesitamos actualizar el estado del escrow a 'released'
      // El débito ya se hizo cuando se aceptó la venta

      // 2. Acreditar HNLD al comprador
      const { error: creditError } = await supabase.rpc('emit_hnld', {
        p_user_id: buyerId,
        p_amount: transaction.hnld_amount,
        p_description: `Compra de HNLD - Solicitud ${requestData?.unique_code || requestId} - HNLD recibidos del vendedor`
      })

      if (creditError) {
        console.error('Error acreditando HNLD al comprador:', creditError)
        return
      }

      // 3. Actualizar transacción
      await supabase
        .from('sale_transactions')
        .update({
          hnld_released_at: now.toISOString(),
          status: 'completed',
          escrow_status: 'released'
        })
        .eq('id', transaction.id)

      // 4. Completar paso 4
      await supabase
        .from('sale_transaction_steps')
        .update({ status: 'completed', completed_at: now.toISOString() })
        .eq('transaction_id', transaction.id)
        .eq('step_order', 4)

      // 5. Actualizar solicitud
      await supabase
        .from('sale_requests')
        .update({ status: 'completed', updated_at: now.toISOString() })
        .eq('id', requestId)

      // 6. Enviar notificaciones
      const uniqueCode = requestData?.unique_code || ''
      const formattedHnldAmount = 'L. ' + 
        new Intl.NumberFormat('es-HN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(transaction.hnld_amount) + ' HNLD'

      await supabase.rpc('emit_notification', {
        p_user_id: buyerId,
        p_topic: 'order',
        p_event: 'SALE_COMPLETED',
        p_title: 'Venta completada',
        p_body: `Se acreditó exitosamente ${formattedHnldAmount} a tu cuenta. La venta ha finalizado correctamente.`,
        p_priority: 'high',
        p_payload: {
          transaction_id: transaction.id,
          request_id: requestId,
          hnld_amount: transaction.hnld_amount,
          formatted_amount: formattedHnldAmount,
          unique_code: uniqueCode,
          role: 'buyer'
        }
      })

      await supabase.rpc('emit_notification', {
        p_user_id: sellerId,
        p_topic: 'order',
        p_event: 'SALE_COMPLETED',
        p_title: 'Venta completada',
        p_body: `La venta ha finalizado exitosamente${uniqueCode ? ` - Código: ${uniqueCode}` : ''}. Los HNLD han sido liberados al comprador.`,
        p_priority: 'high',
        p_payload: {
          transaction_id: transaction.id,
          request_id: requestId,
          unique_code: uniqueCode,
          role: 'seller'
        }
      })

      loadTransaction()
    } catch (error) {
      console.error('Error liberando HNLD:', error)
    }
  }

  // Cargar transacción
  const loadTransaction = async () => {
    if (!transaction?.id) return

    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('sale_transactions')
        .select(`
          *,
          sale_transaction_steps (*)
        `)
        .eq('id', transaction.id)
        .single()

      if (data) {
        setTransaction(data)
        const currentStepIndex = data.sale_transaction_steps?.findIndex(
          step => step.status !== 'completed'
        ) ?? 0
        setCurrentStep(currentStepIndex >= 0 ? currentStepIndex : 3)
        setHasPaymentProof(!!data.payment_proof_url)
      }
    } catch (error) {
      console.error('Error cargando transacción:', error)
    }
  }

  // Manejar subida de comprobante
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !transaction) return

    try {
      setUploadingFile(true)
      const supabase = supabaseBrowser()

      // Subir archivo a storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${transaction.id}/${Date.now()}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName)

      // Actualizar transacción
      await supabase
        .from('sale_transactions')
        .update({
          payment_proof_url: publicUrl,
          payment_proof_uploaded_at: new Date().toISOString()
        })
        .eq('id', transaction.id)

      setHasPaymentProof(true)
      toast({
        title: "Comprobante subido",
        description: "El comprobante de pago ha sido subido exitosamente",
        variant: "created",
      })

      loadTransaction()
    } catch (error) {
      console.error('Error subiendo archivo:', error)
      toast({
        title: "Error",
        description: "Error al subir el comprobante",
        variant: "destructive",
      })
    } finally {
      setUploadingFile(false)
    }
  }

  // Configuración de pasos
  const stepConfig = {
    1: { title: 'Aceptar el trato', color: 'orange', actionRole: 'seller' as const },
    2: { title: 'Pago en proceso', color: 'blue', actionRole: 'buyer' as const },
    3: { title: 'Verificación del recibo', color: 'blue', actionRole: 'seller' as const },
    4: { title: 'HNLD liberados', color: 'green', actionRole: null }
  }

  if (!isOpen) return null

  const steps = transaction?.sale_transaction_steps || []
  const currentStepInfo = steps[currentStep] || steps[0]
  const config = stepConfig[currentStepInfo?.step_order as keyof typeof stepConfig]
  const isCompleted = currentStepInfo?.status === 'completed'
  const canPerformAction = config?.actionRole && !isCompleted && userRole === config.actionRole &&
    (currentStepInfo?.step_order !== 2 || userRole !== 'buyer' || hasPaymentProof)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Proceso de Venta de HNLD</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pasos */}
          <div className="grid grid-cols-4 gap-4">
            {steps.map((step, index) => {
              const stepCfg = stepConfig[step.step_order as keyof typeof stepConfig]
              const isStepCompleted = step.status === 'completed'
              const isCurrentStep = index === currentStep

              return (
                <div key={step.id} className="text-center">
                  <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    isStepCompleted ? 'bg-green-500' : isCurrentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`}>
                    {isStepCompleted ? (
                      <CheckCircle className="h-6 w-6 text-white" />
                    ) : (
                      <Circle className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <p className="text-sm font-medium">{stepCfg?.title || step.step_name}</p>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* Contenido del paso actual */}
          {currentStepInfo && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{config?.title || currentStepInfo.step_name}</h3>
              
              {currentStepInfo.step_order === 2 && userRole === 'buyer' && (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Sube el comprobante de pago para continuar
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      variant="outline"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {hasPaymentProof ? 'Cambiar comprobante' : 'Subir comprobante'}
                    </Button>
                    {hasPaymentProof && (
                      <p className="text-sm text-green-600 mt-2">✓ Comprobante subido</p>
                    )}
                  </div>
                </div>
              )}

              {canPerformAction && (
                <Button
                  onClick={() => handleStepAction(currentStepInfo.step_order)}
                  disabled={loading}
                  className="w-full"
                >
                  {currentStepInfo.step_order === 1 && 'Aceptar Trato'}
                  {currentStepInfo.step_order === 2 && 'Confirmar Pago'}
                  {currentStepInfo.step_order === 3 && 'Verificar Pago'}
                </Button>
              )}
            </div>
          )}

          {/* Información de la transacción */}
          {transaction && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto en HNLD:</span>
                <span className="font-medium">L. {transaction.hnld_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recibirás:</span>
                <span className="font-medium">
                  {transaction.currency === 'USD' ? '$' : transaction.currency === 'EUR' ? '€' : 'L.'}
                  {transaction.amount.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>,
    document.body
  )
}

