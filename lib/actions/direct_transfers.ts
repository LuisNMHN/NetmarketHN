'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DirectTransfer {
  id: string
  from_user_id: string
  to_user_id: string
  amount: number
  description?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  unique_code?: string
  processed_at?: string
  created_at: string
  updated_at: string
  from_user_name?: string
  to_user_name?: string
  is_sent?: boolean
  hnld_transaction_id?: string
}

// Crear transferencia directa
export async function createDirectTransfer(
  toUserId: string,
  amount: number,
  description?: string
): Promise<{ success: boolean; transferId?: string; uniqueCode?: string; error?: string }> {
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
      return { success: false, error: 'No puedes transferir HNLD a ti mismo' }
    }

    const { data, error } = await supabase
      .rpc('create_direct_transfer', {
        p_to_user_id: toUserId,
        p_amount: amount,
        p_description: description || null
      })

    if (error) {
      console.error('❌ Error creando transferencia directa:', error)
      return { success: false, error: error.message || 'Error procesando transferencia' }
    }

    if (!data || !data.success) {
      return { success: false, error: 'Error procesando transferencia' }
    }

    revalidatePath('/dashboard/transferencias')
    revalidatePath('/dashboard')

    return {
      success: true,
      transferId: data.transfer_id,
      uniqueCode: data.unique_code
    }
  } catch (error: any) {
    console.error('❌ Error en createDirectTransfer:', error)
    return { success: false, error: error.message || 'Error inesperado' }
  }
}

// Obtener transferencias del usuario
export async function getUserDirectTransfers(
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: DirectTransfer[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_transfers', {
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo transferencias:', error)
      return { success: false, error: error.message || 'Error obteniendo transferencias' }
    }

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('❌ Error en getUserDirectTransfers:', error)
    return { success: false, error: error.message || 'Error inesperado' }
  }
}

// Buscar usuario por email directamente
export async function findUserByEmail(
  email: string
): Promise<{ success: boolean; data?: { id: string; email: string; full_name?: string }; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!email || !email.includes('@')) {
      return { success: false, error: 'Email inválido' }
    }

    // Buscar usuario por email en profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase().trim())
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
        email: data.email || email,
        full_name: data.full_name || undefined
      } 
    }
  } catch (error: any) {
    console.error('❌ Error en findUserByEmail:', error)
    return { success: false, error: error.message || 'Error inesperado' }
  }
}

// Buscar usuario por email o nombre para transferencias (mantener para compatibilidad)
export async function searchUserForTransfer(
  query: string
): Promise<{ success: boolean; data?: Array<{ id: string; email: string; full_name?: string }>; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!query || query.length < 2) {
      return { success: true, data: [] }
    }

    // Usar función RPC para buscar usuarios
    const { data, error } = await supabase
      .rpc('search_users_for_transfer', {
        p_query: query
      })

    if (error) {
      console.error('❌ Error buscando usuarios:', error)
      return { success: false, error: 'Error buscando usuarios' }
    }

    const results = (data || []).map(user => ({
      id: user.id,
      email: user.email || '',
      full_name: user.full_name || undefined
    }))

    return { success: true, data: results }
  } catch (error: any) {
    console.error('❌ Error en searchUserForTransfer:', error)
    return { success: false, error: error.message || 'Error inesperado' }
  }
}

