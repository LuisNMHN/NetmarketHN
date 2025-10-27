import { supabaseAdmin } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export interface NotificationPayload {
  user_id: string
  topic: 'order' | 'kyc' | 'wallet' | 'chat' | 'system'
  event: string
  title: string
  body: string
  cta_label?: string
  cta_href?: string
  priority?: 'low' | 'normal' | 'high'
  payload?: Record<string, any>
  dedupe_key?: string
  expires_at?: string
}

export interface NotificationResponse {
  success: boolean
  notification_id?: string
  error?: string
}

/**
 * API única para emitir notificaciones desde cualquier módulo de la plataforma
 * Valida permisos, respeta preferencias del usuario y publica en tiempo real
 */
export async function emitNotification(payload: NotificationPayload): Promise<NotificationResponse> {
  try {
    console.log('🔔 emitNotification - Iniciando emisión de notificación:', {
      user_id: payload.user_id,
      topic: payload.topic,
      event: payload.event,
      dedupe_key: payload.dedupe_key
    })
    
    const supabase = await supabaseAdmin()
    
    // Validar parámetros requeridos
    if (!payload.user_id || !payload.topic || !payload.event || !payload.title || !payload.body) {
      console.error('❌ emitNotification - Parámetros requeridos faltantes')
      return {
        success: false,
        error: 'Parámetros requeridos: user_id, topic, event, title, body'
      }
    }

    // Validar que el usuario existe
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', payload.user_id)
      .single()

    if (userError || !user) {
      console.error('❌ emitNotification - Usuario no encontrado:', userError)
      return {
        success: false,
        error: 'Usuario no encontrado'
      }
    }

    console.log('✅ emitNotification - Usuario validado:', user.id)

    // Llamar a la función de base de datos para emitir la notificación
    const { data, error } = await supabase.rpc('emit_notification', {
      p_user_id: payload.user_id,
      p_topic: payload.topic,
      p_event: payload.event,
      p_title: payload.title,
      p_body: payload.body,
      p_cta_label: payload.cta_label || null,
      p_cta_href: payload.cta_href || null,
      p_priority: payload.priority || 'normal',
      p_payload: payload.payload || {},
      p_dedupe_key: payload.dedupe_key || null,
      p_expires_at: payload.expires_at || null
    })

    if (error) {
      console.error('❌ emitNotification - Error en RPC:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('✅ emitNotification - Notificación emitida exitosamente:', data)
    return {
      success: true,
      notification_id: data
    }

  } catch (error) {
    console.error('❌ emitNotification - Error inesperado:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Hook para usar desde componentes del cliente
 */
export async function emitNotificationFromClient(payload: Omit<NotificationPayload, 'user_id'>) {
  const response = await fetch('/api/notifications/emit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return response.json()
}

/**
 * Eventos predefinidos para facilitar el uso
 */
export const NotificationEvents = {
  // Eventos de órdenes
  ORDER_CREATED: {
    topic: 'order' as const,
    event: 'ORDER_CREATED',
    priority: 'normal' as const,
    cta_label: 'Ver orden',
    cta_href: '/dashboard/orders'
  },
  ORDER_PAID: {
    topic: 'order' as const,
    event: 'ORDER_PAID',
    priority: 'high' as const,
    cta_label: 'Validar pago',
    cta_href: '/dashboard/orders'
  },
  ORDER_RELEASED: {
    topic: 'order' as const,
    event: 'ORDER_RELEASED',
    priority: 'high' as const,
    cta_label: 'Ver recibo',
    cta_href: '/dashboard/orders'
  },
  DISPUTE_OPENED: {
    topic: 'order' as const,
    event: 'DISPUTE_OPENED',
    priority: 'high' as const,
    cta_label: 'Responder disputa',
    cta_href: '/dashboard/disputes'
  },

  // Eventos de KYC
  KYC_STATUS_CHANGED: {
    topic: 'kyc' as const,
    event: 'KYC_STATUS_CHANGED',
    priority: 'normal' as const,
    cta_label: 'Ver estado',
    cta_href: '/dashboard/kyc'
  },
  KYC_APPROVED: {
    topic: 'kyc' as const,
    event: 'KYC_APPROVED',
    priority: 'high' as const,
    cta_label: 'Ver perfil',
    cta_href: '/dashboard/profile'
  },
  KYC_REJECTED: {
    topic: 'kyc' as const,
    event: 'KYC_REJECTED',
    priority: 'high' as const,
    cta_label: 'Subir documentos',
    cta_href: '/dashboard/kyc'
  },

  // Eventos de chat/mensajes (DESACTIVADO - eliminado del sistema)
  // NEW_MESSAGE: {
  //   topic: 'chat' as const,
  //   event: 'NEW_MESSAGE',
  //   priority: 'normal' as const,
  //   cta_label: 'Abrir conversación',
  //   cta_href: '/dashboard/chat'
  // },

  // Eventos del sistema
  SYSTEM_MAINTENANCE: {
    topic: 'system' as const,
    event: 'SYSTEM_MAINTENANCE',
    priority: 'high' as const,
    cta_label: 'Ver detalles',
    cta_href: '/dashboard/status'
  }
} as const

/**
 * Función helper para emitir eventos predefinidos
 */
export async function emitPredefinedEvent(
  eventType: keyof typeof NotificationEvents,
  user_id: string,
  customData: {
    title?: string
    body?: string
    payload?: Record<string, any>
    dedupe_key?: string
  } = {}
) {
  const eventConfig = NotificationEvents[eventType]
  
  return emitNotification({
    user_id,
    topic: eventConfig.topic,
    event: eventConfig.event,
    title: customData.title || eventConfig.event.replace(/_/g, ' '),
    body: customData.body || `Evento ${eventConfig.event}`,
    priority: eventConfig.priority,
    cta_label: eventConfig.cta_label,
    cta_href: eventConfig.cta_href,
    payload: customData.payload || {},
    dedupe_key: customData.dedupe_key
  })
}


