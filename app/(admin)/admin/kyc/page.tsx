"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { CheckCircle, XCircle, Eye, Clock, User, FileText, Camera, Home } from "lucide-react"
import { approveKyc, rejectKyc, getKycSubmissions } from '@/app/actions/kyc_admin'

interface KycSubmission {
  id: string
  user_id: string
  full_name: string
  birth_date: string
  country: string
  doc_type: string
  doc_number: string
  status: string
  document_front_path: string | null
  document_back_path: string | null
  selfie_path: string | null
  address_proof_path: string | null
  updated_at: string
  admin_notes: string | null
  profiles: {
    email: string
    full_name: string
  }
}

export default function KycAdminPage() {
  const [submissions, setSubmissions] = useState<KycSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState<KycSubmission | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  useEffect(() => {
    loadSubmissions()
  }, [])

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const result = await getKycSubmissions()
      if (result.ok && result.data) {
        setSubmissions(result.data)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('Error cargando verificaciones')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (submission: KycSubmission) => {
    try {
      setProcessing(submission.user_id)
      const result = await approveKyc(submission.user_id)
      
      if (result.ok) {
        toast.success('Verificación aprobada exitosamente')
        await loadSubmissions() // Recargar la lista
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('Error al aprobar verificación')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!selectedSubmission || !rejectReason.trim()) {
      toast.error('Debe proporcionar un motivo para el rechazo')
      return
    }

    try {
      setProcessing(selectedSubmission.user_id)
      const result = await rejectKyc(selectedSubmission.user_id, rejectReason)
      
      if (result.ok) {
        toast.success('Verificación rechazada exitosamente')
        setShowRejectDialog(false)
        setRejectReason('')
        setSelectedSubmission(null)
        await loadSubmissions() // Recargar la lista
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('Error al rechazar verificación')
    } finally {
      setProcessing(null)
    }
  }

  const openRejectDialog = (submission: KycSubmission) => {
    setSelectedSubmission(submission)
    setShowRejectDialog(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'review':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />En Revisión</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Aprobado</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rechazado</Badge>
      default:
        return <Badge variant="outline">Borrador</Badge>
    }
  }

  const getDocTypeLabel = (docType: string) => {
    switch (docType) {
      case 'ID': return 'Cédula de Identidad'
      case 'Passport': return 'Pasaporte'
      case 'DNI': return 'DNI'
      default: return docType
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Cargando verificaciones...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Verificaciones KYC</h1>
          <p className="text-muted-foreground">Gestiona las verificaciones de identidad de los usuarios</p>
        </div>
        <Button onClick={loadSubmissions} variant="outline">
          Actualizar
        </Button>
      </div>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">No hay verificaciones pendientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {submission.profiles.full_name || submission.full_name}
                    </CardTitle>
                    <CardDescription>
                      {submission.profiles.email} • {getDocTypeLabel(submission.doc_type)}: {submission.doc_number}
                    </CardDescription>
                  </div>
                  {getStatusBadge(submission.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium mb-2">Información Personal</h4>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p><strong>País:</strong> {submission.country}</p>
                      <p><strong>Fecha de nacimiento:</strong> {new Date(submission.birth_date).toLocaleDateString()}</p>
                      <p><strong>Enviado:</strong> {new Date(submission.updated_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Documentos</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className={submission.document_front_path ? "text-green-600" : "text-red-600"}>
                          Documento frontal {submission.document_front_path ? "✓" : "✗"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className={submission.document_back_path ? "text-green-600" : "text-red-600"}>
                          Documento reverso {submission.document_back_path ? "✓" : "✗"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        <span className={submission.selfie_path ? "text-green-600" : "text-red-600"}>
                          Selfie {submission.selfie_path ? "✓" : "✗"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        <span className={submission.address_proof_path ? "text-green-600" : "text-red-600"}>
                          Comprobante domicilio {submission.address_proof_path ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {submission.admin_notes && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <h4 className="font-medium mb-1">Notas del administrador:</h4>
                    <p className="text-sm text-muted-foreground">{submission.admin_notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(submission)}
                    disabled={processing === submission.user_id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprobar
                  </Button>
                  <Button
                    onClick={() => openRejectDialog(submission)}
                    disabled={processing === submission.user_id}
                    variant="destructive"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para rechazar */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Verificación</DialogTitle>
            <DialogDescription>
              Proporciona un motivo para el rechazo. El usuario recibirá este mensaje por correo electrónico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Motivo del rechazo</Label>
              <Textarea
                id="reason"
                placeholder="Ej: Documentos ilegibles, información incorrecta, etc."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing === selectedSubmission?.user_id}
              variant="destructive"
            >
              {processing === selectedSubmission?.user_id ? 'Procesando...' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

