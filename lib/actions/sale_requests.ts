'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SaleRequest {
  id: string
  seller_id: string
  amount: number
  final_amount_hnld: number
  description?: string
  status: 'active' | 'negotiating' | 'accepted' | 'completed' | 'cancelled' | 'expired'
  buyer_id?: string
  accepted_at?: string
  payment_method: 'local_transfer' | 'international_transfer' | 'card' | 'digital_balance' | 'cash'
  bank_name?: string
  custom_bank_name?: string
  country?: string
  custom_country?: string
  digital_wallet?: 'PayPal' | 'Skrill' | 'Payoneer'
  currency_type: 'L' | 'USD' | 'EUR'
  amount_in_original_currency?: number
  exchange_rate_applied?: number
  unique_code?: string
  expires_at: string
  created_at: string
  updated_at: string
  seller_name?: string
  seller_email?: string
}

export interface SaleTransaction {
  id: string
  request_id: string
  seller_id: string
  buyer_id: string
  amount: number
  currency: string
  final_amount_hnld: number
  payment_method: string
  status: 'pending' | 'agreement_confirmed' | 'payment_in_progress' | 'payment_verified' | 'hnld_released' | 'completed' | 'cancelled' | 'disputed'
  escrow_amount?: number
  escrow_status?: 'protected' | 'released' | 'refunded'
  payment_deadline?: string
  verification_deadline?: string
  payment_proof_url?: string
  payment_verified_at?: string
  hnld_released_at?: string
  created_at: string
  updated_at: string
  seller_name?: string
  buyer_name?: string
  unique_code?: string
}

// Crear solicitud de venta
export async function createSaleRequest(
  amount: number, // Cantidad de HNLD a vender
  paymentMethod: 'local_transfer' | 'international_transfer' | 'card' | 'digital_balance' | 'cash',
  options: {
    description?: string
    expiresInDays?: number
    bankName?: string
    customBankName?: string
    country?: string
    customCountry?: string
    digitalWallet?: 'PayPal' | 'Skrill' | 'Payoneer'
    currencyType?: 'L' | 'USD' | 'EUR'
    amountInOriginalCurrency?: number
    exchangeRateApplied?: number
    finalAmountHnld?: number
  } = {}
): Promise<{ success: boolean; requestId?: string; uniqueCode?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
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

    const { data, error } = await supabase
      .rpc('create_sale_request', {
        p_seller_id: user.id,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_description: options.description,
        p_expires_in_days: options.expiresInDays || 7,
        p_bank_name: options.bankName,
        p_custom_bank_name: options.customBankName,
        p_country: options.country,
        p_custom_country: options.customCountry,
        p_digital_wallet: options.digitalWallet,
        p_currency_type: options.currencyType || 'L',
        p_amount_in_original_currency: options.amountInOriginalCurrency,
        p_exchange_rate_applied: options.exchangeRateApplied || 1.0000,
        p_final_amount_hnld: options.finalAmountHnld || amount
      })

    if (error) {
      console.error('❌ Error creando solicitud de venta:', error)
      return { success: false, error: error.message || 'Error creando solicitud de venta' }
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No se pudo crear la solicitud' }
    }

    revalidatePath('/dashboard/ventas')
    revalidatePath('/dashboard/mis-ventas')
    revalidatePath('/dashboard/saldo')
    return { success: true, requestId: data[0]?.request_id, uniqueCode: data[0]?.unique_code }
  } catch (error) {
    console.error('❌ Error en createSaleRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener solicitudes de venta activas (para compradores)
export async function getActiveSaleRequests(
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: SaleRequest[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_active_sale_requests', {
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo solicitudes de venta activas:', error)
      console.error('❌ Detalles del error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return { success: false, error: error.message || 'Error obteniendo solicitudes de venta activas' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getActiveSaleRequests:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener solicitudes de venta del usuario
export async function getUserSaleRequests(
  status?: 'active' | 'negotiating' | 'accepted' | 'completed' | 'cancelled' | 'expired',
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: SaleRequest[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_sale_requests', {
        p_user_id: user.id,
        p_status: status || null,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo solicitudes de venta del usuario:', error)
      return { success: false, error: 'Error obteniendo solicitudes de venta' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getUserSaleRequests:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Cancelar solicitud de venta
export async function cancelSaleRequest(
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
      .from('sale_requests')
      .select('seller_id, status')
      .eq('id', requestId)
      .single()

    if (requestError || !requestData) {
      return { success: false, error: 'Solicitud no encontrada' }
    }

    if (requestData.seller_id !== user.id) {
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
    // El trigger SQL automáticamente notificará a los compradores involucrados
    // IMPORTANTE: Usar NOW() en lugar de toISOString() para asegurar que el trigger detecte el cambio
    const { error: updateError } = await supabase
      .from('sale_requests')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select() // Seleccionar para forzar que se ejecute el trigger

    if (updateError) {
      console.error('❌ Error cancelando solicitud:', updateError)
      return { success: false, error: 'Error cancelando la solicitud' }
    }

    // Notificar a compradores involucrados (esto también se hace automáticamente por el trigger)
    // pero lo hacemos aquí como respaldo
    try {
      console.log('📤 Llamando notify_sale_request_cancelled para request:', requestId)
      const { data, error } = await supabase.rpc('notify_sale_request_cancelled', {
        p_request_id: requestId,
        p_seller_id: user.id
      })
      
      if (error) {
        console.error('❌ Error ejecutando notify_sale_request_cancelled:', error)
      } else {
        console.log('✅ notify_sale_request_cancelled ejecutado:', data)
      }
    } catch (error) {
      console.error('❌ Excepción ejecutando notify_sale_request_cancelled:', error)
    }

    revalidatePath('/dashboard/mis-ventas')
    revalidatePath('/dashboard/ventas')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en cancelSaleRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Eliminar solicitud de venta
export async function deleteSaleRequest(
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
      .from('sale_requests')
      .select('seller_id, status, expires_at')
      .eq('id', requestId)
      .single()

    if (requestError || !requestData) {
      return { success: false, error: 'Solicitud no encontrada' }
    }

    if (requestData.seller_id !== user.id) {
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

    // Eliminar la solicitud y todas las relaciones (CASCADE)
    const { error: deleteError } = await supabase
      .from('sale_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) {
      console.error('❌ Error eliminando solicitud:', deleteError)
      return { success: false, error: 'Error eliminando la solicitud' }
    }

    revalidatePath('/dashboard/mis-ventas')
    revalidatePath('/dashboard/ventas')
    
    return { success: true }
  } catch (error) {
    console.error('❌ Error en deleteSaleRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Aceptar solicitud de venta (crear transacción)
export async function acceptSaleRequest(
  requestId: string,
  paymentMethod: string,
  paymentDetails?: any
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('accept_sale_request', {
        p_request_id: requestId,
        p_buyer_id: user.id,
        p_payment_method: paymentMethod,
        p_payment_details: paymentDetails || null
      })

    if (error) {
      console.error('❌ Error aceptando solicitud de venta:', error)
      return { success: false, error: error.message || 'Error aceptando solicitud de venta' }
    }

    revalidatePath('/dashboard/ventas')
    revalidatePath('/dashboard/mis-ventas')
    // La función RPC devuelve un UUID directamente
    return { success: true, transactionId: data as string }
  } catch (error) {
    console.error('❌ Error en acceptSaleRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener transacción de venta
export async function getSaleTransaction(
  transactionId: string
): Promise<{ success: boolean; data?: SaleTransaction; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_sale_transaction', {
        p_transaction_id: transactionId
      })

    if (error) {
      console.error('❌ Error obteniendo transacción de venta:', error)
      return { success: false, error: 'Error obteniendo transacción de venta' }
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Transacción no encontrada' }
    }

    return { success: true, data: data[0] }
  } catch (error) {
    console.error('❌ Error en getSaleTransaction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Bloquear HNLD en escrow (vendedor acepta trato)
export async function lockHnldInEscrowSale(
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { error } = await supabase
      .rpc('lock_hnld_in_escrow_sale', {
        p_transaction_id: transactionId
      })

    if (error) {
      console.error('❌ Error bloqueando HNLD en escrow:', error)
      return { success: false, error: error.message || 'Error bloqueando HNLD en escrow' }
    }

    revalidatePath('/dashboard/mis-ventas')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en lockHnldInEscrowSale:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Debitar HNLD del vendedor y acreditar al comprador
export async function debitHnldFromSeller(
  transactionId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('debit_hnld_from_seller', {
        p_transaction_id: transactionId
      })

    if (error) {
      console.error('❌ Error debitando HNLD:', error)
      return { success: false, error: error.message || 'Error debitando HNLD' }
    }

    revalidatePath('/dashboard/mis-ventas')
    revalidatePath('/dashboard/saldo')
    return { success: true, transactionId: data }
  } catch (error) {
    console.error('❌ Error en debitHnldFromSeller:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Marcar transacción de venta como completada
export async function markSaleRequestCompleted(
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { error } = await supabase
      .rpc('mark_sale_request_completed', {
        p_transaction_id: transactionId
      })

    if (error) {
      console.error('❌ Error completando transacción de venta:', error)
      return { success: false, error: error.message || 'Error completando transacción de venta' }
    }

    revalidatePath('/dashboard/mis-ventas')
    revalidatePath('/dashboard/ventas')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en markSaleRequestCompleted:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

