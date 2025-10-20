import { supabaseBrowser } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"

export interface Notification {
  id: string
  user_id: string
  topic: 'order' | 'kyc' | 'wallet' | 'chat' | 'system'
  event: string
  title: string
  body: string
  cta_label?: string
  cta_href?: string
  status: 'unread' | 'read' | 'archived'
  priority: 'low' | 'normal' | 'high'
  payload: Record<string, any>
  dedupe_key?: string
  created_at: string
  expires_at?: string
  updated_at: string
}

export interface NotificationStats {
  total: number
  unread: number
  read: number
  archived: number
  high_priority: number
}

export interface NotificationPrefs {
  user_id: string
  channel_inapp: boolean
  channel_email: boolean
  channel_push: boolean
  muted_topics: string[]
  quiet_hours: Record<string, any>
  updated_at: string
}

/**
 * Clase para manejar notificaciones en el cliente
 */
export class NotificationCenter {
  private supabase = supabaseBrowser()
  private realtimeChannel: RealtimeChannel | null = null
  private listeners: Set<(notification: Notification) => void> = new Set()
  private statsListeners: Set<(stats: NotificationStats) => void> = new Set()

  constructor() {
    this.setupRealtimeSubscription()
  }

  /**
   * Configurar suscripción en tiempo real
   */
  private async setupRealtimeSubscription() {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) return

    // Cancelar suscripción anterior si existe
    if (this.realtimeChannel) {
      await this.realtimeChannel.unsubscribe()
    }

    // Crear nueva suscripción
    this.realtimeChannel = this.supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new as Notification
          this.notifyListeners(notification)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new as Notification
          this.notifyListeners(notification)
        }
      )
      .subscribe()
  }

  /**
   * Agregar listener para nuevas notificaciones
   */
  addListener(callback: (notification: Notification) => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Agregar listener para cambios en estadísticas
   */
  addStatsListener(callback: (stats: NotificationStats) => void) {
    this.statsListeners.add(callback)
    return () => this.statsListeners.delete(callback)
  }

  /**
   * Notificar a todos los listeners
   */
  private notifyListeners(notification: Notification) {
    this.listeners.forEach(callback => callback(notification))
    this.refreshStats() // Actualizar estadísticas cuando hay cambios
  }

  /**
   * Obtener notificaciones del usuario
   */
  async getNotifications(options: {
    limit?: number
    offset?: number
    status?: 'unread' | 'read' | 'archived'
    topic?: string
  } = {}): Promise<Notification[]> {
    const { limit = 20, offset = 0, status, topic } = options

    let query = this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', (await this.supabase.auth.getUser()).data.user?.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (topic) {
      query = query.eq('topic', topic)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error obteniendo notificaciones:', error)
      return []
    }

    return data || []
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  async getStats(): Promise<NotificationStats> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) {
      return { total: 0, unread: 0, read: 0, archived: 0, high_priority: 0 }
    }

    const { data, error } = await this.supabase.rpc('get_notification_stats', {
      p_user_id: user.id
    })

    if (error) {
      console.error('Error obteniendo estadísticas:', error)
      return { total: 0, unread: 0, read: 0, archived: 0, high_priority: 0 }
    }

    return data || { total: 0, unread: 0, read: 0, archived: 0, high_priority: 0 }
  }

  /**
   * Refrescar estadísticas y notificar listeners
   */
  async refreshStats() {
    const stats = await this.getStats()
    this.statsListeners.forEach(callback => callback(stats))
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marcando como leída:', error)
      return false
    }

    this.refreshStats()
    return true
  }

  /**
   * Marcar notificación como no leída
   */
  async markAsUnread(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ status: 'unread' })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marcando como no leída:', error)
      return false
    }

    this.refreshStats()
    return true
  }

  /**
   * Archivar notificación
   */
  async archive(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ status: 'archived' })
      .eq('id', notificationId)

    if (error) {
      console.error('Error archivando:', error)
      return false
    }

    this.refreshStats()
    return true
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) return false

    const { error } = await this.supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('user_id', user.id)
      .eq('status', 'unread')

    if (error) {
      console.error('Error marcando todas como leídas:', error)
      return false
    }

    this.refreshStats()
    return true
  }

  /**
   * Obtener preferencias de notificación
   */
  async getPreferences(): Promise<NotificationPrefs | null> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await this.supabase
      .from('notification_prefs')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error obteniendo preferencias:', error)
      return null
    }

    return data
  }

  /**
   * Actualizar preferencias de notificación
   */
  async updatePreferences(prefs: Partial<Omit<NotificationPrefs, 'user_id' | 'updated_at'>>): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) return false

    const { error } = await this.supabase
      .from('notification_prefs')
      .upsert({
        user_id: user.id,
        ...prefs
      })

    if (error) {
      console.error('Error actualizando preferencias:', error)
      return false
    }

    return true
  }

  /**
   * Limpiar recursos
   */
  async cleanup() {
    if (this.realtimeChannel) {
      await this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
    }
    this.listeners.clear()
    this.statsListeners.clear()
  }
}

// Instancia global del centro de notificaciones
export const notificationCenter = new NotificationCenter()


