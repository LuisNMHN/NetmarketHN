"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Search, Plus, Clock, DollarSign, Users, Filter, Shield, Lock, Unlock, X, AlertTriangle, Eye, Send } from "lucide-react"
import Link from "next/link"
import type { AuctionDTO, AuctionStatus, Currency } from "@/lib/contracts/types"
import { onCreateAuction, onLoadAuctions } from "@/lib/contracts/events"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { 
  createEscrow,
  lockEscrow,
  releaseEscrow,
  cancelEscrow,
  disputeEscrow,
  getUserEscrows,
  getEscrowEvents,
  getEscrowMessages,
  addEscrowMessage,
  searchUserForEscrow,
  type Escrow,
  type EscrowEvent,
  type EscrowMessage
} from "@/lib/actions/escrow"
import { formatCurrency as formatCurrencyUtil, formatAmount } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function SubastasPage() {
  const [auctions, setAuctions] = useState<AuctionDTO[]>([])
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [hnldBalance, setHnldBalance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<AuctionStatus | "all">("all")
  const [currencyFilter, setCurrencyFilter] = useState<Currency | "all">("all")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEscrowModalOpen, setIsEscrowModalOpen] = useState(false)
  const [isEscrowDetailsOpen, setIsEscrowDetailsOpen] = useState(false)
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null)
  const [escrowEvents, setEscrowEvents] = useState<EscrowEvent[]>([])
  const [escrowMessages, setEscrowMessages] = useState<EscrowMessage[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTab, setActiveTab] = useState("auctions")
  const itemsPerPage = 6

  // Form state for create modal
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    currency: "USD" as Currency,
    expiresAt: "",
    description: "",
  })

  // Form state for escrow modal
  const [escrowForm, setEscrowForm] = useState({
    payeeEmail: "",
    amount: "",
    title: "",
    description: "",
    terms: "",
    expiresInHours: "168"
  })
  const [searchUser, setSearchUser] = useState({ email: "", user: null as any })
  const [messageForm, setMessageForm] = useState({ message: "" })
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // Cargar subastas
      const auctionsData = await onLoadAuctions()
      setAuctions(auctionsData)
      
      // Cargar escrows
      const escrowsResult = await getUserEscrows()
      if (escrowsResult.success && escrowsResult.data) {
        setEscrows(escrowsResult.data)
      }
      
      // Cargar balance HNLD
      const balanceResult = await getUserHNLDBalance()
      if (balanceResult.success && balanceResult.data) {
        setHnldBalance(balanceResult.data)
      }
    } catch (error) {
      toast.error("Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validations
    if (!formData.title.trim()) {
      toast.error("El título es requerido")
      return
    }

    const amount = Number.parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("El monto debe ser mayor a 0")
      return
    }

    const expiresAt = new Date(formData.expiresAt)
    if (expiresAt <= new Date()) {
      toast.error("La fecha de expiración debe ser futura")
      return
    }

    try {
      const newAuction = await onCreateAuction({
        title: formData.title,
        amount,
        currency: formData.currency,
        expiresAt,
        description: formData.description,
      })

      setAuctions((prev) => [newAuction, ...prev])
      setIsCreateModalOpen(false)
      setFormData({
        title: "",
        amount: "",
        currency: "USD",
        expiresAt: "",
        description: "",
      })
      toast.success("Subasta creada exitosamente")
    } catch (error) {
      toast.error("Error al crear la subasta")
    }
  }

  // Escrow functions
  const handleSearchUser = async () => {
    if (!searchUser.email) {
      toast.error("Ingresa un email válido")
      return
    }

    try {
      const result = await searchUserForEscrow(searchUser.email)
      if (result.success && result.data) {
        setSearchUser(prev => ({ ...prev, user: result.data }))
        toast.success(`Usuario encontrado: ${result.data.name || result.data.email}`)
      } else {
        setSearchUser(prev => ({ ...prev, user: null }))
        toast.error(result.error || "No se encontró el usuario")
      }
    } catch (error) {
      toast.error("Error buscando usuario")
    }
  }

  const handleCreateEscrow = async () => {
    if (!escrowForm.amount || !escrowForm.title || !searchUser.user) {
      toast.error("Todos los campos requeridos deben estar completos")
      return
    }

    const amount = parseFloat(escrowForm.amount)
    if (amount <= 0) {
      toast.error("El monto debe ser mayor a 0")
      return
    }

    if (hnldBalance && amount > hnldBalance.available_balance) {
      toast.error(`Balance insuficiente. Disponible: ${formatCurrencyUtil(hnldBalance.available_balance)}`)
      return
    }

    setProcessing(true)
    try {
      const result = await createEscrow(
        searchUser.user.id,
        amount,
        escrowForm.title,
        escrowForm.description,
        escrowForm.terms,
        "auction", // Tipo específico para subastas
        parseInt(escrowForm.expiresInHours)
      )
      
      if (result.success) {
        toast.success(`Escrow de ${formatCurrencyUtil(amount)} creado exitosamente`)
        setEscrowForm({
          payeeEmail: "",
          amount: "",
          title: "",
          description: "",
          terms: "",
          expiresInHours: "168"
        })
        setSearchUser({ email: "", user: null })
        setIsEscrowModalOpen(false)
        await loadData()
      } else {
        toast.error(result.error || "No se pudo crear el escrow")
      }
    } catch (error) {
      toast.error("Error inesperado al crear el escrow")
    } finally {
      setProcessing(false)
    }
  }

  const handleLockEscrow = async (escrowId: string) => {
    setProcessing(true)
    try {
      const result = await lockEscrow(escrowId)
      
      if (result.success) {
        toast.success("Escrow confirmado - Los fondos han sido bloqueados")
        await loadData()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'locked' } : null)
        }
      } else {
        toast.error(result.error || "No se pudo confirmar el escrow")
      }
    } catch (error) {
      toast.error("Error inesperado al confirmar el escrow")
    } finally {
      setProcessing(false)
    }
  }

  const handleReleaseEscrow = async (escrowId: string) => {
    setProcessing(true)
    try {
      const result = await releaseEscrow(escrowId)
      
      if (result.success) {
        toast.success("Escrow liberado - Los fondos han sido transferidos")
        await loadData()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'released' } : null)
        }
      } else {
        toast.error(result.error || "No se pudo liberar el escrow")
      }
    } catch (error) {
      toast.error("Error inesperado al liberar el escrow")
    } finally {
      setProcessing(false)
    }
  }

  const handleCancelEscrow = async (escrowId: string) => {
    setProcessing(true)
    try {
      const result = await cancelEscrow(escrowId)
      
      if (result.success) {
        toast.success("Escrow cancelado - Los fondos han sido devueltos")
        await loadData()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'cancelled' } : null)
        }
      } else {
        toast.error(result.error || "No se pudo cancelar el escrow")
      }
    } catch (error) {
      toast.error("Error inesperado al cancelar el escrow")
    } finally {
      setProcessing(false)
    }
  }

  const handleDisputeEscrow = async (escrowId: string) => {
    const reason = prompt("¿Cuál es la razón de la disputa?")
    if (!reason) return

    setProcessing(true)
    try {
      const result = await disputeEscrow(escrowId, reason)
      
      if (result.success) {
        toast.success("Escrow disputado - La disputa ha sido registrada")
        await loadData()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'disputed' } : null)
        }
      } else {
        toast.error(result.error || "No se pudo disputar el escrow")
      }
    } catch (error) {
      toast.error("Error inesperado al disputar el escrow")
    } finally {
      setProcessing(false)
    }
  }

  const handleViewEscrowDetails = async (escrow: Escrow) => {
    setSelectedEscrow(escrow)
    setIsEscrowDetailsOpen(true)
    
    // Cargar eventos y mensajes
    try {
      const [eventsResult, messagesResult] = await Promise.all([
        getEscrowEvents(escrow.id),
        getEscrowMessages(escrow.id)
      ])
      
      if (eventsResult.success && eventsResult.data) {
        setEscrowEvents(eventsResult.data)
      }
      
      if (messagesResult.success && messagesResult.data) {
        setEscrowMessages(messagesResult.data)
      }
    } catch (error) {
      console.error('❌ Error cargando detalles:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedEscrow || !messageForm.message.trim()) return

    try {
      const result = await addEscrowMessage(selectedEscrow.id, messageForm.message)
      
      if (result.success) {
        setMessageForm({ message: "" })
        // Recargar mensajes
        const messagesResult = await getEscrowMessages(selectedEscrow.id)
        if (messagesResult.success && messagesResult.data) {
          setEscrowMessages(messagesResult.data)
        }
      } else {
        toast.error(result.error || "No se pudo enviar el mensaje")
      }
    } catch (error) {
      toast.error("Error inesperado al enviar el mensaje")
    }
  }

  // Filter auctions
  const filteredAuctions = auctions.filter((auction) => {
    const matchesSearch = auction.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || auction.status === statusFilter
    const matchesCurrency = currencyFilter === "all" || auction.currency === currencyFilter
    return matchesSearch && matchesStatus && matchesCurrency
  })

  // Pagination
  const totalPages = Math.ceil(filteredAuctions.length / itemsPerPage)
  const paginatedAuctions = filteredAuctions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const getStatusColor = (status: AuctionStatus) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      case "expired":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: AuctionStatus) => {
    switch (status) {
      case "active":
        return "Activa"
      case "closed":
        return "Cerrada"
      case "expired":
        return "Expirada"
      default:
        return status
    }
  }

  const formatCurrency = (amount: number, currency: Currency) => {
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "L"
    const formattedAmount = amount.toLocaleString('es-HN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return `${symbol}.${formattedAmount}`
  }

  const formatTimeRemaining = (expiresAt: Date) => {
    const now = new Date()
    const diff = expiresAt.getTime() - now.getTime()

    if (diff <= 0) return "Expirada"

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days}d ${hours}h`
    return `${hours}h`
  }

  // Helper functions for escrows
  const getEscrowStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'locked':
        return <Lock className="h-4 w-4 text-blue-500" />
      case 'released':
        return <Unlock className="h-4 w-4 text-green-500" />
      case 'cancelled':
        return <X className="h-4 w-4 text-red-500" />
      case 'disputed':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getEscrowStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>
      case 'locked':
        return <Badge className="bg-blue-100 text-blue-800">Bloqueado</Badge>
      case 'released':
        return <Badge className="bg-green-100 text-green-800">Liberado</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>
      case 'disputed':
        return <Badge className="bg-orange-100 text-orange-800">Disputado</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  if (loading) {
    return <LoadingSpinner message="Cargando subastas y escrows..." />
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subastas y Escrows</h1>
          <p className="text-muted-foreground">Gestiona subastas y depósitos en garantía</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isEscrowModalOpen} onOpenChange={setIsEscrowModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Shield className="w-4 h-4 mr-2" />
                Crear Escrow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Escrow para Subasta</DialogTitle>
                <DialogDescription>Crear un depósito en garantía para una transacción de subasta</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payee-email">Email del Beneficiario</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="payee-email"
                      type="email"
                      placeholder="email@ejemplo.com"
                      value={searchUser.email}
                      onChange={(e) => setSearchUser(prev => ({ ...prev, email: e.target.value }))}
                    />
                    <Button type="button" onClick={handleSearchUser} size="sm">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {searchUser.user && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm font-medium text-green-800">
                        ✅ {searchUser.user.name || searchUser.user.email}
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Monto (L.)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={escrowForm.amount}
                      onChange={(e) => setEscrowForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                    {hnldBalance && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Disponible: {formatCurrencyUtil(hnldBalance.available_balance)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="expires">Expira en (horas)</Label>
                    <Input
                      id="expires"
                      type="number"
                      placeholder="168"
                      value={escrowForm.expiresInHours}
                      onChange={(e) => setEscrowForm(prev => ({ ...prev, expiresInHours: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    placeholder="Descripción breve del escrow"
                    value={escrowForm.title}
                    onChange={(e) => setEscrowForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descripción detallada..."
                    value={escrowForm.description}
                    onChange={(e) => setEscrowForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="terms">Términos y Condiciones (opcional)</Label>
                  <Textarea
                    id="terms"
                    placeholder="Términos específicos del escrow..."
                    value={escrowForm.terms}
                    onChange={(e) => setEscrowForm(prev => ({ ...prev, terms: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEscrowModalOpen(false)} disabled={processing}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateEscrow} disabled={processing || !searchUser.user}>
                  {processing ? "Creando..." : "Crear Escrow"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Crear Subasta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nueva Subasta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAuction} className="space-y-4">
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Título de la subasta"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Monto inicial</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Moneda</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value: Currency) => setFormData((prev) => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="expiresAt">Fecha de expiración</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, expiresAt: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción de la subasta"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Crear Subasta
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="auctions">Subastas</TabsTrigger>
          <TabsTrigger value="escrows">Escrows</TabsTrigger>
        </TabsList>
        
        <TabsContent value="auctions" className="space-y-6">
          {/* Filters */}
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por título..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={(value: AuctionStatus | "all") => setStatusFilter(value)}>
                    <SelectTrigger className="w-32">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Activas</SelectItem>
                      <SelectItem value="closed">Cerradas</SelectItem>
                      <SelectItem value="expired">Expiradas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={currencyFilter} onValueChange={(value: Currency | "all") => setCurrencyFilter(value)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auctions Grid */}
          {paginatedAuctions.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay subastas</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || statusFilter !== "all" || currencyFilter !== "all"
                      ? "No se encontraron subastas con los filtros aplicados"
                      : "Aún no has creado ninguna subasta"}
                  </p>
                  {!searchTerm && statusFilter === "all" && currencyFilter === "all" && (
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Primera Subasta
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedAuctions.map((auction) => (
                  <Link key={auction.id} href={`/dashboard/subastas/${auction.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer shadow-sm">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg line-clamp-2">{auction.title}</CardTitle>
                          <Badge className={getStatusColor(auction.status)}>{getStatusText(auction.status)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Precio actual</span>
                            <span className="font-semibold text-lg">
                              {formatCurrency(auction.currentBid || auction.amount, auction.currency)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-gray-500">
                              <Users className="w-4 h-4 mr-1" />
                              {auction.bidCount || 0} pujas
                            </div>
                            <div className="flex items-center text-gray-500">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatTimeRemaining(new Date(auction.expiresAt))}
                            </div>
                          </div>

                          {auction.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{auction.description}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-500">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
        
        <TabsContent value="escrows" className="space-y-6">
          {/* Escrows List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base md:text-lg font-semibold">Mis Escrows</CardTitle>
              <CardDescription>Gestiona tus depósitos en garantía para subastas</CardDescription>
            </CardHeader>
            <CardContent>
              {escrows.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tienes escrows aún</p>
                  <p className="text-sm text-muted-foreground">Crea tu primer escrow para comenzar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escrows.map((escrow) => (
                      <TableRow key={escrow.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{escrow.title}</p>
                            <p className="text-sm text-muted-foreground">{escrow.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrencyUtil(escrow.amount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getEscrowStatusIcon(escrow.status)}
                            {getEscrowStatusBadge(escrow.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(escrow.created_at).toLocaleDateString('es-HN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewEscrowDetails(escrow)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {escrow.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLockEscrow(escrow.id)}
                                disabled={processing}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                            {escrow.status === 'locked' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReleaseEscrow(escrow.id)}
                                  disabled={processing}
                                >
                                  <Unlock className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDisputeEscrow(escrow.id)}
                                  disabled={processing}
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {(escrow.status === 'pending' || escrow.status === 'locked') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelEscrow(escrow.id)}
                                disabled={processing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Escrow Details Dialog */}
      <Dialog open={isEscrowDetailsOpen} onOpenChange={setIsEscrowDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Escrow</DialogTitle>
            <DialogDescription>
              {selectedEscrow?.title} - {getEscrowStatusBadge(selectedEscrow?.status || '')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEscrow && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Detalles</TabsTrigger>
                <TabsTrigger value="events">Eventos</TabsTrigger>
                <TabsTrigger value="messages">Mensajes</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monto</Label>
                    <p className="text-lg font-semibold">{formatCurrencyUtil(selectedEscrow.amount)}</p>
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <div className="flex items-center space-x-2">
                      {getEscrowStatusIcon(selectedEscrow.status)}
                      {getEscrowStatusBadge(selectedEscrow.status)}
                    </div>
                  </div>
                  <div>
                    <Label>Fecha de Creación</Label>
                    <p>{new Date(selectedEscrow.created_at).toLocaleString('es-HN')}</p>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <p>Subasta</p>
                  </div>
                </div>
                
                {selectedEscrow.description && (
                  <div>
                    <Label>Descripción</Label>
                    <p className="text-sm">{selectedEscrow.description}</p>
                  </div>
                )}
                
                {selectedEscrow.terms && (
                  <div>
                    <Label>Términos y Condiciones</Label>
                    <p className="text-sm">{selectedEscrow.terms}</p>
                  </div>
                )}
                
                {selectedEscrow.expires_at && (
                  <div>
                    <Label>Expira</Label>
                    <p className="text-sm">{new Date(selectedEscrow.expires_at).toLocaleString('es-HN')}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="events" className="space-y-4">
                <div className="space-y-2">
                  {escrowEvents.map((event) => (
                    <div key={event.id} className="flex items-center space-x-3 p-3 border rounded">
                      <div className="flex-shrink-0">
                        {getEscrowStatusIcon(event.new_status || event.event_type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString('es-HN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="messages" className="space-y-4">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {escrowMessages.map((message) => (
                    <div key={message.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Usuario {message.sender_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString('es-HN')}
                        </p>
                      </div>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  ))}
                </div>
                
                <div className="flex space-x-2">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={messageForm.message}
                    onChange={(e) => setMessageForm({ message: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}