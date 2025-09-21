"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { onUpdateProfile, onUploadAvatar } from "@/lib/contracts/events"
import { Camera, Upload, User, Mail, Phone, Palette, Shield, Save } from "lucide-react"

interface ProfileData {
  name: string
  email: string
  phone: string
  avatar: string
  theme: "light" | "dark" | "system"
  emailFromAuth: boolean
}

export default function PerfilPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<ProfileData>({
    name: "Juan Pérez",
    email: "juan.perez@example.com",
    phone: "+504 9876-5432",
    avatar: "/placeholder.svg?height=100&width=100",
    theme: "system",
    emailFromAuth: true,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!profile.name.trim()) {
      newErrors.name = "El nombre es requerido"
    } else if (profile.name.trim().length < 2) {
      newErrors.name = "El nombre debe tener al menos 2 caracteres"
    }

    if (!profile.phone.trim()) {
      newErrors.phone = "El teléfono es requerido"
    } else if (!/^\+?[\d\s\-()]+$/.test(profile.phone)) {
      newErrors.phone = "Formato de teléfono inválido"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await onUpdateProfile({
        name: profile.name,
        phone: profile.phone,
        theme: profile.theme,
        avatar: profile.avatar,
      })

      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado correctamente.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil. Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen.",
        variant: "destructive",
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      toast({
        title: "Error",
        description: "La imagen no puede ser mayor a 5MB.",
        variant: "destructive",
      })
      return
    }

    setIsUploadingAvatar(true)
    try {
      const avatarUrl = await onUploadAvatar(file)
      setProfile((prev) => ({ ...prev, avatar: avatarUrl }))

      toast({
        title: "Avatar actualizado",
        description: "Tu foto de perfil se ha actualizado correctamente.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo subir la imagen. Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar || "/placeholder.svg"} alt={profile.name} />
            <AvatarFallback className="text-lg">
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <Button
            size="sm"
            variant="secondary"
            className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
          >
            {isUploadingAvatar ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>

        <div className="flex-1">
          <h2 className="text-2xl font-semibold">Mi Perfil</h2>
          <p className="text-muted-foreground">Gestiona tu información personal y preferencias</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información Personal
            </CardTitle>
            <CardDescription>Actualiza tus datos básicos de contacto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => {
                  setProfile((prev) => ({ ...prev, name: e.target.value }))
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }))
                }}
                placeholder="Tu nombre completo"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
                {profile.emailFromAuth && (
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                )}
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                readOnly={profile.emailFromAuth}
                className={profile.emailFromAuth ? "bg-muted" : ""}
                placeholder="tu@email.com"
              />
              {profile.emailFromAuth && (
                <p className="text-xs text-muted-foreground">
                  Este email proviene de tu cuenta autenticada y no se puede modificar
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Teléfono
              </Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={(e) => {
                  setProfile((prev) => ({ ...prev, phone: e.target.value }))
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }))
                }}
                placeholder="+504 0000-0000"
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Preferencias
            </CardTitle>
            <CardDescription>Personaliza tu experiencia en la plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Tema de la aplicación</Label>
              <Select
                value={profile.theme}
                onValueChange={(value: "light" | "dark" | "system") =>
                  setProfile((prev) => ({ ...prev, theme: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Oscuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El tema "Sistema" se ajusta automáticamente según tu dispositivo
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Privacidad y Seguridad</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Tu información personal está protegida</p>
                <p>• Solo tú puedes ver y editar estos datos</p>
                <p>• Cumplimos con estándares de seguridad</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Avatar Upload Help */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Foto de Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Recomendaciones para tu avatar:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Usa una imagen cuadrada para mejores resultados</li>
              <li>Tamaño máximo: 5MB</li>
              <li>Formatos soportados: JPG, PNG, GIF</li>
              <li>Resolución recomendada: 400x400px o superior</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} className="min-w-32">
          {isLoading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
