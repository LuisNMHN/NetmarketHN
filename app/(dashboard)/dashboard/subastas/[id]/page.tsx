"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Clock, DollarSign, Users, Edit, X, Gavel, User } from "lucide-react"
import Link from "next/link"
import type { AuctionDTO, AuctionStatus, Currency, BidDTO } from "@/lib/contracts/types"
import { onLoadAuction, onEditAuction, onCloseAuction, onBidAuction, onLoadBids } from "@/lib/contracts/events"

export default function AuctionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const auctionId = params.id as string

  const [auction, setAuction] = useState<AuctionDTO | null>(null)
  const [bids, setBids] = useState<BidDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isBidModalOpen, setIsBidModalOpen] = useState(false)
  const [bidAmount, setBidAmount] = useState("")

  // Edit form state
  const [editData, setEditData] = useState({
    title: "",
    amount: "",
    currency: "USD" as Currency,
    expiresAt: "",
    description: "",
  })

  useEffect(() => {
    if (auctionId) {
      loadAuctionData()
    }
  }, [auctionId])

  const loadAuctionData = async () => {
    try {
      setLoading(true)
      const [auctionData, bidsData] = await Promise.all([onLoadAuction(auctionId), onLoadBids(auctionId)])

      setAuction(auctionData)
      setBids(bidsData)

      // Initialize edit form
      setEditData({
        title: auctionData.title,
        amount: auctionData.amount.toString(),
        currency: auctionData.currency,
        expiresAt: new Date(auctionData.expiresAt).toISOString().slice(0, 16),
        description: auctionData.description || "",
      })
    } catch (error) {
      toast.error("Error al cargar la subasta")
      router.push("/dashboard/subastas")
    } finally {
      setLoading(false)
    }
  }

  const handleEditAuction = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!auction) return

    // Validations
    if (!editData.title.trim()) {
      toast.error("El título es requerido")
      return
    }

    const amount = Number.parseFloat(editData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("El monto debe ser mayor a 0")
      return
    }

    const expiresAt = new Date(editData.expiresAt)
    if (expiresAt <= new Date()) {
      toast.error("La fecha de expiración debe ser futura")
      return
    }

    try {
      const updatedAuction = await onEditAuction(auction.id, {
        title: editData.title,
        amount,
        currency: editData.currency,
        expiresAt,
        description: editData.description,
      })

      setAuction(updatedAuction)
      setIsEditModalOpen(false)
      toast.success("Subasta actualizada exitosamente")
    } catch (error) {
      toast.error("Error al actualizar la subasta")
    }
  }

  const handleCloseAuction = async () => {
    if (!auction) return

    try {
      const closedAuction = await onCloseAuction(auction.id)
      setAuction(closedAuction)
      toast.success("Subasta cerrada exitosamente")
    } catch (error) {
      toast.error("Error al cerrar la subasta")
    }
  }

  const handleBidAuction = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!auction) return

    const amount = Number.parseFloat(bidAmount)
    const minBid = (auction.currentBid || auction.amount) + 1

    if (isNaN(amount) || amount < minBid) {
      toast.error(`La puja debe ser mayor a ${formatCurrency(minBid - 1, auction.currency)}`)
      return
    }

    try {
      const newBid = await onBidAuction(auction.id, amount)
      setBids((prev) => [newBid, ...prev])
      setAuction((prev) => (prev ? { ...prev, currentBid: amount, bidCount: (prev.bidCount || 0) + 1 } : null))
      setIsBidModalOpen(false)
      setBidAmount("")
      toast.success("Puja realizada exitosamente")
    } catch (error) {
      toast.error("Error al realizar la puja")
    }
  }

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
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"
    return `${symbol}${amount.toLocaleString()}`
  }

  const formatTimeRemaining = (expiresAt: Date) => {
    const now = new Date()
    const diff = expiresAt.getTime() - now.getTime()

    if (diff <= 0) return "Expirada"

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Subasta no encontrada</h2>
        <p className="text-gray-500 mb-4">La subasta que buscas no existe o ha sido eliminada</p>
        <Link href="/dashboard/subastas">
          <Button>Volver a Subastas</Button>
        </Link>
      </div>
    )
  }

  const canEdit = auction.status === "active"
  const canClose = auction.status === "active"
  const canBid = auction.status === "active"
  const minBidAmount = (auction.currentBid || auction.amount) + 1

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/subastas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-2xl font-bold truncate">{auction.title}</h1>
        <Badge className={getStatusColor(auction.status)}>{getStatusText(auction.status)}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Auction Info */}
          <Card className="bg-card border border-border rounded-2xl">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center justify-between">
                <span>Información de la Subasta</span>
                {canEdit && (
                  <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Editar Subasta</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleEditAuction} className="space-y-4">
                        <div>
                          <Label htmlFor="edit-title">Título</Label>
                          <Input
                            id="edit-title"
                            value={editData.title}
                            onChange={(e) => setEditData((prev) => ({ ...prev, title: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-amount">Monto inicial</Label>
                            <Input
                              id="edit-amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={editData.amount}
                              onChange={(e) => setEditData((prev) => ({ ...prev, amount: e.target.value }))}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-currency">Moneda</Label>
                            <Select
                              value={editData.currency}
                              onValueChange={(value: Currency) => setEditData((prev) => ({ ...prev, currency: value }))}
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
                          <Label htmlFor="edit-expiresAt">Fecha de expiración</Label>
                          <Input
                            id="edit-expiresAt"
                            type="datetime-local"
                            value={editData.expiresAt}
                            onChange={(e) => setEditData((prev) => ({ ...prev, expiresAt: e.target.value }))}
                            min={new Date().toISOString().slice(0, 16)}
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="edit-description">Descripción</Label>
                          <Textarea
                            id="edit-description"
                            value={editData.description}
                            onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                            rows={3}
                          />
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditModalOpen(false)}
                            className="flex-1"
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" className="flex-1">
                            Guardar Cambios
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Precio inicial</span>
                    <p className="font-semibold">{formatCurrency(auction.amount, auction.currency)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Precio actual</span>
                    <p className="font-semibold text-lg text-green-600">
                      {formatCurrency(auction.currentBid || auction.amount, auction.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Pujas</span>
                    <p className="font-semibold">{auction.bidCount || 0}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Tiempo restante</span>
                    <p className="font-semibold">{formatTimeRemaining(new Date(auction.expiresAt))}</p>
                  </div>
                </div>

                {auction.description && (
                  <div>
                    <span className="text-sm text-gray-500">Descripción</span>
                    <p className="mt-1">{auction.description}</p>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Creada el {new Date(auction.createdAt).toLocaleDateString()} a las{" "}
                  {new Date(auction.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bid History */}
          <Card className="bg-card border border-border rounded-2xl">
            <CardHeader className="p-4 md:p-6">
              <CardTitle>Historial de Pujas</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              {bids.length === 0 ? (
                <div className="text-center py-8">
                  <Gavel className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Aún no hay pujas en esta subasta</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bids.map((bid, index) => (
                    <div key={bid.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">Usuario #{bid.userId.slice(-4)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(bid.createdAt).toLocaleDateString()} -{" "}
                            {new Date(bid.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatCurrency(bid.amount, auction.currency)}</p>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Puja más alta
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Price */}
          <Card className="bg-card border border-border rounded-2xl">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Precio Actual
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600 mb-2">
                  {formatCurrency(auction.currentBid || auction.amount, auction.currency)}
                </p>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {auction.bidCount || 0} pujas
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTimeRemaining(new Date(auction.expiresAt))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="bg-card border border-border rounded-2xl">
            <CardHeader className="p-4 md:p-6">
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0 space-y-3">
              {canBid && (
                <Dialog open={isBidModalOpen} onOpenChange={setIsBidModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Gavel className="w-4 h-4 mr-2" />
                      Pujar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Realizar Puja</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleBidAuction} className="space-y-4">
                      <div>
                        <Label htmlFor="bid-amount">Monto de la puja</Label>
                        <Input
                          id="bid-amount"
                          type="number"
                          step="0.01"
                          min={minBidAmount}
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder={`Mínimo: ${formatCurrency(minBidAmount, auction.currency)}`}
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Puja mínima: {formatCurrency(minBidAmount, auction.currency)}
                        </p>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsBidModalOpen(false)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1">
                          Confirmar Puja
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}

              {canClose && (
                <Button variant="destructive" onClick={handleCloseAuction} className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Cerrar Subasta
                </Button>
              )}

              {!canBid && !canClose && (
                <p className="text-sm text-gray-500 text-center py-4">Esta subasta ya no está activa</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
