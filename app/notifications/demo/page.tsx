"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { emitPredefinedEvent } from "@/lib/notifications/emitter"
import { supabaseBrowser } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function NotificationDemoPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Obtener el ID del usuario actual
  useState(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseBrowser().auth.getUser()
      setUserId(user?.id || null)
    }
    getUser()
  })

  const handleEmitNotification = async (eventType: string, customData?: any) => {
    if (!userId) {
      toast.error("Usuario no autenticado")
      return
    }

    setIsLoading(true)
    try {
      const result = await fetch('/api/notifications/emit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          ...customData
        }),
      })

      const response = await result.json()
      
      if (response.success) {
        toast.success(`Notificación ${eventType} enviada correctamente`)
      } else {
        toast.error(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error enviando notificación:', error)
      toast.error('Error enviando notificación')
    } finally {
      setIsLoading(false)
    }
  }

  const demoEvents = [
    {
      title: "Nueva Orden Creada",
      description: "Simula la creación de una nueva orden",
      eventType: "ORDER_CREATED",
      data: {
        topic: "order",
        event: "ORDER_CREATED",
        title: "Nueva orden creada",
        body: "Se ha creado una nueva orden #12345 por $500.00 HNLD",
        priority: "normal",
        cta_label: "Ver orden",
        cta_href: "/dashboard/orders",
        payload: { orderId: "12345", amount: 500 }
      }
    },
    {
      title: "Orden Pagada",
      description: "Simula el pago de una orden (alta prioridad)",
      eventType: "ORDER_PAID",
      data: {
        topic: "order",
        event: "ORDER_PAID",
        title: "¡Orden pagada!",
        body: "La orden #12345 ha sido pagada exitosamente. Puedes proceder con la validación.",
        priority: "high",
        cta_label: "Validar pago",
        cta_href: "/dashboard/orders",
        payload: { orderId: "12345", amount: 500 }
      }
    },
    {
      title: "Nuevo Mensaje",
      description: "Simula un nuevo mensaje en el chat",
      eventType: "NEW_MESSAGE",
      data: {
        topic: "chat",
        event: "NEW_MESSAGE",
        title: "Nuevo mensaje recibido",
        body: "Tienes un nuevo mensaje de Juan Pérez en la conversación sobre la orden #12345",
        priority: "normal",
        cta_label: "Abrir conversación",
        cta_href: "/dashboard/chat",
        payload: { conversationId: "conv_123", senderName: "Juan Pérez" }
      }
    },
    {
      title: "KYC Aprobado",
      description: "Simula la aprobación del proceso KYC",
      eventType: "KYC_APPROVED",
      data: {
        topic: "kyc",
        event: "KYC_APPROVED",
        title: "¡KYC Aprobado!",
        body: "Tu proceso de verificación de identidad ha sido aprobado exitosamente.",
        priority: "high",
        cta_label: "Ver perfil",
        cta_href: "/dashboard/profile",
        payload: { kycId: "kyc_123", approvedAt: new Date().toISOString() }
      }
    },
    {
      title: "Disputa Abierta",
      description: "Simula la apertura de una disputa (alta prioridad)",
      eventType: "DISPUTE_OPENED",
      data: {
        topic: "order",
        event: "DISPUTE_OPENED",
        title: "Disputa abierta",
        body: "Se ha abierto una disputa para la orden #12345. Por favor revisa los detalles.",
        priority: "high",
        cta_label: "Responder disputa",
        cta_href: "/dashboard/disputes",
        payload: { orderId: "12345", disputeId: "disp_123" }
      }
    },
    {
      title: "Mantenimiento del Sistema",
      description: "Simula una notificación de mantenimiento del sistema",
      eventType: "SYSTEM_MAINTENANCE",
      data: {
        topic: "system",
        event: "SYSTEM_MAINTENANCE",
        title: "Mantenimiento programado",
        body: "El sistema estará en mantenimiento el domingo de 2:00 AM a 4:00 AM.",
        priority: "high",
        cta_label: "Ver detalles",
        cta_href: "/dashboard/status",
        payload: { maintenanceStart: "2024-01-14T02:00:00Z", maintenanceEnd: "2024-01-14T04:00:00Z" }
      }
    }
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Demo del Sistema de Notificaciones</h1>
        <p className="text-muted-foreground">
          Prueba el sistema de notificaciones enviando diferentes tipos de eventos.
        </p>
        {userId && (
          <Badge variant="outline" className="mt-2">
            Usuario: {userId.slice(0, 8)}...
          </Badge>
        )}
      </div>

      <div className="grid gap-6">
        {demoEvents.map((event, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {event.title}
                <Badge variant={event.data.priority === 'high' ? 'destructive' : 'default'}>
                  {event.data.priority === 'high' ? 'Alta Prioridad' : 'Prioridad Normal'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{event.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <strong>Tópico:</strong> {event.data.topic}
                </div>
                <div className="text-sm">
                  <strong>Evento:</strong> {event.data.event}
                </div>
                <div className="text-sm">
                  <strong>Título:</strong> {event.data.title}
                </div>
                <div className="text-sm">
                  <strong>Mensaje:</strong> {event.data.body}
                </div>
                {event.data.cta_label && (
                  <div className="text-sm">
                    <strong>CTA:</strong> {event.data.cta_label} → {event.data.cta_href}
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex gap-2">
                <Button
                  onClick={() => handleEmitNotification(event.eventType, event.data)}
                  disabled={isLoading || !userId}
                  className="flex-1"
                >
                  {isLoading ? 'Enviando...' : `Enviar ${event.eventType}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>1. Haz clic en cualquier botón "Enviar" para generar una notificación</p>
            <p>2. La notificación aparecerá inmediatamente en la campana del header</p>
            <p>3. Las notificaciones de alta prioridad mostrarán un toast</p>
            <p>4. Puedes ver todas las notificaciones en la página <a href="/notifications" className="text-primary underline">/notifications</a></p>
            <p>5. Las notificaciones se sincronizan en tiempo real entre pestañas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


