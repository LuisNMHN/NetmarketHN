"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  getUserPurchaseRequests,
  acceptPurchaseOffer,
  type PurchaseRequest
} from "@/lib/actions/purchase_requests"
import { 
  Plus, 
  Clock, 
  User, 
  DollarSign,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  MessageSquare,
  TrendingUp
} from "lucide-react"
import Link from "next/link"

export default function MisSolicitudesPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  const loadRequests = async () => {
    try {
      const result = await getUserPurchaseRequests()
      if (result.success && result.data) {
        setRequests(result.data)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron cargar las solicitudes",
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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Mis Solicitudes de Compra</h1>
          <p className="text-muted-foreground">Gestiona tus solicitudes de compra de HNLD</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/saldo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Solicitud
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Solicitudes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {requests.filter(r => r.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Ofertas</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {requests.filter(r => (r.offers_count || 0) > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {requests.filter(r => r.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tienes solicitudes</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera solicitud de compra de HNLD
              </p>
              <Button asChild>
                <Link href="/dashboard/saldo">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Solicitud
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        <span className="text-xl font-bold">L.{request.amount.toFixed(2)}</span>
                      </div>
                      {getStatusBadge(request.status)}
                      {isExpired(request.expires_at) && request.status === 'active' && (
                        <Badge variant="destructive">Expirada</Badge>
                      )}
                    </div>
                    
                    {request.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {request.description}
                      </p>
                    )}
                    
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
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
                  <p className="text-lg font-bold">L.{selectedRequest.amount.toFixed(2)}</p>
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
    </div>
  )
}
