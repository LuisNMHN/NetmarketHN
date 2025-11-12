"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"
import { 
  getUserSaleRequests,
  cancelSaleRequest,
  type SaleRequest
} from "@/lib/actions/sale_requests"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { 
  Clock, 
  User, 
  X,
  RefreshCw,
  ShoppingCart,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { SaleCompletionPanel } from "@/components/SaleCompletionPanel"
import { SaleHNLDButton } from "@/components/SaleHNLDModal"

export default function MisVentasPage() {
  const [requests, setRequests] = useState<SaleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<SaleRequest | null>(null)
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadRequests = async () => {
    try {
      const result = await getUserSaleRequests()
      if (result && result.success && result.data) {
        setRequests(result.data)
      } else {
        toast({
          title: "Error",
          description: result?.error || "No se pudieron cargar tus ventas",
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

  const handleCancel = async (request: SaleRequest) => {
    if (!confirm('¿Estás seguro de que quieres cancelar esta venta?')) {
      return
    }

    try {
      const result = await cancelSaleRequest(request.id)
      if (result.success) {
        toast({
          title: "Venta Cancelada",
          description: "La venta ha sido cancelada exitosamente",
          variant: "destructive",
        })
        loadRequests()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al cancelar la venta",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('❌ Error cancelando venta:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cancelar venta",
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
    
    // Configurar suscripción realtime para mis ventas
    const supabase = supabaseBrowser()
    
    const channel = supabase
      .channel('my_sale_requests_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sale_requests',
        filter: `seller_id=eq.${userId}`
      }, (payload) => {
        console.log('🔄 Cambio en mis ventas detectado:', payload)
        loadRequests()
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error en la suscripción realtime:', error)
        }
      })
    
    return () => {
      try {
        channel.unsubscribe().catch(err => console.error('Error desuscribiendo:', err))
      } catch (error) {
        console.error('⚠️ Error desuscribiendo canal Realtime:', error)
      }
    }
  }, [userId, toast])

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
          <h1 className="text-2xl sm:text-3xl font-bold">Mis Ventas de HNLD</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus solicitudes de venta de HNLD
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <SaleHNLDButton
            onSuccess={loadRequests}
            variant="default"
            size="sm"
            className="flex-1 sm:flex-none"
          />
        </div>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No tienes ventas de HNLD aún
            </p>
            <SaleHNLDButton onSuccess={loadRequests} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((request) => {
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
                    {request.buyer_id && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Comprador asignado</span>
                      </div>
                    )}
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
                  
                  <div className="flex gap-2">
                    {request.status === 'active' && !isExpired && (
                      <Button
                        onClick={() => handleCancel(request)}
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                    
                    {request.status === 'accepted' && (
                      <Button
                        onClick={() => {
                          setSelectedRequest(request)
                          setCompletionPanelOpen(true)
                        }}
                        variant="default"
                        className="flex-1"
                        size="sm"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Ver Transacción
                      </Button>
                    )}
                    
                    {request.status === 'completed' && (
                      <Badge variant="default" className="bg-emerald-100 text-emerald-800 w-full justify-center py-2">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Completada
                      </Badge>
                    )}
                    
                    {request.status === 'cancelled' && (
                      <Badge variant="secondary" className="w-full justify-center py-2">
                        <X className="mr-2 h-4 w-4" />
                        Cancelada
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Panel de completar venta */}
      {selectedRequest && userId && (
        <SaleCompletionPanel
          requestId={selectedRequest.id}
          sellerId={selectedRequest.seller_id}
          buyerId={selectedRequest.buyer_id || ''}
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

