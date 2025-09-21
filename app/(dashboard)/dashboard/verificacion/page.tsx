"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { CheckCircle, Clock, XCircle, Upload, Camera, FileText, Shield, AlertCircle, Trash2, Eye } from "lucide-react"
import type { KycStatus, KycDraft } from "@/lib/contracts/types"

interface KycData extends KycDraft {
  // Paso 2: Documentos
  documentFront: File | null
  documentBack: File | null
  selfie: File | null

  // Paso 3: Preguntas de verificación
  answers: Record<string, string>
}

const countries = [
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Ecuador",
  "Paraguay",
  "Perú",
  "Uruguay",
  "Venezuela",
  "México",
  "España",
]

const documentTypes = [
  { value: "ID", label: "DNI" },
  { value: "Passport", label: "Pasaporte" },
  { value: "cedula", label: "Cédula de Identidad" },
  { value: "license", label: "Licencia de Conducir" },
]

const verificationQuestions = [
  {
    id: "income_source",
    question: "¿Cuál es su principal fuente de ingresos?",
    type: "radio",
    options: ["Trabajo dependiente", "Trabajo independiente", "Negocio propio", "Inversiones", "Otros"],
  },
  {
    id: "monthly_income",
    question: "¿Cuál es su rango de ingresos mensuales aproximado?",
    type: "radio",
    options: ["Menos de $500", "$500 - $1,500", "$1,500 - $3,000", "$3,000 - $5,000", "Más de $5,000"],
  },
  {
    id: "purpose",
    question: "¿Para qué planea usar principalmente esta plataforma?",
    type: "radio",
    options: ["Compras personales", "Ventas ocasionales", "Negocio regular", "Inversiones", "Otros"],
  },
  {
    id: "experience",
    question: "Describa brevemente su experiencia con plataformas de comercio electrónico:",
    type: "text",
    options: [],
  },
]

export default function VerificacionPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [kycStatus, setKycStatus] = useState<KycStatus>("none")
  const [lastUpdate] = useState(new Date().toLocaleDateString())
  const [kycData, setKycData] = useState<KycData>({
    fullName: "",
    birthDate: "",
    country: "",
    docType: "ID",
    docNumber: "",
    documentFront: null,
    documentBack: null,
    selfie: null,
    answers: {},
  })

  const getStatusInfo = (status: KycStatus) => {
    switch (status) {
      case "none":
        return {
          label: "No iniciado",
          color: "bg-gray-100 text-gray-800",
          icon: <Clock className="h-4 w-4" />,
        }
      case "draft":
        return {
          label: "Borrador",
          color: "bg-blue-100 text-blue-800",
          icon: <Clock className="h-4 w-4" />,
        }
      case "review":
        return {
          label: "En revisión",
          color: "bg-yellow-100 text-yellow-800",
          icon: <Clock className="h-4 w-4" />,
        }
      case "approved":
        return {
          label: "Aprobado",
          color: "bg-green-100 text-green-800",
          icon: <CheckCircle className="h-4 w-4" />,
        }
      case "rejected":
        return {
          label: "Rechazado",
          color: "bg-red-100 text-red-800",
          icon: <XCircle className="h-4 w-4" />,
        }
    }
  }

  const handleFileUpload = (field: keyof KycData, file: File) => {
    // Validación simulada
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]

    if (file.size > maxSize) {
      toast.error("El archivo es demasiado grande. Máximo 5MB.")
      return
    }

    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato no válido. Use JPG, PNG o PDF.")
      return
    }

    setKycData((prev) => ({ ...prev, [field]: file }))
    toast.success("Archivo subido correctamente")
  }

  const handleRemoveDocument = (field: keyof KycData) => {
    setKycData((prev) => ({ ...prev, [field]: null }))
    toast.success("Documento eliminado")
  }

  const onSaveKycDraft = async (draft: KycDraft) => {
    setKycStatus("draft")
    toast.success("Borrador guardado correctamente")
  }

  const onSubmitKyc = async (draft: KycDraft) => {
    setKycStatus("review")
    toast.success("Verificación enviada. Recibirá una respuesta en 1-3 días hábiles.")
  }

  const onRetakeSelfie = () => {
    setKycData((prev) => ({ ...prev, selfie: null }))
    toast.info("Puede tomar una nueva selfie")
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(kycData.fullName && kycData.birthDate && kycData.country && kycData.docType && kycData.docNumber)
      case 2:
        return !!(kycData.documentFront && kycData.documentBack && kycData.selfie)
      case 3:
        return verificationQuestions.every((q) => kycData.answers[q.id])
      default:
        return false
    }
  }

  const canProceed = validateStep(currentStep)
  const progress = (currentStep / 3) * 100

  const statusInfo = getStatusInfo(kycStatus)

  const handleSaveDraft = () => {
    const draftData: KycDraft = {
      fullName: kycData.fullName,
      birthDate: kycData.birthDate,
      country: kycData.country,
      docType: kycData.docType,
      docNumber: kycData.docNumber,
    }
    onSaveKycDraft(draftData)
  }

  const handleSubmitKyc = () => {
    const submitData: KycDraft = {
      fullName: kycData.fullName,
      birthDate: kycData.birthDate,
      country: kycData.country,
      docType: kycData.docType,
      docNumber: kycData.docNumber,
    }
    onSubmitKyc(submitData)
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header con estado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Proceso KYC</h2>
          <p className="text-muted-foreground">Complete el proceso KYC para verificar su identidad</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`${statusInfo.color} flex items-center gap-1`}>
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          <span className="text-sm text-muted-foreground">Actualizado: {lastUpdate}</span>
        </div>
      </div>

      {/* Mensajes de ayuda */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Privacidad garantizada:</strong> Sus datos están protegidos con encriptación de nivel bancario. El
          proceso de revisión toma 1-3 días hábiles. Para soporte, contacte a verificacion@nmhn.com
        </AlertDescription>
      </Alert>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progreso del proceso</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Wizard Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
              {currentStep}
            </span>
            {currentStep === 1 && "Datos Básicos"}
            {currentStep === 2 && "Documentos"}
            {currentStep === 3 && "Preguntas de Verificación"}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && "Ingrese su información personal básica"}
            {currentStep === 2 && "Suba los documentos requeridos para verificar su identidad"}
            {currentStep === 3 && "Responda algunas preguntas para completar la verificación"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paso 1: Datos básicos */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre legal completo *</Label>
                <Input
                  id="fullName"
                  value={kycData.fullName}
                  onChange={(e) => setKycData((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Como aparece en su documento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={kycData.birthDate}
                  onChange={(e) => setKycData((prev) => ({ ...prev, birthDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País *</Label>
                <Select
                  value={kycData.country}
                  onValueChange={(value) => setKycData((prev) => ({ ...prev, country: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione su país" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docType">Tipo de documento *</Label>
                <Select
                  value={kycData.docType}
                  onValueChange={(value: "ID" | "Passport") => setKycData((prev) => ({ ...prev, docType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="docNumber">Número de documento *</Label>
                <Input
                  id="docNumber"
                  value={kycData.docNumber}
                  onChange={(e) => setKycData((prev) => ({ ...prev, docNumber: e.target.value }))}
                  placeholder="Ingrese el número sin espacios ni guiones"
                />
              </div>
            </div>
          )}

          {/* Paso 2: Documentos */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Documento frontal */}
              <div className="space-y-3">
                <Label>Documento - Lado frontal *</Label>
                {kycData.documentFront ? (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{kycData.documentFront.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(kycData.documentFront.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveDocument("documentFront")}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Suba la parte frontal de su documento</p>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload("documentFront", e.target.files[0])}
                      className="hidden"
                      id="documentFront"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="documentFront" className="cursor-pointer">
                        Seleccionar archivo
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {/* Documento reverso */}
              <div className="space-y-3">
                <Label>Documento - Lado reverso *</Label>
                {kycData.documentBack ? (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{kycData.documentBack.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(kycData.documentBack.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveDocument("documentBack")}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Suba la parte trasera de su documento</p>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload("documentBack", e.target.files[0])}
                      className="hidden"
                      id="documentBack"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="documentBack" className="cursor-pointer">
                        Seleccionar archivo
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {/* Selfie */}
              <div className="space-y-3">
                <Label>Selfie con documento *</Label>
                {kycData.selfie ? (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Camera className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{kycData.selfie.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(kycData.selfie.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm" onClick={onRetakeSelfie}>
                        <Camera className="h-4 w-4 mr-1" />
                        Retomar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Tome una selfie sosteniendo su documento</p>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload("selfie", e.target.files[0])}
                      className="hidden"
                      id="selfie"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="selfie" className="cursor-pointer">
                        <Camera className="h-4 w-4 mr-2" />
                        Tomar selfie
                      </label>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Paso 3: Preguntas */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {verificationQuestions.map((question) => (
                <div key={question.id} className="space-y-3">
                  <Label className="text-base font-medium">{question.question} *</Label>
                  {question.type === "radio" ? (
                    <RadioGroup
                      value={kycData.answers[question.id] || ""}
                      onValueChange={(value) =>
                        setKycData((prev) => ({
                          ...prev,
                          answers: { ...prev.answers, [question.id]: value },
                        }))
                      }
                    >
                      {question.options.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                          <Label htmlFor={`${question.id}-${option}`} className="font-normal">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Textarea
                      value={kycData.answers[question.id] || ""}
                      onChange={(e) =>
                        setKycData((prev) => ({
                          ...prev,
                          answers: { ...prev.answers, [question.id]: e.target.value },
                        }))
                      }
                      placeholder="Escriba su respuesta aquí..."
                      rows={3}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Botones de navegación */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
            <div className="flex gap-3">
              {currentStep > 1 && (
                <Button variant="outline" onClick={() => setCurrentStep((prev) => prev - 1)}>
                  Anterior
                </Button>
              )}
              <Button variant="outline" onClick={handleSaveDraft}>
                Guardar borrador
              </Button>
            </div>

            <div className="flex gap-3 sm:ml-auto">
              {currentStep < 3 ? (
                <Button onClick={() => setCurrentStep((prev) => prev + 1)} disabled={!canProceed}>
                  Continuar
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitKyc}
                  disabled={!canProceed || kycStatus === "review"}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {kycStatus === "review" ? "Enviado" : "Enviar verificación"}
                </Button>
              )}
            </div>
          </div>

          {/* Advertencia si faltan campos */}
          {!canProceed && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Complete todos los campos requeridos (*) para continuar.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
