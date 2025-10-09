'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PurchaseRequest {
  id: string
  buyer_id: string
  amount: number
  description?: string
  status: 'active' | 'negotiating' | 'accepted' | 'completed' | 'cancelled' | 'expired'
  seller_id?: string
  accepted_at?: string
  terms?: string
  exchange_rate: number
  expires_at: string
  created_at: string
  updated_at: string
  buyer_name?: string
  buyer_email?: string
  offers_count?: number
}

export interface PurchaseOffer {
  id: string
  request_id: string
  seller_id: string
  offered_amount: number
  exchange_rate: number
  terms?: string
  message?: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  expires_at: string
  created_at: string
  updated_at: string
  seller_name?: string
  seller_email?: string
}

export interface PurchaseTransaction {
  id: string
  request_id: string
  buyer_id: string
  seller_id: string
  amount: number
  exchange_rate: number
  final_amount: number
  status: 'pending' | 'payment_sent' | 'payment_confirmed' | 'hnld_transferred' | 'completed' | 'disputed' | 'cancelled'
  payment_method?: string
  payment_reference?: string
  payment_proof_url?: string
  payment_sent_at?: string
  payment_confirmed_at?: string
  hnld_transferred_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface RequestNotification {
  id: string
  type: 'new_request' | 'new_offer' | 'offer_accepted' | 'offer_rejected' | 'payment_sent' | 'payment_confirmed' | 'transaction_completed' | 'request_expired'
  title: string
  message: string
  is_read: boolean
  created_at: string
  read_at?: string
  request_id?: string
  offer_id?: string
}

// Crear solicitud de compra
export async function createPurchaseRequest(
  amount: number,
  description?: string,
  expiresInDays: number = 7
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (amount <= 0) {
      return { success: false, error: 'El monto debe ser mayor a 0' }
    }

    const { data, error } = await supabase
      .rpc('create_purchase_request', {
        p_buyer_id: user.id,
        p_amount: amount,
        p_description: description,
        p_expires_in_days: expiresInDays
      })

    if (error) {
      console.error('❌ Error creando solicitud de compra:', error)
      return { success: false, error: error.message || 'Error creando solicitud de compra' }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/saldo')
    return { success: true, requestId: data }
  } catch (error) {
    console.error('❌ Error en createPurchaseRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener solicitudes activas (para vendedores)
export async function getActivePurchaseRequests(
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: PurchaseRequest[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_active_purchase_requests', {
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo solicitudes activas:', error)
      return { success: false, error: 'Error obteniendo solicitudes activas' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getActivePurchaseRequests:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener solicitudes del usuario
export async function getUserPurchaseRequests(
  status?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: PurchaseRequest[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_purchase_requests', {
        p_user_id: user.id,
        p_status: status,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo solicitudes del usuario:', error)
      return { success: false, error: 'Error obteniendo solicitudes' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getUserPurchaseRequests:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Crear oferta de vendedor
export async function createPurchaseOffer(
  requestId: string,
  offeredAmount: number,
  exchangeRate: number = 1.0000,
  terms?: string,
  message?: string
): Promise<{ success: boolean; offerId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (offeredAmount <= 0) {
      return { success: false, error: 'El monto ofrecido debe ser mayor a 0' }
    }

    // Verificar que el usuario no sea el comprador de la solicitud
    const { data: requestData, error: requestError } = await supabase
      .from('purchase_requests')
      .select('buyer_id')
      .eq('id', requestId)
      .single()

    if (requestError || !requestData) {
      return { success: false, error: 'Solicitud no encontrada' }
    }

    if (requestData.buyer_id === user.id) {
      return { success: false, error: 'No puedes hacer ofertas en tu propia solicitud de compra' }
    }

    const { data, error } = await supabase
      .rpc('create_purchase_offer', {
        p_request_id: requestId,
        p_seller_id: user.id,
        p_offered_amount: offeredAmount,
        p_exchange_rate: exchangeRate,
        p_terms: terms,
        p_message: message
      })

    if (error) {
      console.error('❌ Error creando oferta:', error)
      return { success: false, error: error.message || 'Error creando oferta' }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/ofertas')
    return { success: true, offerId: data }
  } catch (error) {
    console.error('❌ Error en createPurchaseOffer:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Aceptar oferta
export async function acceptPurchaseOffer(
  offerId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('accept_purchase_offer', {
        p_offer_id: offerId,
        p_buyer_id: user.id
      })

    if (error) {
      console.error('❌ Error aceptando oferta:', error)
      return { success: false, error: error.message || 'Error aceptando oferta' }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/transacciones')
    return { success: true, transactionId: data }
  } catch (error) {
    console.error('❌ Error en acceptPurchaseOffer:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener notificaciones del usuario
export async function getUserNotifications(
  isRead?: boolean,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: RequestNotification[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_notifications', {
        p_user_id: user.id,
        p_is_read: isRead,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo notificaciones:', error)
      return { success: false, error: 'Error obteniendo notificaciones' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getUserNotifications:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Marcar notificación como leída
export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { error } = await supabase
      .rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: user.id
      })

    if (error) {
      console.error('❌ Error marcando notificación como leída:', error)
      return { success: false, error: 'Error marcando notificación' }
    }

    revalidatePath('/dashboard/notificaciones')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en markNotificationRead:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Procesar compra con tarjeta (simulación)
export async function processCardPurchase(
  amount: number,
  cardData: {
    number: string
    expiry: string
    cvv: string
    name: string
  }
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Simular procesamiento de tarjeta
    // En producción, aquí se integraría con Stripe, PayPal, etc.
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Simular éxito del pago
    const transactionId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Emitir HNLD al usuario
    const { error: emitError } = await supabase
      .rpc('emit_hnld', {
        p_user_id: user.id,
        p_amount: amount,
        p_description: `Compra con tarjeta - ${transactionId}`
      })

    if (emitError) {
      console.error('❌ Error emitiendo HNLD:', emitError)
      return { success: false, error: 'Error procesando la compra' }
    }

    revalidatePath('/dashboard/saldo')
    return { success: true, transactionId }
  } catch (error) {
    console.error('❌ Error en processCardPurchase:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
