"use client"

import { useCallback } from "react"
import { emitNotification } from "@/lib/notifications/emitter"
import { supabaseBrowser } from "@/lib/supabase/client"

export interface NegotiationActionParams {
  threadId: string
  action: string
  metadata?: Record<string, any>
  orderId?: string
  auctionId?: string
  disputeId?: string
}

export interface NegotiationActionResult {
  success: boolean
  error?: string
  notificationSent?: boolean
}

/**
 * Hook para manejar acciones de negociación en el chat
 */
export function useNegotiationActions() {
  
  const executeAction = useCallback(async (params: NegotiationActionParams): Promise<NegotiationActionResult> => {
    try {
      const { data: { user } } = await supabaseBrowser().auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Usuario no autenticado' }
      }

      // Ejecutar acción en el chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'emit_system_message',
          threadId: params.threadId,
          action: params.action,
          metadata: params.metadata || {}
        })
      })

      const result = await response.json()
      
      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Emitir notificación adicional si es necesario
      let notificationSent = false
      
      if (['open_dispute', 'mark_paid', 'release_funds', 'cancel_order'].includes(params.action)) {
        await emitAdditionalNotification(params, user.id)
        notificationSent = true
      }

      return { 
        success: true, 
        notificationSent 
      }

    } catch (error) {
      console.error('Error ejecutando acción de negociación:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }
    }
  }, [])

  const markAsPaid = useCallback(async (params: Omit<NegotiationActionParams, 'action'>) => {
    return executeAction({
      ...params,
      action: 'mark_paid',
      metadata: {
        ...params.metadata,
        timestamp: new Date().toISOString(),
        action_type: 'payment_confirmation'
      }
    })
  }, [executeAction])

  const confirmReceived = useCallback(async (params: Omit<NegotiationActionParams, 'action'>) => {
    return executeAction({
      ...params,
      action: 'confirm_received',
      metadata: {
        ...params.metadata,
        timestamp: new Date().toISOString(),
        action_type: 'delivery_confirmation'
      }
    })
  }, [executeAction])

  const requestSupport = useCallback(async (params: Omit<NegotiationActionParams, 'action'>) => {
    return executeAction({
      ...params,
      action: 'request_support',
      metadata: {
        ...params.metadata,
        timestamp: new Date().toISOString(),
        action_type: 'support_request'
      }
    })
  }, [executeAction])

  const openDispute = useCallback(async (params: Omit<NegotiationActionParams, 'action'>) => {
    return executeAction({
      ...params,
      action: 'open_dispute',
      metadata: {
        ...params.metadata,
        timestamp: new Date().toISOString(),
        action_type: 'dispute_opened',
        dispute_reason: params.metadata?.reason || 'No especificado'
      }
    })
  }, [executeAction])

  const cancelOrder = useCallback(async (params: Omit<NegotiationActionParams, 'action'>) => {
    return executeAction({
      ...params,
      action: 'cancel_order',
      metadata: {
        ...params.metadata,
        timestamp: new Date().toISOString(),
        action_type: 'order_cancelled',
        cancellation_reason: params.metadata?.reason || 'Cancelado por el usuario'
      }
    })
  }, [executeAction])

  const releaseFunds = useCallback(async (params: Omit<NegotiationActionParams, 'action'>) => {
    return executeAction({
      ...params,
      action: 'release_funds',
      metadata: {
        ...params.metadata,
        timestamp: new Date().toISOString(),
        action_type: 'funds_released'
      }
    })
  }, [executeAction])

  const closeThread = useCallback(async (params: Omit<NegotiationActionParams, 'action'>) => {
    return executeAction({
      ...params,
      action: 'close_thread',
      metadata: {
        ...params.metadata,
        timestamp: new Date().toISOString(),
        action_type: 'thread_closed'
      }
    })
  }, [executeAction])

  return {
    executeAction,
    markAsPaid,
    confirmReceived,
    requestSupport,
    openDispute,
    cancelOrder,
    releaseFunds,
    closeThread
  }
}

/**
 * Emitir notificación adicional para acciones críticas
 */
async function emitAdditionalNotification(
  params: NegotiationActionParams, 
  userId: string
): Promise<void> {
  try {
    // Obtener información del hilo para determinar los participantes
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_thread_info',
        threadId: params.threadId
      })
    })

    const result = await response.json()
    
    if (!result.success) {
      console.error('Error obteniendo información del hilo:', result.error)
      return
    }

    const thread = result.data
    
    // Determinar el tipo de notificación según la acción
    const notificationConfig = getNotificationConfig(params.action)
    if (!notificationConfig) return

    // Notificar a ambas partes (excepto al que ejecutó la acción)
    const participants = [thread.party_a, thread.party_b]
    if (thread.support_user_id) {
      participants.push(thread.support_user_id)
    }

    for (const participantId of participants) {
      if (participantId !== userId) {
        await emitNotification({
          user_id: participantId,
          topic: notificationConfig.topic,
          event: notificationConfig.event,
          title: notificationConfig.title,
          body: notificationConfig.body,
          priority: notificationConfig.priority,
          cta_label: notificationConfig.cta_label,
          cta_href: notificationConfig.cta_href,
          payload: {
            threadId: params.threadId,
            action: params.action,
            ...params.metadata
          },
          dedupe_key: `negotiation_${params.action}_${params.threadId}_${Date.now()}`
        })
      }
    }
  } catch (error) {
    console.error('Error emitiendo notificación adicional:', error)
  }
}

/**
 * Configuración de notificaciones por acción
 */
function getNotificationConfig(action: string) {
  const configs = {
    'mark_paid': {
      topic: 'order' as const,
      event: 'ORDER_PAID',
      title: 'Orden marcada como pagada',
      body: 'La orden ha sido marcada como pagada en el chat',
      priority: 'high' as const,
      cta_label: 'Ver orden',
      cta_href: '/dashboard/orders'
    },
    'open_dispute': {
      topic: 'order' as const,
      event: 'DISPUTE_OPENED',
      title: 'Disputa abierta',
      body: 'Se ha abierto una disputa en el chat',
      priority: 'high' as const,
      cta_label: 'Responder disputa',
      cta_href: '/dashboard/disputes'
    },
    'cancel_order': {
      topic: 'order' as const,
      event: 'ORDER_CANCELLED',
      title: 'Orden cancelada',
      body: 'La orden ha sido cancelada en el chat',
      priority: 'high' as const,
      cta_label: 'Ver detalles',
      cta_href: '/dashboard/orders'
    },
    'release_funds': {
      topic: 'order' as const,
      event: 'ORDER_RELEASED',
      title: 'Fondos liberados',
      body: 'Los fondos han sido liberados',
      priority: 'high' as const,
      cta_label: 'Ver detalles',
      cta_href: '/dashboard/orders'
    },
    'request_support': {
      topic: 'system' as const,
      event: 'SUPPORT_REQUESTED',
      title: 'Soporte solicitado',
      body: 'Se ha solicitado soporte en el chat',
      priority: 'normal' as const,
      cta_label: 'Ver chat',
      cta_href: '/dashboard/support'
    }
  }

  return configs[action as keyof typeof configs]
}


