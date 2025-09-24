"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { CheckCircle, Clock, XCircle, Upload, Camera, FileText, Shield, AlertCircle, Trash2, Eye, User, Home, Loader2 } from "lucide-react"
import { departmentsToMunicipalities } from "@/lib/data/honduras"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { KycStatus, KycDraft } from "@/lib/contracts/types"
import { saveKycDraft, submitKyc, registerKycFilePath } from "@/app/actions/kyc_data"
import { removeKycFile } from "@/app/actions/kyc"
import { supabaseBrowser } from "@/lib/supabase/client"

interface KycData extends KycDraft {
  documentFront: File | null
  documentBack: File | null
  selfie: File | null
  addressProof: File | null
  department?: string
  municipality?: string
  neighborhood?: string
  addressDesc?: string
}

interface InitialDraft extends KycDraft {
  status: KycStatus
  documentFrontPath?: string | null
  documentBackPath?: string | null
  selfiePath?: string | null
  addressProofPath?: string | null
}

export default function VerificacionClient({ initialDraft }: { initialDraft: InitialDraft | null }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [kycStatus, setKycStatus] = useState<KycStatus>(initialDraft?.status ?? "none")
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleDateString())
  const [kycData, setKycData] = useState<KycData>({
    fullName: initialDraft?.fullName ?? "",
    birthDate: initialDraft?.birthDate ?? "",
    country: initialDraft?.country ?? "Honduras",
    docType: initialDraft?.docType ?? "ID",
    docNumber: initialDraft?.docNumber ?? "",
    documentFront: null,
    documentBack: null,
    selfie: null,
    addressProof: null,
    department: "",
    municipality: "",
    neighborhood: "",
    addressDesc: "",
  })
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const autosaveTimer = useRef<any>(null)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    JSON.stringify({
      fullName: initialDraft?.fullName ?? "",
      birthDate: initialDraft?.birthDate ?? "",
      country: initialDraft?.country ?? "",
      docType: initialDraft?.docType ?? "ID",
      docNumber: initialDraft?.docNumber ?? "",
    }),
  )
  const [uploading, setUploading] = useState({
    documentFront: false,
    documentBack: false,
    selfie: false,
    addressProof: false,
  })
  const [uploadedRemote, setUploadedRemote] = useState({
    documentFront: Boolean(initialDraft?.documentFrontPath),
    documentBack: Boolean(initialDraft?.documentBackPath),
    selfie: Boolean(initialDraft?.selfiePath),
    addressProof: Boolean(initialDraft?.addressProofPath),
  })
  const wizardRef = useRef<HTMLDivElement | null>(null)
  

  // Cámara (desktop y móvil) para selfie
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user")

  const openCamera = async (facing: "user" | "environment" = "user") => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Este dispositivo no permite acceso a la cámara")
        return
      }
      const constraints: MediaStreamConstraints = { video: { facingMode: facing }, audio: false }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraFacing(facing)
      setIsCameraOpen(true)
    } catch {
      toast.error("No se pudo abrir la cámara. Prueba subir un archivo.")
    }
  }

  const closeCamera = () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {}
    streamRef.current = null
    setIsCameraOpen(false)
  }

  const toggleCameraFacing = async () => {
    const next = cameraFacing === "user" ? "environment" : "user"
    closeCamera()
    await openCamera(next)
  }

  const takePhoto = async () => {
    try {
      const video = videoRef.current
      if (!video) return
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
      if (!blob) return
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" })
      await handleFileUpload("selfie", file)
    } finally {
      closeCamera()
    }
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

  const hondurasDepartments = [
    "Atlántida",
    "Choluteca",
    "Colón",
    "Comayagua",
    "Copán",
    "Cortés",
    "El Paraíso",
    "Francisco Morazán",
    "Gracias a Dios",
    "Intibucá",
    "Islas de la Bahía",
    "La Paz",
    "Lempira",
    "Ocotepeque",
    "Olancho",
    "Santa Bárbara",
    "Valle",
    "Yoro",
  ]
  const steps = [
    { id: 1, title: "Datos personales", description: "Nombre completo, fecha de nacimiento y país.", icon: User },
    { id: 2, title: "Documento de identidad", description: "DPI, pasaporte o licencia vigente (frente y reverso).", icon: FileText },
    { id: 3, title: "Selfie de validación", description: "Selfie en tiempo real para confirmar titularidad.", icon: Camera },
    { id: 4, title: "Comprobante de domicilio", description: "Recibo o estado bancario con tu dirección (≤ 3 meses).", icon: Home },
    { id: 5, title: "Revisión y envío", description: "Validación automática y, si aplica, revisión manual.", icon: Shield },
  ]

  // Calcular paso inicial según initialDraft
  useEffect(() => {
    const step1DoneInit = Boolean(kycData.fullName && kycData.birthDate && kycData.country && kycData.docType && kycData.docNumber)
    const step2DoneInit = Boolean(uploadedRemote.documentFront && uploadedRemote.documentBack)
    const step3DoneInit = Boolean(uploadedRemote.selfie)
    const step4DoneInit = Boolean(uploadedRemote.addressProof)
    const nextStep = !step1DoneInit ? 1 : !step2DoneInit ? 2 : !step3DoneInit ? 3 : !step4DoneInit ? 4 : 5
    setCurrentStep(nextStep)
  }, [])

  // Fallback: carga cliente si SSR no trajo initialDraft (p. ej., móviles sin cookie SSR)
  useEffect(() => {
    const loadClientDraft = async () => {
      try {
        if (initialDraft) return
        const supabase = supabaseBrowser()
        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData.session?.user?.id
        if (!userId) return
        const { data: row } = await supabase
          .from("kyc_submissions")
          .select(
            "full_name, birth_date, country, doc_type, doc_number, status, document_front_path, document_back_path, selfie_path, address_proof_path, updated_at, address_department, address_city, address_neighborhood, address_desc",
          )
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!row) return

        setKycData((prev) => ({
          ...prev,
          fullName: row.full_name || prev.fullName,
          birthDate: row.birth_date || prev.birthDate,
          country: row.country || prev.country,
          docType: (row.doc_type as any) || prev.docType,
          docNumber: row.doc_number || prev.docNumber,
          department: row.address_department || prev.department,
          municipality: row.address_city || prev.municipality,
          neighborhood: row.address_neighborhood || prev.neighborhood,
          addressDesc: row.address_desc || prev.addressDesc,
        }))
        setLastSavedSnapshot(
          JSON.stringify({
            fullName: row.full_name || "",
            birthDate: row.birth_date || "",
            country: row.country || "",
            docType: (row.doc_type as any) || "",
            docNumber: row.doc_number || "",
            department: row.address_department || "",
            municipality: row.address_city || "",
            neighborhood: row.address_neighborhood || "",
            addressDesc: row.address_desc || "",
          }),
        )
        setUploadedRemote({
          documentFront: Boolean(row.document_front_path),
          documentBack: Boolean(row.document_back_path),
          selfie: Boolean(row.selfie_path),
          addressProof: Boolean(row.address_proof_path),
        })
        if (row.status) setKycStatus(row.status as KycStatus)
        if (row.updated_at) setLastUpdate(new Date(row.updated_at).toLocaleString())

        const step1Done = Boolean(row.full_name && row.birth_date && row.country && row.doc_type && row.doc_number)
        const step2Done = Boolean(row.document_front_path && row.document_back_path)
        const step3Done = Boolean(row.selfie_path)
        const step4Done = Boolean(row.address_proof_path)
        const nextStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : 5
        setCurrentStep(nextStep)
      } catch {}
    }
    loadClientDraft()
  }, [initialDraft])

  // Suscripción en tiempo real a cambios del registro KYC del usuario (usando columnas *_path)
  useEffect(() => {
    const supabase = supabaseBrowser()
    let channel: any
    let isActive = true

    const subscribe = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) return

      channel = supabase
        .channel("kyc_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "kyc_submissions", filter: `user_id=eq.${userId}` },
          async () => {
            if (!isActive) return
            try {
              const { data: row } = await supabase
                .from("kyc_submissions")
                .select(
                  "full_name, birth_date, country, doc_type, doc_number, status, document_front_path, document_back_path, selfie_path, address_proof_path, updated_at",
                )
                .eq("user_id", userId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle()

              if (!row) return

              setKycData((prev) => ({
                ...prev,
                fullName: row.full_name || prev.fullName,
                birthDate: row.birth_date || prev.birthDate,
                country: row.country || prev.country,
                docType: (row.doc_type as any) || prev.docType,
                docNumber: row.doc_number || prev.docNumber,
              }))
              setLastSavedSnapshot(
                JSON.stringify({
                  fullName: row.full_name || "",
                  birthDate: row.birth_date || "",
                  country: row.country || "",
                  docType: (row.doc_type as any) || "",
                  docNumber: row.doc_number || "",
                }),
              )
              setUploadedRemote({
                documentFront: Boolean(row.document_front_path),
                documentBack: Boolean(row.document_back_path),
                selfie: Boolean(row.selfie_path),
                addressProof: Boolean(row.address_proof_path),
              })
              if (row.status) setKycStatus(row.status as KycStatus)
              if (row.updated_at) setLastUpdate(new Date(row.updated_at).toLocaleString())

              const step1Done = Boolean(
                row.full_name && row.birth_date && row.country && row.doc_type && row.doc_number,
              )
              const step2Done = Boolean(row.document_front_path && row.document_back_path)
              const step3Done = Boolean(row.selfie_path)
              const step4Done = Boolean(row.address_proof_path)
              const nextStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : 5
              setCurrentStep(nextStep)
            } catch {}
          },
        )
        .subscribe()
    }

    subscribe()
    return () => {
      isActive = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  // Autosave con debounce para Paso 1
  useEffect(() => {
    const draftData = {
      fullName: kycData.fullName,
      birthDate: kycData.birthDate,
      country: kycData.country,
      docType: kycData.docType,
      docNumber: kycData.docNumber,
      department: kycData.department,
      municipality: kycData.municipality,
      neighborhood: kycData.neighborhood,
      addressDesc: kycData.addressDesc,
    }
    const allFilled = Boolean(
      draftData.fullName && draftData.birthDate && draftData.country && draftData.docType && draftData.docNumber,
    )
    const snap = JSON.stringify(draftData)
    if (!allFilled || snap === lastSavedSnapshot) {
      return
    }
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current)
    }
    autosaveTimer.current = setTimeout(async () => {
      const res = await saveKycDraft(draftData)
      if (!res.ok) {
        toast.error(res.message, {
          action: {
            label: "Reintentar",
            onClick: () => saveKycDraft(draftData),
          },
        })
        return
      }
      setLastSavedSnapshot(snap)
      setKycStatus("draft")
      setLastUpdate(new Date().toLocaleString())
    }, 800)

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [kycData.fullName, kycData.birthDate, kycData.country, kycData.docType, kycData.docNumber, kycData.department, kycData.municipality, kycData.neighborhood, kycData.addressDesc, lastSavedSnapshot])

  const handleNext = async () => {
    if (currentStep === 1) {
      const draftData = {
        fullName: kycData.fullName,
        birthDate: kycData.birthDate,
        country: kycData.country,
        docType: kycData.docType,
        docNumber: kycData.docNumber,
        department: kycData.department,
        municipality: kycData.municipality,
        neighborhood: kycData.neighborhood,
        addressDesc: kycData.addressDesc,
      }
      const res = await saveKycDraft(draftData)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
    }
    setCurrentStep((prev) => Math.min(5, prev + 1))
  }

  const handleGoToStep = (id: number) => {
    setCurrentStep(id)
    // Pequeño delay para asegurar el render antes de hacer scroll
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)
  }

  const getStatusInfo = (status: KycStatus) => {
    switch (status) {
      case "none":
        return { label: "No iniciado", color: "bg-gray-100 text-gray-800", icon: <Clock className="h-4 w-4" /> }
      case "draft":
        return { label: "Borrador", color: "bg-blue-100 text-blue-800", icon: <Clock className="h-4 w-4" /> }
      case "review":
        return { label: "En revisión", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" /> }
      case "approved":
        return { label: "Aprobado", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-4 w-4" /> }
      case "rejected":
        return { label: "Rechazado", color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> }
    }
  }

  const handleFileUpload = async (
    field: "documentFront" | "documentBack" | "selfie" | "addressProof",
    file: File,
  ) => {
    try {
      const maxSize = 10 * 1024 * 1024
      const allowedTypes = ["image/jpeg", "image/png", "image/heic", "application/pdf"]
      if (file.size > maxSize) {
        toast.error("El archivo es demasiado grande. Máximo 5MB.")
        return
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error("Formato no válido. Use JPG, PNG o PDF.")
        return
      }

      const kindMap: Record<string, "document_front" | "document_back" | "selfie" | "address_proof"> = {
        documentFront: "document_front",
        documentBack: "document_back",
        selfie: "selfie",
        addressProof: "address_proof",
      }
      const kind = kindMap[field as string]
      if (!kind) {
        toast.error("Tipo de archivo no soportado")
        return
      }

      setUploading((prev) => ({ ...prev, [field]: true }))
      const supabase = supabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) {
        toast.error("No hay sesión activa")
        return
      }

      const extMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/heic": "heic",
        "application/pdf": "pdf",
      }
      const ext = extMap[file.type] || "bin"
      const path = `${userId}/${kind}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from("kyc")
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) {
        toast.error("No se pudo subir el archivo. Inténtalo de nuevo.")
        return
      }

      const result = await registerKycFilePath(kind, path)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setKycData((prev) => ({ ...prev, [field]: file }))
      setUploadedRemote((prev) => ({ ...prev, [field]: true }))
      toast.success("Archivo subido correctamente", { action: { label: "Continuar", onClick: () => setCurrentStep((s) => Math.min(5, s + 1)) } })
    } catch (err: any) {
      toast.error(err?.message || "Error al subir el archivo", { action: { label: "Reintentar", onClick: () => handleFileUpload(field, file) } })
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }))
    }
  }

  const handleRemoveDocument = async (field: keyof KycData) => {
    const kindMap: Record<string, "document_front" | "document_back" | "selfie" | "address_proof"> = {
      documentFront: "document_front",
      documentBack: "document_back",
      selfie: "selfie",
      addressProof: "address_proof",
    }
    const kind = kindMap[field as string]
    const res = await removeKycFile(kind)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    setKycData((prev) => ({ ...prev, [field]: null }))
    setUploadedRemote((prev) => ({ ...prev, [field]: false }))
    toast.success(res.message)
  }

  const onSaveKycDraft = async (
    draft: KycDraft & { department?: string; municipality?: string; neighborhood?: string; addressDesc?: string },
  ) => {
    try {
      setIsSavingDraft(true)
      const result = await saveKycDraft(draft)
      if (!result.ok) {
        toast.error(result.message, { action: { label: "Reintentar", onClick: () => onSaveKycDraft(draft) } })
        return
      }
      setKycStatus("draft")
      toast.success(result.message, { action: { label: "Ver estado", onClick: () => checkVerificationStatus() } })
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar el borrador", { action: { label: "Reintentar", onClick: () => onSaveKycDraft(draft) } })
    } finally {
      setIsSavingDraft(false)
    }
  }

  const onSubmitKyc = async (draft: KycDraft) => {
    try {
      setIsSubmitting(true)
      const result = await submitKyc()
      if (!result.ok) {
        toast.error(result.message, { action: { label: "Reintentar", onClick: () => onSubmitKyc(draft) } })
        return
      }
      setKycStatus("review")
      toast.success(result.message, { action: { label: "Ver estado", onClick: () => checkVerificationStatus() } })
    } catch (err: any) {
      toast.error(err?.message || "No se pudo enviar la verificación", { action: { label: "Reintentar", onClick: () => onSubmitKyc(draft) } })
    } finally {
      setIsSubmitting(false)
    }
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
        return !!((kycData.documentFront || uploadedRemote.documentFront) && (kycData.documentBack || uploadedRemote.documentBack))
      case 3:
        return !!(kycData.selfie || uploadedRemote.selfie)
      case 4:
        return !!(kycData.addressProof || uploadedRemote.addressProof)
      case 5:
        return true
      default:
        return false
    }
  }

  const canProceed = validateStep(currentStep)
  const isReadyToSubmit = [1, 2, 3, 4].every((s) => validateStep(s))
  // Progreso basado SOLO en pasos completados (no navegación)
  const step1Done = Boolean(kycData.fullName && kycData.birthDate && kycData.country && kycData.docType && kycData.docNumber)
  const step2Done = Boolean(uploadedRemote.documentFront && uploadedRemote.documentBack)
  const step3Done = Boolean(uploadedRemote.selfie)
  const step4Done = Boolean(uploadedRemote.addressProof)
  const step5Done = kycStatus === "review" || kycStatus === "approved"
  const stepsCompletedCount = [step1Done, step2Done, step3Done, step4Done, step5Done].filter(Boolean).length
  const progress = (stepsCompletedCount / 5) * 100
  const statusInfo = getStatusInfo(kycStatus)!

  const handleSaveDraft = async () => {
    const draftData = {
      fullName: kycData.fullName,
      birthDate: kycData.birthDate,
      country: kycData.country,
      docType: kycData.docType,
      docNumber: kycData.docNumber,
      department: kycData.department,
      municipality: kycData.municipality,
      neighborhood: kycData.neighborhood,
      addressDesc: kycData.addressDesc,
    }
    await onSaveKycDraft(draftData)
  }

  const handleSubmitKyc = async () => {
    const submitData: KycDraft = {
      fullName: kycData.fullName,
      birthDate: kycData.birthDate,
      country: kycData.country,
      docType: kycData.docType,
      docNumber: kycData.docNumber,
    }
    await onSubmitKyc(submitData)
  }

  const startVerification = () => {
    setCurrentStep(1)
  }

  const checkVerificationStatus = () => {
    const label = getStatusInfo(kycStatus)?.label || "Pendiente"
    toast.info(`Estado actual de verificación: ${label}`)
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Verificación de Identidad</h2>
          <p className="text-muted-foreground">
            Protege tus transacciones y accede a todas las funciones de NMHN verificando tu identidad según
            regulaciones internacionales KYC/AML.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`${statusInfo.color} flex items-center gap-1`}>
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          <span className="text-sm text-muted-foreground">Actualizado: {lastUpdate}</span>
        </div>
      </div>

      

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seguridad, confianza y cumplimiento legal</CardTitle>
          <CardDescription>
            En NMHN trabajamos con altos estándares de seguridad para proteger tus operaciones. La verificación de
            identidad es un proceso obligatorio que nos permite cumplir con normativas internacionales contra fraude y
            lavado de dinero (KYC/AML), brindarte un entorno de confianza en cada transacción y garantizar acceso
            completo a todas las funcionalidades de la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Tu información se mantiene segura y encriptada bajo protocolos internacionales de protección de datos. El
              proceso de revisión puede tomar entre 24 y 48 horas hábiles.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progreso del proceso</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((step) => {
          const Icon = step.icon as any
          const isDone =
            (step.id === 1 && step1Done) ||
            (step.id === 2 && step2Done) ||
            (step.id === 3 && step3Done) ||
            (step.id === 4 && step4Done) ||
            (step.id === 5 && step5Done)
          const isActive = currentStep === step.id
          return (
            <div
              key={step.id}
              role="button"
              tabIndex={0}
              onClick={() => handleGoToStep(step.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleGoToStep(step.id)}
              className={`flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer outline-none focus:ring-2 focus:ring-primary ${isActive ? "bg-muted/50" : "bg-card"}`}
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={`rounded-full p-2 ${
                  isDone
                    ? "bg-green-100 text-green-700"
                    : isActive
                    ? "bg-blue-100 text-blue-700"
                    : "bg-muted text-muted-foreground"
                }`}
                title={isDone ? "Completado" : isActive ? "En progreso" : "Pendiente"}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">{step.title}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div ref={wizardRef}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">{currentStep}</span>
            {currentStep === 1 && "Datos personales"}
            {currentStep === 2 && "Documento de identidad"}
            {currentStep === 3 && "Selfie de validación"}
            {currentStep === 4 && "Comprobante de domicilio"}
            {currentStep === 5 && "Revisión y envío"}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && "Ingresa tu nombre completo, fecha de nacimiento y país."}
            {currentStep === 2 && "Sube el documento de identidad (frente y reverso)."}
            {currentStep === 3 && "Tómate una selfie en tiempo real para confirmar tu identidad."}
            {currentStep === 4 && "Adjunta un comprobante de domicilio reciente (≤ 3 meses)."}
            {currentStep === 5 && "Revisa tu información y envía tu verificación para su evaluación."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre legal completo *</Label>
                <Input id="fullName" value={kycData.fullName} onChange={(e) => setKycData((prev) => ({ ...prev, fullName: e.target.value }))} placeholder="Como aparece en su documento" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
                <Input id="birthDate" type="date" value={kycData.birthDate} onChange={(e) => setKycData((prev) => ({ ...prev, birthDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>País</Label>
                <Input value={kycData.country} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docType">Tipo de documento *</Label>
                <Select value={kycData.docType} onValueChange={(value: any) => setKycData((prev) => ({ ...prev, docType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="docNumber">Número de documento *</Label>
                <Input id="docNumber" value={kycData.docNumber} onChange={(e) => setKycData((prev) => ({ ...prev, docNumber: e.target.value }))} placeholder="Ingrese el número sin espacios ni guiones" />
              </div>
              <div className="space-y-2">
                <Label>Departamento *</Label>
                <Select
                  value={kycData.department}
                  onValueChange={(value) => {
                    setKycData((prev) => ({ ...prev, department: value, municipality: "" }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione el departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(departmentsToMunicipalities).map((dep) => (
                      <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Municipio *</Label>
                <Select
                  value={kycData.municipality}
                  onValueChange={(value) => setKycData((prev) => ({ ...prev, municipality: value }))}
                  disabled={!kycData.department}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={kycData.department ? "Seleccione el municipio" : "Seleccione un departamento primero"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(kycData.department ? departmentsToMunicipalities[kycData.department] : []).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Colonia/Barrio/Aldea *</Label>
                <Input value={kycData.neighborhood} onChange={(e) => setKycData((prev) => ({ ...prev, neighborhood: e.target.value }))} placeholder="Ej. Col. Tara / Barrio Abajo" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descripción de calle / bloque / #casa / #apartamento *</Label>
                <Input value={kycData.addressDesc} onChange={(e) => setKycData((prev) => ({ ...prev, addressDesc: e.target.value }))} placeholder="Ej. Calle 3, bloque B, casa #24, apto 3B" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Documento - Lado frontal *</Label>
                {kycData.documentFront ? (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{kycData.documentFront.name}</p>
                        <p className="text-sm text-muted-foreground">{(kycData.documentFront.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveDocument("documentFront")}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Suba la parte frontal de su documento</p>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload("documentFront", e.target.files[0])} className="hidden" id="documentFront" />
                    <Button asChild variant="outline" disabled={uploading.documentFront}>
                      <label htmlFor="documentFront" className="cursor-pointer flex items-center gap-2">
                        {uploading.documentFront && <Loader2 className="h-4 w-4 animate-spin" />}
                        {uploading.documentFront ? "Subiendo..." : "Seleccionar archivo"}
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Documento - Lado reverso *</Label>
                {kycData.documentBack ? (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{kycData.documentBack.name}</p>
                        <p className="text-sm text-muted-foreground">{(kycData.documentBack.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveDocument("documentBack")}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Suba la parte trasera de su documento</p>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload("documentBack", e.target.files[0])} className="hidden" id="documentBack" />
                    <Button asChild variant="outline" disabled={uploading.documentBack}>
                      <label htmlFor="documentBack" className="cursor-pointer flex items-center gap-2">
                        {uploading.documentBack && <Loader2 className="h-4 w-4 animate-spin" />}
                        {uploading.documentBack ? "Subiendo..." : "Seleccionar archivo"}
                      </label>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Selfie con documento *</Label>
                {kycData.selfie ? (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Camera className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{kycData.selfie.name}</p>
                        <p className="text-sm text-muted-foreground">{(kycData.selfie.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                      <Button variant="outline" size="sm" onClick={onRetakeSelfie}><Camera className="h-4 w-4 mr-1" />Retomar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Toma una selfie sosteniendo tu documento</p>
                    <input type="file" accept="image/*;capture=camera" capture="user" onChange={(e) => e.target.files?.[0] && handleFileUpload("selfie", e.target.files[0])} className="hidden" id="selfie" />
                    <div className="flex items-center gap-2 justify-center">
                      <Button asChild variant="outline" disabled={uploading.selfie}>
                        <label htmlFor="selfie" className="cursor-pointer flex items-center gap-2">
                          {uploading.selfie ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                          {uploading.selfie ? "Subiendo..." : "Subir desde archivos"}
                        </label>
                      </Button>
                      <Button variant="outline" onClick={() => openCamera("user")}>
                        <Camera className="h-4 w-4 mr-1" /> Usar cámara
                      </Button>
                    </div>
                    {isCameraOpen && (
                      <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="w-full max-w-md bg-card border border-border rounded-lg p-4 space-y-3">
                          <div className="text-sm text-muted-foreground">Apunta tu rostro y el documento visible</div>
                          <video ref={videoRef} className="w-full rounded-md bg-black" playsInline muted />
                          <div className="flex items-center justify-between gap-2">
                            <Button variant="outline" onClick={toggleCameraFacing}>Cambiar cámara</Button>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={closeCamera}>Cancelar</Button>
                              <Button onClick={takePhoto} className="bg-green-600 hover:bg-green-700">Capturar</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Comprobante de domicilio *</Label>
                {kycData.addressProof ? (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{kycData.addressProof.name}</p>
                        <p className="text-sm text-muted-foreground">{(kycData.addressProof.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveDocument("addressProof")}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Adjunta un recibo de servicios o estado bancario (≤ 3 meses)</p>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload("addressProof", e.target.files[0])} className="hidden" id="addressProof" />
                    <Button asChild variant="outline" disabled={uploading.addressProof}>
                      <label htmlFor="addressProof" className="cursor-pointer flex items-center gap-2">
                        {uploading.addressProof && <Loader2 className="h-4 w-4 animate-spin" />}
                        {uploading.addressProof ? "Subiendo..." : "Seleccionar archivo"}
                      </label>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Nuestro sistema verificará automáticamente tus datos. Si es necesario, un agente realizará una revisión
                  manual. Recibirás una notificación por correo cuando se complete el proceso.
                </AlertDescription>
              </Alert>
              <div className="text-sm text-muted-foreground">Asegúrate de que toda la información y archivos cargados sean legibles y estén actualizados.</div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
            <div className="flex gap-3">
              {currentStep > 1 && (
                <Button variant="outline" onClick={() => setCurrentStep((prev) => prev - 1)}>Anterior</Button>
              )}
              <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft}>
                <span className="flex items-center gap-2">{isSavingDraft && <Loader2 className="h-4 w-4 animate-spin" />}{isSavingDraft ? "Guardando..." : "Guardar borrador"}</span>
              </Button>
            </div>

            <div className="flex gap-3 sm:ml-auto">
              {currentStep < 5 ? (
                <Button onClick={handleNext} disabled={!canProceed}>Continuar</Button>
              ) : (
                <Button onClick={handleSubmitKyc} disabled={!isReadyToSubmit || kycStatus === "review" || isSubmitting} className="bg-green-600 hover:bg-green-700">
                  <span className="flex items-center gap-2">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{kycStatus === "review" ? "Enviado" : isSubmitting ? "Enviando..." : "Enviar verificación"}</span>
                </Button>
              )}
            </div>
          </div>

          {(!canProceed || (currentStep === 5 && !isReadyToSubmit)) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Complete todos los campos requeridos (*) para continuar.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Beneficios de verificar tu cuenta</CardTitle>
          <CardDescription>
            Al completar la verificación, desbloqueas límites más altos y funciones exclusivas, con mayor seguridad en
            todas tus operaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Límites más altos de transacciones</div>
              <div className="text-sm text-muted-foreground">Envía y recibe montos mayores con respaldo de seguridad.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Acceso a subastas y pagos garantizados</div>
              <div className="text-sm text-muted-foreground">Participa en funciones exclusivas y acuerdos protegidos.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Mayor seguridad y confianza</div>
              <div className="text-sm text-muted-foreground">Construye tu reputación y reduce riesgos de fraude.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Transacciones respaldadas</div>
              <div className="text-sm text-muted-foreground">Protección y soporte en cada operación que realices.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preguntas frecuentes</CardTitle>
          <CardDescription>Resuelve dudas comunes sobre el proceso de verificación.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>¿Qué documentos puedo usar para verificar mi identidad?</AccordionTrigger>
              <AccordionContent> Aceptamos DNI, pasaporte o licencia de conducir vigente. Asegúrate de que las imágenes sean legibles.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>¿Cuánto tarda el proceso de verificación?</AccordionTrigger>
              <AccordionContent> Generalmente entre 24 y 48 horas hábiles, dependiendo del volumen de solicitudes.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>¿Cómo sé si mis datos están seguros?</AccordionTrigger>
              <AccordionContent> Usamos cifrado de nivel bancario y protocolos internacionales de protección de datos. Solo compartimos lo necesario con proveedores de verificación.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>¿Qué pasa si no completo mi verificación?</AccordionTrigger>
              <AccordionContent> Podrás usar NMHN de forma limitada, sin acceso a funciones avanzadas ni a transacciones garantizadas.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}


