"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import "./profile-page.css"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { getUserProfileData, updateProfilePreferences, uploadUserAvatar, type UserProfileData } from "@/lib/actions/user_profile"
import { 
  Camera, 
  Upload, 
  User, 
  Mail, 
  Phone, 
  Palette, 
  Shield, 
  Save,
  Calendar,
  MapPin,
  Globe,
  CheckCircle,
  Clock,
  Bell,
  FileText,
  CreditCard,
  Loader2,
  Cat,
  Dog,
  Fish,
  Bird,
  Rabbit,
  Turtle,
  Heart,
  Star,
  Zap,
  Circle
} from "lucide-react"

export default function PerfilPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profileData, setProfileData] = useState<UserProfileData | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [activeSection, setActiveSection] = useState('personal')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [selectedColorScheme, setSelectedColorScheme] = useState('ocean')
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [selectedAnimalAvatar, setSelectedAnimalAvatar] = useState<string | null>(null)

  // Avatares de animales disponibles
  const animalAvatars = {
    cat: {
      name: 'Gato',
      icon: Cat,
      color: '#f59e0b',
      description: 'Místico y elegante'
    },
    dog: {
      name: 'Perro',
      icon: Dog,
      color: '#8b5cf6',
      description: 'Leal y amigable'
    },
    fish: {
      name: 'Pez',
      icon: Fish,
      color: '#06b6d4',
      description: 'Libre y fluido'
    },
    bird: {
      name: 'Pájaro',
      icon: Bird,
      color: '#10b981',
      description: 'Libre y aventurero'
    },
    rabbit: {
      name: 'Conejo',
      icon: Rabbit,
      color: '#f472b6',
      description: 'Ágil y juguetón'
    },
    turtle: {
      name: 'Tortuga',
      icon: Turtle,
      color: '#84cc16',
      description: 'Sabio y paciente'
    },
    heart: {
      name: 'Corazón',
      icon: Heart,
      color: '#ec4899',
      description: 'Amoroso y cariñoso'
    },
    star: {
      name: 'Estrella',
      icon: Star,
      color: '#eab308',
      description: 'Brillante y especial'
    },
    zap: {
      name: 'Rayo',
      icon: Zap,
      color: '#22c55e',
      description: 'Energético y dinámico'
    },
    circle: {
      name: 'Círculo',
      icon: Circle,
      color: '#6b7280',
      description: 'Equilibrado y completo'
    }
  }

  // Esquemas de colores para la franja
  const colorSchemes = {
    ocean: {
      name: 'Océano',
      gradient: 'linear-gradient(90deg, #0ea5e9 0%, #3b82f6 50%, #1d4ed8 100%)',
      description: 'Azules profundos del océano'
    },
    sunset: {
      name: 'Atardecer',
      gradient: 'linear-gradient(90deg, #f97316 0%, #ef4444 50%, #dc2626 100%)',
      description: 'Naranjas y rojos del atardecer'
    },
    forest: {
      name: 'Bosque',
      gradient: 'linear-gradient(90deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
      description: 'Verdes naturales del bosque'
    },
    lavender: {
      name: 'Lavanda',
      gradient: 'linear-gradient(90deg, #a855f7 0%, #9333ea 50%, #7c3aed 100%)',
      description: 'Púrpuras suaves de lavanda'
    },
    coral: {
      name: 'Coral',
      gradient: 'linear-gradient(90deg, #f472b6 0%, #ec4899 50%, #db2777 100%)',
      description: 'Rosas vibrantes del coral'
    },
    aurora: {
      name: 'Aurora',
      gradient: 'linear-gradient(90deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)',
      description: 'Colores mágicos de la aurora'
    },
    emerald: {
      name: 'Esmeralda',
      gradient: 'linear-gradient(90deg, #10b981 0%, #059669 50%, #047857 100%)',
      description: 'Verdes esmeralda elegantes'
    },
    royal: {
      name: 'Real',
      gradient: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 50%, #3730a3 100%)',
      description: 'Púrpuras reales y majestuosos'
    }
  }

  // Función para navegar a una sección
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Cargar datos del perfil al montar el componente
  useEffect(() => {
    const loadProfileData = async () => {
      setIsLoadingProfile(true)
      try {
        const result = await getUserProfileData()
        if (result.ok && result.data) {
          setProfileData(result.data)
          // Si ya hay un teléfono guardado, marcar como guardado
          if (result.data.phone) {
            setPhoneSaved(true)
          }
          console.log('✅ Datos del perfil cargados:')
          console.log(result.data)
        } else {
          console.error('❌ Error cargando perfil:', result.message)
          toast.error(result.message)
        }
      } catch (error) {
        console.error('❌ Error cargando perfil:', error)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfileData()
  }, [toast])

  // Detectar avatar de animal seleccionado al cargar
  useEffect(() => {
    if (profileData?.avatar_url && profileData.avatar_url.startsWith('animal_')) {
      // Buscar qué avatar de animal está seleccionado
      Object.entries(animalAvatars).forEach(([key, animal]) => {
        if (profileData.avatar_url?.includes(`animal_${key}_`)) {
          setSelectedAnimalAvatar(key)
        }
      })
    } else {
      // Si no hay avatar de animal, limpiar selección
      setSelectedAnimalAvatar(null)
    }
  }, [profileData?.avatar_url])

  // Función para obtener información del estado de verificación
  const getVerificationInfo = (status: string) => {
    switch (status) {
      case "approved":
        return { 
          label: "Aprobado", 
          color: "bg-green-500", 
          textColor: "text-green-600",
          icon: CheckCircle,
          description: "Tu identidad ha sido verificada correctamente"
        }
      case "pending":
        return { 
          label: "En Revisión", 
          color: "bg-yellow-500", 
          textColor: "text-yellow-600",
          icon: Clock,
          description: "Tu verificación está siendo revisada"
        }
      case "review":
        return { 
          label: "En Revisión", 
          color: "bg-yellow-500", 
          textColor: "text-yellow-600",
          icon: Clock,
          description: "Estamos revisando tu documentación"
        }
      case "rejected":
        return { 
          label: "Rechazado", 
          color: "bg-red-500", 
          textColor: "text-red-600",
          icon: Shield,
          description: "Hubo un problema con tu verificación"
        }
      default:
        return { 
          label: "No Verificado", 
          color: "bg-red-500", 
          textColor: "text-red-600",
          icon: Shield,
          description: "Completa el proceso de verificación KYC"
        }
    }
  }

  const handleSave = async () => {
    if (!profileData) return
    
    setIsLoading(true)
    setSaveStatus('saving')
    
    // Mostrar notificación de inicio
    toast.info("Guardando preferencias...", {
      description: "Actualizando tu configuración personal",
      duration: 2000,
    })
    
    try {
      const result = await updateProfilePreferences({
        phone: profileData.phone,
        theme: profileData.theme,
        notification_email: profileData.notification_email,
        notification_push: profileData.notification_push,
      })
      
      if (result.ok) {
        setSaveStatus('success')
        setPhoneSaved(true) // Marcar teléfono como guardado
        toast.success("Preferencias guardadas", {
          description: "Tu configuración se ha actualizado correctamente",
          duration: 3000,
        })
        
        // Resetear estado después de 2 segundos
        setTimeout(() => {
          setSaveStatus('idle')
        }, 2000)
      } else {
        setSaveStatus('error')
        toast.error("Error al guardar", {
          description: result.message,
          duration: 4000,
        })
        
        // Resetear estado después de 3 segundos
        setTimeout(() => {
          setSaveStatus('idle')
        }, 3000)
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error)
      setSaveStatus('error')
      toast.error("Error inesperado", {
        description: "No se pudo actualizar el perfil. Inténtalo de nuevo.",
        duration: 4000,
      })
      
      // Resetear estado después de 3 segundos
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profileData) return

    setIsUploadingAvatar(true)
    
    try {
      const result = await uploadUserAvatar(file)
      
      if (result.ok && result.data) {
        setProfileData({ ...profileData, avatar_url: result.data.avatar_url })
        toast.success("Avatar actualizado", {
          description: "Tu foto de perfil se ha actualizado correctamente",
          duration: 3000,
        })
      } else {
        toast.error("Error al actualizar avatar", {
          description: result.message,
          duration: 4000,
        })
      }
    } catch (error) {
      console.error('Error subiendo avatar:', error)
      toast.error("Error inesperado", {
        description: "No se pudo subir la imagen. Inténtalo de nuevo.",
        duration: 4000,
      })
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Función para seleccionar avatar de animal
  const handleAnimalAvatarSelect = async (animalKey: string) => {
    if (!profileData) return

    const animal = animalAvatars[animalKey as keyof typeof animalAvatars]
    if (!animal) return

    setIsUploadingAvatar(true)
    
    try {
      // Crear un identificador simple para el avatar de animal
      const avatarIdentifier = `animal_${animalKey}_${animal.color.replace('#', '')}`
      
      // Actualizar el perfil con el identificador del avatar
      const result = await updateProfilePreferences({ avatar_url: avatarIdentifier })
      
      if (result.ok) {
        setProfileData({ ...profileData, avatar_url: avatarIdentifier })
        setSelectedAnimalAvatar(animalKey)
        setShowAvatarSelector(false)
        toast.success("Avatar actualizado", {
          description: `Has seleccionado el avatar ${animal.name}`,
          duration: 3000,
        })
      } else {
        toast.error("Error al actualizar avatar", {
          description: result.message,
          duration: 4000,
        })
      }
    } catch (error) {
      console.error('Error seleccionando avatar:', error)
      toast.error("Error inesperado", {
        description: "No se pudo actualizar el avatar. Inténtalo de nuevo.",
        duration: 4000,
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleInputChange = (field: keyof UserProfileData, value: any) => {
    if (profileData) {
      setProfileData({ ...profileData, [field]: value })
    }
  }

  // Si está cargando, mostrar spinner
  if (isLoadingProfile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner message="Cargando perfil..." />
      </div>
    )
  }

  // Si no hay datos del perfil, mostrar mensaje
  if (!profileData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner message="No se pudieron cargar los datos del perfil" />
      </div>
    )
  }

  const verificationInfo = getVerificationInfo(profileData.kyc_status)

  return (
    <section className="profile-page min-h-screen bg-gradient">
      <div className="container mx-auto px-4 py-8">
        {/* Header Compacto y Moderno con franja de fondo */}
        <div className="mb-8 relative">
          {/* Franja de color como fondo del header */}
          <div 
            className="color-strip absolute inset-0 rounded-lg"
            style={{ background: colorSchemes[selectedColorScheme as keyof typeof colorSchemes].gradient }}
          ></div>
          
          <div className="relative z-10 flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="profile-avatar h-16 w-16 border-2 shadow-lg">
                  {profileData.avatar_url && profileData.avatar_url.startsWith('animal_') ? (
                    // Mostrar icono de animal
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: selectedAnimalAvatar ? animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.color : '#6b7280' }}>
                      {selectedAnimalAvatar && (() => {
                        const IconComponent = animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.icon
                        return IconComponent ? <IconComponent className="w-8 h-8 text-white" /> : null
                      })()}
                    </div>
                  ) : (
                    // Mostrar imagen normal o fallback
                    <>
                      <AvatarImage src={profileData.avatar_url || ""} alt={profileData.full_name || "Usuario"} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-h4">
                        {profileData.full_name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
            <Button
              size="sm"
                  className="profile-avatar-button absolute -bottom-1 -right-1 h-6 w-6 rounded-full p-0 shadow-md"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
            >
                  <Camera className="h-3 w-3" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
              <div>
                <h1 className="text-h1 text-white font-bold">{profileData.full_name || "Usuario"}</h1>
                <p className="text-body-sm text-white font-medium">{profileData.email}</p>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={`badge-${profileData.kyc_status} px-3 py-1 text-caption shadow-sm ${verificationInfo.textColor} bg-white/90 backdrop-blur-sm`}
            >
                <verificationInfo.icon className="h-3 w-3 mr-1" />
                {verificationInfo.label}
              </Badge>
            </div>
        </div>

        {/* Layout Principal con Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar de Navegación */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-4">
              <Card className="profile-sidebar p-4">
                <h3 className="text-h4 mb-4 text-primary">Navegación</h3>
                <nav className="space-y-2">
                  <button 
                    onClick={() => scrollToSection('personal')}
                    className={`nav-item w-full text-left px-3 py-2 rounded-lg transition-colors text-label ${activeSection === 'personal' ? 'active' : ''}`}
                  >
                    <User className="h-4 w-4 inline mr-2" />
                    Información Personal
                  </button>
                  <button 
                    onClick={() => scrollToSection('verification')}
                    className={`nav-item w-full text-left px-3 py-2 rounded-lg transition-colors text-label ${activeSection === 'verification' ? 'active' : ''}`}
                  >
                    <Shield className="h-4 w-4 inline mr-2" />
                    Verificación
                  </button>
                  <button 
                    onClick={() => scrollToSection('preferences')}
                    className={`nav-item w-full text-left px-3 py-2 rounded-lg transition-colors text-label ${activeSection === 'preferences' ? 'active' : ''}`}
                  >
                    <Bell className="h-4 w-4 inline mr-2" />
                    Preferencias
                  </button>
                  <button 
                    onClick={() => scrollToSection('reputation')}
                    className={`nav-item w-full text-left px-3 py-2 rounded-lg transition-colors text-label ${activeSection === 'reputation' ? 'active' : ''}`}
                  >
                    <CreditCard className="h-4 w-4 inline mr-2" />
                    Reputación
                  </button>
                </nav>
              </Card>

              {/* Resumen Rápido */}
              <Card className="profile-summary p-4">
                <h3 className="text-h4 mb-4 text-primary">Resumen</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-caption">Miembro desde:</span>
                    <span className="text-label text-primary">{new Date(profileData.member_since).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-caption">Estado:</span>
                    <span className={`text-label ${verificationInfo.textColor} !important`}>{verificationInfo.label}</span>
                  </div>
                  {profileData.phone && (
                    <div className="flex justify-between">
                      <span className="text-caption">Teléfono:</span>
                      <span className="text-label text-primary">{profileData.phone}</span>
                    </div>
                  )}
                </div>
              </Card>
        </div>
      </div>

          {/* Contenido Principal */}
          <div className="lg:col-span-3 space-y-6">
            {/* Información Personal - Diseño de Tarjetas Modulares */}
            <div id="personal" className="space-y-6">
              <h2 className="text-h2">Información Personal</h2>
              
              {/* Grid de Información Básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre Completo */}
                <Card className="profile-card hover-card p-4 transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="icon-container p-2 rounded-lg">
                      <User className="icon h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-h4 text-primary">Nombre Completo</h3>
                      <p className="text-caption">Tu nombre registrado</p>
                    </div>
                  </div>
                  <div className="profile-card-muted rounded-lg p-3">
                    <p className="text-label text-primary">{profileData.full_name || "No disponible"}</p>
                </div>
                </Card>

                {/* Email */}
                <Card className="profile-card hover-card p-4 transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="icon-container p-2 rounded-lg">
                      <Mail className="icon h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-h4 text-primary">Correo Electrónico</h3>
                      <p className="text-caption">Cuenta principal</p>
                    </div>
                  </div>
                  <div className="profile-card-muted rounded-lg p-3">
                    <p className="text-label text-primary">{profileData.email}</p>
                </div>
                </Card>

                {/* Teléfono */}
                <Card className="profile-card hover-card p-4 transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="icon-container p-2 rounded-lg">
                      <Phone className="icon h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-h4 text-primary">Número de Teléfono</h3>
                      <p className="text-caption">Contacto opcional</p>
                    </div>
                  </div>
                <div className="space-y-2">
                  <Input
                    value={profileData.phone || ""}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+504 9999-9999"
                      className="form-input"
                      disabled={phoneSaved}
                  />
                    <p className="text-caption">
                      {phoneSaved ? "Número de teléfono guardado" : "Agrega tu número para contactos importantes"}
                  </p>
                </div>
                </Card>

                {/* Fecha de Nacimiento */}
                <Card className="profile-card hover-card p-4 transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="icon-container p-2 rounded-lg">
                      <Calendar className="icon h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-h4 text-primary">Fecha de Nacimiento</h3>
                      <p className="text-caption">Verificado en KYC</p>
                    </div>
                  </div>
                  <div className="profile-card-muted rounded-lg p-3">
                    <p className="text-label text-primary">{profileData.birth_date || "No disponible"}</p>
                  </div>
                </Card>
                </div>

              {/* Información de Verificación */}
              <div className="mt-8">
                <h3 className="text-h3 mb-4">Información de Verificación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* País */}
                  <Card className="profile-card hover-card p-4 transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="icon-container p-2 rounded-lg">
                        <MapPin className="icon h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-h4 text-primary">País de Residencia</h3>
                        <p className="text-caption">Ubicación verificada</p>
                      </div>
                    </div>
                    <div className="profile-card-muted rounded-lg p-3">
                      <p className="text-label text-primary">{profileData.country || "No disponible"}</p>
                </div>
                  </Card>

                  {/* Tipo de Documento */}
                  <Card className="profile-card hover-card p-4 transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="icon-container p-2 rounded-lg">
                        <FileText className="icon h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-h4 text-primary">Tipo de Documento</h3>
                        <p className="text-caption">Documento oficial</p>
                      </div>
                    </div>
                    <div className="profile-card-muted rounded-lg p-3">
                      <p className="text-label text-primary">{profileData.doc_type || "No disponible"}</p>
                    </div>
                  </Card>
                </div>
              </div>
            </div>

            {/* Estado de Verificación - Diseño Compacto */}
            <div id="verification" className="space-y-6">
              <h2 className="text-h2">Estado de Verificación</h2>
              
              {/* Estado Principal */}
              <Card className="profile-card p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`p-3 rounded-full ${verificationInfo.color} shadow-lg`}>
                  <verificationInfo.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h3 className="text-h3 text-primary">{verificationInfo.label}</h3>
                    <p className="text-body-sm text-muted">{verificationInfo.description}</p>
                  </div>
                </div>

                {/* Información Detallada */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="profile-card-muted rounded-lg p-4">
                    <h4 className="text-h4 mb-2 text-primary">Número de Documento</h4>
                    <p className="text-body-sm text-muted font-mono">
                      {profileData.doc_number ? `****${profileData.doc_number.slice(-4)}` : "No disponible"}
                    </p>
              </div>
                  <div className="profile-card-muted rounded-lg p-4">
                    <h4 className="text-h4 mb-2 text-primary">Fecha de Envío</h4>
                    <p className="text-body-sm text-muted">
                      {profileData.kyc_submitted_at ? new Date(profileData.kyc_submitted_at).toLocaleDateString('es-ES') : "No enviado"}
                  </p>
                </div>
              </div>

                {/* Acciones */}
              {(profileData.kyc_status === 'none' || profileData.kyc_status === 'rejected') && (
                  <Button asChild className="btn-primary w-full md:w-auto">
                    <a href="/dashboard/verificacion" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {profileData.kyc_status === 'rejected' ? 'Reintentar Verificación' : 'Iniciar Verificación'}
                    </a>
                  </Button>
                )}
                {profileData.kyc_status === 'pending' && (
                  <div className="p-4 rounded-lg profile-card-muted">
                    <p className="text-body-sm flex items-center gap-2 text-muted">
                      <Clock className="h-4 w-4" />
                      Tu verificación está siendo procesada. Te notificaremos cuando esté lista.
                    </p>
                </div>
              )}
          </Card>
            </div>

            {/* Preferencias - Diseño Simplificado */}
            <div id="preferences" className="space-y-6">
              <h2 className="text-h2">Preferencias</h2>
              
              <Card className="profile-card p-6">
                <div className="space-y-6">
              {/* Tema */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="icon-container p-2 rounded-lg">
                        <Palette className="icon h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-h4 text-primary">Tema de Interfaz</h3>
                        <p className="text-caption">Personaliza la apariencia</p>
                      </div>
                    </div>
                <Select
                  value={profileData.theme}
                  onValueChange={(value: 'light' | 'dark' | 'system') => handleInputChange('theme', value)}
                >
                      <SelectTrigger className="w-full md:w-64 form-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Oscuro</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                  <Separator />

                  {/* Avatar de Animal */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="icon-container p-2 rounded-lg">
                        <User className="icon h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-h4 text-primary">Avatar de Animal</h3>
                        <p className="text-caption">Selecciona tu animal favorito</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                      {Object.entries(animalAvatars).map(([key, animal]) => {
                        const IconComponent = animal.icon
                        return (
                          <button
                            key={key}
                            onClick={() => handleAnimalAvatarSelect(key)}
                            disabled={isUploadingAvatar}
                            className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 disabled:opacity-50 ${
                              selectedAnimalAvatar === key 
                                ? 'border-primary ring-2 ring-primary/20' 
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                            title={animal.description}
                          >
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center mb-2"
                              style={{ backgroundColor: animal.color }}
                            >
                              <IconComponent className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-xs font-medium text-center text-primary">{animal.name}</p>
                            {selectedAnimalAvatar === key && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Esquema de Colores del Header */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="icon-container p-2 rounded-lg">
                        <Palette className="icon h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-h4 text-primary">Colores del Header</h3>
                        <p className="text-caption">Personaliza la franja de color</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(colorSchemes).map(([key, scheme]) => (
                        <button
                          key={key}
                          onClick={() => setSelectedColorScheme(key)}
                          className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                            selectedColorScheme === key 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                          title={scheme.description}
                        >
                          <div 
                            className="w-full h-8 rounded mb-2"
                            style={{ background: scheme.gradient }}
                          ></div>
                          <p className="text-xs font-medium text-center text-primary">{scheme.name}</p>
                          {selectedColorScheme === key && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

              <Separator />

              {/* Notificaciones */}
              <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="icon-container p-2 rounded-lg">
                        <Bell className="icon h-4 w-4" />
                      </div>
                    <div>
                        <h3 className="text-h4 text-primary">Notificaciones</h3>
                        <p className="text-caption">Configura cómo recibir alertas</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 pl-12">
                      <div className="flex items-center justify-between p-3 rounded-lg profile-card-muted">
                        <div>
                          <Label htmlFor="notifications-email" className="text-label text-primary">Correo Electrónico</Label>
                          <p className="text-caption">Notificaciones importantes por email</p>
                    </div>
                    <input
                      type="checkbox"
                      id="notifications-email"
                      checked={profileData.notification_email}
                      onChange={(e) => handleInputChange('notification_email', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>

                      <div className="flex items-center justify-between p-3 rounded-lg profile-card-muted">
                    <div>
                          <Label htmlFor="notifications-push" className="text-label text-primary">Notificaciones Push</Label>
                          <p className="text-caption">Alertas en tiempo real</p>
                    </div>
                    <input
                      type="checkbox"
                      id="notifications-push"
                      checked={profileData.notification_push}
                      onChange={(e) => handleInputChange('notification_push', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              </div>

              {/* Botón de guardar */}
              <div className="pt-4">
                    <Button 
                      onClick={handleSave} 
                      disabled={isLoading} 
                      className={`btn-primary w-full md:w-auto transition-all duration-200 ${
                        saveStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 
                        saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : ''
                      }`}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Guardando...
                        </div>
                      ) : saveStatus === 'success' ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Guardado
                        </div>
                      ) : saveStatus === 'error' ? (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Error
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Save className="h-4 w-4" />
                          Guardar Preferencias
                        </div>
                      )}
                </Button>
              </div>
                </div>
          </Card>
            </div>

            {/* Reputación - Placeholder */}
            <div id="reputation" className="space-y-6">
              <h2 className="text-h2">Reputación</h2>
              
              <Card className="profile-card p-8 text-center">
                <div className="icon-container rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <CreditCard className="icon h-8 w-8" />
                </div>
                <h3 className="text-h3 mb-2 text-primary">Sistema de Reputación</h3>
                <p className="text-body-sm text-muted mb-4">
                  Próximamente podrás ver tu calificación promedio, número de transacciones completadas, y reseñas de otros usuarios.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-caption">
                  <div className="flex items-center justify-center gap-2">
                    <span>📊</span>
                    <span>Calificación promedio</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span>💬</span>
                    <span>Reseñas recibidas</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span>✨</span>
                    <span>Perfil destacado</span>
                  </div>
                </div>
              </Card>
            </div>
                </div>
              </div>
    </div>
    </section>
  )
}