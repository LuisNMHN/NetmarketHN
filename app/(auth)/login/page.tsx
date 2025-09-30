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
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: isAdmin } = await supabase.rpc('has_role', { role_name: 'admin' })
        router.replace(isAdmin ? '/admin' : '/dashboard')
      }
    })
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
    setLoading(true)
    setSubmitError("")
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })
    setLoading(false)
    if (error) {
      const msg = translateAuthError(error.message)
      setSubmitError(msg)
      return
    }
    const { data: isAdmin } = await supabase.rpc('has_role', { role_name: 'admin' })
    router.replace(isAdmin ? '/admin' : '/dashboard')
  }

  function translateAuthError(message: string) {
    const m = message.toLowerCase()
    if (m.includes("invalid login credentials")) return "Credenciales inválidas"
    if (m.includes("email not confirmed")) return "Debes confirmar tu correo para iniciar sesión"
    if (m.includes("too many requests")) return "Demasiados intentos, intenta más tarde"
    return "Ocurrió un error al iniciar sesión"
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <Button
        onClick={toggleTheme}
        variant="outline"
        size="icon"
        className="absolute top-4 right-4 bg-transparent"
        aria-label="Cambiar tema"
      >
        {mounted ? (
          resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
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
            <CardDescription>Bienvenido de vuelta a la plataforma P2P 🇭🇳</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Button variant="outline" className="w-full bg-transparent" type="button">
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
                Continuar con Google
              </Button>
              <Button variant="outline" className="w-full bg-transparent" type="button">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#000000"
                    d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09z"
                  />
                  <path
                    fill="#000000"
                    d="M15.53 3.83c.893-1.09 1.479-2.58 1.309-4.081-1.27.052-2.82.808-3.73 1.818-.78.896-1.454 2.338-1.284 3.713 1.338.104 2.715-.688 3.705-1.45z"
                  />
                </svg>
                Continuar con Apple
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
  )
}
