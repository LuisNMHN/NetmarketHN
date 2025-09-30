"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Eye } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AuctionForm } from "../_forms/AuctionForm"

type Auction = {
  id: string
  title: string
  description: string
  basePrice: number
  currentBid?: number
  status: "upcoming" | "active" | "ended"
  startDate: string
  endDate: string
  bidsCount: number
  createdAt: string
}

// TODO: realtime para pujas y cierre programado
const mockAuctions: Auction[] = [
  {
    id: "AUC-001",
    title: "iPhone 15 Pro Max",
    description: "Nuevo en caja, 256GB",
    basePrice: 25000,
    currentBid: 28500,
    status: "active",
    startDate: "2024-03-20T08:00:00Z",
    endDate: "2024-03-25T20:00:00Z",
    bidsCount: 12,
    createdAt: "2024-03-15T10:00:00Z",
  },
  {
    id: "AUC-002",
    title: "MacBook Pro M3",
    description: "16GB RAM, 512GB SSD",
    basePrice: 45000,
    status: "upcoming",
    startDate: "2024-03-26T08:00:00Z",
    endDate: "2024-03-30T20:00:00Z",
    bidsCount: 0,
    createdAt: "2024-03-18T14:00:00Z",
  },
  {
    id: "AUC-003",
    title: "PlayStation 5",
    description: "Edición estándar con 2 controles",
    basePrice: 15000,
    currentBid: 18200,
    status: "ended",
    startDate: "2024-03-10T08:00:00Z",
    endDate: "2024-03-15T20:00:00Z",
    bidsCount: 24,
    createdAt: "2024-03-05T10:00:00Z",
  },
]

export default function AdminAuctionsPage() {
  const [auctions] = useState<Auction[]>(mockAuctions)
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const columns: Column<Auction>[] = [
    {
      key: "title",
      label: "Título",
      sortable: true,
      render: (auction) => (
        <div>
          <p className="font-medium text-foreground">{auction.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-1">{auction.description}</p>
        </div>
      ),
    },
    {
      key: "basePrice",
      label: "Precio Base",
      sortable: true,
      render: (auction) => <span className="font-mono">L {auction.basePrice.toLocaleString()}</span>,
    },
    {
      key: "currentBid",
      label: "Puja Actual",
      sortable: true,
      render: (auction) =>
        auction.currentBid ? (
          <span className="font-mono font-semibold text-primary">L {auction.currentBid.toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">Sin pujas</span>
        ),
    },
    {
      key: "status",
      label: "Estado",
      sortable: true,
      render: (auction) => {
        const variant = auction.status === "active" ? "success" : auction.status === "upcoming" ? "info" : "neutral"
        return (
          <StatusBadge variant={variant}>
            {auction.status === "upcoming" && "Próxima"}
            {auction.status === "active" && "Activa"}
            {auction.status === "ended" && "Finalizada"}
          </StatusBadge>
        )
      },
    },
    {
      key: "dates",
      label: "Fechas",
      render: (auction) => (
        <div className="text-sm">
          <p className="text-muted-foreground">Inicio: {new Date(auction.startDate).toLocaleDateString("es-HN")}</p>
          <p className="text-muted-foreground">Fin: {new Date(auction.endDate).toLocaleDateString("es-HN")}</p>
        </div>
      ),
    },
    {
      key: "bidsCount",
      label: "Pujas",
      sortable: true,
      render: (auction) => <span className="font-semibold">{auction.bidsCount}</span>,
    },
    {
      key: "actions",
      label: "Acciones",
      render: (auction) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" title="Ver detalles">
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedAuction(auction)
              setIsEditDialogOpen(true)
            }}
          >
            <Edit className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  const activeAuctions = auctions.filter((a) => a.status === "active")
  const upcomingAuctions = auctions.filter((a) => a.status === "upcoming")
  const endedAuctions = auctions.filter((a) => a.status === "ended")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Subastas</h2>
          <p className="text-muted-foreground mt-2">Administra las subastas de la plataforma</p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="size-4" />
          Nueva Subasta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Subastas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auctions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">En la plataforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAuctions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">En curso ahora</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Próximas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAuctions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Por iniciar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Finalizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{endedAuctions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Completadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Auctions table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Subastas</CardTitle>
          <CardDescription>Todas las subastas registradas en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={auctions}
            columns={columns}
            searchPlaceholder="Buscar subastas..."
            emptyMessage="No se encontraron subastas"
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Subasta</DialogTitle>
            <DialogDescription>Completa los datos para crear una nueva subasta</DialogDescription>
          </DialogHeader>
          <AuctionForm
            onSubmit={(data) => {
              console.log("[v0] Creating auction:", data)
              setIsCreateDialogOpen(false)
              // TODO: Implement create logic
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Subasta</DialogTitle>
            <DialogDescription>Modifica los datos de la subasta seleccionada</DialogDescription>
          </DialogHeader>
          <AuctionForm
            initialData={selectedAuction || undefined}
            onSubmit={(data) => {
              console.log("[v0] Updating auction:", data)
              setIsEditDialogOpen(false)
              // TODO: Implement update logic
            }}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
