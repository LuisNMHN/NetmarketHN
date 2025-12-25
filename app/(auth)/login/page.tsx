"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Mail, Lock, Sun, Moon } from "lucide-react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"
import { AuthSpinner } from "@/components/ui/auth-spinner"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showResendButton, setShowResendButton] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        router.replace('/dashboard')
      }
    })

    // Manejar errores de URL
    const urlParams = new URLSearchParams(window.location.search)
    const error = urlParams.get('error')
    
    if (error === 'no_profile') {
      setSubmitError('Tu cuenta no tiene un perfil creado. Contacta al administrador.')
    } else if (error === 'profile_error') {
      setSubmitError('Error verificando perfil de usuario. Intenta nuevamente.')
    } else if (error === 'auth_error') {
      setSubmitError('Error de autenticación. Intenta nuevamente.')
    } else if (error === 'callback_error') {
      setSubmitError('Error en el proceso de autenticación. Intenta nuevamente.')
    }
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors }

    switch (name) {
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = "Ingresa un correo válido (ejemplo@dominio.com)"
        } else {
          delete newErrors.email
        }
        break
      case "password":
        if (value.length < 1) {
          newErrors.password = "La contraseña es requerida"
        } else {
          delete newErrors.password
        }
        break
    }

    setErrors(newErrors)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as { name: keyof typeof formData; value: string }
    setFormData((prev) => ({ ...prev, [name]: value }))
    validateField(name, value)
    if (submitError) setSubmitError("")
  }

  const isFormValid = () => {
    const { email, password } = formData
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const passwordOk = password.trim().length > 0
    const fieldErrors = Object.keys(errors).filter((k) => k !== "submit")
    return emailOk && passwordOk && fieldErrors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid()) return
    setAuthLoading(true)
    setSubmitError("")
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
      
      if (error) {
        const msg = translateAuthError(error.message)
        setSubmitError(msg)
        setAuthLoading(false)
        return
      }

      // Verificar si el email está confirmado
      if (data.user && !data.user.email_confirmed_at) {
        console.log('⚠️ Usuario no ha verificado su email')
        
        // Cerrar sesión inmediatamente
        await supabase.auth.signOut()
        
        setSubmitError('Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.')
        setShowResendButton(true)
        setAuthLoading(false)
        return
      }

      // Verificar si el usuario tiene perfil creado
      if (data.user) {
        console.log('🔍 Verificando perfil para usuario:', data.user.email)
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', data.user.id)
            .maybeSingle()

          if (profileError) {
            console.error('❌ Error verificando perfil:', profileError.message || profileError)
            setSubmitError(`Error verificando perfil: ${profileError.message || 'Error desconocido'}`)
            setAuthLoading(false)
            return
          }

          if (!profile) {
            console.log('⚠️ Usuario sin perfil creado')
            setSubmitError('Tu cuenta no tiene un perfil creado. Contacta al administrador.')
            setAuthLoading(false)
            return
          }

          console.log('✅ Perfil encontrado:', profile.full_name)
        } catch (error) {
          console.error('❌ Error en verificación de perfil:', error instanceof Error ? error.message : error)
          setSubmitError(`Error verificando perfil: ${error instanceof Error ? error.message : 'Error desconocido'}`)
          setAuthLoading(false)
          return
        }
      }
      
      // Verificar si es admin para redirigir al panel correcto
      try {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select(`
            role_id,
            roles!inner(name)
          `)
          .eq('user_id', data.user.id)
          .eq('roles.name', 'admin')
          .maybeSingle()
        
        // Redirigir al panel correcto según el rol
        if (userRoles) {
          router.replace('/admin')
        } else {
          router.replace('/dashboard')
        }
      } catch (error) {
        console.error('Error verificando rol:', error)
        router.replace('/dashboard')
      }
    } catch (error) {
      setSubmitError('Error inesperado al iniciar sesión')
      setAuthLoading(false)
    }
  }


  const handleResendVerification = async () => {
    if (!formData.email) {
      setSubmitError('Ingresa tu correo electrónico para reenviar la verificación')
      return
    }

    setResendLoading(true)
    setSubmitError("")
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        setSubmitError('')
        toast.success("Se ha enviado un nuevo correo de verificación a tu bandeja de entrada")
        setShowResendButton(false)
      } else {
        setSubmitError(result.error || 'Error al reenviar el correo de verificación')
      }
    } catch (error) {
      setSubmitError('Error inesperado al reenviar el correo')
    } finally {
      setResendLoading(false)
    }
  }

  function translateAuthError(message: string) {
    const m = message.toLowerCase()
    if (m.includes("invalid login credentials")) return "Credenciales inválidas"
    if (m.includes("email not confirmed")) return "Debes confirmar tu correo para iniciar sesión"
    if (m.includes("too many requests")) return "Demasiados intentos, intenta más tarde"
    return "Ocurrió un error al iniciar sesión"
  }

  return (
    <>
      {authLoading && <AuthSpinner message="Iniciando sesión..." />}
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-xl shadow-lg border-b border-border/30">
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16 py-3 sm:py-4">
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
            <Link href="/" className="text-xl sm:text-2xl font-bold hover:opacity-80 transition-opacity">
              <span className="text-primary">NM</span>
              <span className="text-foreground/90">HN</span>
            </Link>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-primary hover:bg-muted/50"
                aria-label={mounted && theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {mounted ? (
                  theme === "dark" ? <Sun size={18} className="sm:w-5 sm:h-5" /> : <Moon size={18} className="sm:w-5 sm:h-5" />
                ) : (
                  <span className="h-4 w-4 sm:h-5 sm:w-5 inline-block" />
                )}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-10"
                asChild
              >
                <Link href="/register">Registro</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background pt-20 pb-20 sm:pt-24 sm:pb-24">
        <div className="w-full max-w-sm mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl sm:text-2xl">Inicia sesión en su cuenta de NMHN</CardTitle>
            </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="pb-2 block">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`pl-10 mb-3 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="tu@ejemplo.com"
                    required
                  />
                </div>
                {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="pb-2 block">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`pl-10 pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="••••••••"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-destructive text-sm">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-end text-sm">
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {submitError && <p className="text-destructive text-sm">{submitError}</p>}

              {showResendButton && (
                <div className="space-y-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                  >
                    {resendLoading ? "Enviando..." : "Reenviar correo de verificación"}
                  </Button>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!isFormValid() || loading}>
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  Crear cuenta
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full py-3 sm:py-4 bg-background/70 backdrop-blur-xl border-t border-border/30">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[10px] sm:text-xs text-muted-foreground">
            © 2026 NETMARKETHN LLC — Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
    </>
  )
}
