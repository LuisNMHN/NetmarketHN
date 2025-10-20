"use client"

import { useState, useEffect, useCallback } from "react"
import { notificationCenter, Notification, NotificationStats } from "@/lib/notifications/center"
import { toast } from "sonner"

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats>({ 
    total: 0, 
    unread: 0, 
    read: 0, 
    archived: 0, 
    high_priority: 0 
  })
  const [isLoading, setIsLoading] = useState(true)

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData()
  }, [])

  // Configurar listeners de tiempo real
  useEffect(() => {
    const unsubscribeNotification = notificationCenter.addListener((notification) => {
      setNotifications(prev => [notification, ...prev])
      
      // Solo mostrar toast para notificaciones de alta prioridad críticas
      if (notification.priority === 'high' && notification.topic === 'system') {
        toast.success(notification.title, {
          description: notification.body,
          action: notification.cta_label ? {
            label: notification.cta_label,
            onClick: () => {
              if (notification.cta_href) {
                window.location.href = notification.cta_href
              }
            }
          } : undefined,
          duration: 5000,
        })
      }
    })

    const unsubscribeStats = notificationCenter.addStatsListener((newStats) => {
      setStats(newStats)
    })

    return () => {
      unsubscribeNotification()
      unsubscribeStats()
    }
  }, [])

  const loadInitialData = async () => {
    setIsLoading(true)
    try {
      const [notificationsData, statsData] = await Promise.all([
        notificationCenter.getNotifications({ limit: 20 }),
        notificationCenter.getStats()
      ])
      
      setNotifications(notificationsData)
      setStats(statsData)
    } catch (error) {
      console.error('Error cargando datos iniciales:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadNotifications = useCallback(async (options: {
    limit?: number
    offset?: number
    status?: 'unread' | 'read' | 'archived'
    topic?: string
  } = {}) => {
    try {
      const data = await notificationCenter.getNotifications(options)
      return data
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
      return []
    }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    const success = await notificationCenter.markAsRead(notificationId)
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, status: 'read' as const } : n)
      )
    }
    return success
  }, [])

  const markAsUnread = useCallback(async (notificationId: string) => {
    const success = await notificationCenter.markAsUnread(notificationId)
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, status: 'unread' as const } : n)
      )
    }
    return success
  }, [])

  const archive = useCallback(async (notificationId: string) => {
    const success = await notificationCenter.archive(notificationId)
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    }
    return success
  }, [])

  const markAllAsRead = useCallback(async () => {
    const success = await notificationCenter.markAllAsRead()
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const })))
    }
    return success
  }, [])

  const getPreferences = useCallback(async () => {
    return await notificationCenter.getPreferences()
  }, [])

  const updatePreferences = useCallback(async (prefs: any) => {
    return await notificationCenter.updatePreferences(prefs)
  }, [])

  return {
    notifications,
    stats,
    isLoading,
    loadNotifications,
    markAsRead,
    markAsUnread,
    archive,
    markAllAsRead,
    getPreferences,
    updatePreferences,
    refreshStats: () => notificationCenter.refreshStats()
  }
}


