"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { KycStatus, KycDraft } from "@/lib/contracts/types"
import { saveKycDraft, submitKyc, registerKycFilePath } from "@/app/actions/kyc_data"
import { removeKycFile } from "@/app/actions/kyc"
import { supabaseBrowser } from "@/lib/supabase/client"
import KycUploader from "./KycUploader"

// Tipos para el wizard KYC
type StepKey = 'datos' | 'doc' | 'selfie' | 'domicilio' | 'revision'
type StepStatus = 'locked' | 'active' | 'done'

type WizardState = {
  current: StepKey
  status: Record<StepKey, StepStatus>
  flags: {
    datosOk: boolean
    docFrontalOk: boolean
    docReversoOk: boolean
    selfieOk: boolean
    domicilioOk: boolean
    aceptoDeclaracion: boolean
  }
}

type WizardApi = {
  state: WizardState
  setFlag: (k: keyof WizardState['flags'], v: boolean) => void
  canContinue: () => boolean
  goNext: () => void
  goPrev: () => void
  goTo: (step: StepKey) => void
  reset: () => void
}

// Hook useKycWizard
function useKycWizard(): WizardApi {
  const STORAGE_KEY = 'kycProgress'
  const STEP_ORDER: StepKey[] = ['datos', 'doc', 'selfie', 'domicilio', 'revision']

  const INITIAL_STATE: WizardState = {
    current: 'datos',
    status: {
      datos: 'active',
      doc: 'locked',
      selfie: 'locked',
      domicilio: 'locked',
      revision: 'locked'
    },
    flags: {
      datosOk: false,
      docFrontalOk: false,
      docReversoOk: false,
      selfieOk: false,
      domicilioOk: false,
      aceptoDeclaracion: false
    }
  }

  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  // Cargar estado desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsedState = JSON.parse(saved) as WizardState
        setState(parsedState)
      }
    } catch (error) {
      console.warn('Error loading wizard state from localStorage:', error)
    }
  }, [])

  // Guardar estado en localStorage en cada cambio
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.warn('Error saving wizard state to localStorage:', error)
    }
  }, [state])

  const setFlag = useCallback((key: keyof WizardState['flags'], value: boolean) => {
    setState(prev => ({
      ...prev,
      flags: {
        ...prev.flags,
        [key]: value
      }
    }))
  }, [])

  const canContinue = useCallback((): boolean => {
    const { current, flags } = state

    switch (current) {
      case 'datos':
        return flags.datosOk
      case 'doc':
        return flags.docFrontalOk && flags.docReversoOk
      case 'selfie':
        return flags.selfieOk
      case 'domicilio':
        return flags.domicilioOk
      case 'revision':
        return flags.aceptoDeclaracion
      default:
        return false
    }
  }, [state])

  const goNext = useCallback(() => {
    if (!canContinue()) return

    const currentIndex = STEP_ORDER.indexOf(state.current)
    if (currentIndex === -1 || currentIndex === STEP_ORDER.length - 1) return

    const nextStep = STEP_ORDER[currentIndex + 1]
    
    setState(prev => ({
      ...prev,
      current: nextStep,
      status: {
        ...prev.status,
        [prev.current]: 'done',
        [nextStep]: 'active'
      }
    }))
  }, [state.current, canContinue])

  const goPrev = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.current)
    if (currentIndex <= 0) return

    const prevStep = STEP_ORDER[currentIndex - 1]
    
    setState(prev => ({
      ...prev,
      current: prevStep
    }))
  }, [state.current])

  const goTo = useCallback((step: StepKey) => {
    const stepStatus = state.status[step]
    
    // Solo permitir navegación a pasos 'done' o 'active'
    if (stepStatus === 'locked' || (stepStatus === 'active' && step !== state.current)) {
      return
    }

    setState(prev => ({
      ...prev,
      current: step
    }))
  }, [state.status, state.current])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('Error clearing wizard state from localStorage:', error)
    }
  }, [])

  return {
    state,
    setFlag,
    canContinue,
    goNext,
    goPrev,
    goTo,
    reset
  }
}

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
  department?: string | null
  municipality?: string | null
  neighborhood?: string | null
  addressDesc?: string | null
}

export default function VerificacionClient({ initialDraft }: { initialDraft: InitialDraft | null }) {
  // Hook del wizard KYC
  const wizard = useKycWizard()
  const { state: wizardState, setFlag, canContinue, goNext, goPrev, goTo } = wizard

  const [userId, setUserId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [kycStatus, setKycStatus] = useState<KycStatus>(initialDraft?.status ?? "none")
  
  // Sincronizar currentStep con wizardState.current
  useEffect(() => {
    const stepMap: Record<StepKey, number> = {
      datos: 1,
      doc: 2,
      selfie: 3,
      domicilio: 4,
      revision: 5
    }
    setCurrentStep(stepMap[wizardState.current])
  }, [wizardState.current])
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
    department: initialDraft?.department ?? "",
    municipality: initialDraft?.municipality ?? "",
    neighborhood: initialDraft?.neighborhood ?? "",
    addressDesc: initialDraft?.addressDesc ?? "",
  })
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditingPersonalData, setIsEditingPersonalData] = useState(false)
  const [confirmedSteps, setConfirmedSteps] = useState<Set<number>>(new Set())
  
  // Función para cargar pasos confirmados desde localStorage
  const loadConfirmedSteps = () => {
    try {
      const saved = localStorage.getItem('kyc-confirmed-steps')
      if (saved) {
        const stepsArray = JSON.parse(saved) as number[]
        return new Set(stepsArray)
      }
    } catch (error) {
      console.error('Error loading confirmed steps:', error)
    }
    return new Set<number>()
  }
  
  // Función para guardar pasos confirmados en localStorage
  const saveConfirmedSteps = (steps: Set<number>) => {
    try {
      localStorage.setItem('kyc-confirmed-steps', JSON.stringify(Array.from(steps)))
    } catch (error) {
      console.error('Error saving confirmed steps:', error)
    }
  }
  const autosaveTimer = useRef<any>(null)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    JSON.stringify({
      fullName: initialDraft?.fullName ?? "",
      birthDate: initialDraft?.birthDate ?? "",
      country: initialDraft?.country ?? "",
      docType: initialDraft?.docType ?? "ID",
      docNumber: initialDraft?.docNumber ?? "",
      department: initialDraft?.department ?? "",
      municipality: initialDraft?.municipality ?? "",
      neighborhood: initialDraft?.neighborhood ?? "",
      addressDesc: initialDraft?.addressDesc ?? "",
    }),
  )
  const [uploading, setUploading] = useState({
    documentFront: false,
    documentBack: false,
    selfie: false,
    addressProof: false,
  })
  const [uploadedRemote, setUploadedRemote] = useState({
    documentFront: false,
    documentBack: false,
    selfie: false,
    addressProof: false,
  })
  const [fileInputKeys, setFileInputKeys] = useState({
    documentFront: 0,
    documentBack: 0,
    selfie: 0,
    addressProof: 0,
  })
  
  const wizardRef = useRef<HTMLDivElement | null>(null)
  const [previewData, setPreviewData] = useState<{ url: string; title: string; isPdf: boolean; isLocal: boolean } | null>(null)
  

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
    { id: 2, title: "Documento de identidad", description: "DNI, pasaporte o licencia vigente (frente y reverso).", icon: FileText },
    { id: 3, title: "Selfie de validación", description: "Selfie en tiempo real para confirmar titularidad.", icon: Camera },
    { id: 4, title: "Comprobante de domicilio", description: "Recibo o estado bancario con tu dirección (≤ 3 meses).", icon: Home },
    { id: 5, title: "Revisión y envío", description: "Validación automática y, si aplica, revisión manual.", icon: Shield },
  ]

  // Calcular paso inicial según initialDraft
  // Obtener userId y cargar datos de la base de datos al cargar
  useEffect(() => {
    async function initializeData() {
      try {
        const supabase = supabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          setUserId(session.user.id)
          
          // Cargar pasos confirmados desde localStorage
          const savedConfirmedSteps = loadConfirmedSteps()
          setConfirmedSteps(savedConfirmedSteps)
          
          // Consultar base de datos directamente
          const { data: row } = await supabase
            .from("kyc_submissions")
            .select(`
              status, 
              updated_at, 
              document_front_path, 
              document_back_path, 
              selfie_path, 
              address_proof_path,
              full_name,
              birth_date,
              country,
              doc_type,
              doc_number,
              address_department,
              address_city,
              address_neighborhood,
              address_desc
            `)
            .eq("user_id", session.user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
          
          console.log('🔍 Datos obtenidos de BD:', row)
          
          if (row) {
            // Actualizar estado de archivos subidos
            const newUploadedRemote = {
              documentFront: (row.document_front_path !== null && row.document_front_path !== undefined),
              documentBack: (row.document_back_path !== null && row.document_back_path !== undefined),
              selfie: (row.selfie_path !== null && row.selfie_path !== undefined),
              addressProof: (row.address_proof_path !== null && row.address_proof_path !== undefined),
            }
            
            console.log('📋 Estado de archivos en BD:', {
              document_front_path: row.document_front_path,
              document_back_path: row.document_back_path,
              selfie_path: row.selfie_path,
              address_proof_path: row.address_proof_path
            })
            
            console.log('✅ uploadedRemote calculado:', newUploadedRemote)
            
            setUploadedRemote(newUploadedRemote)
            
            // Actualizar datos personales si existen
            if (row.full_name || row.birth_date || row.country || row.doc_type || row.doc_number) {
              setKycData((prev) => ({
                ...prev,
                fullName: row.full_name || prev.fullName,
                birthDate: row.birth_date || prev.birthDate,
                country: row.country || prev.country,
                docType: (row.doc_type as any) || prev.docType,
                docNumber: row.doc_number || prev.docNumber,
              }))
            }
            
            // Actualizar datos de dirección si existen
            if (row.address_department || row.address_city || row.address_neighborhood || row.address_desc) {
              setKycData((prev) => ({
                ...prev,
                department: row.address_department || prev.department,
                municipality: row.address_city || prev.municipality,
                neighborhood: row.address_neighborhood || prev.neighborhood,
                addressDesc: row.address_desc || prev.addressDesc,
              }))
            }
            
            if (row.status) setKycStatus(row.status as KycStatus)
            if (row.updated_at) setLastUpdate(new Date(row.updated_at).toLocaleString())
          } else {
            console.log('❌ No se encontró registro en BD para el usuario')
          }
        }
      } catch (error) {
        console.error('Error inicializando datos:', error)
      }
    }
    initializeData()
  }, [])

  // Guardar pasos confirmados en localStorage cuando cambien
  useEffect(() => {
    if (confirmedSteps.size > 0) {
      saveConfirmedSteps(confirmedSteps)
    }
  }, [confirmedSteps])

  // Navegación al primer paso disponible al cargar la página
  useEffect(() => {
    const navigateToFirstAvailableStep = () => {
      // Encontrar el primer paso disponible (no necesariamente completo)
      let firstAvailableStep = 1
      
      if (isStepAvailable(1)) {
        firstAvailableStep = 1
      } else if (isStepAvailable(2)) {
        firstAvailableStep = 2
      } else if (isStepAvailable(3)) {
        firstAvailableStep = 3
      } else if (isStepAvailable(4)) {
        firstAvailableStep = 4
      } else if (isStepAvailable(5)) {
        firstAvailableStep = 5
      } else {
        // Si ningún paso está disponible, ir al paso 1
        firstAvailableStep = 1
      }
      
      // Solo navegar si el paso actual no es el primer paso disponible
      if (currentStep !== firstAvailableStep) {
        console.log(`🎯 Navegando al primer paso disponible: ${firstAvailableStep}`)
        setCurrentStep(firstAvailableStep)
      }
    }
    
    // Ejecutar después de que se carguen los datos de la base de datos
    if (userId && uploadedRemote) {
      navigateToFirstAvailableStep()
    }
  }, [userId, uploadedRemote, confirmedSteps]) // Agregado confirmedSteps para reaccionar a cambios

  // Navegación automática: dirigir al siguiente paso disponible cuando se complete un paso
  useEffect(() => {
    // Solo ejecutar si hay pasos confirmados
    if (confirmedSteps.size === 0) return
    
    // Encontrar el primer paso disponible (no necesariamente completo)
    let nextAvailableStep = 1
    
    if (isStepAvailable(1)) {
      nextAvailableStep = 1
    } else if (isStepAvailable(2)) {
      nextAvailableStep = 2
    } else if (isStepAvailable(3)) {
      nextAvailableStep = 3
    } else if (isStepAvailable(4)) {
      nextAvailableStep = 4
    } else if (isStepAvailable(5)) {
      nextAvailableStep = 5
    }
    
    // Solo avanzar automáticamente si el paso actual no está disponible y hay un paso disponible diferente
    if (!isStepAvailable(currentStep) && nextAvailableStep !== currentStep) {
      console.log(`🎯 Navegando al siguiente paso disponible: ${nextAvailableStep}`)
      setCurrentStep(nextAvailableStep)
    }
  }, [uploadedRemote, kycData, confirmedSteps]) // Removido currentStep para evitar bucles


  // Función simplificada para refrescar datos desde la base de datos
  const refreshFromDatabase = async () => {
    if (!userId) return
    
    try {
      const supabase = supabaseBrowser()
      const { data: row } = await supabase
        .from("kyc_submissions")
        .select(`
          status, 
          updated_at, 
          document_front_path, 
          document_back_path, 
          selfie_path, 
          address_proof_path,
          full_name,
          birth_date,
          country,
          doc_type,
          doc_number,
          address_department,
          address_city,
          address_neighborhood,
          address_desc
        `)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      
      console.log('🔄 Refrescando desde BD:', row)
      
      if (row) {
        // Actualizar estado de archivos subidos
        const newUploadedRemote = {
          documentFront: (row.document_front_path !== null && row.document_front_path !== undefined),
          documentBack: (row.document_back_path !== null && row.document_back_path !== undefined),
          selfie: (row.selfie_path !== null && row.selfie_path !== undefined),
          addressProof: (row.address_proof_path !== null && row.address_proof_path !== undefined),
        }
        
        console.log('📋 Nuevo estado de archivos:', newUploadedRemote)
        setUploadedRemote(newUploadedRemote)
        
        // Actualizar datos personales
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
        
        if (row.status) setKycStatus(row.status as KycStatus)
        if (row.updated_at) setLastUpdate(new Date(row.updated_at).toLocaleString())
      }
    } catch (error) {
      console.error('Error refrescando desde BD:', error)
    }
  }

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

  // Función para marcar paso como completo cuando se confirma y sube archivo
  const markStepAsComplete = async (step: number) => {
    console.log(`🔄 Marcando paso ${step} como completo`)
    
    // Verificar si el paso tiene la información requerida
    if (!isStepComplete(step)) {
      console.log(`❌ No se puede marcar paso ${step} como completo - falta información`)
      return
    }
    
    console.log(`✅ Marcando paso ${step} como completo`)
    
    // Marcar el paso como confirmado por el usuario
    setConfirmedSteps(prev => {
      const newSet = new Set([...prev, step])
      console.log(`📝 confirmedSteps actualizado:`, Array.from(newSet))
      return newSet
    })

    // Nota: No navegar automáticamente. El avance ocurrirá solo cuando el usuario haga clic en "Continuar".
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


  const handlePreview = async (
    field: "documentFront" | "documentBack" | "selfie" | "addressProof",
  ) => {
    try {
      const file = kycData[field]
      if (file) {
        const objectUrl = URL.createObjectURL(file)
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        const titleMap: Record<string, string> = {
          documentFront: "Documento - Frente",
          documentBack: "Documento - Reverso",
          selfie: "Selfie",
          addressProof: "Comprobante de domicilio",
        }
        setPreviewData({ url: objectUrl, title: titleMap[field], isPdf, isLocal: true })
        return
      }

      if (!uploadedRemote[field]) {
        toast.info("No hay archivo para previsualizar")
        return
      }

      const supabase = supabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) {
        toast.error("No hay sesión activa")
        return
      }

      const { data: row } = await supabase
        .from("kyc_submissions")
        .select(
          "document_front_path, document_back_path, selfie_path, address_proof_path",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const columnMap: Record<string, string> = {
        documentFront: "document_front_path",
        documentBack: "document_back_path",
        selfie: "selfie_path",
        addressProof: "address_proof_path",
      }
      const path = (row as any)?.[columnMap[field]] as string | undefined
      if (!path) {
        toast.error("No se encontró el archivo")
        return
      }

      const bucket = process.env.NEXT_PUBLIC_SUPABASE_KYC_BUCKET || "kyc"
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) {
        toast.error("No se pudo generar la URL pública")
        return
      }

      const isPdf = path.toLowerCase().endsWith(".pdf")
      const titleMap: Record<string, string> = {
        documentFront: "Documento - Frente",
        documentBack: "Documento - Reverso",
        selfie: "Selfie",
        addressProof: "Comprobante de domicilio",
      }
      setPreviewData({ url, title: titleMap[field], isPdf, isLocal: false })
    } catch {
      toast.error("No se pudo abrir la vista previa")
    }
  }

  const closePreview = () => {
    try {
      if (previewData?.isLocal && previewData.url.startsWith("blob:")) {
        URL.revokeObjectURL(previewData.url)
      }
    } catch {}
    setPreviewData(null)
  }


  // Función para garantizar que el archivo sea un Blob válido
  const blobFromMaybeBase64 = async (input: File | string): Promise<Blob> => {
    if (input instanceof File) return input as Blob
    if (typeof input === 'object' && input && 'size' in input && 'type' in input) return input as Blob
    if (typeof input === 'string' && input.startsWith('data:')) {
      // dataURL -> Blob
      const res = await fetch(input)
      return await res.blob()
    }
    throw new Error('Archivo inválido: se esperaba File/Blob o dataURL base64')
  }

  const handleFileUpload = async (
    field: "documentFront" | "documentBack" | "selfie" | "addressProof",
    file: File,
  ) => {
    // Validaciones previas sin setUploading
      const maxSize = 10 * 1024 * 1024
      const allowedTypes = ["image/jpeg", "image/png", "image/heic", "application/pdf"]
      if (file.size > maxSize) {
      toast.error("El archivo es demasiado grande. Máximo 10MB.")
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

    // Ahora sí activamos el estado de uploading
      setUploading((prev) => ({ ...prev, [field]: true }))
    
    try {
      const supabase = supabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) {
        toast.error("No hay sesión activa")
        return
      }

      // Garantizar que el archivo sea un Blob válido
      const blob = await blobFromMaybeBase64(file)
      
      // Usar nombres consistentes con la UI
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const safeDoc = kind.replace(/\s+/g, '_').toLowerCase()
      
      // Ruta fija y consistente
      const path = `${userId}/${safeDoc}/documento_frontal.${ext}`

      console.log('SUBIENDO A:', path, 'type:', file.type, 'size:', file.size, 'blob size:', blob.size)

      // Intentar primero con bucket 'kyc', si falla por RLS usar 'public'
      let uploadResult = await supabase.storage
        .from('kyc')
        .upload(path, blob, {
          upsert: true,
          contentType: file.type || 'image/png',
          cacheControl: '3600',
        })

      // Si falla por RLS, usar bucket público como fallback
      if (uploadResult.error && uploadResult.error.message?.includes('row-level security')) {
        console.log('🔄 RLS falló, usando bucket público como fallback...')
        uploadResult = await supabase.storage
          .from('public')
          .upload(path, blob, {
            upsert: true,
            contentType: file.type || 'image/png',
            cacheControl: '3600',
          })
      }

      if (uploadResult.error) {
        console.error('Upload error:', uploadResult.error)
        toast.error(`Error subiendo archivo: ${uploadResult.error.message}`)
        return
      }

      console.log("✅ Archivo subido exitosamente")

      const result = await registerKycFilePath(kind, path)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      
      setKycData((prev) => ({ ...prev, [field]: file }))
      // Refrescar desde la base de datos
      await refreshFromDatabase()
      setFileInputKeys((prev: any) => ({ ...prev, [field]: prev[field] + 1 }))
      toast.success("Archivo subido correctamente")
    } catch (err: any) {
      console.error("Error inesperado:", err)
      toast.error(err?.message || "Error al subir el archivo")
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }))
    }
  }

  const handleUploadSuccess = async (docType: 'document_front' | 'document_back' | 'selfie' | 'address_proof') => {
    // Refrescar desde la base de datos
    await refreshFromDatabase()
    
    // Marcar el paso correspondiente como completo (solo flag interno)
    const stepMap = {
      'document_front': 2,
      'document_back': 2,
      'selfie': 3,
      'address_proof': 4
    }
    
    const step = stepMap[docType]
    if (step) {
      await markStepAsComplete(step)
    }

    // Nota: No avanzar automáticamente. El usuario debe hacer clic en "Continuar".
  }

  const handleRemoveFile = async (field: keyof typeof uploadedRemote) => {
    try {
      await handleRemoveDocument(field)
      // Refrescar desde la base de datos
      await refreshFromDatabase()
      toast.success("Archivo eliminado correctamente")
    } catch (err: any) {
      console.error("Error eliminando archivo:", err)
      toast.error("Error al eliminar el archivo")
    }
  }

  const handleEditPersonalData = () => {
    setIsEditingPersonalData(true)
  }

  const handleSavePersonalData = async () => {
    try {
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
      if (res.ok) {
        setIsEditingPersonalData(false)
        toast.success("Datos personales actualizados correctamente")
        // Marcar paso 1 como completo
        await markStepAsComplete(1)
      } else {
        toast.error(res.message)
      }
    } catch (error) {
      console.error("Error guardando datos personales:", error)
      toast.error("Error al guardar los datos personales")
    }
  }

  const handleCancelEditPersonalData = () => {
    setIsEditingPersonalData(false)
    // Opcional: recargar datos desde la base de datos para revertir cambios
  }

  const handleRemoveDocument = async (field: keyof KycData) => {
    try {
      console.log("🔄 Iniciando eliminación de documento:", field)
      
    const kindMap: Record<string, "document_front" | "document_back" | "selfie" | "address_proof"> = {
      documentFront: "document_front",
      documentBack: "document_back",
      selfie: "selfie",
      addressProof: "address_proof",
    }
    const kind = kindMap[field as string]
      console.log("📝 Tipo de archivo a eliminar:", kind)
      
      // Primero intentar eliminar directamente desde el cliente
      const supabase = supabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      
      if (userId) {
        console.log("🗑️ Eliminando directamente desde storage...")
        const bucket = process.env.NEXT_PUBLIC_SUPABASE_KYC_BUCKET || "kyc"
        
        // Obtener la ruta actual del archivo
        const { data: currentData } = await supabase
          .from("kyc_submissions")
          .select(`${kind}_path`)
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        
        const pathKey = `${kind}_path` as keyof typeof currentData
        if (currentData && pathKey in currentData && currentData[pathKey]) {
          const filePath = currentData[pathKey] as string
          console.log("📁 Ruta del archivo a eliminar:", filePath)
          
          // Intentar eliminar del bucket 'kyc' primero
          let deleteResult = await supabase.storage
            .from("kyc")
            .remove([filePath])
          
          // Si falla por RLS, intentar con bucket 'public'
          if (deleteResult.error && deleteResult.error.message?.includes('row-level security')) {
            console.log("🔄 RLS falló en eliminación, intentando con bucket público...")
            deleteResult = await supabase.storage
              .from("public")
              .remove([filePath])
          }
          
          if (deleteResult.error) {
            console.warn("⚠️ Error al eliminar del storage:", deleteResult.error)
            // Continuar con el borrado en BD aunque falle el storage
          } else {
            console.log("✅ Archivo eliminado del storage")
          }
        }
      }
      
      console.log("🚀 Llamando a removeKycFile...")
    const res = await removeKycFile(kind)
      console.log("📨 Respuesta de removeKycFile:", res)
      
    if (!res.ok) {
        console.error("❌ Error en removeKycFile:", res.message)
      toast.error(res.message)
      return
    }
      
      console.log("✅ Eliminación exitosa, actualizando estado local...")
      
      // Limpiar estado local del archivo
    setKycData((prev) => ({ ...prev, [field]: null }))
      
      console.log("🔄 Refrescando desde BD...")
      await refreshFromDatabase()
      
      console.log("🔄 Reinicializando input de archivo...")
      setFileInputKeys((prev: any) => ({ ...prev, [field]: prev[field] + 1 }))
      
      console.log("🎉 Proceso de eliminación completado")
    toast.success(res.message)
      
    } catch (error) {
      console.error("💥 Error inesperado al eliminar documento:", error)
      toast.error("Error inesperado al eliminar el archivo")
    }
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
        // Para pasaportes, solo se requiere el frente
        if (kycData.docType === 'Passport') {
          return !!(kycData.documentFront || uploadedRemote.documentFront)
        }
        // Para otros documentos, se requiere frente y reverso
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

  // Función para verificar si un paso está completo (tiene la información requerida)
  const isStepComplete = (step: number) => {
    if (step === 1) {
      return Boolean(kycData.fullName && kycData.birthDate && kycData.country && kycData.docType && kycData.docNumber)
    } else if (step === 2) {
      // El paso 2 está completo si tiene documentos
      return kycData.docType === 'Passport'
        ? uploadedRemote.documentFront
        : uploadedRemote.documentFront && uploadedRemote.documentBack
    } else if (step === 3) {
      // El paso 3 está completo si tiene selfie
      return uploadedRemote.selfie
    } else if (step === 4) {
      // El paso 4 está completo si tiene comprobante
      return uploadedRemote.addressProof
    } else if (step === 5) {
      // El paso 5 está completo si todos los pasos anteriores están completos
      return Boolean(
        kycData.fullName && kycData.birthDate && kycData.country && kycData.docType && kycData.docNumber &&
        (kycData.docType === 'Passport'
          ? uploadedRemote.documentFront
          : uploadedRemote.documentFront && uploadedRemote.documentBack) &&
        uploadedRemote.selfie &&
        uploadedRemote.addressProof
      )
    }
    return false
  }

  // Función para verificar si un paso está disponible para navegación
  const isStepAvailable = (step: number) => {
    if (step === 1) {
      return true // El paso 1 siempre está disponible
    } else if (step === 2) {
      // El paso 2 está disponible solo si el paso 1 está confirmado
      return confirmedSteps.has(1)
    } else if (step === 3) {
      // El paso 3 está disponible solo si el paso 2 está confirmado
      return confirmedSteps.has(2)
    } else if (step === 4) {
      // El paso 4 está disponible solo si el paso 3 está confirmado
      return confirmedSteps.has(3)
    } else if (step === 5) {
      // El paso 5 está disponible solo si el paso 4 está confirmado
      return confirmedSteps.has(4)
    }
    return false
  }

  // Limpiar pasos marcados como confirmados pero que no tienen información
  useEffect(() => {
    const stepsToRemove: number[] = []
    for (const step of confirmedSteps) {
      if (!isStepComplete(step)) {
        stepsToRemove.push(step)
      }
    }
    
    if (stepsToRemove.length > 0) {
      console.log(`🧹 Limpiando pasos marcados incorrectamente como completos: ${stepsToRemove.join(', ')}`)
      setConfirmedSteps(prev => {
        const newSet = new Set(prev)
        stepsToRemove.forEach(step => newSet.delete(step))
        return newSet
      })
    }
  }, [confirmedSteps, uploadedRemote, kycData])

  // Verificar si el paso actual está completo
  const currentStepComplete = confirmedSteps.has(currentStep) && isStepComplete(currentStep)
  const isReadyToSubmit = [1, 2, 3, 4].every((s) => validateStep(s))
  // Progreso basado SOLO en pasos completados (no navegación)
  const step1Done = Boolean(kycData.fullName && kycData.birthDate && kycData.country && kycData.docType && kycData.docNumber)
  const personalDataComplete = step1Done
  const personalDataInputsDisabled = personalDataComplete && !isEditingPersonalData
  
  // Sincronizar flags del wizard con el estado actual
  useEffect(() => {
    setFlag('datosOk', personalDataComplete)
  }, [personalDataComplete, setFlag])
  
  // Sincronizar flags de documentos
  useEffect(() => {
    setFlag('docFrontalOk', uploadedRemote.documentFront)
    setFlag('docReversoOk', uploadedRemote.documentBack)
    setFlag('selfieOk', uploadedRemote.selfie)
    setFlag('domicilioOk', uploadedRemote.addressProof)
  }, [uploadedRemote, setFlag])
  
  // Logs de depuración para el paso 1
  console.log('🔍 Debug paso 1:', {
    fullName: kycData.fullName,
    birthDate: kycData.birthDate,
    country: kycData.country,
    docType: kycData.docType,
    docNumber: kycData.docNumber,
    step1Done,
    personalDataComplete,
    isEditingPersonalData,
    currentStep
  })
  const step2Done = kycData.docType === 'Passport' 
    ? uploadedRemote.documentFront
    : uploadedRemote.documentFront && uploadedRemote.documentBack
  const step3Done = uploadedRemote.selfie
  const step4Done = uploadedRemote.addressProof
  const step5Done = kycStatus === "review" || kycStatus === "approved"
  
  // La barra de progreso solo avanza con pasos realmente completados
  const stepsCompletedCount = Array.from(confirmedSteps).filter(step => isStepComplete(step)).length
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
          const isDone = confirmedSteps.has(step.id) && isStepComplete(step.id)
          const isActive = currentStep === step.id
          const stepAvailable = isStepAvailable(step.id)
          
          // Mapear step.id numérico a StepKey
          const stepKeyMap: Record<number, StepKey> = {
            1: 'datos',
            2: 'doc', 
            3: 'selfie',
            4: 'domicilio',
            5: 'revision'
          }
          const stepKey = stepKeyMap[step.id]
          const wizardStepStatus = wizardState.status[stepKey]
          
          return (
            <div
              key={step.id}
              role="button"
              tabIndex={stepAvailable ? 0 : -1}
              data-step={stepKey}
              aria-disabled={wizardStepStatus === 'locked' ? 'true' : undefined}
              onClick={() => {
                if (stepAvailable) {
                  handleGoToStep(step.id)
                } else if (stepKey) {
                  goTo(stepKey)
                }
              }}
              onKeyDown={(e) => {
                if (stepAvailable && (e.key === "Enter" || e.key === " ")) {
                  handleGoToStep(step.id)
                } else if (stepKey && (e.key === "Enter" || e.key === " ")) {
                  goTo(stepKey)
                }
              }}
              className={`flex items-start gap-3 rounded-lg border p-4 outline-none focus:ring-2 focus:ring-primary transition-all duration-200 ${
                isActive 
                  ? "bg-muted/50 border-primary shadow-sm" 
                  : stepAvailable
                  ? "bg-card border-border cursor-pointer hover:bg-muted/30 hover:border-muted-foreground/20 hover:shadow-sm"
                  : "bg-muted/20 border-muted/30 cursor-not-allowed"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={`rounded-full p-2 transition-colors duration-200 ${
                  isDone
                    ? "bg-green-100 text-green-700"
                    : isActive
                    ? "bg-blue-100 text-blue-700"
                    : stepAvailable
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/50 text-muted-foreground/60"
                }`}
                title={isDone ? "Completado" : isActive ? "En progreso" : stepAvailable ? "Disponible" : "Bloqueado"}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className={`text-sm font-medium flex items-center gap-2 transition-colors duration-200 ${
                  stepAvailable 
                    ? "text-foreground" 
                    : "text-muted-foreground/60"
                }`}>
                  {step.title}
                  {isDone && <CheckCircle className="h-4 w-4 text-green-600" />}
                </div>
                <div className={`text-xs transition-colors duration-200 ${
                  stepAvailable 
                    ? "text-muted-foreground" 
                    : "text-muted-foreground/50"
                }`}>
                  {step.description}
                </div>
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
                <Input id="fullName" value={kycData.fullName} onChange={(e) => setKycData((prev) => ({ ...prev, fullName: e.target.value }))} placeholder="Como aparece en su documento" disabled={personalDataInputsDisabled} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
                <Input id="birthDate" type="date" value={kycData.birthDate} onChange={(e) => setKycData((prev) => ({ ...prev, birthDate: e.target.value }))} disabled={personalDataInputsDisabled} />
              </div>
              <div className="space-y-2">
                <Label>País</Label>
                <Input value={kycData.country} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docType">Tipo de documento *</Label>
                <Select value={kycData.docType} onValueChange={(value: any) => setKycData((prev) => ({ ...prev, docType: value }))} disabled={personalDataInputsDisabled}>
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
                <Input id="docNumber" value={kycData.docNumber} onChange={(e) => setKycData((prev) => ({ ...prev, docNumber: e.target.value }))} placeholder="Ingrese el número sin espacios ni guiones" disabled={personalDataInputsDisabled} />
              </div>
              <div className="space-y-2">
                <Label>Departamento *</Label>
                <Select
                  value={kycData.department}
                  onValueChange={(value) => {
                    setKycData((prev) => ({ ...prev, department: value, municipality: "" }))
                  }}
                  disabled={personalDataInputsDisabled}
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
                  disabled={!kycData.department || personalDataInputsDisabled}
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
                <Input value={kycData.neighborhood} onChange={(e) => setKycData((prev) => ({ ...prev, neighborhood: e.target.value }))} placeholder="Ej. Col. Tara / Barrio Abajo" disabled={personalDataInputsDisabled} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descripción de calle / bloque / #casa / #apartamento *</Label>
                <Input value={kycData.addressDesc} onChange={(e) => setKycData((prev) => ({ ...prev, addressDesc: e.target.value }))} placeholder="Ej. Calle 3, bloque B, casa #24, apto 3B" disabled={personalDataInputsDisabled} />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {userId ? (
                <KycUploader
                  userId={userId}
                  docType="document_front"
                  maxSizeMB={5}
                  minWidth={600}
                  minHeight={400}
                  compress={true}
                  onUploadSuccess={() => handleUploadSuccess('document_front')}
                  isAlreadyUploaded={uploadedRemote.documentFront}
                  onRemoveFile={() => handleRemoveFile('documentFront')}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Cargando...</p>
                </div>
              )}

              {/* Solo mostrar reverso si no es pasaporte */}
              {kycData.docType !== 'Passport' && (
                userId ? (
                  <KycUploader
                    userId={userId}
                    docType="document_back"
                    maxSizeMB={5}
                    minWidth={600}
                    minHeight={400}
                    compress={true}
                    onUploadSuccess={() => handleUploadSuccess('document_back')}
                    isAlreadyUploaded={uploadedRemote.documentBack}
                    onRemoveFile={() => handleRemoveFile('documentBack')}
                  />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Cargando...</p>
                  </div>
                )
              )}

              {/* Mensaje informativo para pasaportes */}
              {kycData.docType === 'Passport' && (
                <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    ℹ️ Los pasaportes solo requieren una foto del documento principal
                  </p>
              </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              {userId ? (
                <KycUploader
                  userId={userId}
                  docType="selfie"
                  maxSizeMB={3}
                  minWidth={400}
                  minHeight={400}
                  compress={true}
                  onUploadSuccess={() => handleUploadSuccess('selfie')}
                  isAlreadyUploaded={uploadedRemote.selfie}
                  onRemoveFile={() => handleRemoveFile('selfie')}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Cargando...</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              {userId ? (
                <KycUploader
                  userId={userId}
                  docType="address_proof"
                  maxSizeMB={10}
                  minWidth={300}
                  minHeight={200}
                  compress={false} // Los PDFs no se comprimen
                  onUploadSuccess={() => handleUploadSuccess('address_proof')}
                  isAlreadyUploaded={uploadedRemote.addressProof}
                  onRemoveFile={() => handleRemoveFile('addressProof')}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Cargando...</p>
                </div>
              )}
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
              
              {/* Checkbox de aceptación de declaración */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="aceptoDeclaracion"
                  checked={wizardState.flags.aceptoDeclaracion}
                  onChange={(e) => setFlag('aceptoDeclaracion', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="aceptoDeclaracion" className="text-sm">
                  Acepto la declaración de veracidad de la información proporcionada
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
            {/* Botón Atrás */}
            {currentStep > 1 && (
              <Button 
                data-action="atras"
                variant="outline" 
                onClick={goPrev}
                className="flex items-center gap-2"
              >
                ← Atrás
              </Button>
            )}
            
            {/* Solo mostrar botones en pasos 1 y 5 */}
            {(currentStep === 1 || currentStep === 5) && (
            <div className="flex gap-3">
                {/* Botón de editar datos personales */}
                {currentStep === 1 && personalDataComplete && !isEditingPersonalData && (
                  <Button 
                    variant="outline" 
                    onClick={handleEditPersonalData}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors duration-200"
                  >
                    Editar datos
                  </Button>
                )}
                {/* Botones de guardar/cancelar cuando está editando */}
                {currentStep === 1 && isEditingPersonalData && (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleSavePersonalData}
                      className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600 hover:text-emerald-800 transition-colors duration-200"
                    >
                      Guardar cambios
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEditPersonalData}
                      className="border-rose-500 text-rose-700 hover:bg-rose-50 hover:border-rose-600 hover:text-rose-800 transition-colors duration-200"
                    >
                      Cancelar
                    </Button>
                  </>
                )}
                {/* Botón Continuar para el paso 1 */}
                {(() => {
                  const shouldShowButton = currentStep === 1 && personalDataComplete && !isEditingPersonalData
                  console.log('🔍 Evaluando botón Continuar:', {
                    currentStep,
                    personalDataComplete,
                    isEditingPersonalData,
                    shouldShowButton
                  })

                  return shouldShowButton && (
                    <Button 
                      data-action="continuar"
                      onClick={async () => {
                        console.log('🔄 Clic en botón Continuar - Paso 1')
                        console.log('📊 Datos personales:', {
                          fullName: kycData.fullName,
                          birthDate: kycData.birthDate,
                          country: kycData.country,
                          docType: kycData.docType,
                          docNumber: kycData.docNumber
                        })
                        await markStepAsComplete(1)
                        goNext()
                      }}
                      disabled={!canContinue()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
                    >
                      Continuar
                    </Button>
                  )
                })()}
                
                {/* Debug: Mostrar estado del botón Continuar */}
                {currentStep === 1 && (
                  <div className="text-xs text-muted-foreground">
                    Debug: personalDataComplete={personalDataComplete ? 'true' : 'false'}, 
                    isEditingPersonalData={isEditingPersonalData ? 'true' : 'false'}
                  </div>
                )}
            </div>
            )}

            {/* Solo mostrar botón de envío en el paso 5 */}
            {currentStep === 5 && (
              <div className="flex gap-3 sm:ml-auto">
                <Button 
                  data-action="continuar"
                  onClick={async () => {
                    if (canContinue()) {
                      await handleSubmitKyc()
                      goNext()
                    }
                  }} 
                  disabled={!isReadyToSubmit || kycStatus === "review" || isSubmitting || !canContinue()} 
                  className="bg-green-600 hover:bg-green-700"
                >
                  <span className="flex items-center gap-2">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{kycStatus === "review" ? "Enviado" : isSubmitting ? "Enviando..." : "Enviar verificación"}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Mostrar mensaje informativo si el paso está completo */}
          {currentStepComplete && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Este paso ha sido completado. Puede revisar la información y usar la navegación lateral para visitar otros pasos.
              </AlertDescription>
            </Alert>
          )}

          {/* Mostrar mensaje informativo si el paso 5 no está listo */}
          {currentStep === 5 && !isReadyToSubmit && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete todos los pasos para enviar la verificación.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      </div>

      <Dialog open={!!previewData} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewData?.title || "Vista previa"}</DialogTitle>
          </DialogHeader>
          {previewData && (
            previewData.isPdf ? (
              <iframe src={previewData.url} className="w-full h-[70vh] border-0" />
            ) : (
              <img src={previewData.url} alt={previewData.title} className="w-full h-auto max-h-[70vh] object-contain" />
            )
          )}
        </DialogContent>
      </Dialog>

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


