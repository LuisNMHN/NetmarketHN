"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabaseBrowser } from "@/lib/supabase/client"
import { 
  getUserSaleRequests,
  cancelSaleRequest,
  deleteSaleRequest,
  type SaleRequest
} from "@/lib/actions/sale_requests"
import { SaleHNLDButton } from "@/components/SaleHNLDModal"
import { formatCurrency, formatAmount } from "@/lib/utils"
import Link from "next/link"
import { 
  Clock, 
  User, 
  Eye,
  RefreshCw,
  ShoppingBag,
  X,
  Trash2,
  CheckCircle,
  TrendingUp,
  MessageSquare
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SaleCompletionPanel } from "@/components/SaleCompletionPanel"

export default function MisVentasPage() {
  const [requests, setRequests] = useState<SaleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<SaleRequest | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const { toast } = useToast()

  const loadRequests = async () => {
    try {
      setLoading(true)
      const result = await getUserSaleRequests()
      
      if (result && result.success && result.data) {
        setRequests(result.data)
      } else {
        toast({
          title: "Error",
          description: result?.error || "No se pudieron cargar las solicitudes de venta",
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

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadRequests()
  }

  const handleCancelRequest = (request: SaleRequest) => {
    setSelectedRequest(request)
    setCancelOpen(true)
  }

  const confirmCancelRequest = async () => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const result = await cancelSaleRequest(selectedRequest.id)
      
      if (result.success) {
        toast({
          title: "Solicitud Cancelada",
          description: "Tu solicitud de venta ha sido cancelada exitosamente.",
          variant: "destructive",
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

  const handleViewDetails = (request: SaleRequest) => {
    setSelectedRequest(request)
    setDetailsOpen(true)
  }

  const handleViewTransaction = async (request: SaleRequest) => {
    if (!request.buyer_id) {
      toast({
        title: "Sin transacción",
        description: "Esta solicitud aún no ha sido aceptada por ningún comprador",
        variant: "info",
      })
      return
    }

    // Buscar transacción asociada
    try {
      const supabase = supabaseBrowser()
      const { data: transaction } = await supabase
        .from('sale_transactions')
        .select('*')
        .eq('request_id', request.id)
        .single()

      if (transaction) {
        setSelectedTransaction(transaction)
        setSelectedRequest(request)
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
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activa</Badge>
      case 'accepted':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Aceptada</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-emerald-100 text-emerald-800">Completada</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>
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

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  const canCancelRequest = (request: SaleRequest): boolean => {
    // Puede cancelar SIEMPRE, sin importar el estado (incluso si está aceptada)
    return true
  }

  const canDeleteRequest = (request: SaleRequest): boolean => {
    // Se puede eliminar si la solicitud está cancelada, completada, expirada
    // O si la transacción asociada está expirada
    const isExpired = new Date(request.expires_at) < new Date()
    return request.status === 'cancelled' || 
           request.status === 'completed' ||
           request.status === 'expired' ||
           (request.status === 'active' && isExpired)
  }

  const handleDeleteRequest = (request: SaleRequest) => {
    setSelectedRequest(request)
    setDeleteOpen(true)
  }

  const confirmDeleteRequest = async () => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const result = await deleteSaleRequest(selectedRequest.id)
      
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

  useEffect(() => {
    loadRequests()
    
    // Configurar suscripción en tiempo real para sale_requests (solo si userId está disponible)
    let channel: any = null
    if (userId) {
      try {
        const supabase = supabaseBrowser()
        
        console.log('🔧 Configurando suscripción Realtime para userId:', userId)
        
        channel = supabase
          .channel('mis_ventas_changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'sale_requests',
              filter: `seller_id=eq.${userId}` // Solo escuchar actualizaciones a las solicitudes del vendedor actual
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
                        buyer_id: payload.new.buyer_id,
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
              console.log('✅ Suscripción Realtime activa para mis_ventas_changes')
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
      if (channel) {
        try {
          channel.unsubscribe()
        } catch (error) {
          console.error('⚠️ Error desuscribiendo canal Realtime:', error)
        }
      }
    }
  }, [userId, toast])

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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Mis Solicitudes de Venta</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Gestiona tus solicitudes de venta de HNLD</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <SaleHNLDButton 
            onSuccess={loadRequests}
            defaultMethod="local_transfer"
            variant="destructive"
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
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-lg sm:text-2xl font-bold text-purple-600">
              {requests.filter(r => r.status === 'accepted').length}
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 sm:p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-lg sm:text-2xl font-bold text-emerald-600">
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
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No tienes solicitudes</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4">
                Crea tu primera solicitud de venta de HNLD
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => {
            const paymentInfo = getPaymentMethodInfo(request)
            return (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                {/* Mobile Layout */}
                <div className="block sm:hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">💱</span>
                      <span className="text-lg font-bold">{formatCurrency(request.final_amount_hnld)} HNLD</span>
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
                      <span className="font-medium">{paymentInfo.method}</span>
                      {paymentInfo.details && (
                        <span className="ml-1">• {paymentInfo.details}</span>
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
                    {request.buyer_id && (
                      <div className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>Comprador aceptó</span>
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
                    {request.status === 'accepted' && request.buyer_id && (
                      <Button
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleViewTransaction(request)}
                        className="w-full"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Completar venta
                      </Button>
                    )}
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
                        <span className="text-xl font-bold">{formatCurrency(request.final_amount_hnld)} HNLD</span>
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
                      <span className="font-medium">{paymentInfo.method}</span>
                      {paymentInfo.details && (
                        <span className="ml-1">• {paymentInfo.details}</span>
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
                      {request.buyer_id && (
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>Comprador aceptó</span>
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
                    {request.status === 'accepted' && request.buyer_id && (
                      <Button
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleViewTransaction(request)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Completar venta
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
            )
          })
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
              Información completa de tu solicitud de venta
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Monto</Label>
                  <p className="text-lg font-bold">{formatCurrency(selectedRequest.final_amount_hnld)}</p>
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
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Cerrar
            </Button>
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
              No, mantener
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

      {/* Completion Panel */}
      {selectedRequest && selectedTransaction && userId && (
        <SaleCompletionPanel
          requestId={selectedRequest.id}
          transactionId={selectedTransaction.id}
          sellerId={userId}
          buyerId={selectedTransaction.buyer_id}
          amount={selectedRequest.final_amount_hnld}
          currency={selectedRequest.currency_type}
          paymentMethod={selectedRequest.payment_method}
          isOpen={completionPanelOpen}
          onClose={() => {
            setCompletionPanelOpen(false)
            setSelectedRequest(null)
            setSelectedTransaction(null)
            loadRequests()
          }}
          onTransactionCreated={(transactionId) => {
            console.log('✅ Transacción actualizada:', transactionId)
            loadRequests()
          }}
        />
      )}
    </div>
  )
}
