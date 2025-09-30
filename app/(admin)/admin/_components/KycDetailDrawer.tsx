"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "./StatusBadge"
import { Check, X, FileText, ImageIcon } from "lucide-react"

interface KycDocument {
  id: string
  type: string
  url: string
  uploadedAt: string
}

interface KycData {
  id: string
  userId: string
  userName: string
  userEmail: string
  documentType: string
  documentNumber: string
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  reviewedAt?: string
  reviewedBy?: string
  notes?: string
  documents: KycDocument[]
}

interface KycDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: KycData | null
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export function KycDetailDrawer({ open, onOpenChange, data, onApprove, onReject }: KycDetailDrawerProps) {
  if (!data) return null

  const getStatusVariant = (status: KycData["status"]) => {
    switch (status) {
      case "approved":
        return "success"
      case "rejected":
        return "danger"
      default:
        return "warning"
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Revisión KYC</SheetTitle>
          <SheetDescription>Detalles de la solicitud de verificación</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Estado</span>
            <StatusBadge variant={getStatusVariant(data.status)}>
              {data.status === "pending" && "Pendiente"}
              {data.status === "approved" && "Aprobado"}
              {data.status === "rejected" && "Rechazado"}
            </StatusBadge>
          </div>

          {/* User info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Información del Usuario</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre:</span>
                <span className="font-medium">{data.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{data.userEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID Usuario:</span>
                <span className="font-mono text-xs">{data.userId}</span>
              </div>
            </div>
          </div>

          {/* Document info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Información del Documento</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">{data.documentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Número:</span>
                <span className="font-medium">{data.documentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enviado:</span>
                <span className="font-medium">{new Date(data.submittedAt).toLocaleDateString("es-HN")}</span>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Documentos Adjuntos</h3>
            <div className="space-y-2">
              {data.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <div className="flex size-10 items-center justify-center rounded bg-muted">
                    {doc.type.includes("image") ? (
                      <ImageIcon className="size-5 text-muted-foreground" />
                    ) : (
                      <FileText className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploadedAt).toLocaleDateString("es-HN")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      Ver
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Review info */}
          {data.reviewedAt && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Información de Revisión</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revisado por:</span>
                  <span className="font-medium">{data.reviewedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="font-medium">{new Date(data.reviewedAt).toLocaleDateString("es-HN")}</span>
                </div>
                {data.notes && (
                  <div className="pt-2">
                    <span className="text-muted-foreground">Notas:</span>
                    <p className="mt-1 text-sm">{data.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {data.status === "pending" && (
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 gap-2 bg-transparent"
                onClick={() => {
                  onReject?.(data.id)
                  onOpenChange(false)
                }}
              >
                <X className="size-4" />
                Rechazar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => {
                  onApprove?.(data.id)
                  onOpenChange(false)
                }}
              >
                <Check className="size-4" />
                Aprobar
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
