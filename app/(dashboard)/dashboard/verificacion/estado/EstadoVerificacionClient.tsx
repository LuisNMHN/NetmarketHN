"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  X
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface KycData {
  fullName: string
  birthDate: string
  country: string
  docType: string
  docNumber: string
  status: string
  documentFrontPath?: string | null
  documentBackPath?: string | null
  selfiePath?: string | null
  addressProofPath?: string | null
  department?: string | null
  municipality?: string | null
  neighborhood?: string | null
  addressDesc?: string | null
  admin_notes?: string | null
}

interface EstadoVerificacionClientProps {
  kycData: KycData
}

export default function EstadoVerificacionClient({ kycData }: EstadoVerificacionClientProps) {
  const [currentData, setCurrentData] = useState<KycData>(kycData)
  const router = useRouter()

  const getStatusInfo = () => {
    switch (currentData.status) {
      case "approved":
        return {
          icon: CheckCircle,
          title: "Verificación Aprobada",
          description: "Tu verificación ha sido aprobada exitosamente",
          variant: "success" as const,
          color: "text-green-600",
          bgColor: "bg-green-50 dark:bg-green-950/20",
          borderColor: "border-green-200 dark:border-green-800/30"
        }
      case "rejected":
        return {
          icon: XCircle,
          title: "Verificación Rechazada",
          description: "Tu verificación ha sido rechazada",
          variant: "destructive" as const,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/20"
        }
      case "review":
        return {
          icon: Clock,
          title: "En Revisión",
          description: "Tu verificación está siendo revisada",
          variant: "default" as const,
          color: "text-blue-600",
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          borderColor: "border-blue-200 dark:border-blue-800/30"
        }
      case "draft":
        return {
          icon: FileText,
          title: "Borrador",
          description: "Tu verificación está en progreso",
          variant: "secondary" as const,
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          borderColor: "border-border"
        }
      default:
        return {
          icon: Shield,
          title: "Sin Verificación",
          description: "No has iniciado el proceso de verificación",
          variant: "outline" as const,
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          borderColor: "border-border"
        }
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className="space-y-6">

      {/* Estado Principal */}
      <Card className={`${statusInfo.bgColor} ${statusInfo.borderColor} border-2`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${statusInfo.bgColor}`}>
              <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
            </div>
            <div>
              <CardTitle className={statusInfo.color}>{statusInfo.title}</CardTitle>
              <CardDescription>{statusInfo.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={statusInfo.variant}>
                {currentData.status === "approved" && "Aprobado"}
                {currentData.status === "rejected" && "Rechazado"}
                {currentData.status === "review" && "En Revisión"}
                {currentData.status === "draft" && "Borrador"}
                {!["approved", "rejected", "review", "draft"].includes(currentData.status) && "Sin Estado"}
              </Badge>
            </div>

            {/* Información del rechazo */}
            {currentData.status === "rejected" && currentData.admin_notes && (
              <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-destructive">Detalles:</h4>
                        <p className="font-medium text-foreground mt-1">{currentData.admin_notes}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Por favor, revisa los comentarios y vuelve a enviar tu solicitud con las correcciones necesarias.
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => router.back()}
                        className="ml-2 h-8 w-8 p-0 hover:bg-destructive/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Información de aprobación */}
            {currentData.status === "approved" && (
              <div className="p-4 border border-green-200 dark:border-green-800/30 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-green-800 dark:text-green-200">¡Felicidades!</h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Tu verificación ha sido aprobada. Ahora puedes acceder a todos los servicios de la plataforma.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Información de revisión */}
            {currentData.status === "review" && (
              <div className="p-4 border border-blue-200 dark:border-blue-800/30 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200">En Proceso</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Tu verificación está siendo revisada por nuestro equipo. Te notificaremos cuando esté lista.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información del Documento */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Documento</CardTitle>
          <CardDescription>Detalles de tu documento de identidad</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre Completo</label>
              <p className="text-sm font-medium">{currentData.fullName || "No especificado"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tipo de Documento</label>
              <p className="text-sm font-medium">{currentData.docType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Número de Documento</label>
              <p className="text-sm font-mono">{currentData.docNumber || "No especificado"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">País</label>
              <p className="text-sm font-medium">{currentData.country || "No especificado"}</p>
            </div>
            {currentData.birthDate && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Fecha de Nacimiento</label>
                <p className="text-sm font-medium">
                  {new Date(currentData.birthDate).toLocaleDateString("es-HN")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información de Dirección */}
      {(currentData.department || currentData.municipality || currentData.neighborhood || currentData.addressDesc) && (
        <Card>
          <CardHeader>
            <CardTitle>Información de Dirección</CardTitle>
            <CardDescription>Detalles de tu dirección de residencia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {currentData.department && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Departamento</label>
                  <p className="text-sm font-medium">{currentData.department}</p>
                </div>
              )}
              {currentData.municipality && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Municipio</label>
                  <p className="text-sm font-medium">{currentData.municipality}</p>
                </div>
              )}
              {currentData.neighborhood && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Colonia</label>
                  <p className="text-sm font-medium">{currentData.neighborhood}</p>
                </div>
              )}
              {currentData.addressDesc && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Dirección Específica</label>
                  <p className="text-sm font-medium">{currentData.addressDesc}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentos Subidos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Subidos</CardTitle>
          <CardDescription>Archivos que has enviado para la verificación</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {currentData.documentFrontPath && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Documento Frontal</p>
                  <p className="text-xs text-muted-foreground">Subido</p>
                </div>
              </div>
            )}
            {currentData.documentBackPath && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Documento Reverso</p>
                  <p className="text-xs text-muted-foreground">Subido</p>
                </div>
              </div>
            )}
            {currentData.selfiePath && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Selfie</p>
                  <p className="text-xs text-muted-foreground">Subido</p>
                </div>
              </div>
            )}
            {currentData.addressProofPath && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Comprobante de Domicilio</p>
                  <p className="text-xs text-muted-foreground">Subido</p>
                </div>
              </div>
            )}
            {!currentData.documentFrontPath && !currentData.documentBackPath && !currentData.selfiePath && !currentData.addressProofPath && (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay documentos subidos</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {currentData.status === "rejected" && (
              <Button asChild>
                <Link href="/dashboard/verificacion">
                  Reintentar Verificación
                </Link>
              </Button>
            )}
            {currentData.status === "draft" && (
              <Button asChild>
                <Link href="/dashboard/verificacion">
                  Continuar Verificación
                </Link>
              </Button>
            )}
            {!["approved", "rejected", "review", "draft"].includes(currentData.status) && (
              <Button asChild>
                <Link href="/dashboard/verificacion">
                  Iniciar Verificación
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
