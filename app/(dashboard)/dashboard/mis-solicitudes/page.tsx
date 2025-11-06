"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  getUserPurchaseRequests,
  acceptPurchaseOffer,
  cancelPurchaseRequest,
  deletePurchaseRequest,
  type PurchaseRequest
} from "@/lib/actions/purchase_requests"
import { PurchaseHNLDButton } from "@/components/PurchaseHNLDModal"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { 
  Plus, 
  Clock, 
  User, 
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  MessageSquare,
  TrendingUp,
  Trash2,
  X,
  ShoppingCart
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { supabaseBrowser } from "@/lib/supabase/client"
import { PurchaseCompletionPanel } from "@/components/PurchaseCompletionPanel"

export default function MisSolicitudesPage() {
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const { toast } = useToast()

  const loadRequests = async () => {
    try {
      const result = await getUserPurchaseRequests()
      
      if (result && result.success && result.data) {
        setRequests(result.data)
      } else {
        toast({
          title: "Error",
          description: result?.error || "No se pudieron cargar las solicitudes",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al cargar solicitudes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const canDeleteRequest = (request: PurchaseRequest): boolean => {
    // Se puede eliminar si la solicitud está cancelada, completada, expirada
    // O si la transacción asociada está expirada
    return request.status === 'cancelled' || 
           request.status === 'completed' ||
           request.status === 'expired' ||
           isTransactionExpired(request.id) // Nueva función para verificar expiración de transacción
  }

  // Verificar si una transacción está expirada
  // Estado para almacenar qué transacciones están expiradas
  const [expiredTransactions, setExpiredTransactions] = useState<Set<string>>(new Set())

  // Verificar si una transacción está expirada
  const isTransactionExpired = (requestId: string): boolean => {
    return expiredTransactions.has(requestId)
  }

  // Verificar transacciones expiradas al cargar las solicitudes
  const checkExpiredTransactions = async () => {
    const supabase = supabaseBrowser()
    const expiredSet = new Set<string>()
    
    // Para cada solicitud aceptada, verificar si su transacción está expirada
    for (const request of requests) {
      if (request.status === 'accepted') {
        try {
          const { data: transactions } = await supabase
            .from('purchase_transactions')
            .select('id, payment_deadline')
            .eq('request_id', request.id)
            .order('created_at', { ascending: false })
            .limit(1)
          
          if (transactions && transactions.length > 0) {
            const transaction = transactions[0]
            if (transaction.payment_deadline) {
              const deadline = new Date(transaction.payment_deadline).getTime()
              const now = new Date().getTime()
              if (deadline < now) {
                expiredSet.add(request.id)
                
                // Actualizar el estado de la solicitud a "expired" en la BD
                try {
                  const { error: updateError } = await supabase
                    .from('purchase_requests')
                    .update({
                      status: 'expired',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', request.id)
                  
                  if (updateError) {
                    console.error('❌ Error actualizando estado de solicitud a expirada:', updateError)
                  } else {
                    console.log('✅ Solicitud marcada como expirada:', request.id)
                    
                    // Enviar notificación de expiración
                    try {
                      const { data: { user } } = await supabase.auth.getUser()
                      if (user) {
                        await supabase.rpc('notify_request_expired', {
                          p_request_id: request.id,
                          p_buyer_id: user.id
                        })
                      }
                    } catch (notifyErr) {
                      console.error('❌ Error enviando notificación de expiración:', notifyErr)
                    }
                    
                    // Actualizar el estado local de la solicitud
                    setRequests(prev => prev.map(req => 
                      req.id === request.id 
                        ? { ...req, status: 'expired' as const }
                        : req
                    ))
                  }
                } catch (updateError) {
                  console.error('❌ Error actualizando estado de solicitud a expirada:', updateError)
                }
              }
            }
          }
        } catch (error) {
          console.error('Error verificando transacción expirada:', error)
        }
      }
    }
    
    setExpiredTransactions(expiredSet)
  }

  const canCancelRequest = (request: PurchaseRequest): boolean => {
    // Puede cancelar SIEMPRE, sin importar el estado (incluso si está aceptada)
    return true
  }

  const handleDeleteRequest = (request: PurchaseRequest) => {
    setSelectedRequest(request)
    setDeleteOpen(true)
  }

  const confirmDeleteRequest = async () => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const result = await deletePurchaseRequest(selectedRequest.id)
      
      if (result.success) {
        toast({
          title: "✅ Solicitud Eliminada",
          description: "La solicitud ha sido eliminada permanentemente.",
        })
        setDeleteOpen(false)
        setSelectedRequest(null)
        
        // Actualizar estado local inmediatamente
        setRequests(prevRequests => 
          prevRequests.filter(req => req.id !== selectedRequest.id)
        )
        
        // Recargar desde el servidor después de un pequeño delay
        setTimeout(async () => {
          await loadRequests()
        }, 500)
      } else {
        toast({
          title: "❌ Error",
          description: result.error || "Error eliminando la solicitud",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al eliminar la solicitud",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCancelRequest = (request: PurchaseRequest) => {
    setSelectedRequest(request)
    setCancelOpen(true)
  }

  const confirmCancelRequest = async () => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const result = await cancelPurchaseRequest(selectedRequest.id)
      
      if (result.success) {
        toast({
          title: "✅ Solicitud Cancelada",
          description: "Tu solicitud de compra ha sido cancelada exitosamente.",
        })
        setCancelOpen(false)
        setSelectedRequest(null)
        await loadRequests()
      } else {
        toast({
          title: "❌ Error",
          description: result.error || "Error cancelando la solicitud",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al cancelar la solicitud",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadRequests()
  }

  const handleViewDetails = (request: PurchaseRequest) => {
    setSelectedRequest(request)
    setDetailsOpen(true)
  }

  const handleCompletePurchase = async (request: PurchaseRequest) => {
    console.log('🖱️ handleCompletePurchase llamado para solicitud:', request.id)
    console.log('📊 request object:', request)
    
    // Verificar si la transacción está expirada antes de abrir el panel
    if (isTransactionExpired(request.id)) {
      toast({
        title: "Transacción expirada",
        description: "Esta transacción ha expirado. Solo puedes eliminarla.",
        variant: "destructive",
      })
      return
    }
    
    try {
      // Buscar la transacción relacionada con esta solicitud
      const supabase = supabaseBrowser()
      
      console.log('🔍 Buscando transacción para request_id:', request.id)
      
      // Buscar la transacción más reciente (puede haber múltiples si se reactivó)
      const { data: transactions, error } = await supabase
        .from('purchase_transactions')
        .select(`
          *,
          transaction_steps (*)
        `)
        .eq('request_id', request.id)
        .order('created_at', { ascending: false }) // Ordenar por más reciente
        .limit(1)

      console.log('🔍 Transacciones encontradas:', transactions)
      console.log('🔍 Error (si existe):', error)

      // Verificar si la transacción está expirada
      if (transactions && transactions.length > 0) {
        const transaction = transactions[0]
        if (transaction.payment_deadline) {
          const deadline = new Date(transaction.payment_deadline).getTime()
          const now = new Date().getTime()
          if (deadline < now) {
            // Marcar como expirada y actualizar estado en BD
            setExpiredTransactions(prev => new Set([...prev, request.id]))
            
            // Actualizar estado de la solicitud a "expired"
            try {
              await supabase
                .from('purchase_requests')
                .update({
                  status: 'expired',
                  updated_at: new Date().toISOString()
                })
                .eq('id', request.id)
              
              // Actualizar estado local
              setRequests(prev => prev.map(req => 
                req.id === request.id 
                  ? { ...req, status: 'expired' as const }
                  : req
              ))
            } catch (updateError) {
              console.error('❌ Error actualizando estado de solicitud a expirada:', updateError)
            }
            
            toast({
              title: "Transacción expirada",
              description: "Esta transacción ha expirado. Solo puedes eliminarla.",
              variant: "destructive",
            })
            return
          }
        }
      }

      // Si no hay transacción o hay error, verificar si la solicitud está aceptada
      if (error || !transactions || transactions.length === 0) {
        console.error('❌ Error o transacción no encontrada:', error)
        
        // Verificar si la solicitud tiene un seller_id (fue aceptada)
        const { data: requestData } = await supabase
          .from('purchase_requests')
          .select('seller_id, status')
          .eq('id', request.id)
          .single()
        
        if (requestData?.seller_id && requestData?.status === 'accepted') {
          console.log('⚠️ Solicitud aceptada pero sin transacción. El vendedor debe completar el proceso.')
          toast({
            title: "Esperando",
            description: "El vendedor está completando el proceso. Intenta nuevamente en un momento.",
            variant: "default",
          })
        } else {
          toast({
            title: "Información",
            description: "El vendedor debe aceptar el trato primero.",
            variant: "default",
          })
        }
        return
      }

      const transaction = transactions[0]
      console.log('🔍 Transacción seleccionada:', transaction.id)
      console.log('🔍 Pasos de la transacción:', transaction?.transaction_steps)

      // Abrir el panel de completar compra con la transacción existente
      const transactionData = {
        request_id: request.id,
        seller_id: transaction.seller_id,
        buyer_id: transaction.buyer_id,
        amount: transaction.amount,
        currency: transaction.currency || request.currency_type || 'USD',
        payment_method: transaction.payment_method || request.payment_method || 'local_transfer',
        transaction_id: transaction.id,  // IMPORTANTE: incluir el ID de la transacción
        transaction_steps: transaction.transaction_steps || []
      }
      
      console.log('📊 Datos de transacción preparados:', transactionData)
      
      // CRÍTICO: Establecer BOTH estados de forma síncrona
      console.log('📤 Estableciendo selectedTransaction y abriendo panel...')
      setSelectedTransaction(transactionData)
      setCompletionPanelOpen(true)
      console.log('✅ Panel configurado para abrirse')
    } catch (error) {
      console.error('❌ Error al abrir el panel:', error)
      toast({
        title: "Error",
        description: "Error al abrir el panel de completar compra",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activa</Badge>
      case 'negotiating':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Negociando</Badge>
      case 'accepted':
        return <Badge variant="default" className="bg-orange-100 text-orange-800">Aceptada</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-gray-100 text-gray-800">Completada</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelada</Badge>
      case 'expired':
        return <Badge variant="outline">Expirada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentMethodInfo = (request: PurchaseRequest) => {
    switch (request.payment_method) {
      case 'local_transfer':
        return {
          method: 'Transferencia Local',
          currency: 'L.',
          amount: request.amount,
          details: request.bank_name || 'Banco no especificado'
        }
      case 'international_transfer':
        const country = request.country === 'Otro de la zona euro' ? request.custom_country : request.country
        const currency = request.currency_type === 'USD' ? 'USD' : 'EUR'
        const currencySymbol = currency === 'USD' ? '$' : '€'
        return {
          method: 'Transferencia Internacional',
          currency: currencySymbol,
          amount: request.amount_in_original_currency || request.amount,
          details: country || 'País no especificado'
        }
      case 'card':
        return {
          method: 'Tarjeta de Crédito/Débito',
          currency: 'L.',
          amount: request.amount,
          details: 'Compra directa'
        }
      case 'digital_balance':
        return {
          method: 'Saldo Digital',
          currency: 'L.',
          amount: request.amount,
          details: request.digital_wallet || 'Billetera no especificada'
        }
      default:
        return {
          method: 'Método no especificado',
          currency: 'L.',
          amount: request.amount,
          details: 'Sin detalles'
        }
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Hace menos de 1 hora"
    if (diffInHours < 24) return `Hace ${diffInHours} horas`
    const diffInDays = Math.floor(diffInHours / 24)
    return `Hace ${diffInDays} días`
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  // Obtener userId al montar el componente
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseBrowser().auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUser()
  }, [])

  // Manejar parámetro openChat de la URL
  useEffect(() => {
    const openChatParam = searchParams.get('openChat')
    if (openChatParam && requests.length > 0 && userId) {
      console.log('🔍 openChat param:', openChatParam)
      console.log('🔍 Loaded requests:', requests.map(r => ({ id: r.id, unique_code: r.unique_code })))
      console.log('🔍 userId:', userId)
      
      const matchingRequest = requests.find(r => r.id === openChatParam)
      console.log('🔍 Matching request:', matchingRequest)
      
      if (matchingRequest) {
        setSelectedRequest(matchingRequest)
        setChatOpen(true)
        
        // Limpiar el parámetro de la URL
        window.history.replaceState({}, '', '/dashboard/mis-solicitudes')
      }
    }
  }, [searchParams, requests, userId])

  useEffect(() => {
    loadRequests()
    
    // Escuchar cuando cambia el estado de una solicitud
    const handleRequestStatusChange = () => {
      console.log('🔄 Estado de solicitud cambiado, recargando...')
      loadRequests()
    }
    
    window.addEventListener('request-status-changed', handleRequestStatusChange)
    
    // Configurar suscripción en tiempo real para purchase_requests (solo si userId está disponible)
    let channel: any = null
    if (userId) {
      try {
        const supabase = supabaseBrowser()
        
        console.log('🔧 Configurando suscripción Realtime para userId:', userId)
        
        channel = supabase
          .channel('mis_solicitudes_changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'purchase_requests',
              filter: `buyer_id=eq.${userId}` // Solo escuchar actualizaciones a las solicitudes del comprador actual
            },
            (payload) => {
              try {
                console.log('🔄 Cambio en tiempo real recibido:', payload)
                console.log('📊 Datos de la solicitud:', payload.new)
                console.log('🎯 Estado anterior:', payload.old)
                
                // Actualizar la solicitud específica en el estado
                setRequests((prevRequests) => {
                  console.log('📝 Solicitudes antes de actualizar:', prevRequests.length)
                  
                  const updatedRequests = prevRequests.map((req) => {
                    if (req.id === payload.new.id) {
                      console.log('✅ Actualizando solicitud:', req.id, 'Estado:', req.status, '->', payload.new.status)
                      return {
                        ...req,
                        status: payload.new.status,
                        seller_id: payload.new.seller_id,
                        accepted_at: payload.new.accepted_at
                      }
                    }
                    return req
                  })
                  
                  console.log('📝 Solicitudes después de actualizar:', updatedRequests.length)
                  
                  // Si la solicitud no está en el estado actual (p. ej., fue creada), recargar todas
                  const found = prevRequests.find(r => r.id === payload.new.id)
                  if (!found) {
                    console.log('🔄 Solicitud nueva detectada, recargando todas...')
                    loadRequests()
                    return prevRequests
                  }
                  
                  return updatedRequests
                })
              } catch (error) {
                console.error('❌ Error procesando actualización Realtime:', error)
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Suscripción Realtime activa para mis_solicitudes_changes')
            }
            if (status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Error en el canal Realtime, se reintentará automáticamente')
            }
            if (status === 'CLOSED') {
              console.log('ℹ️ Canal Realtime cerrado')
            }
            if (status === 'TIMED_OUT') {
              console.warn('⚠️ Timeout en Realtime, reintentando...')
            }
          })
      } catch (error) {
        console.error('❌ Error configurando suscripción Realtime:', error)
        // No lanzar el error, simplemente continuar sin Realtime
      }
    } else {
      console.log('⚠️ userId no está disponible, no se puede configurar Realtime')
    }
    
    return () => {
      window.removeEventListener('request-status-changed', handleRequestStatusChange)
      if (channel) {
        try {
          channel.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal Realtime:', error)
        }
      }
    }
  }, [userId, toast])

  // Verificar transacciones expiradas cuando cambien las solicitudes
  useEffect(() => {
    if (requests.length > 0) {
      checkExpiredTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="Cargando tus solicitudes..." />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Mis Solicitudes de Compra</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Gestiona tus solicitudes de compra de HNLD</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <PurchaseHNLDButton 
            onSuccess={loadRequests}
            defaultMethod="request"
            className="w-full sm:w-auto"
          />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
            <span className="text-sm">💱</span>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-lg sm:text-2xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>
        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Activas</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-lg sm:text-2xl font-bold text-green-600">
              {requests.filter(r => r.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Aceptadas</CardTitle>
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">
              {requests.filter(r => r.status === 'accepted').length}
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-lg sm:text-2xl font-bold text-purple-600">
              {requests.filter(r => r.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 sm:py-12 px-4">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No tienes solicitudes</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4">
                Crea tu primera solicitud de compra de HNLD
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                {/* Mobile Layout */}
                <div className="block sm:hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">💱</span>
                      <span className="text-lg font-bold">{getPaymentMethodInfo(request).currency}{formatAmount(getPaymentMethodInfo(request).amount)}</span>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      {getStatusBadge(request.status)}
                      {isExpired(request.expires_at) && request.status === 'active' && (
                        <Badge variant="destructive" className="text-xs">Expirada</Badge>
                      )}
                    </div>
                  </div>
                  
                  {request.unique_code && (
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <span className="font-mono bg-muted px-2 py-1 rounded">{request.unique_code}</span>
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">{getPaymentMethodInfo(request).method}</span>
                      {getPaymentMethodInfo(request).details && (
                        <span className="ml-1">• {getPaymentMethodInfo(request).details}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Creada {formatTimeAgo(request.created_at)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="h-3 w-3" />
                      <span>Expira: {new Date(request.expires_at).toLocaleDateString()}</span>
                    </div>
                    {(request.offers_count || 0) > 0 && (
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{request.offers_count} ofertas</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2 pt-2">
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDetails(request)}
                      className="w-full"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalles
                    </Button>
                    {(() => {
                      const isAccepted = request.status === 'accepted'
                      const isExpired = isTransactionExpired(request.id)
                      // Solo mostrar el botón si está aceptada Y NO está expirada
                      if (!isAccepted || isExpired) return null
                      
                      return (
                        <div className="w-full">
                          <button
                            type="button"
                            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center justify-center text-sm font-medium cursor-pointer"
                            onClick={async (e) => {
                              e.stopPropagation()
                              
                              // Verificar si la transacción está expirada
                              const supabase = supabaseBrowser()
                              const { data: checkTransaction } = await supabase
                                .from('purchase_transactions')
                                .select('id, payment_deadline')
                                .eq('request_id', request.id)
                                .single()
                              
                              if (checkTransaction?.payment_deadline) {
                                const deadline = new Date(checkTransaction.payment_deadline).getTime()
                                const now = new Date().getTime()
                                if (deadline < now) {
                                  // Marcar como expirada y actualizar estado en BD
                                  setExpiredTransactions(prev => new Set([...prev, request.id]))
                                  
                                  // Actualizar estado de la solicitud a "expired"
                                  await supabase
                                    .from('purchase_requests')
                                    .update({
                                      status: 'expired',
                                      updated_at: new Date().toISOString()
                                    })
                                    .eq('id', request.id)
                                  
                                  // Actualizar estado local
                                  setRequests(prev => prev.map(req => 
                                    req.id === request.id 
                                      ? { ...req, status: 'expired' as const }
                                      : req
                                  ))
                                  
                                  toast({
                                    title: "Transacción expirada",
                                    description: "Esta transacción ha expirado. Solo puedes eliminarla.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                              }
                              
                              handleCompletePurchase(request).catch(err => {
                                console.error('❌ Error:', err)
                              })
                            }}
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Completar Compra
                          </button>
                        </div>
                      )
                    })()}
                    <div className="flex space-x-2">
                      {canDeleteRequest(request) ? (
                        <Button
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteRequest(request)}
                          disabled={processing}
                          className="flex-1 border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-800 dark:hover:text-red-300"
                          style={{
                            borderColor: 'rgb(252 165 165)', // red-300
                            color: 'rgb(220 38 38)', // red-600
                          }}
                          onMouseEnter={(e) => {
                            if (document.documentElement.classList.contains('dark')) {
                              e.currentTarget.style.backgroundColor = 'rgb(153 27 27)'; // red-800
                              e.currentTarget.style.color = 'rgb(252 165 165)'; // red-300
                            } else {
                              e.currentTarget.style.backgroundColor = 'rgb(254 242 242)'; // red-50
                              e.currentTarget.style.borderColor = 'rgb(248 113 113)'; // red-400
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                            e.currentTarget.style.color = '';
                            e.currentTarget.style.borderColor = '';
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      ) : (
                        <Button
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleCancelRequest(request)}
                          disabled={processing}
                          className="flex-1"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">💱</span>
                      <span className="text-xl font-bold">{getPaymentMethodInfo(request).currency}{formatAmount(getPaymentMethodInfo(request).amount)}</span>
                    </div>
                      {getStatusBadge(request.status)}
                      {isExpired(request.expires_at) && request.status === 'active' && (
                        <Badge variant="destructive">Expirada</Badge>
                      )}
                    </div>
                    
                    {request.unique_code && (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                        <span className="font-mono bg-muted px-2 py-1 rounded">{request.unique_code}</span>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground mb-2">
                      <span className="font-medium">{getPaymentMethodInfo(request).method}</span>
                      {getPaymentMethodInfo(request).details && (
                        <span className="ml-1">• {getPaymentMethodInfo(request).details}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Creada {formatTimeAgo(request.created_at)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>Expira: {new Date(request.expires_at).toLocaleDateString()}</span>
                      </div>
                      {(request.offers_count || 0) > 0 && (
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{request.offers_count} ofertas</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDetails(request)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalles
                    </Button>
                    {(() => {
                      const isAccepted = request.status === 'accepted'
                      const isExpired = isTransactionExpired(request.id)
                      // Solo mostrar el botón si está aceptada Y NO está expirada
                      return isAccepted && !isExpired
                    })() && (
                      <Button
                        variant="default" 
                        size="sm"
                        onClick={async () => {
                          // Verificar primero si existe una transacción
                          const supabase = supabaseBrowser()
                          const { data: checkTransaction } = await supabase
                            .from('purchase_transactions')
                            .select('id, payment_deadline')
                            .eq('request_id', request.id)
                            .single()
                          
                          if (checkTransaction) {
                            // Verificar si la transacción está expirada
                            if (checkTransaction.payment_deadline) {
                              const deadline = new Date(checkTransaction.payment_deadline).getTime()
                              const now = new Date().getTime()
                              if (deadline < now) {
                                // Marcar como expirada y actualizar estado en BD
                                setExpiredTransactions(prev => new Set([...prev, request.id]))
                                
                                // Actualizar estado de la solicitud a "expired"
                                await supabase
                                  .from('purchase_requests')
                                  .update({
                                    status: 'expired',
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', request.id)
                                
                                // Actualizar estado local
                                setRequests(prev => prev.map(req => 
                                  req.id === request.id 
                                    ? { ...req, status: 'expired' as const }
                                    : req
                                ))
                                
                                toast({
                                  title: "Transacción expirada",
                                  description: "Esta transacción ha expirado. Solo puedes eliminarla.",
                                  variant: "destructive",
                                })
                                return
                              }
                            }
                            await handleCompletePurchase(request)
                          } else {
                            toast({
                              title: "Esperando transacción",
                              description: "La transacción aún no está disponible. Espera a que el vendedor complete el proceso de aceptación.",
                              variant: "default",
                            })
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Completar Compra
                      </Button>
                    )}
                    {canDeleteRequest(request) ? (
                      <Button
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteRequest(request)}
                        disabled={processing}
                        className="border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-800 dark:hover:text-red-300"
                        style={{
                          borderColor: 'rgb(252 165 165)', // red-300
                          color: 'rgb(220 38 38)', // red-600
                        }}
                        onMouseEnter={(e) => {
                          if (document.documentElement.classList.contains('dark')) {
                            e.currentTarget.style.backgroundColor = 'rgb(153 27 27)'; // red-800
                            e.currentTarget.style.color = 'rgb(252 165 165)'; // red-300
                          } else {
                            e.currentTarget.style.backgroundColor = 'rgb(254 242 242)'; // red-50
                            e.currentTarget.style.borderColor = 'rgb(248 113 113)'; // red-400
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '';
                          e.currentTarget.style.color = '';
                          e.currentTarget.style.borderColor = '';
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    ) : (
                      <Button
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleCancelRequest(request)}
                        disabled={processing}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span className="text-lg">💱</span>
              <span>Detalles de la Solicitud</span>
            </DialogTitle>
            <DialogDescription>
              Información completa de tu solicitud de compra
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Monto</Label>
                  <p className="text-lg font-bold">{formatCurrency(selectedRequest.amount)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Estado</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Creada</Label>
                  <p className="text-sm">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Expira</Label>
                  <p className="text-sm">{new Date(selectedRequest.expires_at).toLocaleString()}</p>
                </div>
              </div>
              
              {selectedRequest.unique_code && (
                <div>
                  <Label className="text-sm font-medium">Código de Identificación</Label>
                  <div className="mt-1">
                    <span className="font-mono bg-muted px-3 py-2 rounded text-sm">{selectedRequest.unique_code}</span>
                  </div>
                </div>
              )}
              
              {selectedRequest.description && (
                <div>
                  <Label className="text-sm font-medium">Descripción</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedRequest.description}</p>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium">Ofertas Recibidas</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRequest.offers_count || 0} ofertas
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Cerrar
            </Button>
            {selectedRequest && (selectedRequest.offers_count || 0) > 0 && (
              <Button>
                Ver Ofertas
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <span>Cancelar Solicitud</span>
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar esta solicitud? Podrás crear una nueva solicitud más adelante.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-center space-x-2 p-4 bg-muted/50 rounded-lg">
                <span className="text-lg">💱</span>
                <span className="text-lg font-bold">{getPaymentMethodInfo(selectedRequest).currency}{formatAmount(getPaymentMethodInfo(selectedRequest).amount)}</span>
              </div>
              
              {selectedRequest.unique_code && (
                <div className="text-center space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Código de Transacción</Label>
                  <div>
                    <span className="font-mono bg-muted px-3 py-2 rounded text-sm font-medium border">
                      {selectedRequest.unique_code}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="text-center text-xs text-muted-foreground">
                <span className="font-medium">{getPaymentMethodInfo(selectedRequest).method}</span>
                {getPaymentMethodInfo(selectedRequest).details && (
                  <span className="ml-1">• {getPaymentMethodInfo(selectedRequest).details}</span>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={processing}>
              No
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmCancelRequest}
              disabled={processing}
            >
              {processing ? "Cancelando..." : "Sí, cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <X className="h-5 w-5 text-destructive" />
              <span>Eliminar Permanentemente</span>
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta solicitud permanentemente? Esta acción no se puede deshacer y se perderá toda la información relacionada.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-center space-x-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <span className="text-lg">💱</span>
                <span className="text-lg font-bold">{getPaymentMethodInfo(selectedRequest).currency}{formatAmount(getPaymentMethodInfo(selectedRequest).amount)}</span>
                <Badge variant={selectedRequest.status === 'cancelled' ? 'destructive' : 'secondary'}>
                  {selectedRequest.status === 'cancelled' ? 'Cancelada' : 'Expirada'}
                </Badge>
              </div>
              
              {selectedRequest.unique_code && (
                <div className="text-center space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Código de Transacción</Label>
                  <div>
                    <span className="font-mono bg-muted px-3 py-2 rounded text-sm font-medium border">
                      {selectedRequest.unique_code}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="text-center text-xs text-muted-foreground">
                <span className="font-medium">{getPaymentMethodInfo(selectedRequest).method}</span>
                {getPaymentMethodInfo(selectedRequest).details && (
                  <span className="ml-1">• {getPaymentMethodInfo(selectedRequest).details}</span>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteOpen(false)} 
              disabled={processing}
            >
              No
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteRequest}
              disabled={processing}
            >
              {processing ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Panel */}
      {selectedRequest && userId && selectedRequest.buyer_id !== userId && (
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          chatParams={{
            contextType: 'order',
            contextId: selectedRequest.id,
            partyA: selectedRequest.buyer_id,
            partyB: userId,
            contextTitle: 'Negociación de Solicitud',
            contextData: {
              requestId: selectedRequest.id,
              amount: selectedRequest.amount,
              paymentMethod: selectedRequest.payment_method,
              status: selectedRequest.status
            }
          }}
          requestInfo={{
            amount: selectedRequest.amount,
            paymentMethod: selectedRequest.payment_method || '',
            uniqueCode: selectedRequest.unique_code,
            currency: selectedRequest.currency_type
          }}
        />
      )}

      {/* Purchase Completion Panel */}
      {selectedTransaction ? (
        <PurchaseCompletionPanel
          requestId={selectedTransaction.request_id}
          transactionId={selectedTransaction.transaction_id}
          sellerId={selectedTransaction.seller_id}
          buyerId={selectedTransaction.buyer_id}
          amount={selectedTransaction.amount}
          currency={selectedTransaction.currency}
          paymentMethod={selectedTransaction.payment_method}
          isOpen={completionPanelOpen}
          onClose={() => {
            setCompletionPanelOpen(false)
            setSelectedTransaction(null)
            loadRequests()
          }}
          onTransactionCreated={(transactionId) => {
            console.log('Transacción creada:', transactionId)
          }}
        />
      ) : null}
    </div>
  )
}
