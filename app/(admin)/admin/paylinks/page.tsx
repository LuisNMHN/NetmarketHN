"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, QrCode, Power, PowerOff } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { CurrencyBadge } from "../_components/CurrencyBadge"
import { CopyToClipboard } from "../_components/CopyToClipboard"
import { QrPreview } from "../_components/QrPreview"
import { ConfirmDialog } from "../_components/ConfirmDialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PayLinkForm } from "../_forms/PayLinkForm"
import { useToast } from "@/hooks/use-toast"

type PayLink = {
  id: string
  title: string
  amount: number
  currency: "HNL" | "USD"
  description?: string
  status: "active" | "inactive"
  usageCount: number
  usageLimit?: number
  expiresAt?: string
  url: string
  createdAt: string
}

// TODO: tablas sugeridas: pay_links, pay_charges (o payments)
// TODO: generar link público (slug/hash) y QR en backend
const mockPayLinks: PayLink[] = [
  {
    id: "PL-001",
    title: "Pago de Membresía Premium",
    amount: 500,
    currency: "HNL",
    description: "Membresía mensual premium",
    status: "active",
    usageCount: 45,
    usageLimit: 100,
    url: "https://nmhn.com/pay/abc123",
    createdAt: "2024-03-01T10:00:00Z",
  },
  {
    id: "PL-002",
    title: "Donación General",
    amount: 100,
    currency: "HNL",
    description: "Donación para la plataforma",
    status: "active",
    usageCount: 128,
    url: "https://nmhn.com/pay/xyz789",
    createdAt: "2024-02-15T14:30:00Z",
  },
  {
    id: "PL-003",
    title: "Pago de Producto Especial",
    amount: 50,
    currency: "USD",
    description: "Producto exclusivo",
    status: "inactive",
    usageCount: 12,
    usageLimit: 50,
    expiresAt: "2024-04-01T23:59:59Z",
    url: "https://nmhn.com/pay/def456",
    createdAt: "2024-03-10T09:00:00Z",
  },
]

export default function AdminPayLinksPage() {
  const [payLinks] = useState<PayLink[]>(mockPayLinks)
  const [selectedPayLink, setSelectedPayLink] = useState<PayLink | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
  const { toast } = useToast()

  const handleToggleStatus = (id: string, currentStatus: string) => {
    console.log("[v0] Toggling status for:", id)
    toast({
      title: currentStatus === "active" ? "Link Desactivado" : "Link Activado",
      description: "El estado del link ha sido actualizado",
    })
    // TODO: Implement toggle logic
  }

  const handleDelete = (id: string) => {
    console.log("[v0] Deleting pay link:", id)
    toast({
      title: "Link Eliminado",
      description: "El link de pago ha sido eliminado",
    })
    // TODO: Implement delete logic
  }

  const columns: Column<PayLink>[] = [
    {
      key: "id",
      label: "ID",
      sortable: true,
      render: (link) => <span className="font-mono text-xs">{link.id}</span>,
    },
    {
      key: "title",
      label: "Título",
      sortable: true,
      render: (link) => (
        <div>
          <p className="font-medium text-foreground">{link.title}</p>
          {link.description && <p className="text-sm text-muted-foreground line-clamp-1">{link.description}</p>}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Monto",
      sortable: true,
      render: (link) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">{link.amount.toLocaleString()}</span>
          <CurrencyBadge currency={link.currency} />
        </div>
      ),
    },
    {
      key: "status",
      label: "Estado",
      sortable: true,
      render: (link) => (
        <StatusBadge variant={link.status === "active" ? "success" : "neutral"}>
          {link.status === "active" ? "Activo" : "Inactivo"}
        </StatusBadge>
      ),
    },
    {
      key: "usageCount",
      label: "Usos",
      sortable: true,
      render: (link) => (
        <div className="text-sm">
          <span className="font-semibold">{link.usageCount}</span>
          {link.usageLimit && <span className="text-muted-foreground"> / {link.usageLimit}</span>}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Creado",
      sortable: true,
      render: (link) => (
        <div className="text-sm">
          <p>{new Date(link.createdAt).toLocaleDateString("es-HN")}</p>
          {link.expiresAt && (
            <p className="text-xs text-muted-foreground">
              Expira: {new Date(link.expiresAt).toLocaleDateString("es-HN")}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (link) => (
        <div className="flex items-center gap-1">
          <CopyToClipboard text={link.url} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedPayLink(link)
              setIsQrDialogOpen(true)
            }}
            title="Ver QR"
          >
            <QrCode className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleToggleStatus(link.id, link.status)}
            title={link.status === "active" ? "Desactivar" : "Activar"}
          >
            {link.status === "active" ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedPayLink(link)
              setIsEditDialogOpen(true)
            }}
          >
            <Edit className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedPayLink(link)
              setIsDeleteDialogOpen(true)
            }}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  const activeLinks = payLinks.filter((l) => l.status === "active")
  const inactiveLinks = payLinks.filter((l) => l.status === "inactive")
  const totalCharges = payLinks.reduce((sum, link) => sum + link.usageCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Links de Pago</h2>
          <p className="text-muted-foreground mt-2">Gestiona los links de pago de la plataforma</p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="size-4" />
          Nuevo Link de Pago
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payLinks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Links creados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLinks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Links disponibles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveLinks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Links deshabilitados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cobros (7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCharges}</div>
            <p className="text-xs text-muted-foreground mt-1">Transacciones totales</p>
          </CardContent>
        </Card>
      </div>

      {/* PayLinks table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Links de Pago</CardTitle>
          <CardDescription>Todos los links de pago registrados en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={payLinks}
            columns={columns}
            searchPlaceholder="Buscar links..."
            emptyMessage="No se encontraron links de pago"
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Link de Pago</DialogTitle>
            <DialogDescription>Completa los datos para crear un nuevo link de pago</DialogDescription>
          </DialogHeader>
          <PayLinkForm
            onSubmit={(data) => {
              console.log("[v0] Creating pay link:", data)
              setIsCreateDialogOpen(false)
              toast({
                title: "Link Creado",
                description: "El link de pago ha sido creado exitosamente",
              })
              // TODO: Implement create logic
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Link de Pago</DialogTitle>
            <DialogDescription>Modifica los datos del link de pago seleccionado</DialogDescription>
          </DialogHeader>
          <PayLinkForm
            initialData={selectedPayLink || undefined}
            onSubmit={(data) => {
              console.log("[v0] Updating pay link:", data)
              setIsEditDialogOpen(false)
              toast({
                title: "Link Actualizado",
                description: "El link de pago ha sido actualizado exitosamente",
              })
              // TODO: Implement update logic
            }}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (selectedPayLink) handleDelete(selectedPayLink.id)
          setIsDeleteDialogOpen(false)
        }}
        title="Eliminar Link de Pago"
        description={`¿Estás seguro de que deseas eliminar el link "${selectedPayLink?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="destructive"
      />

      {/* QR Preview */}
      {selectedPayLink && (
        <QrPreview
          open={isQrDialogOpen}
          onOpenChange={setIsQrDialogOpen}
          url={selectedPayLink.url}
          title={`QR - ${selectedPayLink.title}`}
        />
      )}
    </div>
  )
}
