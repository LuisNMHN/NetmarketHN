'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface HNLDBalance {
  balance: number
  reserved_balance: number
  available_balance: number
}

export interface HNLDTransaction {
  id: string
  transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'fee'
  amount: number
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  description: string
  from_user_id?: string
  to_user_id?: string
  created_at: string
}

export interface LedgerEntry {
  id: string
  transaction_id: string
  entry_type: 'debit' | 'credit'
  account_type: string
  amount: number
  description: string
  reference_type?: string
  created_at: string
}

// Obtener balance de HNLD del usuario
export async function getUserHNLDBalance(): Promise<{ success: boolean; data?: HNLDBalance; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_hnld_balance', { p_user_id: user.id })

    if (error) {
      console.error('❌ Error obteniendo balance HNLD:', error)
      return { success: false, error: 'Error obteniendo balance' }
    }

    if (!data || data.length === 0) {
      // Crear balance inicial si no existe
      await supabase.rpc('create_hnld_balance', { user_id: user.id })
      return { 
        success: true, 
        data: { balance: 0, reserved_balance: 0, available_balance: 0 } 
      }
    }

    return { success: true, data: data[0] }
  } catch (error) {
    console.error('❌ Error en getUserHNLDBalance:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Emitir HNLD (depósito)
export async function emitHNLD(amount: number, description?: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
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
      .rpc('emit_hnld', {
        p_user_id: user.id,
        p_amount: amount,
        p_description: description || `Compra de HNLD ${amount.toFixed(2)}`
      })

    if (error) {
      console.error('❌ Error emitiendo HNLD:', error)
      return { success: false, error: error.message || 'Error emitiendo HNLD' }
    }

    revalidatePath('/dashboard/saldo')
    return { success: true, transactionId: data }
  } catch (error) {
    console.error('❌ Error en emitHNLD:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Quemar HNLD (retiro)
export async function burnHNLD(amount: number, description?: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
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
      .rpc('burn_hnld', {
        p_user_id: user.id,
        p_amount: amount,
        p_description: description || `Venta de HNLD ${amount.toFixed(2)}`
      })

    if (error) {
      console.error('❌ Error quemando HNLD:', error)
      return { success: false, error: error.message || 'Error procesando retiro' }
    }

    revalidatePath('/dashboard/saldo')
    return { success: true, transactionId: data }
  } catch (error) {
    console.error('❌ Error en burnHNLD:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Transferir HNLD a otro usuario
export async function transferHNLD(toUserId: string, amount: number, description?: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (amount <= 0) {
      return { success: false, error: 'El monto debe ser mayor a 0' }
    }

    if (user.id === toUserId) {
      return { success: false, error: 'No puedes transferir a ti mismo' }
    }

    const { data, error } = await supabase
      .rpc('transfer_hnld', {
        p_from_user_id: user.id,
        p_to_user_id: toUserId,
        p_amount: amount,
        p_description: description || `Transferencia de HNLD ${amount.toFixed(2)}`
      })

    if (error) {
      console.error('❌ Error transfiriendo HNLD:', error)
      return { success: false, error: error.message || 'Error procesando transferencia' }
    }

    revalidatePath('/dashboard/saldo')
    return { success: true, transactionId: data }
  } catch (error) {
    console.error('❌ Error en transferHNLD:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener historial de transacciones
export async function getTransactionHistory(limit: number = 50, offset: number = 0): Promise<{ success: boolean; data?: HNLDTransaction[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_transaction_history', {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo historial:', error)
      return { success: false, error: 'Error obteniendo historial' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getTransactionHistory:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener entradas del ledger
export async function getLedgerEntries(limit: number = 100, offset: number = 0): Promise<{ success: boolean; data?: LedgerEntry[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ Error obteniendo ledger:', error)
      return { success: false, error: 'Error obteniendo ledger' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getLedgerEntries:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Buscar usuario por email para transferencias
export async function searchUserByEmail(email: string): Promise<{ success: boolean; data?: { id: string; email: string; name?: string }; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Buscar en profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .neq('id', user.id) // No incluir al usuario actual
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Usuario no encontrado' }
      }
      console.error('❌ Error buscando usuario:', error)
      return { success: false, error: 'Error buscando usuario' }
    }

    return { 
      success: true, 
      data: { 
        id: data.id, 
        email: data.email, 
        name: data.full_name 
      } 
    }
  } catch (error) {
    console.error('❌ Error en searchUserByEmail:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
