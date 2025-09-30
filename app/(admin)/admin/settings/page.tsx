"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Bell, Globe, Lock, Mail, Shield, Palette, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AdminSettingsPage() {
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  // TODO: cargar desde tabla de configuración en Supabase
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "NetMarketHN",
    siteUrl: "https://netmarkethn.com",
    timezone: "America/Tegucigalpa",
    language: "es",
  })

  const [emailSettings, setEmailSettings] = useState({
    contactEmail: "info@netmarkethn.com",
    supportEmail: "soporte@netmarkethn.com",
    smtpServer: "smtp.gmail.com",
    smtpPort: "587",
  })

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: true,
    maxSessions: 3,
    sessionTimeout: 60,
    passwordMinLength: 8,
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    summaryFrequency: "daily",
    kycAlerts: true,
    payoutAlerts: true,
  })

  const handleSaveSettings = () => {
    setIsSaving(true)
    console.log("[v0] Saving settings:", {
      generalSettings,
      emailSettings,
      securitySettings,
      notificationSettings,
    })
    // TODO: Implement save logic
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Configuración Guardada",
        description: "Los cambios han sido guardados exitosamente",
      })
    }, 1000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Configuración del Sistema</h2>
          <p className="text-muted-foreground mt-2">Administra la configuración general de la plataforma</p>
        </div>
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      {/* System status */}
      <Card>
        <CardHeader>
          <CardTitle>Estado del Sistema</CardTitle>
          <CardDescription>Información general del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estado</p>
                <p className="text-lg font-semibold text-foreground mt-1">Operativo</p>
              </div>
              <Badge variant="default">Activo</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Versión</p>
                <p className="text-lg font-semibold text-foreground mt-1">v2.5.0</p>
              </div>
              <Badge variant="secondary">Estable</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Última actualización</p>
                <p className="text-lg font-semibold text-foreground mt-1">Hace 2 días</p>
              </div>
              <Badge variant="outline">Reciente</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Uptime</p>
                <p className="text-lg font-semibold text-foreground mt-1">99.9%</p>
              </div>
              <Badge className="bg-emerald-500">Excelente</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="email">Correo</TabsTrigger>
              <TabsTrigger value="security">Seguridad</TabsTrigger>
              <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="appearance">Apariencia</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                  <Globe className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configuración General</h3>
                  <p className="text-sm text-muted-foreground">Ajustes básicos del sistema</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Nombre del Sitio</Label>
                  <Input
                    id="siteName"
                    value={generalSettings.siteName}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteUrl">URL del Sitio</Label>
                  <Input
                    id="siteUrl"
                    value={generalSettings.siteUrl}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, siteUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona Horaria</Label>
                  <select
                    id="timezone"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={generalSettings.timezone}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  >
                    <option value="America/Tegucigalpa">América/Tegucigalpa (GMT-6)</option>
                    <option value="America/New_York">América/Nueva York (GMT-5)</option>
                    <option value="America/Los_Angeles">América/Los Ángeles (GMT-8)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <select
                    id="language"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={generalSettings.language}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* Email Settings */}
            <TabsContent value="email" className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                  <Mail className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configuración de Correo</h3>
                  <p className="text-sm text-muted-foreground">Gestiona los correos del sistema</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Correo de Contacto</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={emailSettings.contactEmail}
                    onChange={(e) => setEmailSettings({ ...emailSettings, contactEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Correo de Soporte</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={emailSettings.supportEmail}
                    onChange={(e) => setEmailSettings({ ...emailSettings, supportEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpServer">Servidor SMTP</Label>
                  <Input
                    id="smtpServer"
                    value={emailSettings.smtpServer}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpServer: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Puerto SMTP</Label>
                  <Input
                    id="smtpPort"
                    value={emailSettings.smtpPort}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security" className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                  <Shield className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configuración de Seguridad</h3>
                  <p className="text-sm text-muted-foreground">Opciones de seguridad y privacidad</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label htmlFor="twoFactor">Autenticación de Dos Factores</Label>
                    <p className="text-sm text-muted-foreground">Requiere verificación adicional al iniciar sesión</p>
                  </div>
                  <Switch
                    id="twoFactor"
                    checked={securitySettings.twoFactorEnabled}
                    onCheckedChange={(checked) =>
                      setSecuritySettings({ ...securitySettings, twoFactorEnabled: checked })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maxSessions">Sesiones Simultáneas Máximas</Label>
                    <Input
                      id="maxSessions"
                      type="number"
                      value={securitySettings.maxSessions}
                      onChange={(e) =>
                        setSecuritySettings({ ...securitySettings, maxSessions: Number.parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Tiempo de Sesión (minutos)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) =>
                        setSecuritySettings({ ...securitySettings, sessionTimeout: Number.parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordMinLength">Longitud Mínima de Contraseña</Label>
                    <Input
                      id="passwordMinLength"
                      type="number"
                      value={securitySettings.passwordMinLength}
                      onChange={(e) =>
                        setSecuritySettings({ ...securitySettings, passwordMinLength: Number.parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                  <Bell className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configuración de Notificaciones</h3>
                  <p className="text-sm text-muted-foreground">Gestiona las notificaciones del sistema</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label htmlFor="emailNotif">Notificaciones por Email</Label>
                    <p className="text-sm text-muted-foreground">Recibe notificaciones por correo electrónico</p>
                  </div>
                  <Switch
                    id="emailNotif"
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label htmlFor="pushNotif">Notificaciones Push</Label>
                    <p className="text-sm text-muted-foreground">Recibe notificaciones en tiempo real</p>
                  </div>
                  <Switch
                    id="pushNotif"
                    checked={notificationSettings.pushNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, pushNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label htmlFor="kycAlerts">Alertas de KYC</Label>
                    <p className="text-sm text-muted-foreground">Notificar sobre nuevas solicitudes KYC</p>
                  </div>
                  <Switch
                    id="kycAlerts"
                    checked={notificationSettings.kycAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, kycAlerts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label htmlFor="payoutAlerts">Alertas de Payouts</Label>
                    <p className="text-sm text-muted-foreground">Notificar sobre solicitudes de retiro</p>
                  </div>
                  <Switch
                    id="payoutAlerts"
                    checked={notificationSettings.payoutAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, payoutAlerts: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summaryFreq">Frecuencia de Resumen</Label>
                  <select
                    id="summaryFreq"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={notificationSettings.summaryFrequency}
                    onChange={(e) =>
                      setNotificationSettings({ ...notificationSettings, summaryFrequency: e.target.value })
                    }
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* Payment Settings */}
            <TabsContent value="payments" className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                  <CreditCard className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configuración de Pagos</h3>
                  <p className="text-sm text-muted-foreground">Gestiona métodos de pago y comisiones</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="platformFee">Comisión de Plataforma (%)</Label>
                    <Input id="platformFee" type="number" step="0.1" defaultValue="2.5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minPayout">Retiro Mínimo (HNL)</Label>
                    <Input id="minPayout" type="number" defaultValue="100" />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h4 className="font-medium text-foreground mb-3">Métodos de Pago Habilitados</h4>
                  <div className="space-y-2">
                    {["Tarjeta de Crédito/Débito", "Transferencia Bancaria", "PayPal", "Efectivo"].map((method) => (
                      <div key={method} className="flex items-center justify-between p-2">
                        <span className="text-sm">{method}</span>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                  <Palette className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configuración de Apariencia</h3>
                  <p className="text-sm text-muted-foreground">Personaliza la apariencia del sistema</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema del Sistema</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {["Claro", "Oscuro", "Automático"].map((theme) => (
                      <div
                        key={theme}
                        className="flex items-center justify-center rounded-lg border-2 border-border p-4 cursor-pointer hover:border-primary transition-colors"
                      >
                        <span className="text-sm font-medium">{theme}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL del Logo</Label>
                  <Input id="logoUrl" placeholder="https://ejemplo.com/logo.png" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">URL del Favicon</Label>
                  <Input id="faviconUrl" placeholder="https://ejemplo.com/favicon.ico" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive">
              <Lock className="size-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base text-destructive">Zona de Peligro</CardTitle>
              <CardDescription className="mt-1">Acciones irreversibles del sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium text-foreground">Limpiar caché del sistema</p>
                <p className="text-sm text-muted-foreground mt-1">Elimina todos los archivos temporales</p>
              </div>
              <Button variant="outline" size="sm" className="bg-transparent">
                Limpiar
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium text-foreground">Exportar datos del sistema</p>
                <p className="text-sm text-muted-foreground mt-1">Descarga una copia de todos los datos</p>
              </div>
              <Button variant="outline" size="sm" className="bg-transparent">
                Exportar
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
              <div>
                <p className="font-medium text-destructive">Restablecer configuración</p>
                <p className="text-sm text-muted-foreground mt-1">Vuelve a los valores predeterminados</p>
              </div>
              <Button variant="destructive" size="sm">
                Restablecer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
