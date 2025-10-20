"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"
import { 
  getActivePurchaseRequests,
  createPurchaseOffer,
  type PurchaseRequest
} from "@/lib/actions/purchase_requests"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { 
  Search, 
  Plus, 
  Clock, 
  User, 
  DollarSign,
  MessageSquare,
  TrendingUp,
  Eye,
  Send,
  RefreshCw
} from "lucide-react"

export default function SolicitudesPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const { toast } = useToast()

  // Form state para oferta
  const [offerForm, setOfferForm] = useState({
    amount: "",
    exchangeRate: "1.0000",
    terms: "",
    message: ""
  })

  const loadRequests = async () => {
    try {
      const result = await getActivePurchaseRequests(50, 0)
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

  const handleMakeOffer = (request: PurchaseRequest) => {
    setSelectedRequest(request)
    setOfferForm({
      amount: request.amount.toString(),
      exchangeRate: "1.0000",
      terms: "",
      message: ""
    })
    setOfferOpen(true)
  }

  const handleSubmitOffer = async () => {
    if (!selectedRequest || !offerForm.amount) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(offerForm.amount)
    const exchangeRate = parseFloat(offerForm.exchangeRate)

    if (amount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await createPurchaseOffer(
        selectedRequest.id,
        amount,
        exchangeRate,
        offerForm.terms || undefined,
        offerForm.message || undefined
      )

      if (result.success) {
        toast({
          title: "✅ Oferta enviada",
          description: "Tu oferta ha sido enviada al comprador",
        })
        setOfferOpen(false)
        setSelectedRequest(null)
        setOfferForm({ amount: "", exchangeRate: "1.0000", terms: "", message: "" })
        await loadRequests()
      } else {
        toast({
          title: "❌ Error al enviar oferta",
          description: result.error || "No se pudo enviar la oferta",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al enviar oferta",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activa</Badge>
      case 'negotiating':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Negociando</Badge>
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

  useEffect(() => {
    loadRequests()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Cargando solicitudes...</p>
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
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                      <DollarSign className="h-5 w-5 text-green-600" />
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
                  {getStatusBadge(request.status)}
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
                  <Button 
                    onClick={() => handleMakeOffer(request)}
                    className="flex-1"
                    size="sm"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Hacer Oferta
                  </Button>
                  
                </div>
              </CardContent>
            </Card>
            )
          })
        )}
      </div>

      {/* Offer Dialog */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hacer Oferta</DialogTitle>
            <DialogDescription>
              Envía una oferta para la solicitud de compra de {formatCurrency(selectedRequest?.amount || 0)} HNLD
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="offer-amount">Monto a ofrecer (HNLD)</Label>
              <Input
                id="offer-amount"
                type="number"
                placeholder="0.00"
                value={offerForm.amount}
                onChange={(e) => setOfferForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="offer-rate">Tasa de cambio (opcional)</Label>
              <Input
                id="offer-rate"
                type="number"
                step="0.0001"
                placeholder="1.0000"
                value={offerForm.exchangeRate}
                onChange={(e) => setOfferForm(prev => ({ ...prev, exchangeRate: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="offer-terms">Términos (opcional)</Label>
              <Textarea
                id="offer-terms"
                placeholder="Describe los términos de tu oferta..."
                value={offerForm.terms}
                onChange={(e) => setOfferForm(prev => ({ ...prev, terms: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="offer-message">Mensaje al comprador (opcional)</Label>
              <Textarea
                id="offer-message"
                placeholder="Escribe un mensaje personalizado..."
                value={offerForm.message}
                onChange={(e) => setOfferForm(prev => ({ ...prev, message: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitOffer} disabled={processing}>
              {processing ? "Enviando..." : "Enviar Oferta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
