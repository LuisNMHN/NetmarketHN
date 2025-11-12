'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SaleRequest {
  id: string
  seller_id: string
  amount: number // Monto en HNLD que se quiere vender
  description?: string
  status: 'active' | 'negotiating' | 'accepted' | 'completed' | 'cancelled' | 'expired'
  buyer_id?: string
  accepted_at?: string
  terms?: string
  exchange_rate: number
  expires_at: string
  created_at: string
  updated_at: string
  seller_name?: string
  seller_email?: string
  unique_code?: string
  // Campos del modal
  payment_method?: 'local_transfer' | 'international_transfer' | 'card' | 'digital_balance' | 'cash'
  bank_name?: string
  custom_bank_name?: string
  country?: string
  custom_country?: string
  digital_wallet?: 'PayPal' | 'Skrill' | 'Payoneer'
  currency_type?: 'L' | 'USD' | 'EUR'
  amount_in_original_currency?: number // Monto en moneda física que quiere recibir
  exchange_rate_applied?: number
  processing_fee_percentage?: number
  processing_fee_amount?: number
  final_amount_hnld?: number // Monto en HNLD que se venderá
  payment_reference?: string
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
}

export interface SaleTransaction {
  id: string
  request_id: string
  seller_id: string
  buyer_id: string
  amount: number // Monto en moneda física que recibirá el vendedor
  currency: string
  exchange_rate: number
  hnld_amount: number // Monto en HNLD que se vende
  status: 'pending' | 'agreement_confirmed' | 'payment_in_progress' | 'payment_verified' | 'hnld_released' | 'completed' | 'cancelled' | 'disputed'
  payment_method?: string
  payment_details?: any
  escrow_amount?: number // HNLD bloqueados
  escrow_status?: 'protected' | 'released' | 'refunded'
  payment_proof_url?: string
  payment_proof_uploaded_at?: string
  payment_verified_at?: string
  hnld_released_at?: string
  created_at: string
  updated_at: string
}

// Crear solicitud de venta
export async function createSaleRequest(
  amount: number, // Monto en HNLD que se quiere vender
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
    amountInOriginalCurrency?: number // Monto en moneda física que quiere recibir
    exchangeRateApplied?: number
    processingFeePercentage?: number
    processingFeeAmount?: number
    finalAmountHnld?: number
  } = {}
): Promise<{ success: boolean; requestId?: string; uniqueCode?: string; error?: string }> {
  try {
    console.log('🚀 INICIANDO createSaleRequest')
    console.log('📊 Parámetros recibidos:', { amount, paymentMethod, options })
    
    const supabase = await supabaseServer()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (amount <= 0) {
      return { success: false, error: 'El monto debe ser mayor a 0' }
    }

    // Validar que el usuario tenga suficiente saldo HNLD
    const { data: balanceData, error: balanceError } = await supabase
      .from('hnld_balance')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (balanceError || !balanceData) {
      return { success: false, error: 'Error al verificar saldo HNLD' }
    }

    const finalAmountHnld = options.finalAmountHnld || amount
    if (balanceData.balance < finalAmountHnld) {
      return { success: false, error: `Saldo insuficiente. Tienes L. ${balanceData.balance.toFixed(2)} HNLD y necesitas L. ${finalAmountHnld.toFixed(2)} HNLD` }
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
        p_final_amount_hnld: finalAmountHnld,
        p_payment_reference: null,
        p_payment_status: 'pending'
      })

    if (error) {
      console.error('❌ Error creando solicitud de venta:', error)
      return { success: false, error: error.message || 'Error creando solicitud de venta' }
    }

    if (!data || data.length === 0 || !data[0]?.success) {
      return { success: false, error: data[0]?.message || 'No se pudo crear la solicitud' }
    }

    revalidatePath('/dashboard/ventas')
    revalidatePath('/dashboard/mis-ventas')
    revalidatePath('/dashboard/saldo')
    return { success: true, requestId: data[0]?.id, uniqueCode: data[0]?.unique_code }
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
        p_user_id: user.id
      })

    if (error) {
      console.error('❌ Error obteniendo solicitudes de venta activas:', error)
      return { success: false, error: 'Error obteniendo solicitudes de venta activas' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getActiveSaleRequests:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener solicitudes de venta del usuario
export async function getUserSaleRequests(
  status?: string
): Promise<{ success: boolean; data?: SaleRequest[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_sale_requests', {
        p_user_id: user.id
      })

    if (error) {
      console.error('❌ Error obteniendo solicitudes de venta del usuario:', error)
      return { success: false, error: 'Error obteniendo solicitudes de venta' }
    }

    // Filtrar por status si se proporciona
    let filteredData = data || []
    if (status) {
      filteredData = filteredData.filter((req: SaleRequest) => req.status === status)
    }

    return { success: true, data: filteredData }
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

    const { data, error } = await supabase
      .rpc('cancel_sale_request', {
        p_request_id: requestId,
        p_user_id: user.id
      })

    if (error) {
      console.error('❌ Error cancelando solicitud de venta:', error)
      return { success: false, error: 'Error cancelando solicitud de venta' }
    }

    if (!data) {
      return { success: false, error: 'No se pudo cancelar la solicitud' }
    }

    revalidatePath('/dashboard/ventas')
    revalidatePath('/dashboard/mis-ventas')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en cancelSaleRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Aceptar solicitud de venta (crear transacción)
export async function acceptSaleRequest(
  requestId: string
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
        p_buyer_id: user.id
      })

    if (error) {
      console.error('❌ Error aceptando solicitud de venta:', error)
      return { success: false, error: error.message || 'Error aceptando solicitud de venta' }
    }

    if (!data || data.length === 0 || !data[0]?.success) {
      return { success: false, error: data[0]?.message || 'No se pudo aceptar la solicitud' }
    }

    revalidatePath('/dashboard/ventas')
    revalidatePath('/dashboard/mis-ventas')
    return { success: true, transactionId: data[0]?.transaction_id }
  } catch (error) {
    console.error('❌ Error en acceptSaleRequest:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener solicitud de venta por código
export async function getSaleRequestByCode(
  code: string
): Promise<{ success: boolean; data?: SaleRequest; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data, error } = await supabase
      .from('sale_requests')
      .select('*')
      .eq('unique_code', code)
      .maybeSingle()

    if (error) {
      console.error('❌ Error obteniendo solicitud de venta por código:', error)
      return { success: false, error: 'Error obteniendo solicitud de venta' }
    }

    if (!data) {
      return { success: false, error: 'Solicitud de venta no encontrada' }
    }

    return { success: true, data }
  } catch (error) {
    console.error('❌ Error en getSaleRequestByCode:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

