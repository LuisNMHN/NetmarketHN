"use client"

import { useState, useEffect } from "react"
import { Bell, Check, Archive, Filter, Search, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { notificationCenter, Notification, NotificationStats } from "@/lib/notifications/center"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { cn } from "@/lib/utils"

const getTopicIcon = (topic: string) => {
  switch (topic) {
    case 'order':
      return '📦'
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

const getTopicLabel = (topic: string) => {
  switch (topic) {
    case 'order':
      return 'Órdenes'
    case 'kyc':
      return 'KYC'
    case 'wallet':
      return 'Wallet'
    case 'chat':
      return 'Chat'
    case 'system':
      return 'Sistema'
    default:
      return topic
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, read: 0, archived: 0, high_priority: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [topicFilter, setTopicFilter] = useState<string>("all")
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Cargar datos iniciales
  useEffect(() => {
    loadNotifications(true)
    loadStats()
  }, [])

  // Configurar listeners de tiempo real
  useEffect(() => {
    const unsubscribeNotification = notificationCenter.addListener((notification) => {
      setNotifications(prev => [notification, ...prev])
    })

    const unsubscribeStats = notificationCenter.addStatsListener((newStats) => {
      setStats(newStats)
    })

    return () => {
      unsubscribeNotification()
      unsubscribeStats()
    }
  }, [])

  const loadNotifications = async (reset = false) => {
    if (reset) {
      setIsLoading(true)
      setOffset(0)
    }

    try {
      const filters: any = {
        limit: 20,
        offset: reset ? 0 : offset
      }

      if (statusFilter !== "all") {
        filters.status = statusFilter
      }

      if (topicFilter !== "all") {
        filters.topic = topicFilter
      }

      const data = await notificationCenter.getNotifications(filters)
      
      if (reset) {
        setNotifications(data)
      } else {
        setNotifications(prev => [...prev, ...data])
      }

      setHasMore(data.length === 20)
      if (!reset) {
        setOffset(prev => prev + 20)
      }
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

  const handleMarkAsRead = async (notificationId: string) => {
    await notificationCenter.markAsRead(notificationId)
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, status: 'read' as const } : n)
    )
  }

  const handleMarkAsUnread = async (notificationId: string) => {
    await notificationCenter.markAsUnread(notificationId)
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, status: 'unread' as const } : n)
    )
  }

  const handleArchive = async (notificationId: string) => {
    await notificationCenter.archive(notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const handleMarkAllAsRead = async () => {
    await notificationCenter.markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const })))
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

  // Filtrar notificaciones por término de búsqueda
  const filteredNotifications = notifications.filter(notification => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      notification.title.toLowerCase().includes(searchLower) ||
      notification.body.toLowerCase().includes(searchLower) ||
      notification.event.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notificaciones</h1>
        <p className="text-muted-foreground">
          Gestiona todas tus notificaciones y mantente al día con las actividades de tu cuenta.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full" />
              <span className="text-sm text-muted-foreground">No leídas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.unread}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Leídas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.read}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Archivadas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.archived}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y acciones */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              {/* Búsqueda */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar notificaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtros */}
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value)
                  loadNotifications(true)
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="unread">No leídas</SelectItem>
                    <SelectItem value="read">Leídas</SelectItem>
                    <SelectItem value="archived">Archivadas</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={topicFilter} onValueChange={(value) => {
                  setTopicFilter(value)
                  loadNotifications(true)
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Tópico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="order">Órdenes</SelectItem>
                    <SelectItem value="kyc">KYC</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2">
              {stats.unread > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Marcar todo como leído
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de notificaciones */}
      <div className="space-y-4">
        {isLoading && notifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Cargando notificaciones...</p>
            </CardContent>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay notificaciones</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" || topicFilter !== "all"
                  ? "No se encontraron notificaciones con los filtros aplicados."
                  : "No tienes notificaciones aún."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card key={notification.id} className={cn(
              "transition-colors",
              notification.status === 'unread' && "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
            )}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{getTopicIcon(notification.topic)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm">{notification.title}</h3>
                          <Badge variant="outline" className="text-xs">
                            {getTopicLabel(notification.topic)}
                          </Badge>
                          {notification.priority === 'high' && (
                            <Badge variant="destructive" className="text-xs">
                              Alta prioridad
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatTimeAgo(notification.created_at)}</span>
                          <span className="capitalize">{notification.status}</span>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {notification.status === 'unread' ? (
                            <DropdownMenuItem onClick={() => handleMarkAsRead(notification.id)}>
                              <Check size={14} className="mr-2" />
                              Marcar como leída
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleMarkAsUnread(notification.id)}>
                              <Check size={14} className="mr-2" />
                              Marcar como no leída
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleArchive(notification.id)}>
                            <Archive size={14} className="mr-2" />
                            Archivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {notification.cta_label && notification.cta_href && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link href={notification.cta_href}>
                            {notification.cta_label}
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Cargar más */}
        {hasMore && !isLoading && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => loadNotifications(false)}
              disabled={isLoading}
            >
              {isLoading ? 'Cargando...' : 'Cargar más'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}


