"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "./StatusBadge"
import { Check, X, FileText, ImageIcon, RotateCcw, Trash2, Undo2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/client"
import { type KycRequest } from "@/app/actions/admin"

interface KycDocument {
  id: string
  type: string
  url: string
  uploadedAt: string
  signedUrl?: string
}

interface KycData {
  id: string
  userId: string
  userName: string
  userEmail: string
  documentType: string
  documentNumber: string
  birthDate?: string
  country?: string
  addressDepartment?: string
  addressCity?: string
  addressNeighborhood?: string
  addressDesc?: string
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
  data: KycRequest | null
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onRevert?: (id: string) => void
  onRevertStep?: (id: string, step: 1) => void
  onDeleteDocument?: (userId: string, documentType: string) => void
}

export function KycDetailDrawer({ open, onOpenChange, data, onApprove, onReject, onRevert, onRevertStep, onDeleteDocument }: KycDetailDrawerProps) {
  const [documentsWithUrls, setDocumentsWithUrls] = useState<KycDocument[]>([])
  const [loadingUrls, setLoadingUrls] = useState(false)

  // Convertir KycRequest a KycData
  const convertedData: KycData | null = data ? {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name || 'Sin nombre',
    userEmail: data.user_email || 'Sin email',
    documentType: data.document_type,
    documentNumber: data.document_number,
    birthDate: data.birth_date,
    country: data.country,
    addressDepartment: data.address_department,
    addressCity: data.address_city,
    addressNeighborhood: data.address_neighborhood,
    addressDesc: data.address_desc,
    status: data.status,
    submittedAt: data.submitted_at,
    reviewedAt: data.reviewed_at,
    reviewedBy: data.reviewed_by,
    notes: data.notes,
    documents: data.documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      url: doc.url,
      uploadedAt: doc.uploaded_at
    }))
  } : null

  useEffect(() => {
    if (data && data.documents.length > 0) {
      console.log('📋 Datos recibidos en KycDetailDrawer:', data)
      console.log('📄 Documentos a procesar:', data.documents)
      generateSignedUrls()
    }
  }, [data])

  const generateSignedUrls = async () => {
    if (!convertedData) {
      console.warn('⚠️ No hay datos para procesar')
      return
    }
    
    if (!convertedData.documents || !Array.isArray(convertedData.documents)) {
      console.warn('⚠️ No hay documentos válidos para procesar:', convertedData.documents)
      setDocumentsWithUrls([])
      return
    }
    
    setLoadingUrls(true)
    const supabase = supabaseBrowser()
    
    try {
      console.log(`📋 Procesando ${convertedData.documents.length} documentos`)
      
      const documentsWithSignedUrls = await Promise.all(
        convertedData.documents.map(async (doc, index) => {
          try {
            console.log(`🔍 [${index + 1}/${convertedData.documents.length}] Procesando documento:`, doc)
            
            // Validar que el documento tenga las propiedades necesarias
            if (!doc || typeof doc !== 'object') {
              console.warn(`⚠️ Documento inválido en índice ${index}:`, doc)
              return { id: `invalid-${index}`, type: 'unknown', url: '', uploadedAt: new Date().toISOString(), signedUrl: null }
            }
            
            // Validar que la URL no esté vacía
            if (!doc.url || doc.url.trim() === '') {
              console.warn(`⚠️ URL vacía para documento ${doc.id || index}`)
              return { ...doc, signedUrl: null }
            }

            // Generar URL pública (el bucket kyc es público)
            console.log(`🔄 Generando URL pública para: ${doc.url}`)
            
            const { data: publicUrlData } = supabase.storage
              .from('kyc')
              .getPublicUrl(doc.url)

            console.log(`📊 URL pública generada:`, publicUrlData)

            if (!publicUrlData || !publicUrlData.publicUrl) {
              console.error(`❌ No se pudo generar URL pública para ${doc.url}`)
              return { ...doc, signedUrl: null }
            }

            console.log(`✅ URL pública generada exitosamente para ${doc.url}`)
            console.log(`🔗 URL pública: ${publicUrlData.publicUrl}`)
            return { ...doc, signedUrl: publicUrlData.publicUrl }
          } catch (error) {
            console.error(`❌ Error procesando documento ${doc?.id || index}:`, error)
            return { ...doc, signedUrl: null }
          }
        })
      )

      console.log(`📋 Procesamiento completado. ${documentsWithSignedUrls.length} documentos procesados`)
      console.log(`📄 Documentos finales:`, documentsWithSignedUrls)
      setDocumentsWithUrls(documentsWithSignedUrls)
    } catch (error) {
      console.error('❌ Error general generando URLs firmadas:', error)
      setDocumentsWithUrls(convertedData?.documents || [])
    } finally {
      setLoadingUrls(false)
    }
  }

  if (!convertedData) return null

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
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-xl font-semibold">Revisión de Verificación KYC</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                Verificación de identidad y documentos
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-8 py-6">
          {/* Status Card */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Estado de Verificación</p>
                  <p className="text-xs text-muted-foreground">Estado actual de la solicitud</p>
                </div>
              </div>
              <StatusBadge variant={getStatusVariant(convertedData.status)}>
                {convertedData.status === "pending" && "Pendiente"}
                {convertedData.status === "approved" && "Aprobado"}
                {convertedData.status === "rejected" && "Rechazado"}
              </StatusBadge>
            </div>
          </div>

          {/* User info */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                <span className="text-xs font-semibold text-blue-600">👤</span>
              </div>
              <h3 className="text-lg font-semibold">Información del Usuario</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre Completo</p>
                <p className="text-sm font-medium">{convertedData.userName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                <p className="text-sm font-medium">{convertedData.userEmail}</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ID de Usuario</p>
                <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">{convertedData.userId}</p>
              </div>
            </div>
          </div>

          {/* Document info */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                <span className="text-xs font-semibold text-green-600">📄</span>
              </div>
              <h3 className="text-lg font-semibold">Información del Documento</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de Documento</p>
                <p className="text-sm font-medium">{convertedData.documentType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Número</p>
                <p className="text-sm font-medium font-mono">{convertedData.documentNumber}</p>
              </div>
              {convertedData.birthDate && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de Nacimiento</p>
                  <p className="text-sm font-medium">
                    {new Date(convertedData.birthDate).toLocaleDateString("es-HN")}
                  </p>
                </div>
              )}
              {convertedData.country && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">País</p>
                  <p className="text-sm font-medium">{convertedData.country}</p>
                </div>
              )}
              <div className="space-y-1 md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de Envío</p>
                <p className="text-sm font-medium">
                  {convertedData.submittedAt ? new Date(convertedData.submittedAt).toLocaleDateString("es-HN") : "Fecha no disponible"}
                </p>
              </div>
            </div>
          </div>

          {/* Address info */}
          {(convertedData.addressDepartment || convertedData.addressCity || convertedData.addressNeighborhood || convertedData.addressDesc) && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100">
                  <span className="text-xs font-semibold text-purple-600">🏠</span>
                </div>
                <h3 className="text-lg font-semibold">Información de Dirección</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {convertedData.addressDepartment && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Departamento</p>
                    <p className="text-sm font-medium">{convertedData.addressDepartment}</p>
                  </div>
                )}
                {convertedData.addressCity && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ciudad</p>
                    <p className="text-sm font-medium">{convertedData.addressCity}</p>
                  </div>
                )}
                {convertedData.addressNeighborhood && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Colonia</p>
                    <p className="text-sm font-medium">{convertedData.addressNeighborhood}</p>
                  </div>
                )}
                {convertedData.addressDesc && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dirección Específica</p>
                    <p className="text-sm font-medium">{convertedData.addressDesc}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100">
                <span className="text-xs font-semibold text-orange-600">📎</span>
              </div>
              <h3 className="text-lg font-semibold">Documentos Adjuntos</h3>
            </div>
            {loadingUrls ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Cargando documentos...</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {documentsWithUrls.map((doc) => (
                  <div key={doc.id} className="group rounded-lg border bg-background p-4 transition-all hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                        {doc.type.includes("image") || doc.type === "front" || doc.type === "back" || doc.type === "selfie" ? (
                          <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {doc.type === "front" && "Documento Frontal"}
                          {doc.type === "back" && "Documento Reverso"}
                          {doc.type === "selfie" && "Selfie"}
                          {doc.type === "address" && "Comprobante de Domicilio"}
                          {!["front", "back", "selfie", "address"].includes(doc.type) && doc.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.uploadedAt).toLocaleDateString("es-HN")}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {doc.signedUrl ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                              Ver
                            </a>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>
                            Error
                          </Button>
                        )}
                        {onDeleteDocument && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const documentTypeMap: { [key: string]: string } = {
                                'front': 'document_front_path',
                                'back': 'document_back_path',
                                'selfie': 'selfie_path',
                                'address': 'address_proof_path'
                              }
                              const documentType = documentTypeMap[doc.type]
                              if (documentType) {
                                onDeleteDocument(convertedData.userId, documentType)
                              }
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {documentsWithUrls.length === 0 && (
                  <div className="col-span-2 flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">No hay documentos adjuntos</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review info */}
          {convertedData.reviewedAt && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-xs font-semibold text-indigo-600">✅</span>
                </div>
                <h3 className="text-lg font-semibold">Información de Revisión</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revisado por</p>
                  <p className="text-sm font-medium">{convertedData.reviewedBy || "Administrador"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de Revisión</p>
                  <p className="text-sm font-medium">
                    {convertedData.reviewedAt ? new Date(convertedData.reviewedAt).toLocaleDateString("es-HN") : "Fecha no disponible"}
                  </p>
                </div>
                {convertedData.notes && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas</p>
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-sm">{convertedData.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {convertedData.status === "pending" && (
            <div className="sticky bottom-0 bg-background border-t pt-6">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 h-12 text-base"
                  onClick={() => {
                    onReject?.(convertedData.id)
                    onOpenChange(false)
                  }}
                >
                  <X className="size-5" />
                  Rechazar Verificación
                </Button>
                <Button
                  className="flex-1 gap-2 h-12 text-base"
                  onClick={() => {
                    onApprove?.(convertedData.id)
                    onOpenChange(false)
                  }}
                >
                  <Check className="size-5" />
                  Aprobar Verificación
                </Button>
              </div>
              <div className="flex gap-3 mt-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 h-10 text-sm border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => {
                    onRevertStep?.(convertedData.id, 1)
                    onOpenChange(false)
                  }}
                >
                  <RotateCcw className="size-4" />
                  Revertir Paso 1
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Revertir solo el paso 1 para que el usuario corrija sus datos personales
              </p>
            </div>
          )}

          {/* Revert Action for Approved/Rejected */}
          {(convertedData.status === "approved" || convertedData.status === "rejected") && (
            <div className="sticky bottom-0 bg-background border-t pt-6">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 h-12 text-base border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => {
                    onRevert?.(convertedData.id)
                    onOpenChange(false)
                  }}
                >
                  <RotateCcw className="size-5" />
                  Revertir a Pendiente
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Esta acción revertirá la verificación a estado pendiente para que el usuario complete nuevamente su información
              </p>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  )
}

