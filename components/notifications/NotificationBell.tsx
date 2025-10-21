"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { notificationCenter, Notification, NotificationStats } from "@/lib/notifications/center"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface NotificationBellProps {
  className?: string
}

const getTopicIcon = (topic: string) => {
  switch (topic) {
    case 'order':
      return '💱'
    case 'kyc':
      return '🆔'
    case 'wallet':
      return '💰'
    case 'chat':
      return '💬'
    case 'system':
      return '⚙️'
    default:
      return '🔔'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-500'
    case 'normal':
      return 'bg-blue-500'
    case 'low':
      return 'bg-gray-500'
    default:
      return 'bg-gray-500'
  }
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, read: 0, archived: 0, high_priority: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Sincronizar drawerOpen con isOpen en móvil
  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(isOpen)
    }
  }, [isOpen, isMobile])

  // Cargar datos iniciales
  useEffect(() => {
    loadNotifications()
    loadStats()
  }, [])

  // Configurar listeners de tiempo real
  useEffect(() => {
    const unsubscribeNotification = notificationCenter.addListener((notification) => {
      setNotifications(prev => {
        // Evitar duplicados verificando si la notificación ya existe
        const exists = prev.some(n => n.id === notification.id)
        if (exists) {
          return prev
        }
        return [notification, ...prev.slice(0, 19)] // Mantener solo las 20 más recientes
      })
    })

    const unsubscribeStats = notificationCenter.addStatsListener((newStats) => {
      setStats(newStats)
    })

    return () => {
      unsubscribeNotification()
      unsubscribeStats()
    }
  }, [])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    setIsLoading(true)
    try {
      const data = await notificationCenter.getNotifications({ limit: 20 })
      console.log('🔍 NotificationBell - Cargando notificaciones:', data.length, 'notificaciones')
      console.log('🔍 IDs de notificaciones cargadas:', data.map(n => n.id))
      setNotifications(data)
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await notificationCenter.getStats()
      setStats(data)
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // Función para cerrar el drawer de manera controlada
  const closeDrawer = () => {
    setDrawerOpen(false)
    setTimeout(() => {
      setIsOpen(false)
    }, 100) // Pequeño delay para permitir animación
  }

  // Función para marcar todas las notificaciones como leídas automáticamente
  const markAllAsReadOnOpen = async () => {
    const success = await notificationCenter.markAllAsRead()
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const })))
      // Las estadísticas se actualizarán automáticamente via refreshStats() en NotificationCenter
    }
  }

  // Función para eliminar una notificación con efecto
  const handleDeleteNotification = async (notificationId: string) => {
    console.log('🗑️ NotificationBell - Eliminando notificación:', notificationId)
    console.log('🎬 NotificationBell - Estado deletingIds antes:', deletingIds)
    
    // Agregar a la lista de eliminación para activar la animación
    setDeletingIds(prev => {
      const newSet = new Set(prev).add(notificationId)
      console.log('🎬 NotificationBell - Nuevo estado deletingIds:', newSet)
      return newSet
    })
    
    // Eliminar inmediatamente de la base de datos
    const result = await notificationCenter.deleteNotification(notificationId)
    console.log('🗑️ NotificationBell - Resultado eliminación:', result)
    
    if (result.success) {
      // Esperar a que termine la animación antes de quitar del estado local
      setTimeout(async () => {
        console.log('🗑️ NotificationBell - Removiendo del estado local:', notificationId)
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        setDeletingIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(notificationId)
          console.log('🎬 NotificationBell - Limpiando deletingIds:', newSet)
          return newSet
        })
        
        // Recargar notificaciones para asegurar sincronización
        console.log('🔄 NotificationBell - Recargando notificaciones para sincronización')
        await loadNotifications()
      }, 300) // Duración de la animación
    } else {
      console.log('⚠️ NotificationBell - Error eliminando:', result.error)
      
      // Si es un error de "no encontrada" o "no pertenece", simplemente quitarla del estado local
      if (result.error?.includes('no encontrada') || result.error?.includes('no pertenece')) {
        console.log('🔄 NotificationBell - Notificación ya no existe, quitando del estado local')
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
      
      // Quitar de la lista de eliminación en cualquier caso
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        console.log('🎬 NotificationBell - Limpiando deletingIds por error:', newSet)
        return newSet
      })
    }
  }

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: es 
      })
    } catch {
      return 'hace un momento'
    }
  }

  // Componente para el contenido de notificaciones
  const NotificationContent = ({ showHeader = true }: { showHeader?: boolean }) => (
    <>
      {/* Header - solo mostrar si showHeader es true */}
      {showHeader && (
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
          </div>
        </div>
      )}

      {/* Lista de notificaciones */}
      <ScrollArea 
        className="h-80 sm:h-96 max-h-[50vh]"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Cargando notificaciones...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No hay notificaciones
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => {
              const isDeleting = deletingIds.has(notification.id)
              console.log(`🎬 NotificationBell - Notificación ${notification.id} isDeleting:`, isDeleting)
              
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-muted/50 transition-all duration-300 ease-in-out relative",
                    notification.status === 'unread' && "bg-muted/30",
                    isDeleting && "transform translate-x-full opacity-0"
                  )}
                  style={{
                    transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out'
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                <div className="flex items-start gap-3">
                  <div className="text-lg">{getTopicIcon(notification.topic)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {notification.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.created_at)}
                          </span>
                          {notification.priority === 'high' && (
                            <Badge 
                              variant="destructive" 
                              className="text-xs h-4 px-1"
                            >
                              Alta prioridad
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeleteNotification(notification.id)
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        title="Eliminar notificación"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </>
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (!isOpen && stats.unread > 0) {
            // Marcar todas como leídas cuando se abre el panel
            markAllAsReadOnOpen()
          }
          setIsOpen(!isOpen)
        }}
        className={cn(
          "relative text-muted-foreground hover:text-primary hover:bg-muted/50",
          className
        )}
        aria-label={`Notificaciones${stats.unread > 0 ? ` (${stats.unread} no leídas)` : ''}`}
      >
        <Bell size={20} />
        {stats.unread > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {stats.unread > 99 ? '99+' : stats.unread}
          </Badge>
        )}
      </Button>

      {/* Desktop: Card dropdown */}
      {isOpen && !isMobile && (
        <Card className="absolute right-0 top-12 w-80 sm:w-96 z-50 shadow-lg border max-h-[80vh]">
          <CardContent className="p-0">
            <NotificationContent showHeader={true} />
          </CardContent>
        </Card>
      )}

      {/* Mobile: Drawer */}
      <Drawer 
        open={drawerOpen && isMobile} 
        onOpenChange={(open) => {
          // Solo permitir cerrar con gestos nativos (deslizar hacia abajo)
          // No permitir cerrar con clicks internos
          if (!open) {
            // Solo cerrar si es un gesto nativo, no un click interno
            closeDrawer()
          }
        }}
      >
        <DrawerContent 
          className="max-h-[85vh]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <DrawerHeader className="pb-2">
            <DrawerTitle>Notificaciones</DrawerTitle>
          </DrawerHeader>
          
          <div 
            className="px-4 pb-4"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <NotificationContent showHeader={false} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}


