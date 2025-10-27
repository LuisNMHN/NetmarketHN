"use client"

import { useCallback } from "react"
import { emitPredefinedEvent, NotificationEvents } from "@/lib/notifications/emitter"
import { supabaseBrowser } from "@/lib/supabase/client"
import { toast } from "sonner"

/**
 * Hook para facilitar el uso del sistema de notificaciones
 */
export function useNotificationEmitter() {
  const emitNotification = useCallback(async (payload: {
    topic: 'order' | 'kyc' | 'wallet' | 'system' // DESACTIVADO: 'chat' removido
    event: string
    title: string
    body: string
    cta_label?: string
    cta_href?: string
    priority?: 'low' | 'normal' | 'high'
    payload?: Record<string, any>
    dedupe_key?: string
    expires_at?: string
  }) => {
    try {
      const { data: { user } } = await supabaseBrowser().auth.getUser()
      
      if (!user) {
        console.error('Usuario no autenticado')
        return false
      }

      const response = await fetch('/api/notifications/emit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          ...payload
        }),
      })

      const result = await response.json()
      
      if (!result.success) {
        console.error('Error emitiendo notificación:', result.error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error en useNotificationEmitter:', error)
      return false
    }
  }, [])

  const emitOrderCreated = useCallback(async (orderData: {
    orderId: string
    amount: number
    currency?: string
  }) => {
    return emitNotification({
      topic: 'order',
      event: 'ORDER_CREATED',
      title: 'Nueva orden creada',
      body: `Se ha creado una nueva orden #${orderData.orderId} por ${orderData.amount} ${orderData.currency || 'HNLD'}`,
      priority: 'normal',
      cta_label: 'Ver orden',
      cta_href: `/dashboard/orders/${orderData.orderId}`,
      payload: orderData,
      dedupe_key: `order_created_${orderData.orderId}`
    })
  }, [emitNotification])

  const emitOrderPaid = useCallback(async (orderData: {
    orderId: string
    amount: number
    currency?: string
  }) => {
    return emitNotification({
      topic: 'order',
      event: 'ORDER_PAID',
      title: '¡Orden pagada!',
      body: `La orden #${orderData.orderId} ha sido pagada exitosamente por ${orderData.amount} ${orderData.currency || 'HNLD'}`,
      priority: 'high',
      cta_label: 'Validar pago',
      cta_href: `/dashboard/orders/${orderData.orderId}`,
      payload: orderData,
      dedupe_key: `order_paid_${orderData.orderId}`
    })
  }, [emitNotification])

  const emitNewMessage = useCallback(async (messageData: {
    conversationId: string
    senderName: string
    orderId?: string
  }) => {
    return emitNotification({
      topic: 'chat',
      event: 'NEW_MESSAGE',
      title: 'Nuevo mensaje recibido',
      body: `Tienes un nuevo mensaje de ${messageData.senderName}${messageData.orderId ? ` sobre la orden #${messageData.orderId}` : ''}`,
      priority: 'normal',
      cta_label: 'Abrir conversación',
      cta_href: `/dashboard/chat/${messageData.conversationId}`,
      payload: messageData,
      dedupe_key: `new_message_${messageData.conversationId}_${Date.now()}`
    })
  }, [emitNotification])

  const emitKycStatusChanged = useCallback(async (kycData: {
    kycId: string
    status: 'pending' | 'approved' | 'rejected'
    reason?: string
  }) => {
    const statusLabels = {
      pending: 'en revisión',
      approved: 'aprobado',
      rejected: 'rechazado'
    }

    const priority = kycData.status === 'approved' || kycData.status === 'rejected' ? 'high' : 'normal'

    return emitNotification({
      topic: 'kyc',
      event: 'KYC_STATUS_CHANGED',
      title: `KYC ${statusLabels[kycData.status]}`,
      body: `Tu proceso de verificación de identidad ha sido ${statusLabels[kycData.status]}${kycData.reason ? `. ${kycData.reason}` : ''}`,
      priority,
      cta_label: kycData.status === 'rejected' ? 'Subir documentos' : 'Ver estado',
      cta_href: kycData.status === 'rejected' ? '/dashboard/kyc' : '/dashboard/profile',
      payload: kycData,
      dedupe_key: `kyc_status_${kycData.kycId}`
    })
  }, [emitNotification])

  const emitDisputeOpened = useCallback(async (disputeData: {
    disputeId: string
    orderId: string
    reason: string
  }) => {
    return emitNotification({
      topic: 'order',
      event: 'DISPUTE_OPENED',
      title: 'Disputa abierta',
      body: `Se ha abierto una disputa para la orden #${disputeData.orderId}. Motivo: ${disputeData.reason}`,
      priority: 'high',
      cta_label: 'Responder disputa',
      cta_href: `/dashboard/disputes/${disputeData.disputeId}`,
      payload: disputeData,
      dedupe_key: `dispute_opened_${disputeData.disputeId}`
    })
  }, [emitNotification])

  const emitSystemMaintenance = useCallback(async (maintenanceData: {
    startTime: string
    endTime: string
    description?: string
  }) => {
    return emitNotification({
      topic: 'system',
      event: 'SYSTEM_MAINTENANCE',
      title: 'Mantenimiento programado',
      body: maintenanceData.description || `El sistema estará en mantenimiento desde ${new Date(maintenanceData.startTime).toLocaleString()} hasta ${new Date(maintenanceData.endTime).toLocaleString()}`,
      priority: 'high',
      cta_label: 'Ver detalles',
      cta_href: '/dashboard/status',
      payload: maintenanceData,
      dedupe_key: `maintenance_${maintenanceData.startTime}`
    })
  }, [emitNotification])

  return {
    emitNotification,
    emitOrderCreated,
    emitOrderPaid,
    emitNewMessage,
    emitKycStatusChanged,
    emitDisputeOpened,
    emitSystemMaintenance
  }
}


