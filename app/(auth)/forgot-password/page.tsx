"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mail, Sun, Moon, Check } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [formData, setFormData] = useState({
    email: "",
  })
  const [errors, setErrors] = useState({})
  const [showModal, setShowModal] = useState(false)
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const validateField = (name, value) => {
    const newErrors = { ...errors }

    switch (name) {
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = "Ingresa un correo válido (ejemplo@dominio.com)"
        } else {
          delete newErrors.email
        }
        break
    }

    setErrors(newErrors)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    validateField(name, value)
  }

  const isFormValid = () => {
    const { email } = formData
    return email.trim() !== "" && Object.keys(errors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isFormValid()) {
      setShowModal(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle>¡Correo enviado!</DialogTitle>
            <DialogDescription>
              Hemos enviado las instrucciones para restablecer tu contraseña a{" "}
              <span className="font-medium text-foreground">{formData.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-6">
            <Button onClick={() => setShowModal(false)} className="w-full">
              Entendido
            </Button>
            <Button
              onClick={() => {
                setShowModal(false)
                window.location.href = "/login"
              }}
              variant="outline"
              className="w-full"
            >
              Volver al inicio de sesión
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
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <div className="flex items-center justify-center font-bold text-2xl">
                <span className="text-primary">NM</span>
                <span className="text-muted-foreground">HN</span>
              </div>
            </div>
            <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
            <CardDescription>
              Ingresa tu correo electrónico y te enviaremos las instrucciones para restablecer tu contraseña
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <Button type="submit" className="w-full" disabled={!isFormValid()}>
                Enviar instrucciones
              </Button>
            </form>

            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground">
                ¿Recordaste tu contraseña?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
