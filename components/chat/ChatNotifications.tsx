"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Bell, 
  BellOff, 
  X, 
  MessageSquare,
  Clock,
  Check,
  CheckCheck
} from 'lucide-react'
import { ChatNotification } from '@/lib/actions/chat'

interface ChatNotificationsProps {
  notifications: ChatNotification[]
  onMarkAsRead: (notificationId: string) => void
  onClose: () => void
}

export function ChatNotifications({ 
  notifications, 
  onMarkAsRead, 
  onClose 
}: ChatNotificationsProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  const filteredNotifications = notifications.filter(notification => 
    filter === 'all' || !notification.is_read
  )

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4" />
      case 'typing':
        return <Clock className="h-4 w-4" />
      case 'read':
        return <CheckCheck className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'text-blue-600'
      case 'typing':
        return 'text-orange-600'
      case 'read':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Ahora'
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `Hace ${diffInHours}h`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `Hace ${diffInDays}d`
    
    return date.toLocaleDateString('es-ES')
  }

  const handleNotificationClick = (notification: ChatNotification) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filtros */}
      <div className="p-3 border-b border-border/50">
        <div className="flex gap-2">
          <Button
            variant={filter === 'unread' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('unread')}
            className="flex-1 rounded-lg"
          >
            <Bell className="h-4 w-4 mr-2" />
            No leídas
            {notifications.filter(n => !n.is_read).length > 0 && (
              <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 text-xs">
                {notifications.filter(n => !n.is_read).length}
              </Badge>
            )}
          </Button>
          
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="flex-1 rounded-lg"
          >
            <Check className="h-4 w-4 mr-2" />
            Todas
          </Button>
        </div>
      </div>

      {/* Lista de notificaciones */}
      <ScrollArea className="flex-1">
        {filteredNotifications.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <BellOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? 'No hay notificaciones no leídas' : 'No hay notificaciones'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                  notification.is_read 
                    ? 'bg-muted/30 hover:bg-muted/50 border-border/30' 
                    : 'bg-primary/5 hover:bg-primary/10 border-primary/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icono */}
                  <div className={`flex-shrink-0 ${getNotificationColor(notification.notification_type)}`}>
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  
                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {notification.title && (
                          <h4 className="text-sm font-medium text-card-foreground">
                            {notification.title}
                          </h4>
                        )}
                        
                        {notification.body && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.body}
                          </p>
                        )}
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                      
                      {/* Indicador de no leído */}
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border/50">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filteredNotifications.length} notificación{filteredNotifications.length !== 1 ? 'es' : ''}
          </p>
          
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-muted/50">
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  )
}
