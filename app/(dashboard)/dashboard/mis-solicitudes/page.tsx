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
  X
} from "lucide-react"

export default function MisSolicitudesPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
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
    const isExpired = new Date(request.expires_at) < new Date()
    return request.status === 'cancelled' || 
           (request.status === 'active' && isExpired) ||
           request.status === 'expired'
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activa</Badge>
      case 'negotiating':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Negociando</Badge>
      case 'accepted':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Aceptada</Badge>
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

  useEffect(() => {
    loadRequests()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Cargando tus solicitudes...</p>
          </div>
        </div>
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
            <CardTitle className="text-xs sm:text-sm font-medium">Ofertas</CardTitle>
            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">
              {requests.filter(r => (r.offers_count || 0) > 0).length}
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
              <span className="text-4xl sm:text-6xl mx-auto mb-4">💱</span>
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
                    <div className="flex space-x-2">
                      {request.status === 'active' && (
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
                      {canDeleteRequest(request) && (
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
                    {request.status === 'active' && (
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
                    {canDeleteRequest(request) && (
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
              ¿Cancelar esta solicitud de compra?
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
              ⚠️ Esta acción no se puede deshacer
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
    </div>
  )
}
