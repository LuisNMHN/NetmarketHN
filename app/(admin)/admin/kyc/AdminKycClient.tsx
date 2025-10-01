"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { type KycRequest, updateKycStatus, deleteKycDocument, deleteKycPersonalField } from "@/app/actions/admin"
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
  
  const [rejectionReason, setRejectionReason] = useState("")
  const [selectedRejectionTypes, setSelectedRejectionTypes] = useState<string[]>([])
  const [customRejectionReason, setCustomRejectionReason] = useState("")
  const [revertStep1, setRevertStep1] = useState(false)
  const [revertReason, setRevertReason] = useState("")
  
  const { toast } = useToast()

  // Motivos de rechazo realistas por secciones del KYC
  const rejectionReasons = [
    // Datos personales (Paso 1)
    { value: "personal_name_mismatch", label: "El nombre no coincide con el documento" },
    { value: "personal_birthdate_invalid", label: "Fecha de nacimiento inválida o no coincide" },
    { value: "personal_doc_number_format", label: "Número de documento con formato inválido" },
    { value: "personal_country_mismatch", label: "País declarado no coincide con el documento" },
    { value: "personal_incomplete", label: "Datos personales incompletos" },

    // Documento de identidad (Paso 2)
    { value: "doc_front_blurry", label: "Documento (frontal) borroso o ilegible" },
    { value: "doc_back_blurry", label: "Documento (reverso) borroso o ilegible" },
    { value: "doc_missing_back", label: "Falta el reverso del documento" },
    { value: "doc_expired", label: "Documento vencido" },
    { value: "doc_cropped", label: "Documento mal encuadrado o recortado" },
    { value: "doc_glare", label: "Reflejos o destellos impiden la lectura" },
    { value: "doc_mismatch_info", label: "Datos del documento no coinciden con los ingresados" },
    { value: "doc_manipulated", label: "Documento alterado o con signos de manipulación" },
    { value: "doc_type_wrong", label: "Tipo de documento incorrecto para el país" },
    { value: "doc_unreadable_mrz", label: "Zona MRZ o datos clave no legibles" },
    { value: "doc_unsupported_format", label: "Formato de archivo no soportado" },
    { value: "doc_file_quality", label: "Calidad o resolución del archivo insuficiente" },

    // Selfie (Paso 3)
    { value: "selfie_not_match_document", label: "El rostro de la selfie no coincide con el documento" },
    { value: "selfie_multiple_faces", label: "Se detectan múltiples rostros en la selfie" },
    { value: "selfie_low_light", label: "Iluminación insuficiente en la selfie" },
    { value: "selfie_occlusions", label: "Rostro cubierto (gafas oscuras, gorra, mascarilla)" },
    { value: "selfie_poor_quality", label: "Selfie borrosa o de baja calidad" },
    { value: "selfie_not_holding_doc_when_required", label: "No sostiene el documento cuando se requiere" },

    // Comprobante de domicilio (Paso 4)
    { value: "address_invalid_document", label: "Comprobante de domicilio inválido o no aceptado" },
    { value: "address_not_readable", label: "Comprobante de domicilio ilegible" },
    { value: "address_outdated", label: "Comprobante de domicilio con antigüedad mayor a 3 meses" },
    { value: "address_name_mismatch", label: "Nombre en el comprobante no coincide con el usuario" },
    { value: "address_address_mismatch", label: "Dirección no coincide con la proporcionada" },
    { value: "address_cropped_or_glare", label: "Comprobante mal encuadrado o con reflejos" },

    // Calidad general y fraude
    { value: "incomplete_submission", label: "Envío incompleto (faltan pasos o archivos)" },
    { value: "duplicate_submission", label: "Solicitud duplicada" },
    { value: "suspicious_activity", label: "Actividad sospechosa o intento de fraude" },
    { value: "watermark_or_editing", label: "Marcas de agua, filtros o edición excesiva" },

    // Otro
    { value: "other", label: "Otro motivo" },
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
    // Validar que se haya seleccionado al menos un motivo
    if (!selectedRejectionTypes.length) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un motivo para el rechazo",
        variant: "destructive",
      })
      return
    }

    // Si incluye "otro motivo", validar que se haya escrito una razón personalizada
    if (selectedRejectionTypes.includes("other") && !customRejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Debes proporcionar un motivo personalizado",
        variant: "destructive",
      })
      return
    }

    // Construir el motivo final (concatena múltiples selecciones)
    const labelsByValue = Object.fromEntries(rejectionReasons.map(r => [r.value, r.label])) as Record<string, string>
    const normalizedReasons = selectedRejectionTypes
      .map(v => v === "other" ? (customRejectionReason.trim() ? `Otro: ${customRejectionReason.trim()}` : "Otro") : (labelsByValue[v] || v))
    const finalReason = normalizedReasons.join("; ")


    // Luego rechazar la solicitud
    const result = await updateKycStatus(id, "rejected", finalReason)
    if (result.success) {
      toast({
        title: "KYC Rechazado",
        description: "La solicitud ha sido rechazada",
      })
      setIsRejectDialogOpen(false)
      setSelectedRejectionTypes([])
      setCustomRejectionReason("")
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
          
          onDeleteDocument={handleDeleteDocument}
          onDeletePersonalField={async (userId, field) => {
            try {
              const res = await fetch('/api/admin/delete-personal-field', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, field })
              })
              const data = await res.json()
              if (res.ok && data.ok) {
                toast({ title: 'Campo eliminado', description: 'El dato fue borrado correctamente.' })
                window.location.reload()
              } else {
                toast({ title: 'Error', description: data.error || 'No se pudo borrar el campo', variant: 'destructive' })
              }
            } catch (e:any) {
              toast({ title: 'Error de red', description: e?.message || 'No se pudo contactar al servidor', variant: 'destructive' })
            }
          }}
          />

      {/* Script de delegación eliminado; usamos handler React en el Drawer */}

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
            setSelectedRejectionTypes([])
            setCustomRejectionReason("")
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
              <Label className="text-sm font-medium">
                Motivos del rechazo (puedes seleccionar varios) *
              </Label>
              <div className="mt-2 grid grid-cols-1 gap-2 max-h-64 overflow-auto pr-1">
                {rejectionReasons.map((reason) => {
                  const checked = selectedRejectionTypes.includes(reason.value)
                  return (
                    <div key={reason.value} className="flex items-start space-x-2">
                      <Checkbox
                        id={`rej-${reason.value}`}
                        checked={checked}
                        onCheckedChange={(val) => {
                          const isChecked = Boolean(val)
                          setSelectedRejectionTypes((prev) => {
                            if (isChecked) return Array.from(new Set([...prev, reason.value]))
                            return prev.filter(v => v !== reason.value)
                          })
                        }}
                      />
                      <Label htmlFor={`rej-${reason.value}`} className="text-sm leading-snug cursor-pointer">
                        {reason.label}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedRejectionTypes.includes("other") && (
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

    </div>
  )
}
