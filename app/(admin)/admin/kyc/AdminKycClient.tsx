"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { KycDetailDrawer } from "../_components/KycDetailDrawer"
import { ConfirmDialog } from "../_components/ConfirmDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { type KycRequest, updateKycStatus, deleteKycDocument, revertKycStep } from "@/app/actions/admin"
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
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false)
  const [isStepRevertDialogOpen, setIsStepRevertDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [selectedRejectionType, setSelectedRejectionType] = useState("")
  const [customRejectionReason, setCustomRejectionReason] = useState("")
  const [revertStep1, setRevertStep1] = useState(false)
  const [revertReason, setRevertReason] = useState("")
  const [stepRevertReason, setStepRevertReason] = useState("")
  const [selectedStep, setSelectedStep] = useState<1 | null>(null)
  const { toast } = useToast()

  // Motivos comunes de rechazo
  const rejectionReasons = [
    { value: "documents_blurry", label: "Documentos borrosos o ilegibles" },
    { value: "incorrect_info", label: "Información personal incorrecta" },
    { value: "document_mismatch", label: "Documento no coincide con la información" },
    { value: "poor_quality_selfie", label: "Selfie de mala calidad o no corresponde" },
    { value: "invalid_address_proof", label: "Comprobante de domicilio inválido" },
    { value: "expired_document", label: "Documento vencido" },
    { value: "incomplete_documents", label: "Documentos incompletos" },
    { value: "suspicious_activity", label: "Actividad sospechosa detectada" },
    { value: "duplicate_submission", label: "Solicitud duplicada" },
    { value: "other", label: "Otro motivo" }
  ]

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
    // Validar que se haya seleccionado un motivo
    if (!selectedRejectionType) {
      toast({
        title: "Error",
        description: "Debes seleccionar un motivo para el rechazo",
        variant: "destructive",
      })
      return
    }

    // Si es "otro motivo", validar que se haya escrito una razón personalizada
    if (selectedRejectionType === "other" && !customRejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Debes proporcionar un motivo personalizado",
        variant: "destructive",
      })
      return
    }

    // Construir el motivo final
    const finalReason = selectedRejectionType === "other" 
      ? customRejectionReason 
      : rejectionReasons.find(r => r.value === selectedRejectionType)?.label || selectedRejectionType

    // Si se seleccionó revertir paso 1, hacer ambas acciones
    if (revertStep1) {
      // Primero revertir el paso 1
      const revertResult = await revertKycStep(id, 1, `Rechazo: ${finalReason}`)
      if (!revertResult.success) {
        toast({
          title: "Error",
          description: "No se pudo revertir el paso 1",
          variant: "destructive",
        })
        return
      }
    }

    // Luego rechazar la solicitud
    const result = await updateKycStatus(id, "rejected", finalReason)
    if (result.success) {
      toast({
        title: "KYC Rechazado",
        description: revertStep1 
          ? "La solicitud ha sido rechazada y el paso 1 revertido" 
          : "La solicitud ha sido rechazada",
      })
      setIsRejectDialogOpen(false)
      setSelectedRejectionType("")
      setCustomRejectionReason("")
      setRevertStep1(false)
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

  const handleRevert = async (id: string) => {
    if (!revertReason.trim()) {
      toast({
        title: "Error",
        description: "Debes proporcionar un motivo para la reversión",
        variant: "destructive",
      })
      return
    }

    const result = await updateKycStatus(id, "pending", revertReason)
    if (result.success) {
      toast({
        title: "KYC Revertido",
        description: "La solicitud ha sido revertida a pendiente",
      })
      setIsRevertDialogOpen(false)
      setRevertReason("")
      // Recargar la página para obtener los datos actualizados
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo revertir la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleDeleteDocument = async (userId: string, documentType: string) => {
    const result = await deleteKycDocument(userId, documentType as any)
    if (result.success) {
      toast({
        title: "Documento Eliminado",
        description: "El documento ha sido eliminado exitosamente",
      })
      // Recargar la página para obtener los datos actualizados
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo eliminar el documento",
        variant: "destructive",
      })
    }
  }

  const handleRevertStep = async (userId: string, step: 1) => {
    if (!stepRevertReason.trim()) {
      toast({
        title: "Error",
        description: "Debes proporcionar un motivo para revertir el paso",
        variant: "destructive",
      })
      return
    }

    const result = await revertKycStep(userId, step, stepRevertReason)
    if (result.success) {
      toast({
        title: "Paso Revertido",
        description: `El paso ${step} ha sido revertido exitosamente`,
      })
      setIsStepRevertDialogOpen(false)
      setStepRevertReason("")
      setSelectedStep(null)
      // Recargar la página para obtener los datos actualizados
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo revertir el paso",
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
        onRevert={(id) => {
          setIsDrawerOpen(false)
          setIsRevertDialogOpen(true)
        }}
        onRevertStep={(id, step) => {
          setSelectedRequest(requests.find(r => r.id === id) || null)
          setSelectedStep(step)
          setIsStepRevertDialogOpen(true)
        }}
        onDeleteDocument={handleDeleteDocument}
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
      <AlertDialog 
        open={isRejectDialogOpen} 
        onOpenChange={(open) => {
          setIsRejectDialogOpen(open)
          if (!open) {
            setSelectedRejectionType("")
            setCustomRejectionReason("")
            setRevertStep1(false)
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Verificación KYC</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas rechazar la verificación de {selectedRequest?.user_name || selectedRequest?.user_email}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="rejection-type" className="text-sm font-medium">
                Motivo del rechazo *
              </Label>
              <Select value={selectedRejectionType} onValueChange={setSelectedRejectionType}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecciona un motivo de rechazo" />
                </SelectTrigger>
                <SelectContent>
                  {rejectionReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRejectionType === "other" && (
              <div>
                <Label htmlFor="custom-rejection-reason" className="text-sm font-medium">
                  Motivo personalizado *
                </Label>
                <Textarea
                  id="custom-rejection-reason"
                  placeholder="Describe el motivo específico del rechazo"
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  className="mt-2 min-h-[80px]"
                  required
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="revert-step1" 
                checked={revertStep1}
                onCheckedChange={(checked) => setRevertStep1(checked as boolean)}
              />
              <Label htmlFor="revert-step1" className="text-sm font-medium">
                Revertir Paso 1 - Datos Personales
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Si marcas esta opción, el usuario podrá corregir sus datos personales además del rechazo
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedRequest) handleReject(selectedRequest.id)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert Confirmation */}
      <AlertDialog 
        open={isRevertDialogOpen} 
        onOpenChange={(open) => {
          setIsRevertDialogOpen(open)
          if (!open) setRevertReason("")
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Revertir Verificación KYC</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas revertir la verificación de {selectedRequest?.user_name || selectedRequest?.user_email} a estado pendiente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="revert-reason" className="text-sm font-medium">
                Motivo de la reversión *
              </Label>
              <Textarea
                id="revert-reason"
                placeholder="Describe el motivo específico de la reversión (ej: Información incompleta, documentos inconsistentes, etc.)"
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                className="mt-2 min-h-[100px]"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este motivo será visible para el usuario y explicará por qué debe completar nuevamente su verificación
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedRequest) handleRevert(selectedRequest.id)
              }}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              Revertir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step Revert Confirmation */}
      <AlertDialog 
        open={isStepRevertDialogOpen} 
        onOpenChange={(open) => {
          setIsStepRevertDialogOpen(open)
          if (!open) {
            setStepRevertReason("")
            setSelectedStep(null)
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Revertir Paso {selectedStep}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas revertir el paso {selectedStep} para {selectedRequest?.user_name || selectedRequest?.user_email}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="step-revert-reason" className="text-sm font-medium">
                Motivo de la reversión del paso *
              </Label>
              <Textarea
                id="step-revert-reason"
                placeholder="Describe el motivo específico de la reversión (ej: Información incorrecta, datos inconsistentes, etc.)"
                value={stepRevertReason}
                onChange={(e) => setStepRevertReason(e.target.value)}
                className="mt-2 min-h-[100px]"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este motivo será visible para el usuario y explicará por qué debe corregir este paso específico
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedRequest && selectedStep) {
                  handleRevertStep(selectedRequest.id, selectedStep)
                }
              }}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Revertir Paso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
