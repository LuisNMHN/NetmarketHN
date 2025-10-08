"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

function ConfirmEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token = searchParams.get('token')
        const type = searchParams.get('type')

        if (!token) {
          setStatus('error')
          setMessage('Token de verificación no válido')
          return
        }

        console.log('🔍 Verificando email con token:', token)

        const supabase = supabaseBrowser()
        
        // Verificar el email usando el token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type === 'signup' ? 'signup' : 'email'
        })

        if (error) {
          console.error('❌ Error verificando email:', error)
          setStatus('error')
          setMessage(error.message || 'Error al verificar el correo electrónico')
          return
        }

        if (data.user) {
          console.log('✅ Email verificado exitosamente:', data.user.email)
          setStatus('success')
          setMessage('¡Tu correo electrónico ha sido verificado exitosamente!')
          
          // Redirigir al perfil después de 3 segundos
          setTimeout(() => {
            router.push('/dashboard/perfil')
          }, 3000)
        } else {
          setStatus('error')
          setMessage('No se pudo verificar el correo electrónico')
        }

      } catch (error) {
        console.error('❌ Error en confirmación:', error)
        setStatus('error')
        setMessage('Error inesperado al verificar el correo')
      }
    }

    confirmEmail()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Link href="/" className="flex items-center justify-center font-bold text-2xl hover:opacity-80" title="Ir al inicio">
              <span className="text-primary">NM</span>
              <span className="text-muted-foreground">HN</span>
            </Link>
          </div>
          <CardTitle className="text-2xl">Verificación de Email</CardTitle>
          <CardDescription>Confirmando tu correo electrónico</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {status === 'loading' && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <p className="text-muted-foreground">Verificando tu correo electrónico...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-green-600">¡Verificación exitosa!</h3>
                <p className="text-muted-foreground">{message}</p>
                <p className="text-sm text-muted-foreground">
                  Serás redirigido a completar tu perfil en unos segundos...
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/dashboard/perfil">Completar mi Perfil</Link>
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-red-600">Error de verificación</h3>
                <p className="text-muted-foreground">{message}</p>
                <p className="text-sm text-muted-foreground">
                  El enlace puede haber expirado o ya haber sido usado.
                </p>
              </div>
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/login">Ir al Login</Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/register">Crear nueva cuenta</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ConfirmEmailContent />
    </Suspense>
  )
}
