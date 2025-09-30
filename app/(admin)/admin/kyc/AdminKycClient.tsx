"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { KycDetailDrawer } from "../_components/KycDetailDrawer"
import { ConfirmDialog } from "../_components/ConfirmDialog"
import { type KycRequest, updateKycStatus } from "@/app/actions/admin"
import { useToast } from "@/hooks/use-toast"

interface AdminKycClientProps {
  initialRequests: KycRequest[]
}

export default function AdminKycClient({ initialRequests }: AdminKycClientProps) {
  const [requests, setRequests] = useState<KycRequest[]>(initialRequests)
  const [selectedRequest, setSelectedRequest] = useState<KycRequest | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const { toast } = useToast()

  const handleApprove = async (id: string) => {
    const result = await updateKycStatus(id, "approved")
    if (result.success) {
      toast({
        title: "KYC Aprobado",
        description: "La solicitud ha sido aprobada exitosamente",
      })
      setIsApproveDialogOpen(false)
      // Recargar la página para obtener los datos actualizados
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo aprobar la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (id: string) => {
    const result = await updateKycStatus(id, "rejected")
    if (result.success) {
      toast({
        title: "KYC Rechazado",
        description: "La solicitud ha sido rechazada",
      })
      setIsRejectDialogOpen(false)
      // Recargar la página para obtener los datos actualizados
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo rechazar la solicitud",
        variant: "destructive",
      })
    }
  }

  const columns: Column<KycRequest>[] = [
    {
      key: "user_name",
      label: "Usuario",
      sortable: true,
      render: (req) => (
        <div>
          <p className="font-medium text-foreground">{req.user_name || "Sin nombre"}</p>
          <p className="text-sm text-muted-foreground">{req.user_email}</p>
        </div>
      ),
    },
    {
      key: "document_type",
      label: "Documento",
      sortable: true,
      render: (req) => (
        <div>
          <p className="text-sm text-foreground">{req.document_type}</p>
          <p className="text-xs text-muted-foreground font-mono">{req.document_number}</p>
        </div>
      ),
    },
    {
      key: "submitted_at",
      label: "Enviado el",
      sortable: true,
      render: (req) => new Date(req.submitted_at).toLocaleDateString("es-HN"),
    },
    {
      key: "status",
      label: "Estado",
      sortable: true,
      render: (req) => {
        const variant = req.status === "approved" ? "success" : req.status === "rejected" ? "danger" : "warning"
        return (
          <StatusBadge variant={variant}>
            {req.status === "pending" && "Pendiente"}
            {req.status === "approved" && "Aprobado"}
            {req.status === "rejected" && "Rechazado"}
          </StatusBadge>
        )
      },
    },
    {
      key: "actions",
      label: "Acciones",
      render: (req) => (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          onClick={() => {
            setSelectedRequest(req)
            setIsDrawerOpen(true)
          }}
        >
          <Eye className="size-4" />
          Revisar
        </Button>
      ),
    },
  ]

  const pendingRequests = requests.filter((r) => r.status === "pending")
  const approvedRequests = requests.filter((r) => r.status === "approved")
  const rejectedRequests = requests.filter((r) => r.status === "rejected")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Revisión KYC</h2>
        <p className="text-muted-foreground mt-2">Gestiona las solicitudes de verificación de identidad</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Requieren revisión</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Aprobados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Verificaciones completadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rechazados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Solicitudes denegadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes KYC</CardTitle>
          <CardDescription>Revisa y gestiona las solicitudes de verificación</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending">Pendientes ({pendingRequests.length})</TabsTrigger>
              <TabsTrigger value="approved">Aprobados ({approvedRequests.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rechazados ({rejectedRequests.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              <DataTable
                data={pendingRequests}
                columns={columns}
                searchPlaceholder="Buscar solicitudes..."
                emptyMessage="No hay solicitudes pendientes"
              />
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              <DataTable
                data={approvedRequests}
                columns={columns}
                searchPlaceholder="Buscar solicitudes..."
                emptyMessage="No hay solicitudes aprobadas"
              />
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              <DataTable
                data={rejectedRequests}
                columns={columns}
                searchPlaceholder="Buscar solicitudes..."
                emptyMessage="No hay solicitudes rechazadas"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* KYC Detail Drawer */}
      <KycDetailDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        data={selectedRequest}
        onApprove={(id) => {
          setIsDrawerOpen(false)
          setIsApproveDialogOpen(true)
        }}
        onReject={(id) => {
          setIsDrawerOpen(false)
          setIsRejectDialogOpen(true)
        }}
      />

      {/* Approve Confirmation */}
      <ConfirmDialog
        open={isApproveDialogOpen}
        onOpenChange={setIsApproveDialogOpen}
        onConfirm={() => {
          if (selectedRequest) handleApprove(selectedRequest.id)
        }}
        title="Aprobar Verificación KYC"
        description={`¿Estás seguro de que deseas aprobar la verificación de ${selectedRequest?.user_name || selectedRequest?.user_email}?`}
        confirmText="Aprobar"
      />

      {/* Reject Confirmation */}
      <ConfirmDialog
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
        onConfirm={() => {
          if (selectedRequest) handleReject(selectedRequest.id)
        }}
        title="Rechazar Verificación KYC"
        description={`¿Estás seguro de que deseas rechazar la verificación de ${selectedRequest?.user_name || selectedRequest?.user_email}?`}
        confirmText="Rechazar"
        variant="destructive"
      />
    </div>
  )
}
