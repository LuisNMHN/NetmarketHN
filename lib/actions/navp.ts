'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface NAVPOID {
  id: string
  oid_code: string
  oid_name: string
  oid_type: 'bank' | 'fintech' | 'merchant' | 'individual'
  owner_id: string
  is_active: boolean
  created_at: string
}

export interface NAVPSTC {
  id: string
  stc_code: string
  stc_name: string
  stc_type: 'payment' | 'transfer' | 'withdrawal' | 'deposit' | 'refund'
  description: string
  is_active: boolean
}

export interface NAVPPayment {
  id: string
  payment_code: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'
  description?: string
  created_at: string
  expires_at?: string
  completed_at?: string
  qr_code_data?: string
  payment_link?: string
  payer_id?: string
  payee_id: string
}

export interface NAVPOCRScan {
  id: string
  payment_id: string
  scan_type: 'qr' | 'text' | 'image'
  scan_data: string
  extracted_data?: any
  confidence_score?: number
  created_at: string
}

export interface NAVPValidation {
  id: string
  payment_id: string
  validation_type: 'oid_check' | 'stc_check' | 'amount_check' | 'expiry_check' | 'ocr_validation'
  validation_result: boolean
  validation_message?: string
  created_at: string
}

// Crear OID
export async function createNAVPOID(
  oidCode: string,
  oidName: string,
  oidType: string
): Promise<{ success: boolean; oidId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!oidCode || !oidName || !oidType) {
      return { success: false, error: 'Todos los campos son requeridos' }
    }

    const { data, error } = await supabase
      .rpc('create_navp_oid', {
        p_oid_code: oidCode,
        p_oid_name: oidName,
        p_oid_type: oidType
      })

    if (error) {
      console.error('❌ Error creando OID:', error)
      return { success: false, error: error.message || 'Error creando OID' }
    }

    revalidatePath('/dashboard/pagos')
    return { success: true, oidId: data }
  } catch (error) {
    console.error('❌ Error en createNAVPOID:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Crear pago NAVP
export async function createNAVPPayment(
  oidId: string,
  stcId: string,
  amount: number,
  currency: string = 'HNLD',
  description?: string,
  payeeId?: string,
  expiresInHours: number = 24
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
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
      .rpc('create_navp_payment', {
        p_oid_id: oidId,
        p_stc_id: stcId,
        p_amount: amount,
        p_currency: currency,
        p_description: description,
        p_payee_id: payeeId,
        p_expires_in_hours: expiresInHours
      })

    if (error) {
      console.error('❌ Error creando pago NAVP:', error)
      return { success: false, error: error.message || 'Error creando pago' }
    }

    revalidatePath('/dashboard/pagos')
    return { success: true, paymentId: data }
  } catch (error) {
    console.error('❌ Error en createNAVPPayment:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Procesar escaneo OCR
export async function processOCRScan(
  paymentId: string,
  scanType: string,
  scanData: string,
  extractedData?: any,
  confidenceScore?: number
): Promise<{ success: boolean; scanId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!paymentId || !scanType || !scanData) {
      return { success: false, error: 'Datos de escaneo requeridos' }
    }

    const { data, error } = await supabase
      .rpc('process_ocr_scan', {
        p_payment_id: paymentId,
        p_scan_type: scanType,
        p_scan_data: scanData,
        p_extracted_data: extractedData,
        p_confidence_score: confidenceScore
      })

    if (error) {
      console.error('❌ Error procesando escaneo OCR:', error)
      return { success: false, error: error.message || 'Error procesando escaneo' }
    }

    revalidatePath('/dashboard/pagos')
    return { success: true, scanId: data }
  } catch (error) {
    console.error('❌ Error en processOCRScan:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Validar pago NAVP
export async function validateNAVPPayment(
  paymentId: string,
  validationType: string,
  validationResult: boolean,
  validationMessage?: string
): Promise<{ success: boolean; validationId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!paymentId || !validationType) {
      return { success: false, error: 'Datos de validación requeridos' }
    }

    const { data, error } = await supabase
      .rpc('validate_navp_payment', {
        p_payment_id: paymentId,
        p_validation_type: validationType,
        p_validation_result: validationResult,
        p_validation_message: validationMessage
      })

    if (error) {
      console.error('❌ Error validando pago NAVP:', error)
      return { success: false, error: error.message || 'Error validando pago' }
    }

    revalidatePath('/dashboard/pagos')
    return { success: true, validationId: data }
  } catch (error) {
    console.error('❌ Error en validateNAVPPayment:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Completar pago NAVP
export async function completeNAVPPayment(
  paymentId: string,
  payerId?: string,
  payerEmail?: string,
  payerPhone?: string,
  externalTransactionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!paymentId) {
      return { success: false, error: 'ID de pago requerido' }
    }

    const { data, error } = await supabase
      .rpc('complete_navp_payment', {
        p_payment_id: paymentId,
        p_payer_id: payerId,
        p_payer_email: payerEmail,
        p_payer_phone: payerPhone,
        p_external_transaction_id: externalTransactionId
      })

    if (error) {
      console.error('❌ Error completando pago NAVP:', error)
      return { success: false, error: error.message || 'Error completando pago' }
    }

    revalidatePath('/dashboard/pagos')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en completeNAVPPayment:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener pagos del usuario
export async function getUserNAVPPayments(
  status?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: NAVPPayment[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_navp_payments', {
        p_user_id: user.id,
        p_status: status,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo pagos NAVP:', error)
      return { success: false, error: 'Error obteniendo pagos' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getUserNAVPPayments:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener OIDs del usuario
export async function getUserOIDs(): Promise<{ success: boolean; data?: NAVPOID[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .from('navp_oids')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo OIDs:', error)
      return { success: false, error: 'Error obteniendo OIDs' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getUserOIDs:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener STCs disponibles
export async function getAvailableSTCs(): Promise<{ success: boolean; data?: NAVPSTC[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data, error } = await supabase
      .from('navp_stcs')
      .select('*')
      .eq('is_active', true)
      .order('stc_code')

    if (error) {
      console.error('❌ Error obteniendo STCs:', error)
      return { success: false, error: 'Error obteniendo STCs' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getAvailableSTCs:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener pago por código
export async function getPaymentByCode(paymentCode: string): Promise<{ success: boolean; data?: NAVPPayment; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data, error } = await supabase
      .from('navp_payments')
      .select('*')
      .eq('payment_code', paymentCode)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Pago no encontrado' }
      }
      console.error('❌ Error obteniendo pago:', error)
      return { success: false, error: 'Error obteniendo pago' }
    }

    return { success: true, data }
  } catch (error) {
    console.error('❌ Error en getPaymentByCode:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

