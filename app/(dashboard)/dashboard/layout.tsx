"use client"

import type React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreditCard, Gavel, Home, LogOut, Receipt, User, Menu, MoreVertical, Link2, Shield, Bell, Cat, Dog, Fish, Bird, Rabbit, Turtle, Heart, Star, Zap, Circle, AlertTriangle, X, Search, MessageSquare, HelpCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"
import { usePathname } from "next/navigation"
import { getKycDraft } from "@/app/actions/kyc_data"
import { AuthSpinner } from "@/components/ui/auth-spinner"
import { NotificationBell } from "@/components/notifications/NotificationBell"

interface DashboardLayoutProps {
  children: React.ReactNode
  userName?: string
}

const menuItems = [
  { id: "resumen", label: "Resumen", icon: Home, href: "/dashboard" },
  { id: "saldo", label: "Balance HNLD", icon: CreditCard, href: "/dashboard/saldo" },
  { id: "solicitudes", label: "Solicitudes", icon: Search, href: "/dashboard/solicitudes" },
  { id: "subastas", label: "Subastas", icon: Gavel, href: "/dashboard/subastas" },
  { id: "transacciones", label: "Transacciones", icon: Receipt, href: "/dashboard/transacciones" },
  { id: "links", label: "Links de Pago", icon: Link2, href: "/dashboard/links" },
  { id: "verificacion", label: "Verificación", icon: Shield, href: "/dashboard/verificacion" },
  { id: "perfil", label: "Perfil", icon: User, href: "/dashboard/perfil" },
]

export default function DashboardLayout({ children, userName = "Usuario" }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const [displayName, setDisplayName] = useState(userName)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [kycStatus, setKycStatus] = useState<string>("none")
  const [kycData, setKycData] = useState<any>(null)
  const [selectedAnimalAvatar, setSelectedAnimalAvatar] = useState<string | null>(null)
  const [showRejectionBanner, setShowRejectionBanner] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  // Avatares de animales disponibles (mismo que en perfil)
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

  useEffect(() => {
    setMounted(true)
  }, [])

  // Cargar nombre del usuario desde Supabase
  useEffect(() => {
    const supabase = supabaseBrowser()
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session
      if (!session) {
        // Si no hay sesión, redirigir al login
        window.location.href = '/login'
        return
      }
      
      setUserId(session.user.id)
      
      // VALIDACIÓN DE SEGURIDAD: Verificar que el usuario tenga un perfil en la base de datos
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle()
      
      // Si no hay perfil en la base de datos, continuar sin cerrar sesión
      if (profileError || !profile) {
        console.log('⚠️ Usuario sin perfil en base de datos:', session.user.email)
        console.log('⚠️ Continuando sin cerrar sesión')
        // await supabase.auth.signOut() // Temporalmente deshabilitado
        // window.location.href = '/login' // Temporalmente deshabilitado
        // return // Temporalmente deshabilitado
      }
      
      const name = profile?.full_name || session.user.user_metadata?.full_name || session.user.email || userName
      setDisplayName(name)

      // Cargar avatar del usuario desde user_profiles
      try {
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("avatar_url")
          .eq("user_id", session.user.id)
          .maybeSingle()
        
        if (userProfile?.avatar_url) {
          setUserAvatar(userProfile.avatar_url)
          
          // Detectar avatar de animal seleccionado
          if (userProfile.avatar_url.startsWith('animal_')) {
            Object.entries(animalAvatars).forEach(([key, animal]) => {
              if (userProfile.avatar_url?.includes(`animal_${key}_`)) {
                setSelectedAnimalAvatar(key)
              }
            })
          } else {
            setSelectedAnimalAvatar(null)
          }
        }
      } catch (error) {
        console.log('No se pudo cargar avatar del usuario:', error)
      }

      // Cargar datos de KYC para notificaciones inteligentes
      try {
        const kycResult = await getKycDraft()
        if (kycResult && kycResult.ok && kycResult.data) {
          setKycData(kycResult.data)
          setKycStatus(kycResult.data.status)
          
          // Mostrar banner de rechazo si el estado es "rejected"
          console.log('🔍 Estado KYC cargado:', kycResult.data.status)
          console.log('🔍 Admin notes:', kycResult.data.admin_notes)
          setShowRejectionBanner(kycResult.data.status === "rejected")
        }
      } catch (error) {
        console.error('Error loading KYC data:', error)
      }

      // Determinar si mostrar notificación basado en estado KYC real
      const kycNotification = getKycNotification()
      setShowRejectionBanner(kycNotification.show)
    })
  }, [])

  // Suscripción en tiempo real a cambios en kyc_submissions
  useEffect(() => {
    if (!userId) return

    const supabase = supabaseBrowser()
    
    // Suscribirse a cambios en la tabla kyc_submissions para el usuario actual
    const channel = supabase
      .channel('kyc-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kyc_submissions',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log('🔄 Cambio detectado en KYC:', payload)
          
          // Actualizar el estado local con los nuevos datos
          try {
            const kycResult = await getKycDraft()
            if (kycResult && kycResult.ok && kycResult.data) {
              setKycData(kycResult.data)
              setKycStatus(kycResult.data.status)
              
              // Recalcular notificaciones
              const kycNotification = getKycNotification()
              setShowRejectionBanner(kycNotification.show)
              
              console.log('✅ Estado KYC actualizado en tiempo real:', kycResult.data.status)
            }
          } catch (error) {
            console.error('Error actualizando KYC en tiempo real:', error)
          }
        }
      )
      .subscribe()

    // Limpiar suscripción al desmontar
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Función para obtener el mensaje de notificación según el estado KYC real
  const getKycNotification = () => {
    // Si no hay datos en la base de datos
    if (!kycData) {
      return {
        type: "warning" as const,
        icon: Shield,
        title: "Verificación de cuenta requerida",
        message: "Es necesario completar la verificación de tu cuenta para acceder a todos los servicios de la plataforma.",
        action: "Iniciar verificación",
        show: true
      }
    }
    
    // Si hay datos pero el estado es "draft"
    if (kycStatus === "draft") {
      return {
        type: "info" as const,
        icon: Shield,
        title: "Verificación en progreso",
        message: "Has iniciado el proceso de verificación. Completa todos los pasos para enviar tu solicitud.",
        action: "Continuar verificación",
        show: true
      }
    }
    
    // Si está en revisión
    if (kycStatus === "review") {
      return {
        type: "info" as const,
        icon: Shield,
        title: "Verificación en revisión",
        message: "Tu verificación ha sido enviada y está siendo revisada por nuestro equipo. Los documentos se encuentran en revisión.",
        action: null,
        show: true
      }
    }
    
    // Si está aprobada
    if (kycStatus === "approved") {
      return {
        type: "success" as const,
        icon: Shield,
        title: "Verificación completada",
        message: "¡Felicidades! Tu cuenta ha sido verificada exitosamente. Ahora puedes utilizar todos los servicios de NMHN.",
        action: null,
        show: true
      }
    }
    
    // Si está rechazada
    if (kycStatus === "rejected") {
      const rejectionReason = kycData?.admin_notes || "No se proporcionó una razón específica"
      return {
        type: "error" as const,
        icon: Shield,
        title: "Verificación rechazada",
        message: `Tu verificación fue rechazada. Motivo: ${rejectionReason}. Revisa los comentarios y vuelve a enviar tu solicitud.`,
        action: "Reintentar verificación",
        show: true
      }
    }
    
    // Estado por defecto
    return {
      type: "info" as const,
      icon: Shield,
      title: "Estado de verificación",
      message: "Verifica el estado actual de tu cuenta.",
      action: null,
      show: false
    }
  }

  const getSectionTitle = (pathname: string) => {
    if (pathname === "/dashboard") return "Resumen"
    if (pathname.startsWith("/dashboard/subastas")) return "Subastas"
    if (pathname.startsWith("/dashboard/saldo")) return "Balance HNLD"
    if (pathname.startsWith("/dashboard/solicitudes")) return "Solicitudes"
    if (pathname.startsWith("/dashboard/transacciones")) return "Transacciones"
    if (pathname.startsWith("/dashboard/links")) return "Links de Pago"
    if (pathname.startsWith("/dashboard/verificacion")) return "Verificación"
    if (pathname.startsWith("/dashboard/perfil")) return "Perfil"
    return "Dashboard"
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  const toggleTheme = () => {
    if (resolvedTheme === "dark") {
      setTheme("light")
    } else {
      setTheme("dark")
    }
  }

  const handleLogout = async () => {
    setLogoutLoading(true)
    try {
      const supabase = supabaseBrowser()
      await supabase.auth.signOut()
    } catch {}
    // Pequeño delay para mostrar el spinner
    setTimeout(() => {
      window.location.href = "/login"
    }, 1000)
  }

  const handleLogoutClick = () => {
    setShowLogoutModal(true)
  }

  const handleConfirmLogout = async () => {
    setLogoutLoading(true)
    setShowLogoutModal(false)
    try {
      const supabase = supabaseBrowser()
      await supabase.auth.signOut()
    } catch {}
    // Pequeño delay para mostrar el spinner
    setTimeout(() => {
      window.location.href = "/login"
    }, 1000)
  }

  if (!mounted) {
    return (
      <div className="flex h-screen bg-white dark:bg-gray-950">
        <div className="hidden lg:block w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800"></div>
        <div className="flex-1 bg-white dark:bg-gray-950"></div>
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <>
      {logoutLoading && <AuthSpinner message="Cerrando sesión..." />}
      <div
        className="flex h-screen bg-background"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        <aside
          className={cn(
            "flex flex-col bg-sidebar border-r border-sidebar-border shadow transition-all duration-300",
            "hidden lg:flex", // Desktop: siempre visible en lg+
            sidebarCollapsed ? "w-16" : "w-64",
            // Móvil/tablet: overlay cuando está abierto
            "lg:relative fixed inset-y-0 left-0 z-50",
            mobileMenuOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-4 py-4 border-b border-sidebar-border">
              <div className="flex flex-col items-start space-y-1">
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-primary">NM</span>
                  {!sidebarCollapsed && <span className="text-2xl font-bold text-sidebar-foreground">HN</span>}
                </div>
                {!sidebarCollapsed && <span className="text-xs font-medium text-sidebar-foreground">Dashboard</span>}
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-2 py-4">
              <ul className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  const itemIsActive = isActive(item.href)

                  return (
                    <li key={item.id}>
                      <Button
                        asChild
                        variant={itemIsActive ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start !pl-4 !pr-3 gap-3 rounded-2xl h-12 transition-all duration-200",
                          itemIsActive
                            ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                          sidebarCollapsed && "justify-center !px-0",
                        )}
                      >
                        <Link
                          href={item.href}
                          title={sidebarCollapsed ? item.label : undefined}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                            <Icon className="h-5 w-5" />
                          </span>
                          {!sidebarCollapsed && <span className="text-left">{item.label}</span>}
                        </Link>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-sidebar-border">
              <Button
                variant="ghost"
                onClick={handleLogoutClick}
                className={cn(
                  "w-full justify-start !pl-4 !pr-3 gap-3 rounded-2xl h-12 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200",
                  sidebarCollapsed && "justify-center !px-0",
                )}
                title={sidebarCollapsed ? "Salir" : undefined}
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                  <LogOut className="h-5 w-5" />
                </span>
                {!sidebarCollapsed && <span className="text-left">Salir</span>}
              </Button>
            </div>
          </div>
        </aside>

		{/* Main Content Area */}
		<div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
			<header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 py-3 md:py-4">
            {/* Header Desktop */}
            <div className="hidden md:flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // En móvil/tablet: toggle mobile menu
                    if (window.innerWidth < 1024) {
                      setMobileMenuOpen(!mobileMenuOpen)
                    } else {
                      // En desktop: toggle collapse
                      setSidebarCollapsed(!sidebarCollapsed)
                    }
                  }}
                  className="flex rounded-full h-10 w-10 bg-muted hover:bg-muted/80 transition-all duration-200"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle sidebar</span>
                </Button>

                <h1 className="text-xl lg:text-2xl font-semibold text-card-foreground">{getSectionTitle(pathname)}</h1>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-4">
                  <span className="text-sm lg:text-base font-bold text-right">Hola, {displayName}!</span>

                  {/* Campana de notificaciones */}
                  <NotificationBell />
                  
                  {/* Botón de cambio de tema */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="rounded-full h-11 w-11 bg-muted hover:bg-muted/80 transition-all duration-200 border border-border"
                    title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  >
                    <div className="flex items-center justify-center">
                      {isDark ? (
                        <svg className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="sr-only">Cambiar tema</span>
                  </Button>

                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    {userAvatar && userAvatar.startsWith('animal_') ? (
                      // Mostrar icono de animal
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: selectedAnimalAvatar ? animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.color : '#6b7280' }}>
                        {selectedAnimalAvatar && (() => {
                          const IconComponent = animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.icon
                          return IconComponent ? <IconComponent className="w-5 h-5 text-white" /> : null
                        })()}
                      </div>
                    ) : (
                      // Mostrar imagen normal o fallback
                      <>
                        <AvatarImage src={userAvatar || "/placeholder.svg"} alt={displayName} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                </div>

                <div className="sm:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-11 w-11 bg-muted hover:bg-muted/80 transition-all duration-200"
                      >
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">Abrir menú</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <div className="px-3 py-2 border-b border-border/40">
                        <p className="text-sm font-semibold truncate">Hola, {displayName}!</p>
                      </div>
                      <DropdownMenuItem onClick={toggleTheme} className="flex items-center space-x-2">
                        {isDark ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                            />
                          </svg>
                        )}
                        <span>{isDark ? "Modo claro" : "Modo oscuro"}</span>
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem onClick={handleLogoutClick} className="flex items-center space-x-2">
                        <LogOut className="h-4 w-4" />
                        <span>Salir</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Header Móvil */}
            <div className="md:hidden">
              <div className="flex items-center justify-between">
                {/* Lado izquierdo: Menú + Título */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="flex rounded-full h-9 w-9 bg-muted hover:bg-muted/80 transition-all duration-200 flex-shrink-0"
                  >
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Toggle sidebar</span>
                  </Button>

                  <h1 className="text-lg font-semibold text-card-foreground truncate">{getSectionTitle(pathname)}</h1>
                </div>

                {/* Lado derecho: Notificaciones + Avatar + Menú */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* Campana de notificaciones */}
                  <NotificationBell />
                  
                  {/* Avatar del usuario */}
                  <Avatar className="h-8 w-8 border-2 border-primary/20">
                    {userAvatar && userAvatar.startsWith('animal_') ? (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: selectedAnimalAvatar ? animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.color : '#6b7280' }}>
                        {selectedAnimalAvatar && (() => {
                          const IconComponent = animalAvatars[selectedAnimalAvatar as keyof typeof animalAvatars]?.icon
                          return IconComponent ? <IconComponent className="w-4 h-4 text-white" /> : null
                        })()}
                      </div>
                    ) : (
                      <>
                        <AvatarImage src={userAvatar || "/placeholder.svg"} alt={displayName} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  
                  {/* Menú de tres puntos */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-9 w-9 bg-muted hover:bg-muted/80 transition-all duration-200"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Menú de opciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                        Hola, {displayName}!
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/perfil" className="flex items-center">
                          <User className="mr-2 h-4 w-4" />
                          <span>Perfil</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/verificacion" className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Verificación</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/extras/support" className="flex items-center">
                          <HelpCircle className="mr-2 h-4 w-4" />
                          <span>Soporte</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={toggleTheme} className="flex items-center">
                        {isDark ? (
                          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                        ) : (
                          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                            />
                          </svg>
                        )}
                        <span>{isDark ? "Modo claro" : "Modo oscuro"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowLogoutModal(true)} className="text-red-600">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Cerrar sesión</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

			{/* Main Content */}
			<main className="flex-1 bg-background">
            <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 pb-24 lg:pb-6">
              {/* Banner de rechazo KYC */}
              {showRejectionBanner && kycData?.admin_notes && (
                <div className="mb-6 p-4 border border-destructive/20 bg-destructive/10 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-destructive">Verificación Rechazada</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Motivo del rechazo:</strong> {kycData.admin_notes}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Por favor, revisa los comentarios y vuelve a enviar tu solicitud con las correcciones necesarias.
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowRejectionBanner(false)}
                          className="ml-2 h-8 w-8 p-0 hover:bg-destructive/20"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          onClick={() => setShowRejectionModal(true)}
                        >
                          Ver Detalles
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {children}
            </div>
          </main>
        </div>

        {/* Modal de detalles de rechazo */}
        <Dialog open={showRejectionModal} onOpenChange={setShowRejectionModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Detalles del Rechazo
              </DialogTitle>
              <DialogDescription>
                Información sobre el motivo del rechazo de tu verificación
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-lg">
                <h4 className="font-semibold text-destructive mb-2">Motivo del rechazo:</h4>
                <p className="text-sm text-foreground">{kycData?.admin_notes}</p>
              </div>
              <div className="p-4 border border-muted bg-muted/50 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">¿Qué puedes hacer?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Revisa la calidad de tus documentos</li>
                  <li>• Asegúrate de que las fotos sean claras y legibles</li>
                  <li>• Verifica que toda la información sea correcta</li>
                  <li>• Volver a enviar tu solicitud</li>
                </ul>
              </div>
              <div className="flex gap-2 pt-2">
                <Button asChild className="flex-1">
                  <Link href="/dashboard/verificacion">
                    Reintentar Verificación
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowRejectionModal(false)}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-40"
          style={{
            paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <nav className="flex justify-around px-2 py-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const itemIsActive = isActive(item.href)

              return (
                <Button
                  key={item.id}
                  asChild
                  variant="ghost"
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center h-12 rounded-xl transition-all duration-200 mx-1",
                    itemIsActive
                      ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Link href={item.href} className="flex flex-col items-center justify-center w-full h-full">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="text-xs font-medium leading-none mt-1 truncate hidden md:inline">
                      {item.label}
                    </span>
                  </Link>
                </Button>
              )
            })}
          </nav>
        </div>
      </div>

      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              Confirmar Salida
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-left space-y-2">
                <p>¿Estás seguro que deseas cerrar sesión?</p>
                <p className="text-sm text-muted-foreground">
                  Esta acción cerrará tu sesión actual y limpiará todos los datos locales almacenados en tu dispositivo.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowLogoutModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmLogout} 
              className="w-full sm:w-auto"
              disabled={logoutLoading}
            >
              {logoutLoading ? "Cerrando..." : "Sí, Cerrar Sesión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </>
  )
}
