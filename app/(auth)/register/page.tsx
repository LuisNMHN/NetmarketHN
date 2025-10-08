"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eye, EyeOff, Mail, Lock, User, Sun, Moon, Check } from "lucide-react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"
import { AuthSpinner } from "@/components/ui/auth-spinner"

export default function RegisterPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Si ya hay sesión, redirigir al dashboard
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: isAdmin } = await supabase.rpc('has_role', { role_name: 'admin' })
        router.replace(isAdmin ? '/admin' : '/dashboard')
      }
    })
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors }

    switch (name) {
      case "name":
        const nameParts = value.trim().split(/\s+/)
        if (value.length < 2) {
          newErrors.name = "El nombre debe tener al menos 2 caracteres"
        } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value)) {
          newErrors.name = "Solo se permiten letras y espacios"
        } else if (nameParts.length < 2) {
          newErrors.name = "Ingresa al menos un nombre y un apellido"
        } else {
          delete newErrors.name
        }
        break
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = "Ingresa un correo válido (ejemplo@dominio.com)"
        } else {
          delete newErrors.email
        }
        break
      case "password":
        if (value.length < 8) {
          newErrors.password = "Mínimo 8 caracteres"
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          newErrors.password = "Debe incluir mayúscula, minúscula y número"
        } else {
          delete newErrors.password
        }
        break
      case "confirm":
        if (value !== formData.password) {
          newErrors.confirm = "Las contraseñas no coinciden"
        } else {
          delete newErrors.confirm
        }
        break
    }

    setErrors(newErrors)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as { name: keyof typeof formData; value: string }
    setFormData((prev) => ({ ...prev, [name]: value }))
    validateField(name, value)
  }

  const isFormValid = () => {
    const { name, email, password, confirm } = formData
    return (
      name.trim() !== "" &&
      email.trim() !== "" &&
      password.trim() !== "" &&
      confirm.trim() !== "" &&
      Object.keys(errors).length === 0
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid()) return
    setAuthLoading(true)
    
    console.log('🚀 Iniciando registro para:', formData.email)
    
    try {
      // Verificar configuración de Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('🔧 Configuración Supabase:')
      console.log('- URL:', supabaseUrl ? 'Configurada' : 'FALTANTE')
      console.log('- Key:', supabaseKey ? 'Configurada' : 'FALTANTE')
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Configuración de Supabase incompleta')
      }

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { full_name: formData.name } },
      })
      
      console.log('📝 Resultado de signUp:')
      console.log('- Data:', data)
      console.log('- Error:', error)
      console.log('- User:', data?.user)
      console.log('- Session:', data?.session)
      
      if (error) {
        console.error('❌ Error en signUp:', error)
        setErrors((prev) => ({ ...prev, submit: error.message }))
        setAuthLoading(false)
        return
      }

      if (!data.user) {
        console.error('❌ No se creó el usuario')
        setErrors((prev) => ({ ...prev, submit: 'No se pudo crear el usuario' }))
        setAuthLoading(false)
        return
      }

      console.log('✅ Usuario creado:', data.user.id, data.user.email)

      // Si hay sesión inmediata (usuario confirmado), crear perfil usando función SQL
      if (data.session && data.user) {
        console.log('🔄 Usuario confirmado, creando perfil...')
        
        try {
          // Usar función SQL para crear perfil completo con rol
          console.log('📊 Llamando a create_user_profile...')
          const { error: profileError } = await supabase.rpc('create_user_profile', {
            p_user_id: data.user.id,
            p_email: formData.email,
            p_full_name: formData.name
          })

          if (profileError) {
            console.warn('⚠️ Error creando perfil con función SQL:', profileError)
            
            // Verificar si el perfil ya existe
            const { data: existingProfile, error: checkError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', data.user.id)
              .maybeSingle()
            
            if (checkError) {
              console.error('❌ Error verificando perfil existente:', checkError.message)
            } else if (existingProfile) {
              console.log('ℹ️ Perfil ya existe, continuando...')
            } else {
              console.log('🔄 Intentando fallback manual...')
              
              // Fallback: crear perfil manualmente solo si no existe
              const { error: manualError } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  full_name: formData.name,
                  email: formData.email,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                
              if (manualError) {
                console.error('❌ Error en fallback manual:', manualError.message || manualError)
              } else {
                console.log('✅ Perfil creado manualmente')
              }
            }
          } else {
            console.log('✅ Perfil creado con función SQL')
          }

          // Verificar rol y redirigir
          console.log('🔍 Verificando rol de admin...')
          const { data: isAdmin } = await supabase.rpc('has_role', { role_name: 'admin' })
          console.log('👤 Es admin:', isAdmin)
          
          router.replace(isAdmin ? '/admin' : '/dashboard')
        } catch (profileCreationError) {
          console.error('❌ Error creando perfiles:', profileCreationError instanceof Error ? profileCreationError.message : profileCreationError)
          // Continuar con el flujo normal aunque falle la creación de perfil
          try {
            const { data: isAdmin } = await supabase.rpc('has_role', { role_name: 'admin' })
            router.replace(isAdmin ? '/admin' : '/dashboard')
          } catch (redirectError) {
            console.error('❌ Error en redirección:', redirectError instanceof Error ? redirectError.message : redirectError)
            router.replace('/dashboard')
          }
        }
      } else {
        console.log('📧 Usuario necesita confirmar email')
        
        // Enviar correo de verificación personalizado
        try {
          const response = await fetch('/api/auth/send-verification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.email,
              userName: formData.name
            }),
          })

          if (response.ok) {
            console.log('✅ Correo de verificación personalizado enviado')
          } else {
            console.warn('⚠️ Error enviando correo personalizado, usando modal por defecto')
          }
        } catch (error) {
          console.warn('⚠️ Error enviando correo personalizado:', error)
        }
        
        // Usuario necesita confirmar email
        setShowSuccessModal(true)
        setAuthLoading(false)
      }
    } catch (error) {
      console.error('❌ Error en registro:', error instanceof Error ? error.message : error)
      setErrors((prev) => ({ ...prev, submit: 'Error inesperado. Intenta nuevamente.' }))
      setAuthLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    console.log('🔄 Iniciando Google Sign Up...')
    setAuthLoading(true)
    setErrors({})
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) {
        console.error('❌ Error Google Sign Up:', error)
        setErrors((prev) => ({ ...prev, submit: 'Error al registrarse con Google' }))
        setAuthLoading(false)
      } else {
        console.log('✅ Google OAuth iniciado correctamente')
      }
      // Si no hay error, el usuario será redirigido automáticamente
    } catch (error) {
      console.error('❌ Error inesperado Google Sign Up:', error)
      setErrors((prev) => ({ ...prev, submit: 'Error inesperado al conectar con Google' }))
      setAuthLoading(false)
    }
  }

  const handleFacebookSignUp = async () => {
    console.log('🔄 Iniciando Facebook Sign Up...')
    setAuthLoading(true)
    setErrors({})
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'public_profile'
        }
      })
      
      if (error) {
        console.error('❌ Error Facebook Sign Up:', error)
        setErrors((prev) => ({ ...prev, submit: 'Error al registrarse con Facebook' }))
        setAuthLoading(false)
      } else {
        console.log('✅ Facebook OAuth iniciado correctamente')
      }
      // Si no hay error, el usuario será redirigido automáticamente
    } catch (error) {
      console.error('❌ Error inesperado Facebook Sign Up:', error)
      setErrors((prev) => ({ ...prev, submit: 'Error inesperado al conectar con Facebook' }))
      setAuthLoading(false)
    }
  }

  return (
    <>
      {authLoading && <AuthSpinner message="Creando cuenta..." />}
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader className="text-center">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle>¡Cuenta creada exitosamente!</DialogTitle>
            <DialogDescription>
              Hemos enviado un correo electrónico de confirmación a{" "}
              <span className="font-medium text-foreground">{formData.email}</span>. Por favor, revisa tu bandeja de
              entrada y haz clic en el enlace para activar tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowSuccessModal(false)} className="flex-1">
              Cerrar
            </Button>
            <Button onClick={() => (window.location.href = "/login")} className="flex-1">
              Ir al login
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <CardTitle className="text-2xl">Crear cuenta</CardTitle>
            <CardDescription>La primera plataforma de comercio digital diseñada para hondureños 🇭🇳</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full bg-transparent" 
                type="button"
                onClick={handleGoogleSignUp}
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
                onClick={handleFacebookSignUp}
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
                <Label htmlFor="name">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`pl-10 ${errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="Ingresa tu nombre completo"
                    required
                  />
                </div>
                {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirm"
                    name="confirm"
                    value={formData.confirm}
                    onChange={handleInputChange}
                    className={`pl-10 pr-10 ${errors.confirm ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="••••••••"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirm && <p className="text-destructive text-sm">{errors.confirm}</p>}
                {errors.submit && <p className="text-destructive text-sm">{errors.submit}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={!isFormValid() || loading}>
                {loading ? "Creando..." : "Crear cuenta"}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Inicia sesión
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
