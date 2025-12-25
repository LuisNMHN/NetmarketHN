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


  return (
    <>
      {authLoading && <AuthSpinner message="Creando cuenta..." />}
      
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
                <Link href="/login">Ingresar</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background pt-20 pb-20 sm:pt-24 sm:pb-24">
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

      <div className="w-full max-w-sm mx-auto">
        <Card>
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl sm:text-2xl">Datos básicos para crear cuenta NMHN</CardTitle>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground px-2">
              Se deberá completar el registro, verificando los datos dentro de la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name" className="pb-2 block">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`pl-10 ${errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="Nombre legal (verificable con DNI/Pasaporte)"
                    required
                  />
                </div>
                {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="confirm" className="pb-2 block">Confirmar contraseña</Label>
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
