"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { OrderChatButton, AuctionChatButton, SupportChatButton, DisputeChatButton } from "@/components/chat/ChatButton"
import { supabaseBrowser } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function ChatDemoPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [otherUserId, setOtherUserId] = useState<string | null>(null)

  // Obtener usuario actual
  useState(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseBrowser().auth.getUser()
      setCurrentUserId(user?.id || null)
      
      // Para demo, usar un ID fijo como "otro usuario"
      setOtherUserId("00000000-0000-0000-0000-000000000001")
    }
    getUser()
  })

  const demoScenarios = [
    {
      title: "Chat de Orden",
      description: "Simula una conversación entre comprador y vendedor sobre una orden",
      context: {
        type: "order",
        id: "ORD-12345",
        title: "Orden #12345 - iPhone 15 Pro",
        data: {
          product: "iPhone 15 Pro",
          price: 1200,
          currency: "HNLD",
          status: "pending_payment"
        }
      },
      component: OrderChatButton,
      props: {
        orderId: "ORD-12345",
        buyerId: currentUserId || "buyer-id",
        sellerId: otherUserId || "seller-id",
        orderTitle: "iPhone 15 Pro",
        orderData: {
          product: "iPhone 15 Pro",
          price: 1200,
          currency: "HNLD"
        }
      }
    },
    {
      title: "Chat de Subasta",
      description: "Simula una conversación entre postor y vendedor en una subasta",
      context: {
        type: "auction",
        id: "AUCT-67890",
        title: "Subasta #67890 - MacBook Pro",
        data: {
          product: "MacBook Pro M3",
          currentBid: 2500,
          currency: "HNLD",
          status: "active"
        }
      },
      component: AuctionChatButton,
      props: {
        auctionId: "AUCT-67890",
        bidderId: currentUserId || "bidder-id",
        sellerId: otherUserId || "seller-id",
        auctionTitle: "MacBook Pro M3",
        auctionData: {
          product: "MacBook Pro M3",
          currentBid: 2500,
          currency: "HNLD"
        }
      }
    },
    {
      title: "Chat de Soporte",
      description: "Simula una conversación con soporte técnico",
      context: {
        type: "ticket",
        id: "TICKET-11111",
        title: "Ticket #11111 - Problema con pago",
        data: {
          issue: "Problema con pago",
          priority: "high",
          status: "open"
        }
      },
      component: SupportChatButton,
      props: {
        ticketId: "TICKET-11111",
        userId: currentUserId || "user-id",
        supportUserId: otherUserId || "support-id",
        ticketTitle: "Problema con pago",
        ticketData: {
          issue: "Problema con pago",
          priority: "high"
        }
      }
    },
    {
      title: "Chat de Disputa",
      description: "Simula una conversación para resolver una disputa",
      context: {
        type: "dispute",
        id: "DISP-22222",
        title: "Disputa #22222 - Producto defectuoso",
        data: {
          reason: "Producto defectuoso",
          orderId: "ORD-12345",
          status: "open"
        }
      },
      component: DisputeChatButton,
      props: {
        disputeId: "DISP-22222",
        partyAId: currentUserId || "party-a-id",
        partyBId: otherUserId || "party-b-id",
        supportUserId: otherUserId || "support-id",
        disputeTitle: "Producto defectuoso",
        disputeData: {
          reason: "Producto defectuoso",
          orderId: "ORD-12345"
        }
      }
    }
  ]

  const handleTestNotification = async () => {
    try {
      const response = await fetch('/api/notifications/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          topic: 'chat',
          event: 'NEW_MESSAGE',
          title: 'Mensaje de prueba',
          body: 'Este es un mensaje de prueba del sistema de chat',
          priority: 'normal',
          cta_label: 'Abrir chat',
          cta_href: '/chat/demo'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success('Notificación de prueba enviada')
      } else {
        toast.error(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error enviando notificación de prueba:', error)
      toast.error('Error enviando notificación')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Demo del Sistema de Chat Transaccional</h1>
        <p className="text-muted-foreground">
          Prueba el sistema de chat P2P reutilizable para diferentes contextos.
        </p>
        
        <div className="mt-4 flex items-center gap-4">
          {currentUserId && (
            <Badge variant="outline">
              Usuario actual: {currentUserId.slice(0, 8)}...
            </Badge>
          )}
          <Button onClick={handleTestNotification} variant="outline" size="sm">
            Probar Notificación
          </Button>
        </div>
      </div>

      {/* Información del sistema */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Características del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">✅ Funcionalidades Implementadas</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Modal responsivo con desenfoque</li>
                <li>• Realtime entre usuarios</li>
                <li>• Acciones de negociación</li>
                <li>• Integración con notificaciones</li>
                <li>• RLS y rate limiting</li>
                <li>• UI/UX consistente con NMHN</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🎯 Contextos Soportados</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Órdenes (order)</li>
                <li>• Subastas (auction)</li>
                <li>• Tickets de soporte (ticket)</li>
                <li>• Disputas (dispute)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Escenarios de prueba */}
      <div className="grid gap-6">
        <h2 className="text-2xl font-semibold">Escenarios de Prueba</h2>
        
        {demoScenarios.map((scenario, index) => {
          const Component = scenario.component
          return (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {scenario.title}
                      <Badge variant="outline">{scenario.context.type}</Badge>
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">{scenario.description}</p>
                  </div>
                  <Component {...scenario.props} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Contexto:</strong> {scenario.context.type} - {scenario.context.id}
                  </div>
                  <div>
                    <strong>Título:</strong> {scenario.context.title}
                  </div>
                  <div>
                    <strong>Datos:</strong> 
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(scenario.context.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Instrucciones */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Instrucciones de Prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">1. Probar Chat Básico</h4>
              <p className="text-muted-foreground">
                Haz clic en cualquier botón de chat para abrir el modal. 
                Envía mensajes y observa la funcionalidad realtime.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">2. Probar Acciones de Negociación</h4>
              <p className="text-muted-foreground">
                Usa los botones de acción rápida en el chat para probar:
                "Marcar pagado", "Confirmar recibido", "Solicitar soporte", etc.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">3. Probar Notificaciones</h4>
              <p className="text-muted-foreground">
                Haz clic en "Probar Notificación" para enviar una notificación de prueba.
                Observa la campana en el header del dashboard.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">4. Probar Responsividad</h4>
              <p className="text-muted-foreground">
                Abre el chat en diferentes tamaños de pantalla para verificar
                que el modal se adapta correctamente (móvil, tablet, desktop).
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">5. Probar Realtime</h4>
              <p className="text-muted-foreground">
                Abre el mismo chat en dos pestañas diferentes para verificar
                que los mensajes se sincronizan en tiempo real.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integración */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Cómo Integrar en tu Código</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Para Órdenes:</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
{`import { OrderChatButton } from '@/components/chat/ChatButton'

<OrderChatButton
  orderId="ORD-12345"
  buyerId={buyerId}
  sellerId={sellerId}
  orderTitle="iPhone 15 Pro"
  orderData={{ price: 1200, currency: 'HNLD' }}
/>`}
              </pre>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Para Subastas:</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
{`import { AuctionChatButton } from '@/components/chat/ChatButton'

<AuctionChatButton
  auctionId="AUCT-67890"
  bidderId={bidderId}
  sellerId={sellerId}
  auctionTitle="MacBook Pro M3"
  auctionData={{ currentBid: 2500, currency: 'HNLD' }}
/>`}
              </pre>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Chat Personalizado:</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
{`import { ChatButton } from '@/components/chat/ChatButton'

<ChatButton
  chatParams={{
    contextType: 'order',
    contextId: 'custom-id',
    partyA: userId1,
    partyB: userId2,
    contextTitle: 'Mi Chat Personalizado'
  }}
  buttonText="💬 Chatear"
/>`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


