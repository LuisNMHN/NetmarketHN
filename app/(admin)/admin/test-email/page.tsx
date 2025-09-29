"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Mail, Send } from "lucide-react"

export default function TestEmailPage() {
  const [email, setEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const sendTestApprovalEmail = async () => {
    if (!email || !userName) {
      toast.error('Por favor completa todos los campos')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: '✅ Verificación Aprobada - NMHN (Prueba)',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Verificación Aprobada - NMHN</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 10px 10px 0 0;
                }
                .content {
                  background: #f8f9fa;
                  padding: 30px;
                  border-radius: 0 0 10px 10px;
                }
                .success-icon {
                  font-size: 48px;
                  color: #28a745;
                  margin-bottom: 20px;
                }
                .button {
                  display: inline-block;
                  background: #28a745;
                  color: white;
                  padding: 12px 30px;
                  text-decoration: none;
                  border-radius: 5px;
                  margin: 20px 0;
                }
                .footer {
                  text-align: center;
                  margin-top: 30px;
                  color: #666;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>¡Verificación Aprobada!</h1>
                <p>NMHN - Tu plataforma de confianza</p>
              </div>
              
              <div class="content">
                <div style="text-align: center;">
                  <div class="success-icon">✅</div>
                </div>
                
                <h2>¡Felicidades, ${userName}!</h2>
                
                <p>Tu verificación de identidad ha sido <strong>aprobada exitosamente</strong>. Ahora puedes acceder a todos los servicios de NMHN.</p>
                
                <h3>¿Qué puedes hacer ahora?</h3>
                <ul>
                  <li>✅ Realizar transacciones sin límites</li>
                  <li>✅ Participar en subastas</li>
                  <li>✅ Crear links de pago</li>
                  <li>✅ Acceder a todas las funcionalidades premium</li>
                </ul>
                
                <div style="text-align: center;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">
                    Acceder a mi Dashboard
                  </a>
                </div>
                
                <p><strong>Este es un correo de prueba del sistema de notificaciones.</strong></p>
                
                <p>¡Bienvenido a NMHN!</p>
              </div>
              
              <div class="footer">
                <p>Este correo fue enviado automáticamente por NMHN</p>
                <p>© 2024 NMHN. Todos los derechos reservados.</p>
              </div>
            </body>
            </html>
          `,
          type: 'approval',
          userName,
        }),
      })

      if (response.ok) {
        toast.success('Correo de aprobación enviado exitosamente')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al enviar correo')
      }
    } catch (error) {
      toast.error('Error al enviar correo')
    } finally {
      setLoading(false)
    }
  }

  const sendTestRejectionEmail = async () => {
    if (!email || !userName || !reason) {
      toast.error('Por favor completa todos los campos')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: '⚠️ Verificación Requiere Atención - NMHN (Prueba)',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Verificación Requiere Atención - NMHN</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 10px 10px 0 0;
                }
                .content {
                  background: #f8f9fa;
                  padding: 30px;
                  border-radius: 0 0 10px 10px;
                }
                .warning-icon {
                  font-size: 48px;
                  color: #ff6b6b;
                  margin-bottom: 20px;
                }
                .button {
                  display: inline-block;
                  background: #007bff;
                  color: white;
                  padding: 12px 30px;
                  text-decoration: none;
                  border-radius: 5px;
                  margin: 20px 0;
                }
                .footer {
                  text-align: center;
                  margin-top: 30px;
                  color: #666;
                  font-size: 14px;
                }
                .reason-box {
                  background: #fff3cd;
                  border: 1px solid #ffeaa7;
                  padding: 15px;
                  border-radius: 5px;
                  margin: 20px 0;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Verificación Requiere Atención</h1>
                <p>NMHN - Tu plataforma de confianza</p>
              </div>
              
              <div class="content">
                <div style="text-align: center;">
                  <div class="warning-icon">⚠️</div>
                </div>
                
                <h2>Hola ${userName},</h2>
                
                <p>Tu solicitud de verificación de identidad <strong>requiere atención adicional</strong> para poder ser procesada.</p>
                
                <div class="reason-box">
                  <h3>Motivo:</h3>
                  <p>${reason}</p>
                </div>
                
                <h3>¿Qué puedes hacer?</h3>
                <ul>
                  <li>🔍 Revisar la calidad de tus documentos</li>
                  <li>📸 Asegurarte de que las fotos sean claras y legibles</li>
                  <li>📋 Verificar que toda la información sea correcta</li>
                  <li>🔄 Volver a enviar tu solicitud</li>
                </ul>
                
                <div style="text-align: center;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/verificacion" class="button">
                    Revisar mi Verificación
                  </a>
                </div>
                
                <p><strong>Este es un correo de prueba del sistema de notificaciones.</strong></p>
                
                <p>Si necesitas ayuda, nuestro equipo de soporte está disponible para asistirte.</p>
              </div>
              
              <div class="footer">
                <p>Este correo fue enviado automáticamente por NMHN</p>
                <p>© 2024 NMHN. Todos los derechos reservados.</p>
              </div>
            </body>
            </html>
          `,
          type: 'rejection',
          userName,
        }),
      })

      if (response.ok) {
        toast.success('Correo de rechazo enviado exitosamente')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al enviar correo')
      }
    } catch (error) {
      toast.error('Error al enviar correo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Prueba de Correos Electrónicos</h1>
        <p className="text-muted-foreground">Envía correos de prueba para verificar el funcionamiento del sistema</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Correo de Aprobación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-600" />
              Correo de Aprobación
            </CardTitle>
            <CardDescription>
              Envía un correo de prueba cuando se aprueba una verificación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email-approval">Correo electrónico</Label>
              <Input
                id="email-approval"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="name-approval">Nombre del usuario</Label>
              <Input
                id="name-approval"
                placeholder="Juan Pérez"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <Button
              onClick={sendTestApprovalEmail}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Correo de Aprobación
            </Button>
          </CardContent>
        </Card>

        {/* Correo de Rechazo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-red-600" />
              Correo de Rechazo
            </CardTitle>
            <CardDescription>
              Envía un correo de prueba cuando se rechaza una verificación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email-rejection">Correo electrónico</Label>
              <Input
                id="email-rejection"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="name-rejection">Nombre del usuario</Label>
              <Input
                id="name-rejection"
                placeholder="Juan Pérez"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reason-rejection">Motivo del rechazo</Label>
              <Textarea
                id="reason-rejection"
                placeholder="Documentos ilegibles, información incorrecta, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={sendTestRejectionEmail}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Correo de Rechazo
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Asegúrate de que las variables de entorno estén configuradas correctamente</li>
              <li>Verifica que el proveedor de correo esté configurado</li>
              <li>Usa un correo real para recibir las pruebas</li>
              <li>Revisa la bandeja de entrada (y spam) del correo de destino</li>
              <li>Los correos de prueba incluyen la marca "(Prueba)" en el asunto</li>
            </ol>
        </CardContent>
      </Card>
    </div>
  )
}