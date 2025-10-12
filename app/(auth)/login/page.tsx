"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

  const handleGoogleSignIn = async () => {
    console.log('🔄 Iniciando Google Sign In...')
    setAuthLoading(true)
    setSubmitError("")
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) {
        console.error('❌ Error Google:', error)
        setSubmitError('Error al iniciar sesión con Google')
        setAuthLoading(false)
      } else {
        console.log('✅ Google OAuth iniciado correctamente')
      }
      // Si no hay error, el usuario será redirigido automáticamente
    } catch (error) {
      console.error('❌ Error inesperado Google:', error)
      setSubmitError('Error inesperado al conectar con Google')
      setAuthLoading(false)
    }
  }

  const handleFacebookSignIn = async () => {
    console.log('🔄 Iniciando Facebook Sign In...')
    setAuthLoading(true)
    setSubmitError("")
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'public_profile'
        }
      })
      
      if (error) {
        console.error('❌ Error Facebook:', error)
        setSubmitError('Error al iniciar sesión con Facebook')
        setAuthLoading(false)
      } else {
        console.log('✅ Facebook OAuth iniciado correctamente')
      }
      // Si no hay error, el usuario será redirigido automáticamente
    } catch (error) {
      console.error('❌ Error inesperado Facebook:', error)
      setSubmitError('Error inesperado al conectar con Facebook')
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <Button
        onClick={toggleTheme}
        variant="outline"
        size="icon"
        className="absolute top-4 right-4 bg-transparent"
        aria-label="Cambiar tema"
      >
        {mounted ? (
          theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
        ) : (
          <span className="h-4 w-4 inline-block" />
        )}
      </Button>

      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Link href="/" className="flex items-center justify-center font-bold text-2xl hover:opacity-80" title="Ir al inicio">
                <span className="text-primary">NM</span>
                <span className="text-muted-foreground">HN</span>
              </Link>
            </div>
            <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
            <CardDescription>Bienvenido de vuelta a la plataforma de comercio digital en 🇭🇳</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full bg-transparent" 
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? "Conectando..." : "Continuar con Google"}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full bg-transparent" 
                type="button"
                onClick={handleFacebookSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {loading ? "Conectando..." : "Continuar con Facebook"}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-primary font-medium">O CONTINÚA CON EMAIL</span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="tu@ejemplo.com"
                    required
                  />
                </div>
                {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
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

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="text-muted-foreground">
                    Recordarme
                  </Label>
                </div>
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
    </div>
    </>
  )
}
