"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserX, ArrowLeft, UserPlus, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"

export default function AccountNotFoundPage() {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    // Obtener el email del usuario de la URL o localStorage si está disponible
    const urlParams = new URLSearchParams(window.location.search)
    const email = urlParams.get('email')
    if (email) {
      setUserEmail(email)
    }
  }, [])

  const handleGoBack = () => {
    router.back()
  }

  const handleRegister = () => {
    router.push('/register')
  }

  const handleLogin = () => {
    router.push('/login')
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-destructive/10">
              <UserX className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cuenta no encontrada</h1>
          <p className="text-muted-foreground">
            Tu cuenta no está registrada en nuestra plataforma
          </p>
        </div>

        {/* Alert */}
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {userEmail ? (
              <>
                La cuenta <strong>{userEmail}</strong> no existe en nuestra base de datos.
              </>
            ) : (
              "Tu cuenta de usuario no se encuentra registrada en nuestra plataforma."
            )}
          </AlertDescription>
        </Alert>

        {/* Main Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <UserPlus className="h-5 w-5" />
              ¿Qué puedes hacer?
            </CardTitle>
            <CardDescription>
              Tienes varias opciones para continuar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h3 className="font-semibold text-sm mb-2">Opción 1: Crear nueva cuenta</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Si eres nuevo en la plataforma, puedes registrarte creando una nueva cuenta.
                </p>
                <Button onClick={handleRegister} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Crear cuenta nueva
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <h3 className="font-semibold text-sm mb-2">Opción 2: Intentar con otra cuenta</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Si tienes otra cuenta, puedes intentar iniciar sesión con esas credenciales.
                </p>
                <Button onClick={handleLogin} variant="outline" className="w-full">
                  Iniciar sesión
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <h3 className="font-semibold text-sm mb-2">Opción 3: Volver atrás</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Regresa a la página anterior para intentar nuevamente.
                </p>
                <Button onClick={handleGoBack} variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver atrás
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">¿Necesitas ayuda?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Si crees que esto es un error o necesitas asistencia, puedes:
            </p>
            <div className="space-y-2">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/support">
                  Contactar soporte
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/">
                  Ir al inicio
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Si continúas teniendo problemas, contacta a nuestro equipo de soporte.
          </p>
        </div>
      </div>
    </div>
  )
}
