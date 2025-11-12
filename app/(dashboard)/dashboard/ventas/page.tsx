"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
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
  RefreshCw,
  ShoppingCart,
  X
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { SaleCompletionPanel } from "@/components/SaleCompletionPanel"

export default function VentasPage() {
  const [requests, setRequests] = useState<SaleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<SaleRequest | null>(null)
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadRequests = async () => {
    try {
      const result = await getActiveSaleRequests(50, 0)
      if (result && result.success && result.data) {
        let requestsToShow = result.data
        
        // Si hay usuario autenticado, también cargar solicitudes "accepted"
        if (userId) {
          const supabase = supabaseBrowser()
          
          const { data: acceptedRequests } = await supabase
            .from('sale_requests')
            .select('*')
            .eq('status', 'accepted')
            .neq('seller_id', userId) // Excluir ventas del usuario actual
          
          const allRequests = [...requestsToShow]
          if (acceptedRequests) allRequests.push(...acceptedRequests as SaleRequest[])
          
          const uniqueRequests = Array.from(
            new Map(allRequests.map(req => [req.id, req])).values()
          )
          
          requestsToShow = uniqueRequests
        }
        
        setRequests(requestsToShow)
      } else {
        toast({
          title: "Error",
          description: result?.error || "No se pudieron cargar las ventas",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('❌ Error cargando ventas:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar ventas",
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

  const handleBuy = async (request: SaleRequest) => {
    console.log('🖱️ Comprador haciendo clic en "Comprar" para venta:', request.id)
    
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
      const result = await acceptSaleRequest(request.id)
      
      if (result.success && result.transactionId) {
        toast({
          title: "Venta aceptada",
          description: "Se ha iniciado el proceso de compra. Debes dar clic al botón 'Aceptar trato' para continuar.",
          variant: "info",
        })
        
        // Abrir panel de completar venta
        setSelectedRequest(request)
        setCompletionPanelOpen(true)
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al aceptar la venta",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('❌ Error aceptando venta:', error)
      toast({
        title: "Error",
        description: "Error inesperado al aceptar venta",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (request: SaleRequest) => {
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

  const getPaymentMethodInfo = (request: SaleRequest) => {
    switch (request.payment_method) {
      case 'local_transfer':
        return {
          method: 'Transferencia Local',
          currency: 'L.',
          amount: request.amount_in_original_currency || request.final_amount_hnld,
          details: request.bank_name || 'Banco no especificado'
        }
      case 'international_transfer':
        const country = request.country === 'Otro de la zona euro' ? request.custom_country : request.country
        const currency = request.currency_type === 'USD' ? 'USD' : 'EUR'
        const currencySymbol = currency === 'USD' ? '$' : '€'
        return {
          method: 'Transferencia Internacional',
          currency: currencySymbol,
          amount: request.amount_in_original_currency || request.final_amount_hnld,
          details: country || 'País no especificado'
        }
      case 'digital_balance':
        return {
          method: 'Saldo Digital',
          currency: 'L.',
          amount: request.amount_in_original_currency || request.final_amount_hnld,
          details: request.digital_wallet || 'Billetera no especificada'
        }
      case 'cash':
        return {
          method: 'Efectivo',
          currency: 'L.',
          amount: request.amount_in_original_currency || request.final_amount_hnld,
          details: 'Pago en efectivo'
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
    // Excluir ventas del usuario actual
    if (userId && request.seller_id === userId) {
      return false
    }
    
    // No mostrar completed, expired o cancelled
    if (request.status === 'completed' || request.status === 'expired' || request.status === 'cancelled') {
      return false
    }
    
    const paymentInfo = getPaymentMethodInfo(request)
    return (
      request.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.seller_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.final_amount_hnld?.toString().includes(searchTerm) ||
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
    if (userId) {
      loadRequests()
    }
    
    // Configurar suscripción realtime para sale_requests
    const supabase = supabaseBrowser()
    
    console.log('🔌 Configurando suscripción realtime para sale_requests...')
    
    const channelActive = supabase
      .channel('sale_requests_active_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sale_requests',
        filter: 'status=eq.active'
      }, async (payload) => {
        const newRequest = payload.new as SaleRequest
        console.log('✅ Nueva venta activa detectada:', newRequest)
        if (userId && newRequest.seller_id !== userId) {
          setRequests(prev => {
            if (prev.some(req => req.id === newRequest.id)) return prev
            return [newRequest, ...prev]
          })
          
          let sellerName = 'Vendedor'
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newRequest.seller_id)
              .maybeSingle()
            
            if (profile?.full_name) {
              sellerName = profile.full_name
            }
          } catch (error) {
            console.log('⚠️ No se pudo obtener el nombre del vendedor:', error)
          }
          
          const codeText = newRequest.unique_code ? `Código: ${newRequest.unique_code}` : ''
          const description = `Se ha publicado una nueva venta de HNLD${codeText ? ` - ${codeText}` : ''} - Vendedor: ${sellerName}`
          
          toast({
            title: "Nueva venta disponible",
            description: description,
            variant: "created",
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sale_requests',
        filter: 'status=eq.active'
      }, (payload) => {
        const updatedRequest = payload.new as SaleRequest
        if (userId && updatedRequest.seller_id !== userId) {
          setRequests(prev => prev.map(req => req.id === updatedRequest.id ? updatedRequest : req))
        } else {
          setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
        }
      })
      .subscribe((status, error) => {
        console.log('📡 Estado de suscripción realtime (active):', status)
        if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error en la suscripción realtime (active):', error)
        }
      })
    
    const channelDelete = supabase
      .channel('sale_requests_deletes')
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'sale_requests'
      }, (payload) => {
        const deletedId = payload.old?.id
        if (deletedId) {
          setRequests(prev => prev.filter(req => req.id !== deletedId))
        }
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error en la suscripción realtime (delete):', error)
        }
      })
    
    const channelStatusChanges = supabase
      .channel('sale_requests_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sale_requests'
      }, (payload) => {
        const updatedRequest = payload.new as SaleRequest
        const oldRequest = payload.old as SaleRequest
        
        if (updatedRequest.status === 'cancelled') {
          if (completionPanelOpen && selectedRequest?.id === updatedRequest.id) {
            setCompletionPanelOpen(false)
            setSelectedRequest(null)
          }
          
          setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
          
          toast({
            title: "Venta Cancelada",
            description: `El vendedor ha cancelado la venta de HNLD.`,
            variant: "destructive",
            duration: 5000,
          })
        } else if (
          (oldRequest?.status === 'active' || oldRequest?.status === 'accepted') &&
          !['active', 'accepted'].includes(updatedRequest.status)
        ) {
          setRequests(prev => prev.filter(req => req.id !== updatedRequest.id))
        } else if (['active', 'accepted'].includes(updatedRequest.status)) {
          if (userId && updatedRequest.seller_id !== userId) {
            setRequests(prev => {
              if (prev.some(req => req.id === updatedRequest.id)) {
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
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error en la suscripción realtime (status changes):', error)
        }
      })
    
    return () => {
      console.log('🧹 Limpiando suscripciones realtime...')
      try {
        const channels = [
          supabase.channel('sale_requests_active_changes'),
          supabase.channel('sale_requests_deletes'),
          supabase.channel('sale_requests_status_changes')
        ]
        channels.forEach(channel => {
          channel.unsubscribe().catch(err => console.error('Error desuscribiendo:', err))
        })
      } catch (error) {
        console.error('⚠️ Error desuscribiendo canales Realtime:', error)
      }
    }
  }, [userId, toast, completionPanelOpen, selectedRequest])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Solicitudes de Venta</h1>
          <p className="text-muted-foreground mt-1">
            Compra HNLD de otros usuarios
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por código, vendedor, monto o método de pago..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchTerm ? "No se encontraron ventas que coincidan con tu búsqueda" : "No hay ventas de HNLD disponibles en este momento"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((request) => {
            const paymentInfo = getPaymentMethodInfo(request)
            const expiresAt = new Date(request.expires_at)
            const isExpired = expiresAt < new Date()
            
            return (
              <Card key={request.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {formatCurrency(request.final_amount_hnld || request.amount)} HNLD
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {request.unique_code || 'Sin código'}
                      </CardDescription>
                    </div>
                    {getStatusBadge(request)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{request.seller_name || 'Vendedor'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeAgo(request.created_at)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Método:</span> {paymentInfo.method}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Recibirás:</span> {paymentInfo.currency}{formatAmount(paymentInfo.amount)}
                    </div>
                    {paymentInfo.details && (
                      <div className="text-sm text-muted-foreground">
                        {paymentInfo.details}
                      </div>
                    )}
                  </div>
                  
                  {request.status === 'active' && !isExpired && (
                    <Button
                      onClick={() => handleBuy(request)}
                      className="w-full"
                      size="sm"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Comprar HNLD
                    </Button>
                  )}
                  
                  {request.status === 'accepted' && (
                    <Button
                      onClick={() => {
                        setSelectedRequest(request)
                        setCompletionPanelOpen(true)
                      }}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      Ver Transacción
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Panel de completar venta */}
      {selectedRequest && (
        <SaleCompletionPanel
          requestId={selectedRequest.id}
          sellerId={selectedRequest.seller_id}
          buyerId={userId || ''}
          amount={selectedRequest.amount_in_original_currency || selectedRequest.final_amount_hnld || selectedRequest.amount}
          currency={selectedRequest.currency_type || 'L'}
          paymentMethod={selectedRequest.payment_method || 'local_transfer'}
          isOpen={completionPanelOpen}
          onClose={() => {
            setCompletionPanelOpen(false)
            setSelectedRequest(null)
          }}
          onTransactionCreated={() => {
            loadRequests()
          }}
        />
      )}
    </div>
  )
}

