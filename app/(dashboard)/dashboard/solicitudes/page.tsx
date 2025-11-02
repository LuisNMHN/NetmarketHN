"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"
import { 
  getActivePurchaseRequests,
  // DESACTIVADO: startNegotiation, endNegotiationNoDeal ya no se usan
  type PurchaseRequest
} from "@/lib/actions/purchase_requests"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { 
  Search, 
  Clock, 
  User, 
  MessageSquare,
  Eye,
  RefreshCw,
  ShoppingCart,
  X
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { PurchaseCompletionPanel } from "@/components/PurchaseCompletionPanel"

export default function SolicitudesPage() {
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null)
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadRequests = async () => {
    try {
      // Cargar solicitudes activas
      const result = await getActivePurchaseRequests(50, 0)
      if (result && result.success && result.data) {
        let requestsToShow = result.data
        
        // Si hay usuario autenticado, también cargar solicitudes "accepted" (las negotiating ya no existen)
        if (userId) {
          const supabase = supabaseBrowser()
          
          // Cargar solicitudes aceptadas (donde el vendedor puede estar involucrado)
          // IMPORTANTE: Excluir las solicitudes del usuario actual
          const { data: acceptedRequests } = await supabase
            .from('purchase_requests')
            .select('*')
            .eq('status', 'accepted')
            .neq('buyer_id', userId) // ⭐ Excluir solicitudes del usuario actual ⭐
          
          // Combinar todas las solicitudes
          const allRequests = [...requestsToShow]
          if (acceptedRequests) allRequests.push(...acceptedRequests as PurchaseRequest[])
          
          // Eliminar duplicados por ID
          const uniqueRequests = Array.from(
            new Map(allRequests.map(req => [req.id, req])).values()
          )
          
          requestsToShow = uniqueRequests
        }
        
        setRequests(requestsToShow)
      } else {
        toast({
          title: "Error",
          description: result?.error || "No se pudieron cargar las solicitudes",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('❌ Error cargando solicitudes:', error)
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

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadRequests()
  }

  const handleNegotiate = async (request: PurchaseRequest) => {
    console.log('🖱️ Vendedor haciendo clic en "Negociar" para solicitud:', request.id)
    
    if (!userId) {
      console.error('❌ No hay userId')
      toast({
        title: "Error",
        description: "No se pudo obtener tu información de usuario",
        variant: "destructive",
      })
      return
    }

    try {
      // No necesitamos actualizar el estado a 'negotiating' ya que esa columna fue eliminada
      // Simplemente abrimos el panel directamente
      console.log('📝 Abriendo panel de transacción para negociar...')
      
      console.log('📋 Abriendo panel de completar compra para el vendedor')
      console.log('📋 Datos de la solicitud:', {
        requestId: request.id,
        buyer_id: request.buyer_id,
        amount: request.amount,
        currency: request.currency_type,
        payment_method: request.payment_method,
        userId: userId
      })
      
      // Abrir directamente el panel de completar compra
      setSelectedRequest(request)
      setCompletionPanelOpen(true)
      console.log('✅ Panel abierto')
      
      toast({
        title: "Negociación iniciada",
        description: "Puedes completar la transacción de forma segura.",
      })
    } catch (error) {
      console.error('❌ Error abriendo panel de compra:', error)
      toast({
        title: "Error",
        description: "Error inesperado al abrir panel de compra",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (request: PurchaseRequest) => {
    const { status } = request
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activa</Badge>
      case 'negotiating':
        return <Badge variant="default" className="bg-orange-100 text-orange-800">Negociando</Badge>
      case 'accepted':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Aceptada</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-emerald-100 text-emerald-800">Completada</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelada</Badge>
      case 'expired':
        return <Badge variant="secondary">Expirada</Badge>
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

  const filteredRequests = requests.filter(request => {
    // ⭐ Excluir solicitudes del usuario actual ⭐
    if (userId && request.buyer_id === userId) {
      return false
    }
    
    // No mostrar completed, expired o cancelled
    if (request.status === 'completed' || request.status === 'expired' || request.status === 'cancelled') {
      return false
    }
    
    const paymentInfo = getPaymentMethodInfo(request)
    return (
      request.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.amount.toString().includes(searchTerm) ||
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

  // Manejar apertura automática del chat desde URL
  useEffect(() => {
    const openChatId = searchParams.get('openChat')
    console.log('🔗 Parámetro openChat recibido:', openChatId)
    console.log('📋 Solicitudes cargadas:', requests.length)
    console.log('👤 Usuario ID:', userId)
    
    if (openChatId && requests.length > 0 && userId) {
      // Buscar la solicitud correspondiente al ID
      const request = requests.find(r => r.id === openChatId)
      console.log('🔍 Solicitud encontrada:', request ? 'Sí' : 'No')
      
      if (request) {
        console.log('✅ Abriendo chat para solicitud:', request.id)
        setSelectedRequest(request)
        setChatOpen(true)
        // Limpiar el parámetro de la URL
        window.history.replaceState({}, '', '/dashboard/solicitudes')
      } else {
        console.log('❌ No se encontró la solicitud con ID:', openChatId)
        console.log('📋 IDs disponibles:', requests.map(r => r.id))
      }
    }
  }, [searchParams, requests, userId])

  useEffect(() => {
    if (userId) {
      loadRequests()
    }
    
    // Configurar suscripción realtime para purchase_requests
    const supabase = supabaseBrowser()
    
    console.log('🔌 Configurando suscripción realtime para purchase_requests...')
    
    // Canal para INSERT y UPDATE de solicitudes activas
    const channelActive = supabase
      .channel('purchase_requests_active_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'purchase_requests',
        filter: 'status=eq.active'
      }, (payload) => {
        const newRequest = payload.new as PurchaseRequest
        console.log('✅ Nueva solicitud activa detectada:', newRequest)
        // Solo agregar si no es del usuario actual
        if (userId && newRequest.buyer_id !== userId) {
          setRequests(prev => {
            // Evitar duplicados
            if (prev.some(req => req.id === newRequest.id)) return prev
            return [newRequest, ...prev]
          })
          toast({
            title: "Nueva solicitud disponible",
            description: `Se ha publicado una nueva solicitud de compra`,
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'purchase_requests',
        filter: 'status=eq.active'
      }, (payload) => {
        const updatedRequest = payload.new as PurchaseRequest
        console.log('🔄 Solicitud activa actualizada:', updatedRequest)
        // Solo actualizar si no es del usuario actual
        if (userId && updatedRequest.buyer_id !== userId) {
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
    
    // Canal separado para DELETE (sin filtro de status, para detectar todas las eliminaciones)
    const channelDelete = supabase
      .channel('purchase_requests_deletes')
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'purchase_requests'
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
    
    // Canal para detectar cambios de estado a 'cancelled' o cualquier otro estado no activo
    // Escucha todos los UPDATE sin filtro de status para poder detectar cambios de estado
    const channelStatusChanges = supabase
      .channel('purchase_requests_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'purchase_requests'
      }, (payload) => {
        const updatedRequest = payload.new as PurchaseRequest
        const oldRequest = payload.old as PurchaseRequest
        
        console.log('🔄 Cambio de estado detectado:', {
          requestId: updatedRequest.id,
          oldStatus: oldRequest?.status,
          newStatus: updatedRequest.status
        })
        
        // Si la solicitud cambió a 'cancelled', removerla y cerrar panel si está abierto
        if (updatedRequest.status === 'cancelled') {
          console.log('🚫 Solicitud cancelada detectada:', updatedRequest.id)
          
          // Cerrar el panel de transacción si está abierto para esta solicitud
          if (completionPanelOpen && selectedRequest?.id === updatedRequest.id) {
            console.log('🚫 Cerrando panel de transacción debido a cancelación')
            setCompletionPanelOpen(false)
            setSelectedRequest(null)
          }
          
          // Remover la solicitud de la lista completamente
          setRequests(prev => {
            const filtered = prev.filter(req => req.id !== updatedRequest.id)
            console.log(`🚫 Solicitud ${updatedRequest.id} removida de la lista (cancelada por comprador)`)
            return filtered
          })
          
          // Mostrar aviso al vendedor explicando que el comprador canceló
          toast({
            title: "Solicitud Cancelada",
            description: `El comprador ha cancelado la solicitud de compra.`,
            variant: "destructive",
            duration: 5000,
          })
        }
        // Si cambió de 'active' o 'accepted' a otro estado que no debería mostrarse
        else if (
          (oldRequest?.status === 'active' || oldRequest?.status === 'accepted') &&
          !['active', 'accepted'].includes(updatedRequest.status)
        ) {
          console.log(`🔄 Solicitud ${updatedRequest.id} cambió de ${oldRequest.status} a ${updatedRequest.status}, removiendo de la lista`)
          setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
        }
        // Si cambió a 'active' o 'accepted' desde otro estado
        else if (['active', 'accepted'].includes(updatedRequest.status)) {
          console.log(`✅ Solicitud ${updatedRequest.id} cambió a estado ${updatedRequest.status}`)
          // Solo agregar si no es del usuario actual y no está ya en la lista
          if (userId && updatedRequest.buyer_id !== userId) {
            setRequests(prev => {
              if (prev.some(req => req.id === updatedRequest.id)) {
                // Ya existe, actualizarla
                return prev.map(req => req.id === updatedRequest.id ? updatedRequest : req)
              } else {
                // No existe, agregarla
                return [updatedRequest, ...prev]
              }
            })
          } else {
            // Es del usuario actual, removerla
            setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
          }
        }
      })
      .subscribe((status, error) => {
        console.log('📡 Estado de suscripción realtime (status changes):', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción realtime (status changes) activa')
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error en la suscripción realtime (status changes):', error)
        }
      })
    
    return () => {
      console.log('🧹 Limpiando suscripciones realtime...')
      supabase.removeChannel(channelActive)
      supabase.removeChannel(channelDelete)
      supabase.removeChannel(channelStatusChanges)
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
          <h1 className="text-2xl md:text-3xl font-bold">Solicitudes de Compra</h1>
          <p className="text-muted-foreground">Oportunidades para vender HNLD a otros usuarios</p>
          <p className="text-sm text-muted-foreground mt-1">
            💡 Solo puedes ver solicitudes de otros usuarios. Tus propias solicitudes aparecen en "Mis Solicitudes"
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            🔒 Tus solicitudes están ocultas aquí para evitar conflictos de interés
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/dashboard/mis-solicitudes">
              <User className="mr-2 h-4 w-4" />
              Mis Solicitudes
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
              placeholder="Buscar por monto, método de pago, país, banco o código..."
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
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay solicitudes disponibles</h3>
            <p className="text-muted-foreground mb-2">
              {searchTerm ? "No se encontraron solicitudes que coincidan con tu búsqueda" : "No hay solicitudes de compra activas de otros usuarios en este momento"}
            </p>
            <p className="text-xs text-muted-foreground">
              💡 Recuerda que solo ves solicitudes de otros usuarios. Las tuyas aparecen en "Mis Solicitudes"
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
                      <span>{paymentInfo.currency}{formatAmount(paymentInfo.amount)}</span>
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-1 mt-1">
                      <User className="h-4 w-4" />
                      <span>{request.buyer_name || "Usuario"}</span>
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

                {/* DESACTIVADO: Información de timeout de negociación ya no es necesaria */}

                <div className="flex space-x-2">
                  {request.status === 'active' && (
                    <Button 
                      onClick={() => handleNegotiate(request)}
                      className="flex-1"
                      size="sm"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Negociar
                    </Button>
                  )}
                  
                  {request.status === 'accepted' && (
                    <Button 
                      onClick={() => {
                        setSelectedRequest(request)
                        setCompletionPanelOpen(true)
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                      size="sm"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Continúa Negociación
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            )
          })
        )}
      </div>

      {/* Purchase Completion Panel */}
      {selectedRequest && userId && (
        <PurchaseCompletionPanel
          requestId={selectedRequest.id}
          sellerId={userId}
          buyerId={selectedRequest.buyer_id || selectedRequest.user_id}
          amount={selectedRequest.amount}
          currency={selectedRequest.currency_type || 'L.'}
          paymentMethod={selectedRequest.payment_method}
          isOpen={completionPanelOpen}
          onClose={() => {
            setCompletionPanelOpen(false)
            setSelectedRequest(null)
            loadRequests()
          }}
          onTransactionCreated={(transactionId) => {
            console.log('✅ Transacción creada:', transactionId)
            // Actualizar la lista de solicitudes
            loadRequests()
          }}
        />
      )}
    </div>
  )
}
