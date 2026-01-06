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
  unique_code?: string
  // Nuevos campos del modal
  payment_method?: 'local_transfer' | 'international_transfer' | 'card' | 'digital_balance'
  bank_name?: string
  custom_bank_name?: string
  country?: string
  custom_country?: string
  digital_wallet?: 'PayPal' | 'Skrill' | 'Payoneer'
  currency_type?: 'L' | 'USD' | 'EUR'
  amount_in_original_currency?: number
  exchange_rate_applied?: number
  processing_fee_percentage?: number
  processing_fee_amount?: number
  final_amount_hnld?: number
  payment_reference?: string
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  // Campos de negociación (DESACTIVADOS - ya no se usan)
  negotiating_with?: string
  negotiation_started_at?: string
  negotiation_timeout_at?: string
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
  type: 'new_request' | 'new_offer' | 'offer_accepted' | 'offer_rejected' | 'payment_sent' | 'payment_confirmed' | 'transaction_completed' | 'request_expired' | 'request_cancelled'
  title: string
  message: string
  is_read: boolean
  created_at: string
  read_at?: string
  request_id?: string
  offer_id?: string
}

// Crear solicitud de compra con los nuevos campos del modal
export async function createPurchaseRequest(
  amount: number,
  paymentMethod: 'local_transfer' | 'international_transfer' | 'card' | 'digital_balance',
  options: {
    description?: string
    expiresInDays?: number
    // Campos específicos por método de pago
    bankName?: string
    customBankName?: string
    country?: string
    customCountry?: string
    digitalWallet?: 'PayPal' | 'Skrill' | 'Payoneer'
    currencyType?: 'L' | 'USD' | 'EUR'
    amountInOriginalCurrency?: number
    exchangeRateApplied?: number
    processingFeePercentage?: number
    processingFeeAmount?: number
    finalAmountHnld?: number
  } = {}
): Promise<{ success: boolean; requestId?: string; uniqueCode?: string; error?: string }> {
  try {
    console.log('🚀 INICIANDO createPurchaseRequest')
    console.log('📊 Parámetros recibidos:', { amount, paymentMethod, options })
    
    const supabase = await supabaseServer()
    console.log('✅ Supabase client obtenido')
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('👤 Usuario obtenido:', { user: user?.id, error: userError })
    
    if (userError || !user) {
      console.log('❌ Error de autenticación:', userError)
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (amount <= 0) {
      return { success: false, error: 'El monto debe ser mayor a 0' }
    }

    // Validaciones específicas por método de pago
    if (paymentMethod === 'local_transfer' && !options.bankName) {
      return { success: false, error: 'Debe seleccionar un banco para transferencia local' }
    }
    
    if (paymentMethod === 'international_transfer' && !options.country) {
      return { success: false, error: 'Debe seleccionar un país para transferencia internacional' }
    }
    
    if (paymentMethod === 'digital_balance' && !options.digitalWallet) {
      return { success: false, error: 'Debe seleccionar una billetera digital' }
    }

    console.log('🔍 Creando solicitud con parámetros:', {
      p_buyer_id: user.id,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_bank_name: options.bankName,
      p_custom_bank_name: options.customBankName,
      p_country: options.country,
      p_custom_country: options.customCountry,
      p_digital_wallet: options.digitalWallet,
      p_currency_type: options.currencyType || 'L',
      p_amount_in_original_currency: options.amountInOriginalCurrency || amount,
      p_exchange_rate_applied: options.exchangeRateApplied || 1.0000,
      p_processing_fee_percentage: options.processingFeePercentage,
      p_processing_fee_amount: options.processingFeeAmount,
      p_final_amount_hnld: options.finalAmountHnld || amount,
      p_description: options.description,
      p_expires_in_days: options.expiresInDays || 7
    })

    console.log('📞 Llamando a create_purchase_request RPC...')
    const { data, error } = await supabase
      .rpc('create_purchase_request', {
        p_buyer_id: user.id,
        p_amount: amount,
        p_description: options.description,
        p_expires_in_days: options.expiresInDays || 7,
        p_payment_method: paymentMethod,
        p_bank_name: options.bankName,
        p_custom_bank_name: options.customBankName,
        p_country: options.country,
        p_custom_country: options.customCountry,
        p_digital_wallet: options.digitalWallet,
        p_currency_type: options.currencyType || 'L',
        p_amount_in_original_currency: options.amountInOriginalCurrency || amount,
        p_exchange_rate_applied: options.exchangeRateApplied || 1.0000,
        p_processing_fee_percentage: options.processingFeePercentage,
        p_processing_fee_amount: options.processingFeeAmount,
        p_final_amount_hnld: options.finalAmountHnld || amount,
        p_payment_reference: null,
        p_payment_status: 'pending'
      })

    console.log('📥 Respuesta recibida:', { data, error })

    if (error) {
      console.error('❌ Error creando solicitud de compra:', error)
      console.error('❌ Detalles del error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return { success: false, error: error.message || 'Error creando solicitud de compra' }
    }

    console.log('✅ Respuesta de create_purchase_request:', data)

    if (!data || data.length === 0) {
      console.error('❌ No se devolvió data de la función')
      return { success: false, error: 'No se pudo crear la solicitud' }
    }

    console.log('🎉 Solicitud creada exitosamente:', {
      id: data[0]?.id,
      uniqueCode: data[0]?.unique_code,
      success: data[0]?.success,
      message: data[0]?.message
    })

    console.log('🔍 Información de debugging:', data[0]?.debug_info)

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/saldo')
    return { success: true, requestId: data[0]?.id, uniqueCode: data[0]?.unique_code }
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

// Eliminar permanentemente una solicitud de compra
export async function deletePurchaseRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar que la solicitud pertenece al usuario
    const { data: requestData, error: requestError } = await supabase
      .from('purchase_requests')
      .select('buyer_id, status, expires_at')
      .eq('id', requestId)
      .single()

    if (requestError || !requestData) {
      return { success: false, error: 'Solicitud no encontrada' }
    }

    if (requestData.buyer_id !== user.id) {
      return { success: false, error: 'No tienes permisos para eliminar esta solicitud' }
    }

    // Solo permitir eliminar solicitudes canceladas o expiradas
    const isExpired = new Date(requestData.expires_at) < new Date()
    const canDelete = requestData.status === 'cancelled' || 
                     (requestData.status === 'active' && isExpired) ||
                     requestData.status === 'expired'

    if (!canDelete) {
      return { success: false, error: 'Solo se pueden eliminar solicitudes canceladas o expiradas' }
    }

    // Notificar a vendedores involucrados ANTES de eliminar la solicitud
    // (debe hacerse antes porque después ya no existirá en la BD)
    try {
      console.log('📤 Llamando notify_request_deleted para request:', requestId)
      const { data, error } = await supabase.rpc('notify_request_deleted', {
        p_request_id: requestId,
        p_buyer_id: user.id
      })
      
      if (error) {
        console.error('❌ Error ejecutando notify_request_deleted:', error)
      } else {
        console.log('✅ notify_request_deleted ejecutado:', data)
      }
    } catch (error) {
      console.error('❌ Excepción ejecutando notify_request_deleted:', error)
      // Continuar con la eliminación incluso si falla la notificación
    }

    // Eliminar la solicitud y todas las relaciones (CASCADE)
    const { error: deleteError } = await supabase
      .from('purchase_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) {
      console.error('❌ Error eliminando solicitud:', deleteError)
      return { success: false, error: 'Error eliminando la solicitud' }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/mis-solicitudes')
    
    return { success: true }
  } catch (error) {
    console.error('❌ Error en deletePurchaseRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Cancelar solicitud de compra
export async function cancelPurchaseRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar que la solicitud pertenece al usuario
    const { data: requestData, error: requestError } = await supabase
      .from('purchase_requests')
      .select('buyer_id, status')
      .eq('id', requestId)
      .single()

    if (requestError || !requestData) {
      return { success: false, error: 'Solicitud no encontrada' }
    }

    if (requestData.buyer_id !== user.id) {
      return { success: false, error: 'No tienes permisos para cancelar esta solicitud' }
    }

    // Permitir cancelar solicitudes activas, aceptadas o en negociación (pero no completadas ni ya canceladas)
    if (requestData.status === 'completed') {
      return { success: false, error: 'No se pueden cancelar solicitudes completadas' }
    }
    
    if (requestData.status === 'cancelled') {
      return { success: false, error: 'Esta solicitud ya está cancelada' }
    }

    // Actualizar el estado de la solicitud a 'cancelled'
    // El trigger SQL automáticamente notificará a los vendedores involucrados
    const { error: updateError } = await supabase
      .from('purchase_requests')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('❌ Error cancelando solicitud:', updateError)
      return { success: false, error: 'Error cancelando la solicitud' }
    }

    // Crear notificación para el comprador (confirmación)
    await supabase
      .from('request_notifications')
      .insert({
        user_id: user.id,
        request_id: requestId,
        type: 'request_cancelled',
        title: 'Solicitud Cancelada',
        message: 'Tu solicitud de compra ha sido cancelada exitosamente.'
      })

    // Notificar a vendedores involucrados (esto también se hace automáticamente por el trigger)
    // pero lo hacemos aquí como respaldo
    try {
      console.log('📤 Llamando notify_request_cancelled para request:', requestId)
      const { data, error } = await supabase.rpc('notify_request_cancelled', {
        p_request_id: requestId,
        p_buyer_id: user.id
      })
      
      if (error) {
        console.error('❌ Error ejecutando notify_request_cancelled:', error)
      } else {
        console.log('✅ notify_request_cancelled ejecutado:', data)
      }
    } catch (error) {
      console.error('❌ Excepción ejecutando notify_request_cancelled:', error)
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/mis-solicitudes')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en cancelPurchaseRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Actualizar estado del pago
export async function updatePaymentStatus(
  requestId: string,
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
  paymentReference?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('update_payment_status', {
        p_request_id: requestId,
        p_payment_status: paymentStatus,
        p_payment_reference: paymentReference
      })

    if (error) {
      console.error('❌ Error actualizando estado del pago:', error)
      return { success: false, error: error.message || 'Error actualizando estado del pago' }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/transacciones')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en updatePaymentStatus:', error)
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
        p_description: `Compra de HNLD ${amount.toFixed(2)}. Código: ${transactionId}`
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

// Buscar solicitud por código único
export async function getPurchaseRequestByCode(
  uniqueCode: string
): Promise<{ success: boolean; data?: PurchaseRequest; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_purchase_request_by_code', {
        p_unique_code: uniqueCode
      })

    if (error) {
      console.error('❌ Error obteniendo solicitud por código:', error)
      return { success: false, error: 'Error obteniendo solicitud' }
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Solicitud no encontrada' }
    }

    return { success: true, data: data[0] }
  } catch (error) {
    console.error('❌ Error en getPurchaseRequestByCode:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// =========================================================
// FUNCIONES DE NEGOCIACIÓN DESACTIVADAS
// =========================================================
// DESACTIVADO: Ya no se cambia el estado de las solicitudes durante la negociación

// Iniciar negociación (DESACTIVADO - ya no bloquea la solicitud)
export async function startNegotiation(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  // DESACTIVADO: Esta función ya no cambia el estado de la solicitud
  console.log('⚠️ startNegotiation llamada pero DESACTIVADA - no se cambia el estado')
  return { success: true, error: 'Función desactivada - no se cambia el estado' }
}

// Finalizar negociación sin acuerdo (DESACTIVADO - ya no libera la solicitud)
export async function endNegotiationNoDeal(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  // DESACTIVADO: Esta función ya no cambia el estado de la solicitud
  console.log('⚠️ endNegotiationNoDeal llamada pero DESACTIVADA - no se cambia el estado')
  return { success: true, error: 'Función desactivada - no se cambia el estado' }
}

// Aceptar oferta durante negociación
export async function acceptOfferDuringNegotiation(
  requestId: string,
  negotiatedAmount: number,
  negotiatedTerms?: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    console.log('✅ Aceptando oferta negociada para solicitud:', requestId)
    console.log('💰 Monto negociado:', negotiatedAmount)
    console.log('👤 Usuario:', user.id)

    const { data, error } = await supabase
      .rpc('accept_offer_during_negotiation', {
        p_request_id: requestId,
        p_buyer_id: user.id,
        p_negotiated_amount: negotiatedAmount,
        p_negotiated_terms: negotiatedTerms
      })

    if (error) {
      console.error('❌ Error aceptando oferta negociada:', error)
      return { success: false, error: error.message || 'Error aceptando oferta' }
    }

    console.log('✅ Oferta aceptada exitosamente, transacción:', data)
    
    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/mis-solicitudes')
    revalidatePath('/dashboard/transacciones')
    return { success: true, transactionId: data }
  } catch (error) {
    console.error('❌ Error en acceptOfferDuringNegotiation:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener solicitudes disponibles (excluyendo las en negociación)
export async function getAvailablePurchaseRequests(
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
      .rpc('get_available_purchase_requests', {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo solicitudes disponibles:', error)
      return { success: false, error: 'Error obteniendo solicitudes disponibles' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getAvailablePurchaseRequests:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Limpiar negociaciones expiradas (función administrativa)
export async function cleanupExpiredNegotiations(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data, error } = await supabase
      .rpc('cleanup_expired_negotiations')

    if (error) {
      console.error('❌ Error limpiando negociaciones expiradas:', error)
      return { success: false, error: 'Error limpiando negociaciones expiradas' }
    }

    console.log('🧹 Negociaciones expiradas limpiadas:', data)
    return { success: true, count: data }
  } catch (error) {
    console.error('❌ Error en cleanupExpiredNegotiations:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
