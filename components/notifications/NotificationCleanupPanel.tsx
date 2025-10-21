"use client"

import { useState, useEffect } from "react"
import { Trash2, RefreshCw, BarChart3, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { notificationCenter } from "@/lib/notifications/center"
import { toast } from "sonner"

interface CleanupStats {
  total_notifications: number
  by_status: {
    unread: number
    read: number
    archived: number
  }
  by_topic: {
    order: number
    kyc: number
    wallet: number
    chat: number
    system: number
  }
  by_age: {
    last_24h: number
    last_7d: number
    last_30d: number
    older_30d: number
  }
  expired_count: number
  duplicate_count: number
}

export function NotificationCleanupPanel() {
  const [stats, setStats] = useState<CleanupStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)

  // Cargar estadísticas iniciales
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const result = await notificationCenter.getCleanupStats()
      if (result.success && result.stats) {
        setStats(result.stats)
      } else {
        toast.error("Error cargando estadísticas")
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
      toast.error("Error cargando estadísticas")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutomaticCleanup = async () => {
    setIsCleaning(true)
    try {
      const result = await notificationCenter.performAutomaticCleanup()
      if (result.success && result.result) {
        const data = result.result
        toast.success(
          `Limpieza completada: ${data.total_deleted} notificaciones eliminadas`,
          {
            description: `Expiradas: ${data.breakdown.expired}, Archivadas: ${data.breakdown.archived}, Duplicadas: ${data.breakdown.duplicates}, Sistema: ${data.breakdown.system}`
          }
        )
        await loadStats() // Recargar estadísticas
      } else {
        toast.error(result.error || "Error ejecutando limpieza automática")
      }
    } catch (error) {
      console.error('Error ejecutando limpieza:', error)
      toast.error("Error ejecutando limpieza automática")
    } finally {
      setIsCleaning(false)
    }
  }

  const handleCleanupExpired = async () => {
    setIsCleaning(true)
    try {
      const result = await notificationCenter.cleanupExpiredNotifications()
      if (result.success) {
        toast.success(`${result.deletedCount} notificaciones expiradas eliminadas`)
        await loadStats()
      } else {
        toast.error(result.error || "Error limpiando notificaciones expiradas")
      }
    } catch (error) {
      console.error('Error limpiando expiradas:', error)
      toast.error("Error limpiando notificaciones expiradas")
    } finally {
      setIsCleaning(false)
    }
  }

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true)
    try {
      const result = await notificationCenter.cleanupDuplicateNotifications()
      if (result.success) {
        toast.success(`${result.deletedCount} notificaciones duplicadas eliminadas`)
        await loadStats()
      } else {
        toast.error(result.error || "Error limpiando notificaciones duplicadas")
      }
    } catch (error) {
      console.error('Error limpiando duplicadas:', error)
      toast.error("Error limpiando notificaciones duplicadas")
    } finally {
      setIsCleaning(false)
    }
  }

  const handleCleanupUserNotifications = async () => {
    setIsCleaning(true)
    try {
      const result = await notificationCenter.cleanupUserNotifications(7)
      if (result.success) {
        toast.success(`${result.deletedCount} notificaciones del usuario eliminadas`)
        await loadStats()
      } else {
        toast.error(result.error || "Error limpiando notificaciones del usuario")
      }
    } catch (error) {
      console.error('Error limpiando usuario:', error)
      toast.error("Error limpiando notificaciones del usuario")
    } finally {
      setIsCleaning(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando estadísticas...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estadísticas del Sistema de Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && (
            <>
              {/* Estadísticas generales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.total_notifications}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">{stats.by_status.unread}</div>
                  <div className="text-sm text-muted-foreground">No leídas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{stats.by_status.read}</div>
                  <div className="text-sm text-muted-foreground">Leídas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-500">{stats.by_status.archived}</div>
                  <div className="text-sm text-muted-foreground">Archivadas</div>
                </div>
              </div>

              <Separator />

              {/* Por tópico */}
              <div>
                <h4 className="font-semibold mb-2">Por Tópico</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_topic.order}</div>
                    <div className="text-xs text-muted-foreground">Órdenes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_topic.kyc}</div>
                    <div className="text-xs text-muted-foreground">KYC</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_topic.wallet}</div>
                    <div className="text-xs text-muted-foreground">Wallet</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_topic.chat}</div>
                    <div className="text-xs text-muted-foreground">Chat</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_topic.system}</div>
                    <div className="text-xs text-muted-foreground">Sistema</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Por edad */}
              <div>
                <h4 className="font-semibold mb-2">Por Edad</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_age.last_24h}</div>
                    <div className="text-xs text-muted-foreground">Últimas 24h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_age.last_7d}</div>
                    <div className="text-xs text-muted-foreground">Últimos 7 días</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_age.last_30d}</div>
                    <div className="text-xs text-muted-foreground">Últimos 30 días</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.by_age.older_30d}</div>
                    <div className="text-xs text-muted-foreground">Más de 30 días</div>
                  </div>
                </div>
              </div>

              {/* Alertas */}
              {(stats.expired_count > 0 || stats.duplicate_count > 0) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-orange-500">Alertas de Limpieza</h4>
                    {stats.expired_count > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">{stats.expired_count} notificaciones expiradas</span>
                      </div>
                    )}
                    {stats.duplicate_count > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">{stats.duplicate_count} notificaciones duplicadas</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={loadStats} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Acciones de limpieza */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Acciones de Limpieza
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Limpieza automática completa */}
            <div className="space-y-2">
              <h4 className="font-semibold">Limpieza Automática Completa</h4>
              <p className="text-sm text-muted-foreground">
                Ejecuta todas las limpiezas automáticas: expiradas, archivadas, duplicadas y sistema.
              </p>
              <Button 
                onClick={handleAutomaticCleanup} 
                disabled={isCleaning}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isCleaning ? 'Limpiando...' : 'Ejecutar Limpieza Completa'}
              </Button>
            </div>

            {/* Limpieza de expiradas */}
            <div className="space-y-2">
              <h4 className="font-semibold">Limpiar Expiradas</h4>
              <p className="text-sm text-muted-foreground">
                Elimina notificaciones que han pasado su fecha de expiración.
              </p>
              <Button 
                variant="outline" 
                onClick={handleCleanupExpired} 
                disabled={isCleaning}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isCleaning ? 'Limpiando...' : 'Limpiar Expiradas'}
              </Button>
            </div>

            {/* Limpieza de duplicadas */}
            <div className="space-y-2">
              <h4 className="font-semibold">Limpiar Duplicadas</h4>
              <p className="text-sm text-muted-foreground">
                Elimina notificaciones duplicadas basadas en dedupe_key.
              </p>
              <Button 
                variant="outline" 
                onClick={handleCleanupDuplicates} 
                disabled={isCleaning}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isCleaning ? 'Limpiando...' : 'Limpiar Duplicadas'}
              </Button>
            </div>

            {/* Limpieza del usuario */}
            <div className="space-y-2">
              <h4 className="font-semibold">Limpiar Mis Notificaciones</h4>
              <p className="text-sm text-muted-foreground">
                Elimina notificaciones del usuario actual más antiguas de 7 días.
              </p>
              <Button 
                variant="outline" 
                onClick={handleCleanupUserNotifications} 
                disabled={isCleaning}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isCleaning ? 'Limpiando...' : 'Limpiar Mis Notificaciones'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
