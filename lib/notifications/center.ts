import { supabaseBrowser } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"

export interface Notification {
  id: string
  user_id: string
  topic: 'order' | 'kyc' | 'wallet' | 'system' // DESACTIVADO: 'chat' removido
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
    
    if (!user) {
      console.log('⚠️ NotificationCenter - Usuario no autenticado, saltando suscripción')
      return
    }

    console.log('🔌 NotificationCenter - Configurando suscripción realtime para usuario:', user.id)

    // Cancelar suscripción anterior si existe
    if (this.realtimeChannel) {
      console.log('🧹 NotificationCenter - Limpiando suscripción anterior')
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
          console.log('📨 NotificationCenter - Nueva notificación recibida via realtime:', payload.new)
          const notification = payload.new as Notification
          
          // Log del status si está disponible en el payload
          if (notification.payload && notification.payload.request_status) {
            console.log('📊 NotificationCenter - Status del request:', notification.payload.request_status)
            console.log('📊 NotificationCenter - Request ID:', notification.payload.request_id)
          }
          
          // Log específico para cancelaciones, eliminaciones, expiraciones y completadas
          if (notification.event === 'REQUEST_CANCELLED' || notification.event === 'REQUEST_DELETED' || notification.event === 'REQUEST_EXPIRED' || notification.event === 'REQUEST_COMPLETED') {
            console.log('🚨 NotificationCenter - Notificación de solicitud:', {
              event: notification.event,
              title: notification.title,
              request_status: notification.payload?.request_status,
              request_id: notification.payload?.request_id
            })
          }
          
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
          console.log('📨 NotificationCenter - Notificación actualizada via realtime:', payload.new)
          const notification = payload.new as Notification
          this.notifyListeners(notification)
        }
      )
      .subscribe((status) => {
        console.log('🔌 NotificationCenter - Estado de suscripción:', status)
      })
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
    console.log('📢 NotificationCenter - Notificando listeners:', this.listeners.size, 'listeners')
    this.listeners.forEach(callback => callback(notification))
    // NO llamar refreshStats aquí para evitar bucles infinitos
    // Las estadísticas se actualizarán automáticamente cuando se actualice el estado en el componente
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

    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) {
      console.log('❌ NotificationCenter - Usuario no autenticado en getNotifications')
      return []
    }

    console.log('📥 NotificationCenter - Obteniendo notificaciones para usuario:', user.id)

    let query = this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
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
      console.error('❌ NotificationCenter - Error obteniendo notificaciones:', error)
      return []
    }

    console.log('📥 NotificationCenter - Notificaciones obtenidas:', data?.length || 0)
    console.log('📥 NotificationCenter - IDs obtenidos:', data?.map(n => n.id) || [])

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
   * Limpiar notificaciones expiradas
   */
  async cleanupExpiredNotifications(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('cleanup_expired_notifications')
      
      if (error) {
        console.error('Error limpiando notificaciones expiradas:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, deletedCount: data }
    } catch (error) {
      console.error('Error limpiando notificaciones expiradas:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Limpiar notificaciones duplicadas
   */
  async cleanupDuplicateNotifications(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('cleanup_duplicate_notifications')
      
      if (error) {
        console.error('Error limpiando notificaciones duplicadas:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, deletedCount: data }
    } catch (error) {
      console.error('Error limpiando notificaciones duplicadas:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Ejecutar limpieza automática completa
   */
  async performAutomaticCleanup(): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('perform_automatic_cleanup')
      
      if (error) {
        console.error('Error ejecutando limpieza automática:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, result: data }
    } catch (error) {
      console.error('Error ejecutando limpieza automática:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Obtener estadísticas de limpieza
   */
  async getCleanupStats(): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('get_cleanup_stats')
      
      if (error) {
        console.error('Error obteniendo estadísticas de limpieza:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, stats: data }
    } catch (error) {
      console.error('Error obteniendo estadísticas de limpieza:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Eliminar notificación individual del usuario actual
   */
  async deleteNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) {
      console.log('❌ NotificationCenter - Usuario no autenticado')
      return { success: false, error: 'Usuario no autenticado' }
    }

    console.log('🗑️ NotificationCenter - Eliminando notificación:', notificationId, 'para usuario:', user.id)

    try {
      const { error, count } = await this.supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .eq('id', notificationId)
        .eq('user_id', user.id) // Asegurar que solo puede eliminar sus propias notificaciones
      
      console.log('🗑️ NotificationCenter - Resultado delete:', { error, count })
      
      if (error) {
        console.error('Error eliminando notificación:', error)
        return { success: false, error: error.message }
      }
      
      if (count === 0) {
        console.log('⚠️ NotificationCenter - No se eliminó ninguna notificación (count=0)')
        return { success: false, error: 'Notificación no encontrada o no pertenece al usuario' }
      }
      
      console.log('✅ NotificationCenter - Notificación eliminada exitosamente')
      this.refreshStats()
      return { success: true }
    } catch (error) {
      console.error('Error eliminando notificación:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Eliminar múltiples notificaciones del usuario actual
   */
  async deleteMultipleNotifications(notificationIds: string[]): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (notificationIds.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    try {
      const { error, count } = await this.supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .in('id', notificationIds)
        .eq('user_id', user.id) // Asegurar que solo puede eliminar sus propias notificaciones
      
      if (error) {
        console.error('Error eliminando notificaciones:', error)
        return { success: false, error: error.message }
      }
      
      this.refreshStats()
      return { success: true, deletedCount: count || 0 }
    } catch (error) {
      console.error('Error eliminando notificaciones:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Eliminar todas las notificaciones leídas del usuario actual
   */
  async deleteAllReadNotifications(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    try {
      const { error, count } = await this.supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'read')
      
      if (error) {
        console.error('Error eliminando notificaciones leídas:', error)
        return { success: false, error: error.message }
      }
      
      this.refreshStats()
      return { success: true, deletedCount: count || 0 }
    } catch (error) {
      console.error('Error eliminando notificaciones leídas:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }

  /**
   * Limpiar notificaciones del usuario actual (función administrativa)
   */
  async cleanupUserNotifications(keepDays: number = 7): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    try {
      const { data, error } = await this.supabase.rpc('admin_cleanup_user_notifications', {
        p_user_id: user.id,
        p_keep_days: keepDays
      })
      
      if (error) {
        console.error('Error limpiando notificaciones del usuario:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, deletedCount: data.deleted_count }
    } catch (error) {
      console.error('Error limpiando notificaciones del usuario:', error)
      return { success: false, error: 'Error inesperado' }
    }
  }
}

// Instancia global del centro de notificaciones
export const notificationCenter = new NotificationCenter()


