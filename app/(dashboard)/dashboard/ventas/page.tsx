"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"
import { 
  getActiveSaleRequests,
  acceptSaleRequest,
  type SaleRequest
} from "@/lib/actions/sale_requests"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { 
  Search, 
  Clock, 
  User, 
  Eye,
  RefreshCw,
  ShoppingBag,
  MessageSquare
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { SaleCompletionPanel } from "@/components/SaleCompletionPanel"
import { notificationCenter } from "@/lib/notifications/center"

export default function VentasPage() {
  const [requests, setRequests] = useState<SaleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<SaleRequest | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | undefined>(undefined)
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getCurrentUser()
  }, [])

  const loadRequests = async () => {
    try {
      setLoading(true)
      // Cargar solicitudes activas
      const result = await getActiveSaleRequests(50, 0)
      if (result && result.success && result.data) {
        let requestsToShow = result.data
        
        // Si hay usuario autenticado, también cargar solicitudes "accepted" (donde el comprador puede estar involucrado)
        // IMPORTANTE: Excluir las solicitudes del usuario actual y las canceladas
        if (userId) {
          const supabase = supabaseBrowser()
          
          // Cargar solicitudes aceptadas (donde el comprador puede estar involucrado)
          // IMPORTANTE: Excluir las solicitudes del usuario actual y las canceladas
          const { data: acceptedRequests } = await supabase
            .from('sale_requests')
            .select('*')
            .eq('status', 'accepted')
            .neq('seller_id', userId) // ⭐ Excluir solicitudes del usuario actual ⭐
          
          // Combinar todas las solicitudes
          const allRequests = [...requestsToShow]
          if (acceptedRequests) {
            // Filtrar solo las que no están canceladas, completadas o expiradas
            const validAccepted = acceptedRequests.filter(
              req => req.status !== 'cancelled' && 
                    req.status !== 'completed' && 
                    req.status !== 'expired'
            )
            allRequests.push(...validAccepted as SaleRequest[])
          }
          
          // Eliminar duplicados por ID y filtrar canceladas, completadas y expiradas
          const uniqueRequests = Array.from(
            new Map(allRequests.map(req => [req.id, req])).values()
          ).filter(req => 
            req.status !== 'cancelled' && 
            req.status !== 'completed' && 
            req.status !== 'expired'
          )
          
          requestsToShow = uniqueRequests
        } else {
          // Si no hay usuario, también filtrar canceladas, completadas y expiradas
          requestsToShow = requestsToShow.filter(req => 
            req.status !== 'cancelled' && 
            req.status !== 'completed' && 
            req.status !== 'expired'
          )
        }
        
        setRequests(requestsToShow)
      } else {
        console.error('❌ Error en loadRequests:', result?.error)
        toast({
          title: "Error",
          description: result?.error || "No se pudieron cargar las solicitudes de venta",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('❌ Error cargando solicitudes de venta:', error)
      toast({
        title: "Error",
        description: error?.message || "Error inesperado al cargar solicitudes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadRequests()
  }

  const handleAcceptSale = async (request: SaleRequest) => {
    // Mostrar toast naranja al comprador indicando que se inicia la compra
    toast({
      title: "Iniciando compra de HNLD",
      description: "Se está procesando tu solicitud de compra...",
      variant: "info",
    })

    if (!userId) {
      toast({
        title: "Error",
        description: "No se pudo obtener tu información de usuario",
        variant: "destructive",
      })
      return
    }

    try {
      // Aceptar la solicitud de venta (crear transacción)
      const result = await acceptSaleRequest(
        request.id,
        request.payment_method,
        {
          bank_name: request.bank_name,
          custom_bank_name: request.custom_bank_name,
          country: request.country,
          custom_country: request.custom_country,
          digital_wallet: request.digital_wallet
        }
      )

      if (result.success && result.transactionId) {
        // El toast naranja ya se mostró al inicio, no mostrar otro toast verde
        // Abrir panel de completar venta
        setSelectedRequest(request)
        setSelectedTransactionId(result.transactionId)
        setCompletionPanelOpen(true)
        
        // Recargar solicitudes
        await loadRequests()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error aceptando la solicitud",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('❌ Error aceptando solicitud de venta:', error)
      toast({
        title: "Error",
        description: "Error inesperado al aceptar la solicitud",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (request: SaleRequest) => {
    const { status } = request
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activa</Badge>
      case 'accepted':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Aceptada</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-emerald-100 text-emerald-800">Completada</Badge>
      case 'cancelled':
        return <Badge variant="destructive" className="animate-pulse">Cancelada</Badge>
      case 'expired':
        return <Badge variant="secondary">Expirada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentMethodInfo = (request: SaleRequest) => {
    switch (request.payment_method) {
      case 'local_transfer':
        return {
          method: 'Transferencia Local',
          currency: 'L.',
          amount: request.final_amount_hnld,
          details: request.bank_name === 'Otros' ? request.custom_bank_name : request.bank_name || 'Banco no especificado'
        }
      case 'digital_balance':
        return {
          method: 'Saldo Digital',
          currency: 'L.',
          amount: request.final_amount_hnld,
          details: request.digital_wallet || 'Billetera no especificada'
        }
      case 'card':
        return {
          method: 'Tarjeta de Crédito/Débito',
          currency: 'L.',
          amount: request.final_amount_hnld,
          details: 'Compra directa'
        }
      default:
        return {
          method: 'Método no especificado',
          currency: 'L.',
          amount: request.final_amount_hnld,
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

  const filteredRequests = requests.filter(request => {
    // Excluir solicitudes del usuario actual
    if (userId && request.seller_id === userId) {
      return false
    }
    
    // No mostrar completed, expired o cancelled (igual que en compras)
    if (request.status === 'completed' || request.status === 'expired' || request.status === 'cancelled') {
      return false
    }
    
    const paymentInfo = getPaymentMethodInfo(request)
    return (
      request.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.seller_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.final_amount_hnld.toString().includes(searchTerm) ||
      request.unique_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paymentInfo.method.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paymentInfo.details.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  // Obtener ID del usuario actual
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const supabase = supabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          setUserId(session.user.id)
        }
      } catch (error) {
        console.error('Error obteniendo usuario:', error)
      }
    }
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (!userId) {
      console.log('⏳ Esperando userId para configurar Realtime...')
      return
    }
    
    console.log('🚀 Configurando Realtime para userId:', userId)
    loadRequests()
    
    const supabase = supabaseBrowser()
    
    // Canal para INSERT y UPDATE de solicitudes activas
    const channelActive = supabase
      .channel('sale_requests_active_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sale_requests',
        filter: 'status=eq.active'
      }, async (payload) => {
        const newRequest = payload.new as SaleRequest
        console.log('✅ Nueva solicitud activa detectada:', newRequest)
        // Solo agregar si no es del usuario actual
        if (userId && newRequest.seller_id !== userId) {
          setRequests(prev => {
            // Evitar duplicados
            if (prev.some(req => req.id === newRequest.id)) return prev
            return [newRequest, ...prev]
          })
          // El toast se muestra desde NotificationBell, no aquí para evitar duplicados
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sale_requests',
        filter: 'status=eq.active'
      }, (payload) => {
        const updatedRequest = payload.new as SaleRequest
        console.log('🔄 Solicitud activa actualizada:', updatedRequest)
        // Solo actualizar si no es del usuario actual
        if (userId && updatedRequest.seller_id !== userId) {
          setRequests(prev => prev.map(req => req.id === updatedRequest.id ? updatedRequest : req))
        } else {
          // Si ahora es del usuario actual, removerla de la lista
          setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
        }
      })
      .subscribe((status, error) => {
        console.log('📡 Estado de suscripción realtime (active):', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción realtime (active) activa')
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error en la suscripción realtime (active):', error)
        }
      })
    
    // Canal separado para DELETE
    const channelDelete = supabase
      .channel('sale_requests_deletes')
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'sale_requests'
      }, (payload) => {
        const deletedId = payload.old?.id
        console.log('🗑️ Solicitud eliminada detectada:', deletedId)
        if (deletedId) {
          setRequests(prev => {
            const filtered = prev.filter(req => req.id !== deletedId)
            console.log(`🗑️ Solicitud ${deletedId} removida. Quedan ${filtered.length} solicitudes`)
            return filtered
          })
        }
      })
      .subscribe((status, error) => {
        console.log('📡 Estado de suscripción realtime (delete):', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción realtime (delete) activa')
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error en la suscripción realtime (delete):', error)
        }
      })
    
    // Canal para detectar cambios de estado - CRÍTICO PARA ELIMINAR CANCELADAS
    const channelStatusChanges = supabase
      .channel('sale_requests_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sale_requests'
      }, (payload) => {
        const updatedRequest = payload.new as SaleRequest
        const oldRequest = payload.old as SaleRequest
        
        console.log('🔔 UPDATE RECIBIDO:', {
          id: updatedRequest.id,
          oldStatus: oldRequest?.status,
          newStatus: updatedRequest.status
        })
        
        // Si la solicitud cambió a 'cancelled', removerla inmediatamente
        if (updatedRequest.status === 'cancelled') {
          console.log('🚫 REMOVIENDO SOLICITUD CANCELADA:', updatedRequest.id)
          setRequests(prev => {
            const filtered = prev.filter(req => req.id !== updatedRequest.id)
            console.log('✅ Removida. Antes:', prev.length, 'Después:', filtered.length)
            return filtered
          })
          setCompletionPanelOpen(false)
          setSelectedRequest(null)
          toast({
            title: "Solicitud Cancelada",
            description: `El vendedor ha cancelado la solicitud de venta.`,
            variant: "destructive",
            duration: 5000,
          })
          return
        }
        
        // Si cambió de 'active' o 'accepted' a otro estado, removerla
        if (
          (oldRequest?.status === 'active' || oldRequest?.status === 'accepted') &&
          !['active', 'accepted'].includes(updatedRequest.status)
        ) {
          setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
          return
        }
        
        // Si cambió a 'active' o 'accepted', actualizar o agregar
        if (['active', 'accepted'].includes(updatedRequest.status)) {
          if (userId && updatedRequest.seller_id !== userId) {
            setRequests(prev => {
              const exists = prev.some(req => req.id === updatedRequest.id)
              if (exists) {
                return prev.map(req => req.id === updatedRequest.id ? updatedRequest : req)
              } else {
                return [updatedRequest, ...prev]
              }
            })
          } else {
            setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
          }
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción realtime activa - Escuchando UPDATE en sale_requests')
        } else if (status === 'CHANNEL_ERROR') {
          // Solo loggear si hay un error real, no si es undefined (desconexión temporal)
          if (err) {
            console.warn('⚠️ Error en suscripción realtime:', err)
          }
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          // Estados normales de desconexión, no son errores críticos
          console.log('📡 Canal realtime:', status)
        }
      })
    
    // Escuchar notificaciones de cancelación (ya que Realtime UPDATE no funciona)
    const unsubscribeNotification = notificationCenter.addListener((notification) => {
      if (notification.event === 'SALE_REQUEST_CANCELLED' && notification.payload?.request_id) {
        const requestId = notification.payload.request_id
        console.log('🔔 Notificación de cancelación recibida, removiendo solicitud:', requestId)
        setRequests(prev => {
          const filtered = prev.filter(req => req.id !== requestId)
          console.log('✅ Solicitud removida por notificación. Antes:', prev.length, 'Después:', filtered.length)
          return filtered
        })
        setCompletionPanelOpen(false)
        setSelectedRequest(null)
      }
    })

    return () => {
      console.log('🧹 Limpiando suscripciones realtime...', { userId })
      try {
        if (channelActive) {
          channelActive.unsubscribe()
        }
        if (channelDelete) {
          channelDelete.unsubscribe()
        }
        if (channelStatusChanges) {
          channelStatusChanges.unsubscribe()
        }
        unsubscribeNotification()
      } catch (error) {
        console.error('⚠️ Error desuscribiendo canales Realtime:', error)
      }
    }
  }, [userId, toast])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="Cargando solicitudes..." />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Solicitudes de otros usuarios</h1>
          <p className="text-muted-foreground">Oportunidades para comprar HNLD de otros usuarios</p>
          <p className="text-sm text-muted-foreground mt-1">
            💡 Solo puedes ver solicitudes de otros usuarios. Tus propias solicitudes aparecen en "Mis Ventas"
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            🔒 Tus solicitudes están ocultas aquí para evitar conflictos de interés
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/dashboard/mis-ventas">
              <User className="mr-2 h-4 w-4" />
              Mis Ventas
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por monto, método de pago, banco, billetera o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Requests Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredRequests.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay solicitudes disponibles</h3>
            <p className="text-muted-foreground mb-2">
              {searchTerm ? "No se encontraron solicitudes que coincidan con tu búsqueda" : "No hay solicitudes de venta activas de otros usuarios en este momento"}
            </p>
            <p className="text-xs text-muted-foreground">
              💡 Recuerda que solo ves solicitudes de otros usuarios. Las tuyas aparecen en "Mis Ventas"
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const paymentInfo = getPaymentMethodInfo(request)
            return (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <span className="text-lg">💱</span>
                      <span>{formatCurrency(request.final_amount_hnld)} HNLD</span>
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-1 mt-1">
                      <User className="h-4 w-4" />
                      <span>{request.seller_name || request.seller_email || "Vendedor"}</span>
                    </CardDescription>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{paymentInfo.method}</span>
                        {paymentInfo.details && (
                          <span className="ml-1">• {paymentInfo.details}</span>
                        )}
                      </div>
                      {request.unique_code && (
                        <div>
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {request.unique_code}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(request)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatTimeAgo(request.created_at)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="h-4 w-4" />
                    <span>Expira: {new Date(request.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  {request.status === 'active' && (
                    <Button 
                      onClick={() => handleAcceptSale(request)}
                      className="flex-1"
                      size="sm"
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Comprar HNLD
                    </Button>
                  )}
                  
                  {request.status === 'accepted' && request.buyer_id && (
                    <Button 
                      onClick={async () => {
                        try {
                          const supabase = supabaseBrowser()
                          const { data: transaction } = await supabase
                            .from('sale_transactions')
                            .select('id')
                            .eq('request_id', request.id)
                            .single()

                          if (transaction) {
                            setSelectedRequest(request)
                            setSelectedTransactionId(transaction.id)
                            setCompletionPanelOpen(true)
                          } else {
                            toast({
                              title: "Transacción no encontrada",
                              description: "No se encontró una transacción asociada a esta solicitud",
                              variant: "destructive",
                            })
                          }
                        } catch (error) {
                          console.error('Error cargando transacción:', error)
                          toast({
                            title: "Error",
                            description: "Error cargando la transacción",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                      size="sm"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Ver Transacción
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            )
          })
        )}
      </div>

      {/* Sale Completion Panel */}
      {selectedRequest && userId && (
        <SaleCompletionPanel
          requestId={selectedRequest.id}
          transactionId={selectedTransactionId}
          sellerId={selectedRequest.seller_id}
          buyerId={userId}
          amount={selectedRequest.final_amount_hnld}
          currency={selectedRequest.currency_type}
          paymentMethod={selectedRequest.payment_method}
          isOpen={completionPanelOpen}
          onClose={() => {
            setCompletionPanelOpen(false)
            setSelectedRequest(null)
            setSelectedTransactionId(undefined)
            loadRequests()
          }}
          onTransactionCreated={(transactionId) => {
            console.log('✅ Transacción creada:', transactionId)
            setSelectedTransactionId(transactionId)
            loadRequests()
          }}
        />
      )}
    </div>
  )
}
