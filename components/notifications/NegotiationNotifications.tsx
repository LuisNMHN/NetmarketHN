"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  DollarSign
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { 
  getUserNotifications,
  markNotificationRead,
  type RequestNotification
} from "@/lib/actions/purchase_requests"

interface NegotiationNotificationProps {
  notification: RequestNotification
  onMarkRead: (id: string) => void
}

export function NegotiationNotification({ notification, onMarkRead }: NegotiationNotificationProps) {
  const [isRead, setIsRead] = useState(notification.is_read)

  const handleMarkRead = async () => {
    if (isRead) return
    
    const result = await markNotificationRead(notification.id)
    if (result.success) {
      setIsRead(true)
      onMarkRead(notification.id)
    }
  }

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'negotiation_started':
        return <MessageSquare className="h-5 w-5 text-blue-500" />
      case 'negotiation_ended':
        return <XCircle className="h-5 w-5 text-gray-500" />
      case 'negotiation_expired':
        return <Clock className="h-5 w-5 text-orange-500" />
      case 'offer_accepted':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getNotificationColor = () => {
    if (isRead) return "bg-gray-50 dark:bg-gray-900"
    
    switch (notification.type) {
      case 'negotiation_started':
        return "bg-blue-50 dark:bg-blue-900/20"
      case 'negotiation_ended':
        return "bg-gray-50 dark:bg-gray-900"
      case 'negotiation_expired':
        return "bg-orange-50 dark:bg-orange-900/20"
      case 'offer_accepted':
        return "bg-green-50 dark:bg-green-900/20"
      default:
        return "bg-yellow-50 dark:bg-yellow-900/20"
    }
  }

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md ${getNotificationColor()} ${
        !isRead ? 'border-l-4 border-l-blue-500' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {getNotificationIcon()}
            <div className="flex-1">
              <CardTitle className={`text-sm ${!isRead ? 'font-semibold' : 'font-normal'}`}>
                {notification.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {notification.message}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Badge 
              variant={isRead ? "secondary" : "default"}
              className={`text-xs ${!isRead ? 'bg-blue-100 text-blue-800' : ''}`}
            >
              {isRead ? 'Leída' : 'Nueva'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { 
                addSuffix: true, 
                locale: es 
              })}
            </span>
          </div>
        </div>
      </CardHeader>
      
      {!isRead && (
        <CardContent className="pt-0">
          <Button 
            onClick={handleMarkRead}
            size="sm"
            variant="outline"
            className="w-full"
          >
            Marcar como leída
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

interface NegotiationNotificationsProps {
  className?: string
}

export function NegotiationNotifications({ className }: NegotiationNotificationsProps) {
  const [notifications, setNotifications] = useState<RequestNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const result = await getUserNotifications(undefined, 20, 0)
      
      if (result.success && result.data) {
        // Filtrar solo notificaciones relacionadas con negociación
        const negotiationNotifications = result.data.filter(n => 
          n.type.includes('negotiation') || 
          n.type === 'offer_accepted' ||
          n.type === 'offer_rejected'
        )
        
        setNotifications(negotiationNotifications)
        setUnreadCount(negotiationNotifications.filter(n => !n.is_read).length)
      }
    } catch (error) {
      console.error('❌ Error cargando notificaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  useEffect(() => {
    loadNotifications()
    
    // Recargar notificaciones cada 30 segundos
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Notificaciones de Negociación</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Notificaciones de Negociación</span>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="bg-red-100 text-red-800">
              {unreadCount} nueva{unreadCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Actualizaciones sobre tus negociaciones activas
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay notificaciones de negociación</p>
            <p className="text-sm">Las notificaciones aparecerán aquí cuando inicies negociaciones</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NegotiationNotification
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}





















