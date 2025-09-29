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
import { CheckCircle, Clock, XCircle, Upload, Camera, FileText, Shield, AlertCircle, Trash2, Eye, User, Home, Loader2, ArrowRight } from "lucide-react"
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
  goToNextIncomplete: () => void
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
    
    console.log(`🔍 goTo(${step}):`, {
      stepStatus,
      currentStep: state.current,
      step
    })
    
    // Solo permitir navegación a pasos 'done' o 'active'
    if (stepStatus === 'locked' || (stepStatus === 'active' && step !== state.current)) {
      console.log(`❌ Navegación bloqueada a ${step}: stepStatus=${stepStatus}`)
      return
    }

    console.log(`✅ Navegando a ${step}`)
    setState(prev => ({
      ...prev,
      current: step
    }))
  }, [state.status, state.current])

  const goToNextIncomplete = useCallback(() => {
    // Encontrar el siguiente paso incompleto
    const stepMap: Record<StepKey, number> = {
      datos: 1,
      doc: 2,
      selfie: 3,
      domicilio: 4,
      revision: 5
    }
    
    const currentStepNumber = stepMap[state.current]
    let nextIncompleteStep: StepKey | null = null
    
    // Buscar el siguiente paso incompleto (empezar desde el paso 3 por defecto)
    for (let step = 3; step <= 5; step++) {
      const stepKey = STEP_ORDER[step - 1] as StepKey
      const stepStatus = state.status[stepKey]
      
      // Si el paso está disponible (no está 'done'), ir ahí
      if (stepStatus !== 'done') {
        nextIncompleteStep = stepKey
        break
      }
    }
    
    // Si no hay siguiente paso incompleto, ir al paso 3 por defecto
    if (!nextIncompleteStep) {
      nextIncompleteStep = 'selfie' // Paso 3
    }
    
    setState(prev => ({
      ...prev,
      current: nextIncompleteStep,
      status: {
        ...prev.status,
        [prev.current]: 'done',
        [nextIncompleteStep]: 'active'
      }
    }))
  }, [state.current, state.status])

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
    goToNextIncomplete,
    reset
  }
}

interface KycData {
  fullName: string
  birthDate: string
  country: string
  docType: "ID" | "Passport"
  docNumber: string
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
  const { state: wizardState, setFlag, canContinue, goNext, goPrev, goTo, goToNextIncomplete } = wizard

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
  const [isProcessingStep1, setIsProcessingStep1] = useState(false)
  const [hasDataInDatabase, setHasDataInDatabase] = useState(!!initialDraft)
  
  const [isProcessingStep2, setIsProcessingStep2] = useState(false)
  const [isProcessingStep3, setIsProcessingStep3] = useState(false)
  const [isProcessingStep4, setIsProcessingStep4] = useState(false)
  const [step1ContinueClicked, setStep1ContinueClicked] = useState(false)
  const [step2ContinueClicked, setStep2ContinueClicked] = useState(false)
  const [step3Enabled, setStep3Enabled] = useState(false)
  const [step3ContinueClicked, setStep3ContinueClicked] = useState(false)
  const [step4Enabled, setStep4Enabled] = useState(false)
  const [step4ContinueClicked, setStep4ContinueClicked] = useState(false)
  const [step5Enabled, setStep5Enabled] = useState(false)
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)
  const [showPassportModal, setShowPassportModal] = useState(false)
  const [hasInitialNavigation, setHasInitialNavigation] = useState(false)
  const [confirmedSteps, setConfirmedSteps] = useState<Set<number>>(new Set())
  const [nameError, setNameError] = useState<string>("")
  const [docNumberError, setDocNumberError] = useState<string>("")
  const [birthDateError, setBirthDateError] = useState<string>("")
  
  // Función para validar nombre (no permite números)
  const validateName = (name: string): boolean => {
    const hasNumbers = /\d/.test(name)
    return !hasNumbers
  }
  
  // Función para formatear DNI (0000-0000-00000)
  const formatDNI = (value: string): string => {
    // Remover todos los caracteres no numéricos
    const numbers = value.replace(/\D/g, '')
    
    // Limitar a 13 dígitos
    const limitedNumbers = numbers.slice(0, 13)
    
    // Aplicar formato con guiones
    if (limitedNumbers.length <= 4) {
      return limitedNumbers
    } else if (limitedNumbers.length <= 8) {
      return `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4)}`
    } else {
      return `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4, 8)}-${limitedNumbers.slice(8)}`
    }
  }
  
  // Función para validar DNI
  const validateDNI = (value: string): boolean => {
    const numbers = value.replace(/\D/g, '')
    return numbers.length === 13
  }
  
  // Función para validar pasaporte hondureño (formato alfanumérico)
  const validatePassport = (value: string): boolean => {
    // Permitir letras y números, longitud entre 8-12 caracteres
    const alphanumeric = value.replace(/[^A-Za-z0-9]/g, '')
    return alphanumeric.length >= 8 && alphanumeric.length <= 12
  }
  
  // Función para validar edad mínima (18 años)
  const validateAge = (birthDate: string): boolean => {
    if (!birthDate) return false
    
    const today = new Date()
    const birth = new Date(birthDate)
    const age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    // Verificar si ya cumplió años este año
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return age - 1 >= 18
    }
    
    return age >= 18
  }
  
  // Función para cargar pasos confirmados desde localStorage
  const loadConfirmedSteps = () => {
    try {
      const saved = localStorage.getItem('kyc-confirmed-steps')
      console.log('🔄 Leyendo desde localStorage:', saved)
      if (saved) {
        const stepsArray = JSON.parse(saved) as number[]
        console.log('🔄 Pasos parseados:', stepsArray)
        return new Set(stepsArray)
      }
    } catch (error) {
      console.error('Error loading confirmed steps:', error)
    }
    return new Set<number>()
  }

  // Función para cargar estados del paso 2, 3, 4 y 5 desde localStorage
  const loadStepStates = () => {
    try {
      const step1Clicked = localStorage.getItem('kyc-step1-continue-clicked')
      const step2Clicked = localStorage.getItem('kyc-step2-continue-clicked')
      const step3Enabled = localStorage.getItem('kyc-step3-enabled')
      const step3Clicked = localStorage.getItem('kyc-step3-continue-clicked')
      const step4Enabled = localStorage.getItem('kyc-step4-enabled')
      const step4Clicked = localStorage.getItem('kyc-step4-continue-clicked')
      const step5Enabled = localStorage.getItem('kyc-step5-enabled')
      
      console.log('🔄 Cargando estados del paso 1, 2, 3, 4 y 5:', {
        step1Clicked,
        step2Clicked,
        step3Enabled,
        step3Clicked,
        step4Enabled,
        step4Clicked,
        step5Enabled
      })
      
      return {
        step1ContinueClicked: step1Clicked === 'true',
        step2ContinueClicked: step2Clicked === 'true',
        step3Enabled: step3Enabled === 'true',
        step3ContinueClicked: step3Clicked === 'true',
        step4Enabled: step4Enabled === 'true',
        step4ContinueClicked: step4Clicked === 'true',
        step5Enabled: step5Enabled === 'true'
      }
    } catch (error) {
      console.error('Error cargando estados del paso 1, 2, 3, 4 y 5:', error)
      return {
        step1ContinueClicked: false,
        step2ContinueClicked: false,
        step3Enabled: false,
        step3ContinueClicked: false,
        step4Enabled: false,
        step4ContinueClicked: false,
        step5Enabled: false
      }
    }
  }
  
  // Función para guardar pasos confirmados en localStorage
  const saveConfirmedSteps = (steps: Set<number>) => {
    try {
      const stepsArray = Array.from(steps)
      console.log('🔄 Guardando confirmedSteps en localStorage:', stepsArray)
      localStorage.setItem('kyc-confirmed-steps', JSON.stringify(stepsArray))
    } catch (error) {
      console.error('Error saving confirmed steps:', error)
    }
  }

  // Función para guardar estados del paso 1, 2, 3, 4 y 5 en localStorage
  const saveStepStates = (step1Clicked: boolean = false, step2Clicked: boolean, step3Enabled: boolean, step3Clicked: boolean = false, step4Enabled: boolean = false, step4Clicked: boolean = false, step5Enabled: boolean = false) => {
    try {
      console.log('🔄 Guardando estados del paso 1, 2, 3, 4 y 5:', {
        step1Clicked,
        step2Clicked,
        step3Enabled,
        step3Clicked,
        step4Enabled,
        step4Clicked,
        step5Enabled
      })
      localStorage.setItem('kyc-step1-continue-clicked', step1Clicked.toString())
      localStorage.setItem('kyc-step2-continue-clicked', step2Clicked.toString())
      localStorage.setItem('kyc-step3-enabled', step3Enabled.toString())
      localStorage.setItem('kyc-step3-continue-clicked', step3Clicked.toString())
      localStorage.setItem('kyc-step4-enabled', step4Enabled.toString())
      localStorage.setItem('kyc-step4-continue-clicked', step4Clicked.toString())
      localStorage.setItem('kyc-step5-enabled', step5Enabled.toString())
    } catch (error) {
      console.error('Error saving step states:', error)
    }
  }
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
    { id: 2, title: "Documento de identidad", description: "DNI o pasaporte hondureño", icon: FileText },
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
          console.log('🔄 Cargando confirmedSteps desde localStorage:', Array.from(savedConfirmedSteps))
          console.log('🔄 Paso 2 cargado:', savedConfirmedSteps.has(2))
          setConfirmedSteps(savedConfirmedSteps)
          
          // Cargar estados del paso 1, 2, 3, 4 y 5 desde localStorage
          const stepStates = loadStepStates()
          console.log('🔄 Cargando estados del paso 1, 2, 3, 4 y 5:', stepStates)
          setStep1ContinueClicked(stepStates.step1ContinueClicked)
          setStep2ContinueClicked(stepStates.step2ContinueClicked)
          setStep3Enabled(stepStates.step3Enabled)
          setStep3ContinueClicked(stepStates.step3ContinueClicked)
          setStep4Enabled(stepStates.step4Enabled)
          setStep4ContinueClicked(stepStates.step4ContinueClicked)
          setStep5Enabled(stepStates.step5Enabled)
          
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
  }, [confirmedSteps.size])

  // Sincronizar flags del wizard con confirmedSteps
  useEffect(() => {
    console.log('🔄 Sincronizando flags del wizard con confirmedSteps:', Array.from(confirmedSteps))
    console.log('🔄 Paso 2 en confirmedSteps:', confirmedSteps.has(2))
    
    // Actualizar flags del wizard basado en confirmedSteps
    setFlag('datosOk', confirmedSteps.has(1))
    setFlag('docFrontalOk', confirmedSteps.has(2))
    setFlag('docReversoOk', confirmedSteps.has(2))
    setFlag('selfieOk', confirmedSteps.has(3))
    setFlag('domicilioOk', confirmedSteps.has(4))
    // Para el paso 5, marcar como completo si está en confirmedSteps O si el estado es review/approved
    setFlag('aceptoDeclaracion', confirmedSteps.has(5) || kycStatus === "review" || kycStatus === "approved")
    
    console.log('✅ Flags del wizard actualizados')
    console.log('✅ docFrontalOk:', confirmedSteps.has(2))
    console.log('✅ docReversoOk:', confirmedSteps.has(2))
  }, [confirmedSteps.size, setFlag, kycStatus])

  // Navegación al primer paso incompleto al cargar la página (solo una vez)
  useEffect(() => {
    const navigateToFirstIncompleteStep = () => {
      console.log('🔄 Navegación inteligente - buscando primer paso incompleto')
      
      // Encontrar el primer paso que no esté completo
      let firstIncompleteStep = 1
      
      // Verificar cada paso en orden para encontrar el primero incompleto
      for (let step = 1; step <= 5; step++) {
        const isCompleted = isStepCompleted(step)
        console.log(`🔍 Verificando paso ${step}: isStepCompleted(${step}) = ${isCompleted}`)
        
        if (step === 3) {
          console.log(`🔍 Detalles paso 3: hasDataInDatabase=${hasDataInDatabase}, uploadedRemote.selfie=${uploadedRemote.selfie}`)
        }
        
        if (!isCompleted) {
          firstIncompleteStep = step
          console.log(`✅ Paso ${step} es el primer incompleto`)
          break
        }
      }
      
      console.log(`🎯 Navegando al primer paso incompleto: ${firstIncompleteStep}`)
      setCurrentStep(firstIncompleteStep)
    }
    
    // Ejecutar solo una vez cuando se cargan los datos iniciales y uploadedRemote está sincronizado
    if (userId && uploadedRemote && !hasInitialNavigation && 
        (uploadedRemote.documentFront || uploadedRemote.documentBack || uploadedRemote.selfie || uploadedRemote.addressProof)) {
      console.log('🔄 Iniciando navegación inteligente...')
      console.log('🔍 Estado uploadedRemote:', uploadedRemote)
      navigateToFirstIncompleteStep()
      setHasInitialNavigation(true)
    }
  }, [userId, uploadedRemote, hasInitialNavigation])

  // Navegación automática: dirigir al siguiente paso incompleto cuando se complete un paso
  // DESHABILITADO para permitir navegación libre entre pasos completados
  /*
  useEffect(() => {
    // Solo ejecutar si hay pasos confirmados y datos cargados
    if (confirmedSteps.size === 0 || !userId || !uploadedRemote) return
    
    // Encontrar el primer paso incompleto
    let nextIncompleteStep = 1
    
    for (let step = 1; step <= 5; step++) {
      if (isStepAvailable(step)) {
        if (!isStepComplete(step)) {
          nextIncompleteStep = step
          break
        }
      } else {
        nextIncompleteStep = 1
        break
      }
    }
    
    // Solo navegar si el paso actual está completo y hay un siguiente paso incompleto
    if (isStepComplete(currentStep) && nextIncompleteStep !== currentStep) {
      console.log(`🎯 Paso ${currentStep} completado, navegando al siguiente paso incompleto: ${nextIncompleteStep}`)
      setCurrentStep(nextIncompleteStep)
    }
  }, [uploadedRemote, kycData, confirmedSteps, currentStep, userId]) // Incluido currentStep para detectar cambios
  */


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


  // Función para marcar paso como completo cuando se confirma y sube archivo
  const markStepAsComplete = async (step: number) => {
    console.log(`🔄 Marcando paso ${step} como completo`)
    
    // Para el paso 5, no verificar isStepComplete ya que se marca como completo al enviar
    if (step === 5) {
      console.log(`✅ Marcando paso 5 como completo (enviado)`)
      
      // Marcar el paso como confirmado por el usuario
      setConfirmedSteps(prev => {
        const newSet = new Set([...prev, step])
        console.log(`📝 confirmedSteps actualizado:`, Array.from(newSet))
        console.log(`📝 Paso ${step} agregado a confirmedSteps`)
        return newSet
      })
      
      return true
    }
    
    // Verificar si el paso tiene la información requerida
    const stepComplete = isStepComplete(step)
    console.log(`🔍 Paso ${step} está completo:`, stepComplete)
    
    if (!stepComplete) {
      console.log(`❌ No se puede marcar paso ${step} como completo - falta información`)
      return false
    }
    
    console.log(`✅ Marcando paso ${step} como completo`)
    
    // Marcar el paso como confirmado por el usuario
    setConfirmedSteps(prev => {
      const newSet = new Set([...prev, step])
      console.log(`📝 confirmedSteps actualizado:`, Array.from(newSet))
      console.log(`📝 Paso ${step} agregado a confirmedSteps`)
      console.log(`📝 Paso 2 en el nuevo set:`, newSet.has(2))
      return newSet
    })

    // Nota: Los flags del wizard se actualizarán automáticamente a través del useEffect
    // que sincroniza confirmedSteps con los flags
    return true
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

      // Intentar primero con bucket 'public'
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
          .from('kyc')
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
    console.log(`✅ Upload exitoso para ${docType}`)
    
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
      console.log(`📝 Paso ${step} marcado como completo`)
    }

    // Mostrar mensaje de éxito específico
    const docTypeLabels = {
      'document_front': 'Documento frontal',
      'document_back': 'Documento reverso', 
      'selfie': 'Selfie de verificación',
      'address_proof': 'Comprobante de domicilio'
    }
    
    toast.success(`${docTypeLabels[docType]} subido correctamente`, {
      description: 'El archivo ha sido guardado y verificado',
      duration: 3000,
    })

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
          
          // Intentar eliminar del bucket 'public' primero
          let deleteResult = await supabase.storage
            .from("public")
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
        // Se requiere frente y reverso para todos los documentos
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
      return Boolean(
        kycData.fullName && 
        kycData.birthDate && 
        kycData.country && 
        kycData.docType && 
        kycData.docNumber &&
        kycData.department &&
        kycData.municipality &&
        kycData.neighborhood &&
        kycData.addressDesc &&
        validateAge(kycData.birthDate) &&
        !nameError &&
        !docNumberError &&
        !birthDateError
      )
    } else if (step === 2) {
      // El paso 2 está completo si tiene documentos (frente y reverso)
      const step2Complete = uploadedRemote.documentFront && uploadedRemote.documentBack
      
      console.log(`🔍 isStepComplete(2):`, {
        docType: kycData.docType,
        documentFront: uploadedRemote.documentFront,
        documentBack: uploadedRemote.documentBack,
        result: step2Complete
      })
      
      return step2Complete
    } else if (step === 3) {
      // El paso 3 está completo si tiene selfie
      return uploadedRemote.selfie
    } else if (step === 4) {
      // El paso 4 está completo si tiene comprobante
      return uploadedRemote.addressProof
    } else if (step === 5) {
      // El paso 5 está completo solo si está en revisión o aprobado (no en draft)
      return kycStatus === "review" || kycStatus === "approved"
    }
    return false
  }

  // Función para verificar si un paso está disponible para navegación (secuencial)
  const isStepAvailable = (step: number) => {
    if (step === 1) {
      return true // El paso 1 siempre está disponible
    } else if (step === 2) {
      // El paso 2 está disponible si el paso 1 está confirmado Y hay datos en BD
      return confirmedSteps.has(1) && step1ContinueClicked && hasDataInDatabase
    } else if (step === 3) {
      // El paso 3 está disponible si el paso 2 está confirmado Y se hizo clic en Continuar Y hay datos en BD
      return confirmedSteps.has(2) && step2ContinueClicked && hasDataInDatabase
    } else if (step === 4) {
      // El paso 4 está disponible si el paso 3 está confirmado Y se hizo clic en Continuar Y hay datos en BD
      return confirmedSteps.has(3) && step3ContinueClicked && hasDataInDatabase
    } else if (step === 5) {
      // El paso 5 está disponible si el paso 4 está confirmado Y se hizo clic en Continuar Y hay datos en BD
      return confirmedSteps.has(4) && step4ContinueClicked && hasDataInDatabase
    }
    return false
  }

  // Función para verificar si un paso está completado (verifica datos reales en BD)
  const isStepCompleted = (step: number) => {
    if (step === 1) {
      // Paso 1: verificar que hay datos personales reales en BD
      return hasDataInDatabase && kycData.fullName && kycData.birthDate && kycData.country && kycData.docType && kycData.docNumber
    } else if (step === 2) {
      // Paso 2: verificar que hay documentos reales en BD (frente y reverso)
      return hasDataInDatabase && (uploadedRemote.documentFront && uploadedRemote.documentBack)
    } else if (step === 3) {
      // Paso 3: verificar que hay selfie real en BD
      return hasDataInDatabase && uploadedRemote.selfie
    } else if (step === 4) {
      // Paso 4: verificar que hay comprobante de domicilio real en BD
      return hasDataInDatabase && uploadedRemote.addressProof
    } else if (step === 5) {
      // Paso 5: verificar estado de revisión
      return kycStatus === "review" || kycStatus === "approved"
    }
    return false
  }

  // Función para verificar si se puede navegar a un paso (disponible o completado)
  const canNavigateToStep = (step: number) => {
    return isStepAvailable(step) || isStepCompleted(step)
  }

  // Limpiar pasos marcados como confirmados pero que no tienen información
  useEffect(() => {
    // Solo ejecutar la limpieza si uploadedRemote está sincronizado
    if (!uploadedRemote.documentFront && !uploadedRemote.documentBack && !uploadedRemote.selfie && !uploadedRemote.addressProof) {
      console.log('🔄 Saltando limpieza - uploadedRemote no está sincronizado')
      return
    }
    
    const stepsToRemove: number[] = []
    for (const step of confirmedSteps) {
      const isComplete = isStepComplete(step)
      console.log(`🔍 Verificando paso ${step} para limpieza:`, {
        step,
        isComplete,
        confirmedSteps: Array.from(confirmedSteps),
        uploadedRemote
      })
      
      if (!isComplete) {
        stepsToRemove.push(step)
      }
    }
    
    if (stepsToRemove.length > 0) {
      console.log(`🧹 Limpiando pasos marcados incorrectamente como completos: ${stepsToRemove.join(', ')}`)
      setConfirmedSteps(prev => {
        const newSet = new Set(prev)
        stepsToRemove.forEach(step => newSet.delete(step))
        console.log(`🧹 confirmedSteps después de limpieza:`, Array.from(newSet))
        return newSet
      })
    }
  }, [confirmedSteps.size, uploadedRemote, kycData])

  // Verificar si el paso actual está completo
  const currentStepComplete = confirmedSteps.has(currentStep) && isStepComplete(currentStep) && 
    (currentStep === 1 ? (step1ContinueClicked && hasDataInDatabase) : 
     currentStep === 2 ? (step2ContinueClicked && hasDataInDatabase) :
     currentStep === 3 ? (step3ContinueClicked && hasDataInDatabase) :
     currentStep === 4 ? (step4ContinueClicked && hasDataInDatabase) :
     true) // Para el paso 5, no necesita verificación adicional
  const isReadyToSubmit = [1, 2, 3, 4].every((s) => validateStep(s))
  // Progreso basado SOLO en pasos completados (no navegación)
  const step1Done = Boolean(
    kycData.fullName && 
    kycData.birthDate && 
    kycData.country && 
    kycData.docType && 
    kycData.docNumber &&
    kycData.department &&
    kycData.municipality &&
    kycData.neighborhood &&
    kycData.addressDesc &&
    validateAge(kycData.birthDate)
  )
  
  console.log('🔍 step1Done calculado:', {
    fullName: kycData.fullName,
    birthDate: kycData.birthDate,
    country: kycData.country,
    docType: kycData.docType,
    docNumber: kycData.docNumber,
    department: kycData.department,
    municipality: kycData.municipality,
    neighborhood: kycData.neighborhood,
    addressDesc: kycData.addressDesc,
    step1Done: step1Done
  })
  
  // Debug adicional para el botón Continuar del paso 1
  if (currentStep === 1) {
    console.log('🔘 Botón Continuar paso 1:', {
      step1Done: step1Done,
      isProcessingStep1: isProcessingStep1,
      step1ContinueClicked: step1ContinueClicked,
      hasDataInDatabase: hasDataInDatabase,
      disabled: !step1Done || isProcessingStep1 || (step1ContinueClicked && hasDataInDatabase),
      uploadedRemote: uploadedRemote
    })
    
    // Resetear step1ContinueClicked si los datos están completos pero no está en confirmedSteps
    if (step1Done && !confirmedSteps.has(1) && step1ContinueClicked) {
      console.log('🔄 Reseteando step1ContinueClicked - datos completos pero paso no confirmado')
      setStep1ContinueClicked(false)
    }
    
  }
  const personalDataComplete = step1Done
  
  // Sincronizar flags del wizard con el estado actual
  useEffect(() => {
    setFlag('datosOk', confirmedSteps.has(1))
  }, [confirmedSteps.size, setFlag])

  // Debug: Monitorear cambios en isProcessingStep1
  useEffect(() => {
    console.log('🔒 Estado isProcessingStep1 cambió:', isProcessingStep1)
  }, [isProcessingStep1])

  // Navegación automática al cargar la página (refresh)
  useEffect(() => {
    // Solo ejecutar una vez cuando se cargan los datos iniciales, hay pasos confirmados y uploadedRemote está sincronizado
    if (userId && uploadedRemote && confirmedSteps.size > 0 && !hasInitialNavigation &&
        (uploadedRemote.documentFront || uploadedRemote.documentBack || uploadedRemote.selfie || uploadedRemote.addressProof)) {
      console.log('🔄 Página cargada, buscando primer paso incompleto...')
      console.log('🔄 confirmedSteps en refresh:', Array.from(confirmedSteps))
      console.log('🔄 step1ContinueClicked en refresh:', step1ContinueClicked)
      console.log('🔄 step2ContinueClicked en refresh:', step2ContinueClicked)
      console.log('🔄 step3Enabled en refresh:', step3Enabled)
      console.log('🔄 step3ContinueClicked en refresh:', step3ContinueClicked)
      console.log('🔄 step4Enabled en refresh:', step4Enabled)
      console.log('🔄 step4ContinueClicked en refresh:', step4ContinueClicked)
      console.log('🔄 step5Enabled en refresh:', step5Enabled)
      
      // Si el paso 2 está completo pero no se hizo clic en Continuar, quedarse en el paso 2
      if (confirmedSteps.has(2) && !step2ContinueClicked) {
        console.log('🔄 Refresh - Paso 2 completo pero no se hizo clic en Continuar - quedándose en paso 2')
        setCurrentStep(2)
        setHasInitialNavigation(true)
        return
      } else if (confirmedSteps.has(3) && !step3ContinueClicked) {
        console.log('🔄 Refresh - Paso 3 completo pero no se hizo clic en Continuar - quedándose en paso 3')
        setCurrentStep(3)
        setHasInitialNavigation(true)
        return
      } else if (confirmedSteps.has(4) && !step4ContinueClicked) {
        console.log('🔄 Refresh - Paso 4 completo pero no se hizo clic en Continuar - quedándose en paso 4')
        setCurrentStep(4)
        setHasInitialNavigation(true)
        return
      }
      
      // Encontrar el primer paso incompleto
      let firstIncompleteStep = 1
      
      for (let step = 1; step <= 5; step++) {
        console.log(`🔍 Refresh - Verificando paso ${step}:`)
        console.log(`  - isStepComplete(${step}):`, isStepComplete(step))
        console.log(`  - confirmedSteps.has(${step}):`, confirmedSteps.has(step))
        console.log(`  - kycStatus:`, kycStatus)
        
        // Verificar si el paso está completo usando isStepComplete
          if (!isStepComplete(step)) {
            firstIncompleteStep = step
          console.log(`✅ Refresh - Paso ${step} es el primer incompleto`)
          break
        }
      }
      
      // Navegar al primer paso incompleto si no estamos ya ahí
      if (currentStep !== firstIncompleteStep) {
        console.log(`🎯 Página actualizada, navegando al primer paso incompleto: ${firstIncompleteStep}`)
        setCurrentStep(firstIncompleteStep)
      } else {
        console.log(`✅ Refresh - Ya estamos en el paso correcto: ${currentStep}`)
      }
      
      setHasInitialNavigation(true)
    }
  }, [userId, uploadedRemote, confirmedSteps.size, hasInitialNavigation, step1ContinueClicked, step2ContinueClicked, step3Enabled, step3ContinueClicked, step4Enabled, step4ContinueClicked, step5Enabled])
  
  // Sincronizar flags de documentos
  useEffect(() => {
    setFlag('docFrontalOk', uploadedRemote.documentFront)
    setFlag('docReversoOk', uploadedRemote.documentBack)
    setFlag('selfieOk', uploadedRemote.selfie)
    setFlag('domicilioOk', uploadedRemote.addressProof)
  }, [uploadedRemote, setFlag])

  
  // Auto-guardar paso 2 cuando los documentos estén cargados
  useEffect(() => {
    console.log('🔍 Verificando auto-guardado paso 2:', {
      documentFront: uploadedRemote.documentFront,
      documentBack: uploadedRemote.documentBack,
      docType: kycData.docType,
      hasStep2: confirmedSteps.has(2),
      hasDataInDatabase
    })
    
    // Solo auto-guardar si hay datos reales en la base de datos
    if (kycData.docType && hasDataInDatabase) {
      const step2Complete = uploadedRemote.documentFront && uploadedRemote.documentBack
      
      console.log('🔍 step2Complete calculado:', step2Complete)
      
      // NO auto-guardar - solo marcar como completo cuando el usuario haga clic en Continuar
      // if (step2Complete && !confirmedSteps.has(2)) {
      //   console.log('🔄 Auto-guardando paso 2 - documentos detectados en BD')
      //   setConfirmedSteps(prev => {
      //     const newSet = new Set([...prev, 2])
      //     console.log('🔄 Paso 2 agregado automáticamente:', Array.from(newSet))
      //     return newSet
      //   })
      //   
      //   // Asegurar que se quede en el paso 2 para que el usuario haga clic en Continuar
      //   if (currentStep !== 2) {
      //     console.log('🔄 Forzando navegación al paso 2 para mostrar botón Continuar')
      //     setCurrentStep(2)
      //   }
      // }
    }
  }, [uploadedRemote, kycData.docType, confirmedSteps.size, currentStep, hasDataInDatabase])

  // Auto-guardar paso 3 cuando la selfie esté cargada
  useEffect(() => {
    console.log('🔍 Verificando auto-guardado paso 3:', {
      selfie: uploadedRemote.selfie,
      hasStep3: confirmedSteps.has(3),
      hasDataInDatabase
    })
    
    // NO auto-guardar - solo marcar como completo cuando el usuario haga clic en Continuar
    // if (uploadedRemote.selfie && !confirmedSteps.has(3) && hasDataInDatabase) {
    //   console.log('🔄 Auto-guardando paso 3 - selfie detectada en BD')
    //   setConfirmedSteps(prev => {
    //     const newSet = new Set([...prev, 3])
    //     console.log('🔄 Paso 3 agregado automáticamente:', Array.from(newSet))
    //     return newSet
    //   })
    //   
    //   // Asegurar que se quede en el paso 3 para que el usuario haga clic en Continuar
    //   if (currentStep !== 3) {
    //     console.log('🔄 Forzando navegación al paso 3 para mostrar botón Continuar')
    //     setCurrentStep(3)
    //   }
    // }
  }, [uploadedRemote, confirmedSteps.size, currentStep, hasDataInDatabase])

  // Auto-guardar paso 4 cuando el comprobante de domicilio esté cargado
  useEffect(() => {
    console.log('🔍 Verificando auto-guardado paso 4:', {
      addressProof: uploadedRemote.addressProof,
      hasStep4: confirmedSteps.has(4),
      hasDataInDatabase
    })
    
    // NO auto-guardar - solo marcar como completo cuando el usuario haga clic en Continuar
    // if (uploadedRemote.addressProof && !confirmedSteps.has(4) && hasDataInDatabase) {
    //   console.log('🔄 Auto-guardando paso 4 - comprobante de domicilio detectado en BD')
    //   setConfirmedSteps(prev => {
    //     const newSet = new Set([...prev, 4])
    //     console.log('🔄 Paso 4 agregado automáticamente:', Array.from(newSet))
    //     return newSet
    //   })
    //   
    //   // Asegurar que se quede en el paso 4 para que el usuario haga clic en Continuar
    //   if (currentStep !== 4) {
    //     console.log('🔄 Forzando navegación al paso 4 para mostrar botón Continuar')
    //     setCurrentStep(4)
    //   }
    // }
  }, [uploadedRemote, confirmedSteps.size, currentStep, hasDataInDatabase])

  // Habilitar el paso 3 si ya se completó el paso 2 y se hizo clic en Continuar
  useEffect(() => {
    if (confirmedSteps.has(2) && !step3Enabled && !confirmedSteps.has(3)) {
      console.log('🔄 Habilitando paso 3 - paso 2 completado y no se ha hecho clic en Continuar')
      // No habilitar automáticamente, esperar clic en Continuar
    }
  }, [confirmedSteps.size, step3Enabled])
  
  // Logs de depuración para el paso 1 (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Debug paso 1:', {
    fullName: kycData.fullName,
    birthDate: kycData.birthDate,
    country: kycData.country,
    docType: kycData.docType,
    docNumber: kycData.docNumber,
    step1Done,
    personalDataComplete,
    currentStep
  })
  }
  const step2Done = uploadedRemote.documentFront && uploadedRemote.documentBack
  
  console.log('🔍 step2Done calculado:', {
    docType: kycData.docType,
    documentFront: uploadedRemote.documentFront,
    documentBack: uploadedRemote.documentBack,
    step2Done: step2Done
  })
  
  // Debug adicional para el botón Continuar del paso 2
  if (currentStep === 2) {
    console.log('🔘 Botón Continuar paso 2:', {
      step2Done: step2Done,
      isProcessingStep2: isProcessingStep2,
      step2ContinueClicked: step2ContinueClicked,
      disabled: !step2Done || isProcessingStep2 || step2ContinueClicked,
      uploadedRemote: uploadedRemote
    })
    
    // Resetear step2ContinueClicked si los documentos están completos pero no está en confirmedSteps
    if (step2Done && !confirmedSteps.has(2) && step2ContinueClicked) {
      console.log('🔄 Reseteando step2ContinueClicked - documentos completos pero paso no confirmado')
      setStep2ContinueClicked(false)
    }
    
  }
  const step3Done = uploadedRemote.selfie
  
  // Debug adicional para el botón Continuar del paso 3
  if (currentStep === 3) {
    console.log('🔘 Botón Continuar paso 3:', {
      step3Done: step3Done,
      isProcessingStep3: isProcessingStep3,
      step3ContinueClicked: step3ContinueClicked,
      disabled: !step3Done || isProcessingStep3 || step3ContinueClicked,
      uploadedRemote: uploadedRemote
    })
    
    // Resetear step3ContinueClicked si la selfie está completa pero no está en confirmedSteps
    if (step3Done && !confirmedSteps.has(3) && step3ContinueClicked) {
      console.log('🔄 Reseteando step3ContinueClicked - selfie completa pero paso no confirmado')
      setStep3ContinueClicked(false)
    }
    
  }
  const step4Done = uploadedRemote.addressProof
  
  // Debug adicional para el botón Continuar del paso 4
  if (currentStep === 4) {
    console.log('🔘 Botón Continuar paso 4:', {
      step4Done: step4Done,
      isProcessingStep4: isProcessingStep4,
      step4ContinueClicked: step4ContinueClicked,
      disabled: !step4Done || isProcessingStep4 || step4ContinueClicked,
      uploadedRemote: uploadedRemote
    })
    
    // Resetear step4ContinueClicked si el comprobante está completo pero no está en confirmedSteps
    if (step4Done && !confirmedSteps.has(4) && step4ContinueClicked) {
      console.log('🔄 Reseteando step4ContinueClicked - comprobante completo pero paso no confirmado')
      setStep4ContinueClicked(false)
    }
    
  }
  const step5Done = kycStatus === "review" || kycStatus === "approved"
  
  // === VERIFICACIÓN AUTOMÁTICA DE BASE DE DATOS ===
  // Verificar paso 1: Datos personales
  useEffect(() => {
    const checkAndMarkComplete = async () => {
      if (step1Done && hasDataInDatabase && !confirmedSteps.has(1)) {
        console.log('🔍 Verificando paso 1 en base de datos:', {
          fullName: kycData.fullName,
          docType: kycData.docType,
          docNumber: kycData.docNumber
        })
        
        if (kycData.fullName && kycData.docType && kycData.docNumber) {
          console.log('✅ Datos personales encontrados en BD - marcando paso 1 como completo')
          const success = await markStepAsComplete(1)
          if (success) {
            console.log('✅ Paso 1 marcado como completo y guardado en localStorage')
          }
        }
      }
    }
    
    checkAndMarkComplete()
  }, [step1Done, hasDataInDatabase, confirmedSteps.size])
  
  // Verificar paso 2: Documentos
  useEffect(() => {
    const checkAndMarkComplete = async () => {
      if (step2Done && hasDataInDatabase && !confirmedSteps.has(2)) {
        console.log('🔍 Verificando paso 2 en base de datos:', {
          documentFront: uploadedRemote.documentFront,
          documentBack: uploadedRemote.documentBack
        })
        
        if (uploadedRemote.documentFront && uploadedRemote.documentBack) {
          console.log('✅ Documentos encontrados en BD - marcando paso 2 como completo')
          const success = await markStepAsComplete(2)
          if (success) {
            console.log('✅ Paso 2 marcado como completo y guardado en localStorage')
          }
        }
      }
    }
    
    checkAndMarkComplete()
  }, [step2Done, hasDataInDatabase, confirmedSteps.size])
  
  // Verificar paso 3: Selfie
  useEffect(() => {
    const checkAndMarkComplete = async () => {
      if (step3Done && hasDataInDatabase && !confirmedSteps.has(3)) {
        console.log('🔍 Verificando paso 3 en base de datos:', uploadedRemote.selfie)
        
        if (uploadedRemote.selfie) {
          console.log('✅ Selfie encontrada en BD - marcando paso 3 como completo')
          const success = await markStepAsComplete(3)
          if (success) {
            console.log('✅ Paso 3 marcado como completo y guardado en localStorage')
          }
        }
      }
    }
    
    checkAndMarkComplete()
  }, [step3Done, hasDataInDatabase, confirmedSteps.size])
  
  // Verificar paso 4: Comprobante de domicilio
  useEffect(() => {
    const checkAndMarkComplete = async () => {
      if (step4Done && hasDataInDatabase && !confirmedSteps.has(4)) {
        console.log('🔍 Verificando paso 4 en base de datos:', uploadedRemote.addressProof)
        
        if (uploadedRemote.addressProof) {
          console.log('✅ Comprobante encontrado en BD - marcando paso 4 como completo')
          const success = await markStepAsComplete(4)
          if (success) {
            console.log('✅ Paso 4 marcado como completo y guardado en localStorage')
          }
        }
      }
    }
    
    checkAndMarkComplete()
  }, [step4Done, hasDataInDatabase, confirmedSteps.size])
  
  // La barra de progreso solo avanza con pasos realmente completados
  const stepsCompletedCount = Array.from(confirmedSteps).filter(step => isStepComplete(step)).length
  // Si el estado es review o approved, mostrar 100% de progreso
  const progress = (kycStatus === "review" || kycStatus === "approved") ? 100 : (stepsCompletedCount / 5) * 100
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

  const handleSaveStep2Draft = async () => {
    // Guardar el estado de los documentos del paso 2
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
      // Los documentos se guardan automáticamente cuando se suben
    }
    await onSaveKycDraft(draftData)
  }

  const handleSaveStep3Draft = async () => {
    // Guardar el estado de la selfie del paso 3
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
      // La selfie se guarda automáticamente cuando se sube
    }
    await onSaveKycDraft(draftData)
  }

  const handleSaveStep4Draft = async () => {
    // Guardar el estado del comprobante de domicilio del paso 4
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
      // El comprobante de domicilio se guarda automáticamente cuando se sube
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

  // Función para continuar al paso 2 (extraída para reutilización)
  const continueToStep2 = async () => {
    setIsProcessingStep1(true)
    console.log('🔄 Clic en botón Continuar - Paso 1')
    console.log('🔒 Estado isProcessingStep1:', true)
    console.log('📊 Datos personales:', {
      fullName: kycData.fullName,
      birthDate: kycData.birthDate,
      country: kycData.country,
      docType: kycData.docType,
      docNumber: kycData.docNumber,
      department: kycData.department,
      municipality: kycData.municipality,
      neighborhood: kycData.neighborhood,
      addressDesc: kycData.addressDesc
    })
    
    try {
      // Guardar los datos personales en la base de datos
      await handleSaveDraft()
      
      // Marcar que hay datos en la base de datos
      setHasDataInDatabase(true)
      
      // Marcar que se hizo clic en Continuar
      setStep1ContinueClicked(true)
      
      // Marcar el paso como completo
      await markStepAsComplete(1)
      
      // Guardar estados en localStorage
      saveStepStates(
        true, // step1ContinueClicked
        step2ContinueClicked,
        step3Enabled,
        step3ContinueClicked,
        step4Enabled,
        step4ContinueClicked,
        step5Enabled
      )
      
      // Navegar específicamente al paso 2
      console.log('🎯 Navegando al paso 2 desde el botón Continuar')
      setCurrentStep(2)
    } catch (error) {
      console.error('Error en paso 1:', error)
      toast.error('Error al procesar los datos. Inténtalo de nuevo.')
    } finally {
      setIsProcessingStep1(false)
    }
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
              proceso de revisión puede tomar entre 24 y 72 horas hábiles.
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
          const isDone = (confirmedSteps.has(step.id) && isStepComplete(step.id)) || 
                        (step.id === 5 && (kycStatus === "review" || kycStatus === "approved"))
          const isActive = currentStep === step.id
          const stepAvailable = isStepAvailable(step.id)
          const stepCompleted = isStepCompleted(step.id) || 
                               (step.id === 5 && (kycStatus === "review" || kycStatus === "approved"))
          const canNavigate = canNavigateToStep(step.id)
          
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
              tabIndex={canNavigate ? 0 : -1}
              data-step={stepKey}
              aria-disabled={!canNavigate ? 'true' : undefined}
              onClick={() => {
                if (canNavigate) {
                  handleGoToStep(step.id)
                } else if (stepKey) {
                  goTo(stepKey)
                }
              }}
              onKeyDown={(e) => {
                if (canNavigate && (e.key === "Enter" || e.key === " ")) {
                  handleGoToStep(step.id)
                } else if (stepKey && (e.key === "Enter" || e.key === " ")) {
                  goTo(stepKey)
                }
              }}
              className={`flex items-start gap-3 rounded-lg border p-4 outline-none focus:ring-2 focus:ring-primary transition-all duration-200 ${
                isActive 
                  ? "bg-muted/50 border-primary shadow-sm" 
                  : canNavigate
                  ? "bg-card border-border cursor-pointer hover:bg-muted/30 hover:border-muted-foreground/20 hover:shadow-sm"
                  : "bg-muted/20 border-muted/30 cursor-not-allowed"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={`rounded-full p-2 transition-colors duration-200 flex items-center justify-center ${
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
                {step.id === 1 && (
                  <User 
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      minWidth: '18px', 
                      minHeight: '18px',
                      maxWidth: '18px',
                      maxHeight: '18px',
                      fontSize: '18px',
                      display: 'block',
                      lineHeight: '1',
                      flexShrink: 0
                    }} 
                  />
                )}
                {step.id === 2 && (
                  <div 
                    className="flex items-center justify-center"
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      fontSize: '18px'
                    }}
                  >
                    <FileText 
                      style={{ 
                        width: '18px', 
                        height: '18px',
                        minWidth: '18px', 
                        minHeight: '18px',
                        maxWidth: '18px',
                        maxHeight: '18px',
                        fontSize: '18px',
                        display: 'block',
                        lineHeight: '1',
                        flexShrink: 0
                      }} 
                    />
                  </div>
                )}
                {step.id === 3 && (
                  <Camera 
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      minWidth: '18px', 
                      minHeight: '18px',
                      maxWidth: '18px',
                      maxHeight: '18px',
                      fontSize: '18px',
                      display: 'block',
                      lineHeight: '1',
                      flexShrink: 0
                    }} 
                  />
                )}
                {step.id === 4 && (
                  <div 
                    className="flex items-center justify-center"
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      fontSize: '18px'
                    }}
                  >
                    <Home 
                      style={{ 
                        width: '18px', 
                        height: '18px',
                        minWidth: '18px', 
                        minHeight: '18px',
                        maxWidth: '18px',
                        maxHeight: '18px',
                        fontSize: '18px',
                        display: 'block',
                        lineHeight: '1',
                        flexShrink: 0
                      }} 
                    />
                  </div>
                )}
                {step.id === 5 && (
                  <Shield 
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      minWidth: '18px', 
                      minHeight: '18px',
                      maxWidth: '18px',
                      maxHeight: '18px',
                      fontSize: '18px',
                      display: 'block',
                      lineHeight: '1',
                      flexShrink: 0
                    }} 
                  />
                )}
              </div>
              <div className="space-y-1">
                <div className={`text-sm font-medium flex items-center gap-2 transition-colors duration-200 ${
                  stepAvailable 
                    ? "text-foreground" 
                    : "text-muted-foreground/60"
                }`}>
                  {step.title}
                  {isDone && <CheckCircle className={`text-green-600 ${step.id === 2 || step.id === 4 ? 'h-8 w-8' : step.id === 3 ? 'h-6 w-6' : 'h-5 w-5'}`} />}
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
            <span className={`rounded-full w-6 h-6 flex items-center justify-center text-sm ${
              confirmedSteps.has(currentStep)
                ? "bg-green-600 text-white" 
                : "bg-primary text-primary-foreground"
            }`}>
              {confirmedSteps.has(currentStep) ? (
                <span className="text-xs font-bold">✓</span>
              ) : (
                currentStep
              )}
            </span>
            {currentStep === 1 && "Datos personales"}
            {currentStep === 2 && "Documento de identidad"}
            {currentStep === 3 && "Selfie de validación"}
            {currentStep === 4 && "Comprobante de domicilio"}
            {currentStep === 5 && "Revisión y envío"}
            {confirmedSteps.has(currentStep) && (
              <span className="text-green-600 text-sm font-normal">✓ Completado</span>
            )}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && isStepCompleted(1) && "✓ Datos personales completados y guardados correctamente."}
            {currentStep === 1 && !isStepCompleted(1) && "Ingresa tu nombre completo, fecha de nacimiento y país."}
            {currentStep === 2 && isStepCompleted(2) && "✓ Documentos de identidad completados y guardados correctamente."}
            {currentStep === 2 && !isStepCompleted(2) && "Sube tu DNI o pasaporte hondureño (frente y reverso)."}
            {currentStep === 3 && isStepCompleted(3) && "✓ Selfie de validación completada y guardada correctamente."}
            {currentStep === 3 && !isStepCompleted(3) && "Tómate una selfie en tiempo real para confirmar tu identidad."}
            {currentStep === 4 && isStepCompleted(4) && "✓ Comprobante de domicilio completado y guardado correctamente."}
            {currentStep === 4 && !isStepCompleted(4) && "Adjunta un comprobante de domicilio reciente (≤ 3 meses)."}
      {currentStep === 5 && (confirmedSteps.has(5) || kycStatus === "review" || kycStatus === "approved") && "✓ Verificación enviada correctamente para su evaluación."}
      {currentStep === 5 && !confirmedSteps.has(5) && kycStatus !== "review" && kycStatus !== "approved" && "Revisa tu información y envía tu verificación para su evaluación."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label htmlFor="fullName">Nombre legal completo *</Label>
                <Input 
                  id="fullName" 
                  value={kycData.fullName} 
                  onChange={(e) => {
                    const value = e.target.value
                    if (validateName(value)) {
                      setKycData((prev) => ({ ...prev, fullName: value }))
                      setNameError("")
                    } else {
                      setNameError("El nombre no puede contener números")
                    }
                  }} 
                  placeholder="Como aparece en su documento"
                  className={nameError ? "border-destructive focus:border-destructive" : ""}
                  disabled={isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)}
                />
                {nameError && (
                  <p className="text-sm text-destructive">{nameError}</p>
                )}
              </div>
              <div className="space-y-4">
                <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
                <Input 
                  id="birthDate" 
                  type="date" 
                  value={kycData.birthDate} 
                  onChange={(e) => {
                    const value = e.target.value
                    setKycData((prev) => ({ ...prev, birthDate: value }))
                    
                    if (value) {
                      if (validateAge(value)) {
                        setBirthDateError("")
                      } else {
                        setBirthDateError("Debes ser mayor de 18 años para abrir una cuenta")
                      }
                    } else {
                      setBirthDateError("")
                    }
                  }}
                  className={birthDateError ? "border-destructive focus:border-destructive" : ""}
                  disabled={isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)}
                />
                {birthDateError && (
                  <p className="text-sm text-destructive">{birthDateError}</p>
                )}
              </div>
              <div className="space-y-4">
                <Label>País</Label>
                <Input value={kycData.country} disabled />
              </div>
              <div className="space-y-4">
                <Label htmlFor="docType">Tipo de documento *</Label>
                <Select value={kycData.docType} onValueChange={(value: any) => {
                  setKycData((prev) => ({ ...prev, docType: value, docNumber: "" }))
                  setDocNumberError("")
                }} disabled={isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)}>
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
              <div className="space-y-4 md:col-span-2">
                <Label htmlFor="docNumber">Número de documento *</Label>
                <Input 
                  id="docNumber" 
                  value={kycData.docNumber} 
                  maxLength={kycData.docType === "ID" ? 15 : 12}
                  onChange={(e) => {
                    const value = e.target.value
                    
                    if (kycData.docType === "ID") {
                      // Para DNI, aplicar formateo automático
                      const formattedValue = formatDNI(value)
                      setKycData((prev) => ({ ...prev, docNumber: formattedValue }))
                      
                      // Validar si tiene exactamente 13 dígitos
                      if (validateDNI(formattedValue)) {
                        setDocNumberError("")
                      } else {
                        const numbers = formattedValue.replace(/\D/g, '')
                        if (numbers.length > 0 && numbers.length < 13) {
                          setDocNumberError("El DNI debe tener exactamente 13 dígitos")
                        } else {
                          setDocNumberError("")
                        }
                      }
                    } else if (kycData.docType === "Passport") {
                      // Para pasaporte hondureño, permitir letras y números (máximo 12 caracteres)
                      const alphanumeric = value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12)
                      setKycData((prev) => ({ ...prev, docNumber: alphanumeric }))
                      
                      // Validar longitud (8-12 caracteres alfanuméricos)
                      if (validatePassport(alphanumeric)) {
                        setDocNumberError("")
                      } else {
                        if (alphanumeric.length > 0 && alphanumeric.length < 8) {
                          setDocNumberError("El pasaporte debe tener entre 8-12 caracteres alfanuméricos")
                        } else {
                          setDocNumberError("")
                        }
                      }
                    }
                  }} 
                  placeholder={kycData.docType === "ID" ? "0000-0000-00000" : "HND1234567"}
                  className={docNumberError ? "border-destructive focus:border-destructive" : ""}
                  disabled={isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)}
                />
                {docNumberError && (
                  <p className="text-sm text-destructive">{docNumberError}</p>
                )}
                {kycData.docType === "ID" && !docNumberError && kycData.docNumber && (
                  <p className="text-sm text-muted-foreground">Formato: 0000-0000-00000</p>
                )}
                {kycData.docType === "Passport" && !docNumberError && kycData.docNumber && (
                  <p className="text-sm text-muted-foreground">Formato: 8-12 caracteres alfanuméricos</p>
                )}
              </div>
              <div className="space-y-4">
                <Label>Departamento *</Label>
                <Select
                  value={kycData.department}
                  onValueChange={(value) => {
                    setKycData((prev) => ({ ...prev, department: value, municipality: "" }))
                  }}
                  disabled={isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)}
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
              <div className="space-y-4">
                <Label>Municipio *</Label>
                <Select
                  value={kycData.municipality}
                  onValueChange={(value) => setKycData((prev) => ({ ...prev, municipality: value }))}
                  disabled={!kycData.department || isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)}
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
              <div className="space-y-4">
                <Label>Colonia/Barrio/Aldea *</Label>
                <Input value={kycData.neighborhood} onChange={(e) => setKycData((prev) => ({ ...prev, neighborhood: e.target.value }))} placeholder="Ej. Col. Tara / Barrio Abajo" disabled={isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)} />
              </div>
              <div className="space-y-4 md:col-span-2">
                <Label>Descripción de calle / bloque / #casa / #apartamento *</Label>
                <Input value={kycData.addressDesc} onChange={(e) => setKycData((prev) => ({ ...prev, addressDesc: e.target.value }))} placeholder="Ej. Calle 3, bloque B, casa #24, apto 3B" disabled={isProcessingStep1 || (hasDataInDatabase && confirmedSteps.has(1) && step1ContinueClicked)} />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-8">
              {userId ? (
                <KycUploader
                  userId={userId}
                  docType="document_front"
                  bucket="kyc"
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

              {/* Mostrar reverso para todos los documentos */}
              {(
                userId ? (
                  <KycUploader
                    userId={userId}
                    docType="document_back"
                    bucket="kyc"
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

            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-8">
              {userId ? (
                <KycUploader
                  userId={userId}
                  docType="selfie"
                  bucket="kyc"
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

              {currentStep === 3 && (
                <Button
                  data-action="continuar"
                  onClick={async () => {
                    if (isProcessingStep3) return // Prevenir múltiples clics

                    // Validación estricta antes de continuar
                    if (!step3Done) {
                      toast.error('Por favor sube la selfie requerida antes de continuar.')
                      return
                    }

                    setIsProcessingStep3(true)
                    setStep3ContinueClicked(true)
                    saveStepStates(step1ContinueClicked, step2ContinueClicked, step3Enabled, true, false) // Guardar que se hizo clic en Continuar
                    console.log('🔄 Clic en botón Continuar - Paso 3')
                    console.log('🔒 Estado isProcessingStep3:', true)
                    console.log('🔒 Estado step3ContinueClicked:', true)
                    console.log('📊 Selfie cargada:', {
                      selfie: uploadedRemote.selfie
                    })
                    
                    try {
                      // Guardar la selfie del paso 3 en la base de datos
                      await handleSaveStep3Draft()
                      
                      // Marcar el paso como completo
                      const success = await markStepAsComplete(3)
                      
                      if (success) {
                        // Navegar específicamente al paso 4 (domicilio)
                        console.log('🎯 Navegando al paso 4 desde el botón Continuar')
                        console.log('🔍 Estado del wizard antes de navegar:', {
                          current: wizardState.current,
                          status: wizardState.status
                        })
                        
                        // Habilitar el paso 4 permanentemente
                        setStep4Enabled(true)
                        saveStepStates(step1ContinueClicked, step2ContinueClicked, step3Enabled, true, true) // Guardar que el paso 4 está habilitado
                        
                        // Usar setCurrentStep directamente para asegurar la navegación
                        setCurrentStep(4)
                        console.log('✅ Navegación al paso 4 completada')
                      } else {
                        toast.error('No se pudo marcar el paso 3 como completo. Verifica que la selfie esté cargada.')
                      }
                    } catch (error) {
                      console.error('Error en paso 3:', error)
                      toast.error('Error al procesar la selfie. Inténtalo de nuevo.')
                    } finally {
                      setIsProcessingStep3(false)
                    }
                  }}
                  disabled={!step3Done || isProcessingStep3 || step3ContinueClicked}
                  title={`step3Done: ${step3Done}, isProcessingStep3: ${isProcessingStep3}, step3ContinueClicked: ${step3ContinueClicked}`}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
                >
                  <span className="flex items-center gap-2">
                    {isProcessingStep3 && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isProcessingStep3 ? "Procesando..." : "Continuar"}
                  </span>
                </Button>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-8">
              {userId ? (
                <KycUploader
                  userId={userId}
                  docType="address_proof"
                  bucket="kyc"
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

              {currentStep === 4 && (
                <Button
                  data-action="continuar"
                  onClick={async () => {
                    if (isProcessingStep4) return // Prevenir múltiples clics

                    // Validación estricta antes de continuar
                    if (!step4Done) {
                      toast.error('Por favor sube el comprobante de domicilio requerido antes de continuar.')
                      return
                    }

                    setIsProcessingStep4(true)
                    setStep4ContinueClicked(true)
                    saveStepStates(step1ContinueClicked, step2ContinueClicked, step3Enabled, step3ContinueClicked, step4Enabled, true, false) // Guardar que se hizo clic en Continuar
                    console.log('🔄 Clic en botón Continuar - Paso 4')
                    console.log('🔒 Estado isProcessingStep4:', true)
                    console.log('🔒 Estado step4ContinueClicked:', true)
                    console.log('📊 Comprobante de domicilio cargado:', {
                      addressProof: uploadedRemote.addressProof
                    })
                    
                    try {
                      // Guardar el comprobante de domicilio del paso 4 en la base de datos
                      await handleSaveStep4Draft()
                      
                      // Marcar el paso como completo
                      const success = await markStepAsComplete(4)
                      
                      if (success) {
                        // Navegar específicamente al paso 5 (revisión)
                        console.log('🎯 Navegando al paso 5 desde el botón Continuar')
                        console.log('🔍 Estado del wizard antes de navegar:', {
                          current: wizardState.current,
                          status: wizardState.status
                        })
                        
                        // Habilitar el paso 5 permanentemente
                        setStep5Enabled(true)
                        saveStepStates(step1ContinueClicked, step2ContinueClicked, step3Enabled, step3ContinueClicked, step4Enabled, true, true) // Guardar que el paso 5 está habilitado
                        
                        // Usar setCurrentStep directamente para asegurar la navegación
                        setCurrentStep(5)
                        console.log('✅ Navegación al paso 5 completada')
                      } else {
                        toast.error('No se pudo marcar el paso 4 como completo. Verifica que el comprobante de domicilio esté cargado.')
                      }
                    } catch (error) {
                      console.error('Error en paso 4:', error)
                      toast.error('Error al procesar el comprobante de domicilio. Inténtalo de nuevo.')
                    } finally {
                      setIsProcessingStep4(false)
                    }
                  }}
                  disabled={!step4Done || isProcessingStep4 || step4ContinueClicked}
                  title={`step4Done: ${step4Done}, isProcessingStep4: ${isProcessingStep4}, step4ContinueClicked: ${step4ContinueClicked}`}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
                >
                  <span className="flex items-center gap-2">
                    {isProcessingStep4 && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isProcessingStep4 ? "Procesando..." : "Continuar"}
                  </span>
                </Button>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Nuestro sistema verificará automáticamente tus datos. Si es necesario, un agente realizará una revisión
                  manual. Recibirás una notificación por correo cuando se complete el proceso. El tiempo estimado es de 24-72 horas hábiles.
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
                  disabled={kycStatus === "review" || kycStatus === "approved"}
                  className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label htmlFor="aceptoDeclaracion" className="text-sm">
                  Acepto la declaración de veracidad de la información proporcionada
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
            {/* Botón Atrás */}
            {currentStep > 1 && currentStep !== 2 && currentStep !== 3 && currentStep !== 4 && currentStep !== 5 && (
              <Button 
                data-action="atras"
                variant="outline" 
                onClick={goPrev}
                className="flex items-center gap-2"
              >
                ← Atrás
              </Button>
            )}
            
            {/* Mostrar botones en pasos 1, 2 y 5 */}
            {(currentStep === 1 || currentStep === 2 || currentStep === 5) && (
            <div className="flex gap-4">
                {/* Botón Continuar para el paso 1 */}
                {currentStep === 1 && (
                    <Button 
                      data-action="continuar"
                      onClick={async () => {
                        if (isProcessingStep1) return // Prevenir múltiples clics
                        
                        // Validación estricta antes de continuar
                        if (!step1Done) {
                          toast.error('Por favor completa todos los campos requeridos antes de continuar.')
                          return
                        }
                        
                        // Si el usuario eligió Pasaporte, mostrar el modal explicativo
                        if (kycData.docType === "Passport") {
                          setShowPassportModal(true)
                          return // No continuamos hasta que el usuario confirme el modal
                        }
                        
                        // Para otros tipos de documento, continuamos normalmente
                        await continueToStep2()
                      }}
                      disabled={!step1Done || isProcessingStep1 || (step1ContinueClicked && hasDataInDatabase)}
                      title={`step1Done: ${step1Done}, isProcessingStep1: ${isProcessingStep1}, step1ContinueClicked: ${step1ContinueClicked}, hasDataInDatabase: ${hasDataInDatabase}`}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
                    >
                      <span className="flex items-center gap-2">
                        {isProcessingStep1 && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isProcessingStep1 ? "Procesando..." : "Continuar"}
                      </span>
                    </Button>
                )}
                
                {/* Botón Continuar para el paso 2 */}
                {currentStep === 2 && (
                    <Button 
                      data-action="continuar"
                      onClick={async () => {
                        if (isProcessingStep2) return // Prevenir múltiples clics
                        
                        // Validación estricta antes de continuar
                        if (!step2Done) {
                          toast.error('Por favor sube todas las imágenes requeridas antes de continuar.')
                          return
                        }
                        
                        setIsProcessingStep2(true)
                        setStep2ContinueClicked(true)
                        saveStepStates(step1ContinueClicked, true, false) // Guardar que se hizo clic en Continuar
                        console.log('🔄 Clic en botón Continuar - Paso 2')
                        console.log('🔒 Estado isProcessingStep2:', true)
                        console.log('🔒 Estado step2ContinueClicked:', true)
                        console.log('📊 Documentos cargados:', {
                          docType: kycData.docType,
                          documentFront: uploadedRemote.documentFront,
                          documentBack: uploadedRemote.documentBack
                        })
                        
                        try {
                          // Guardar los documentos del paso 2 en la base de datos
                          await handleSaveStep2Draft()
                          
                          // Marcar el paso como completo
                          const success = await markStepAsComplete(2)
                          
                          if (success) {
                            // Navegar específicamente al paso 3 (selfie)
                            console.log('🎯 Navegando al paso 3 desde el botón Continuar')
                            console.log('🔍 Estado del wizard antes de navegar:', {
                              current: wizardState.current,
                              status: wizardState.status
                            })
                            
                            // Habilitar el paso 3 permanentemente
                            setStep3Enabled(true)
                            saveStepStates(step1ContinueClicked, true, true) // Guardar que el paso 3 está habilitado
                            
                            // Usar setCurrentStep directamente para asegurar la navegación
                            setCurrentStep(3)
                            console.log('✅ Navegación al paso 3 completada')
                          } else {
                            toast.error('No se pudo marcar el paso 2 como completo. Verifica que las imágenes estén cargadas.')
                          }
                        } catch (error) {
                          console.error('Error en paso 2:', error)
                          toast.error('Error al procesar los documentos. Inténtalo de nuevo.')
                        } finally {
                          setIsProcessingStep2(false)
                        }
                      }}
                      disabled={!step2Done || isProcessingStep2 || step2ContinueClicked}
                      title={`step2Done: ${step2Done}, isProcessingStep2: ${isProcessingStep2}, step2ContinueClicked: ${step2ContinueClicked}`}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
                    >
                      <span className="flex items-center gap-2">
                        {isProcessingStep2 && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isProcessingStep2 ? "Procesando..." : "Continuar"}
                      </span>
                    </Button>
                )}
                
            </div>
            )}

            {/* Solo mostrar botón de envío en el paso 5 */}
            {currentStep === 5 && (
              <div className="flex gap-4 sm:ml-auto">
                <Button 
                  data-action="continuar"
                  onClick={async () => {
                    if (canContinue()) {
                      try {
                        // Enviar la verificación
                      await handleSubmitKyc()
                        
                        // Marcar el paso 5 como completo
                        const success = await markStepAsComplete(5)
                        
                        if (success) {
                          console.log('✅ Paso 5 marcado como completo después del envío')
                          // Mostrar modal de confirmación en lugar de navegar
                          setShowSubmissionModal(true)
                        } else {
                          console.error('❌ No se pudo marcar el paso 5 como completo')
                        }
                      } catch (error) {
                        console.error('Error al enviar verificación:', error)
                      }
                    }
                  }} 
                  disabled={!isReadyToSubmit || kycStatus === "review" || isSubmitting || !canContinue() || !wizardState.flags.aceptoDeclaracion} 
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
              <AccordionContent> Generalmente entre 24 y 72 horas hábiles, dependiendo del volumen de solicitudes.</AccordionContent>
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

      {/* Modal de confirmación de envío */}
      <Dialog open={showSubmissionModal} onOpenChange={setShowSubmissionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Verificación Enviada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tu verificación ha sido enviada exitosamente. Nuestro equipo revisará tus documentos y te notificaremos por correo electrónico cuando se complete el proceso.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                <strong>Tiempo estimado:</strong> 24-72 horas hábiles
              </p>
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={() => setShowSubmissionModal(false)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Entendido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal información para pasaportes */}
      <Dialog open={showPassportModal} onOpenChange={setShowPassportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Documento de Pasaporte
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-foreground space-y-2">
              <p className="font-medium">¿Sabías que para pasaportes necesitas?</p>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Subir dos veces la misma imagen:</strong> Para validar tu documento de pasaporte, 
                  deberás cargar la misma foto de tu pasaporte tanto en "Documento frontal" como en "Documento reverso".
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Esto es necesario porque los pasaportes tienen toda la información válida en una sola página.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowPassportModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={async () => {
                  setShowPassportModal(false)
                  await continueToStep2()
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Entendido, continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


