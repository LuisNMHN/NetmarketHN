'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Escrow {
  id: string
  payer_id: string
  payee_id: string
  amount: number
  status: 'pending' | 'locked' | 'released' | 'cancelled' | 'disputed'
  escrow_type: 'p2p_trade' | 'service' | 'auction' | 'guarantee' | 'custom'
  title: string
  description?: string
  terms?: string
  created_at: string
  expires_at?: string
  locked_at?: string
  released_at?: string
  cancelled_at?: string
  dispute_reason?: string
  dispute_created_at?: string
}

export interface EscrowEvent {
  id: string
  event_type: 'created' | 'locked' | 'released' | 'cancelled' | 'disputed' | 'expired' | 'extended'
  old_status?: string
  new_status?: string
  description?: string
  created_at: string
  created_by: string
}

export interface EscrowMessage {
  id: string
  sender_id: string
  message: string
  message_type: 'text' | 'system' | 'dispute' | 'resolution'
  is_public: boolean
  created_at: string
}

// Crear un nuevo Escrow
export async function createEscrow(
  payeeId: string,
  amount: number,
  title: string,
  description?: string,
  terms?: string,
  escrowType: string = 'custom',
  expiresInHours: number = 168
): Promise<{ success: boolean; escrowId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (amount <= 0) {
      return { success: false, error: 'El monto debe ser mayor a 0' }
    }

    if (user.id === payeeId) {
      return { success: false, error: 'No puedes crear un escrow contigo mismo' }
    }

    const { data, error } = await supabase
      .rpc('create_escrow', {
        p_payee_id: payeeId,
        p_amount: amount,
        p_title: title,
        p_description: description,
        p_terms: terms,
        p_escrow_type: escrowType,
        p_expires_in_hours: expiresInHours
      })

    if (error) {
      console.error('❌ Error creando escrow:', error)
      return { success: false, error: error.message || 'Error creando escrow' }
    }

    revalidatePath('/dashboard/transacciones')
    return { success: true, escrowId: data }
  } catch (error) {
    console.error('❌ Error en createEscrow:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Confirmar (lock) un Escrow
export async function lockEscrow(escrowId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('lock_escrow', { p_escrow_id: escrowId })

    if (error) {
      console.error('❌ Error confirmando escrow:', error)
      return { success: false, error: error.message || 'Error confirmando escrow' }
    }

    revalidatePath('/dashboard/transacciones')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en lockEscrow:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Liberar (release) un Escrow
export async function releaseEscrow(escrowId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('release_escrow', { 
        p_escrow_id: escrowId,
        p_reason: reason
      })

    if (error) {
      console.error('❌ Error liberando escrow:', error)
      return { success: false, error: error.message || 'Error liberando escrow' }
    }

    revalidatePath('/dashboard/transacciones')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en releaseEscrow:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Cancelar un Escrow
export async function cancelEscrow(escrowId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('cancel_escrow', { 
        p_escrow_id: escrowId,
        p_reason: reason
      })

    if (error) {
      console.error('❌ Error cancelando escrow:', error)
      return { success: false, error: error.message || 'Error cancelando escrow' }
    }

    revalidatePath('/dashboard/transacciones')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en cancelEscrow:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Disputar un Escrow
export async function disputeEscrow(escrowId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!reason.trim()) {
      return { success: false, error: 'Debes proporcionar una razón para la disputa' }
    }

    const { data, error } = await supabase
      .rpc('dispute_escrow', { 
        p_escrow_id: escrowId,
        p_reason: reason
      })

    if (error) {
      console.error('❌ Error disputando escrow:', error)
      return { success: false, error: error.message || 'Error disputando escrow' }
    }

    revalidatePath('/dashboard/transacciones')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en disputeEscrow:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener escrows del usuario
export async function getUserEscrows(
  status?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: Escrow[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_user_escrows', {
        p_user_id: user.id,
        p_status: status,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo escrows:', error)
      return { success: false, error: 'Error obteniendo escrows' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getUserEscrows:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener eventos de un escrow
export async function getEscrowEvents(escrowId: string): Promise<{ success: boolean; data?: EscrowEvent[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_escrow_events', { p_escrow_id: escrowId })

    if (error) {
      console.error('❌ Error obteniendo eventos del escrow:', error)
      return { success: false, error: 'Error obteniendo eventos' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getEscrowEvents:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener mensajes de un escrow
export async function getEscrowMessages(
  escrowId: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ success: boolean; data?: EscrowMessage[]; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data, error } = await supabase
      .rpc('get_escrow_messages', {
        p_escrow_id: escrowId,
        p_limit: limit,
        p_offset: offset
      })

    if (error) {
      console.error('❌ Error obteniendo mensajes del escrow:', error)
      return { success: false, error: 'Error obteniendo mensajes' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('❌ Error en getEscrowMessages:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Agregar mensaje a un escrow
export async function addEscrowMessage(
  escrowId: string,
  message: string,
  messageType: string = 'text'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!message.trim()) {
      return { success: false, error: 'El mensaje no puede estar vacío' }
    }

    const { data, error } = await supabase
      .rpc('add_escrow_message', {
        p_escrow_id: escrowId,
        p_message: message,
        p_message_type: messageType
      })

    if (error) {
      console.error('❌ Error agregando mensaje al escrow:', error)
      return { success: false, error: error.message || 'Error agregando mensaje' }
    }

    revalidatePath('/dashboard/transacciones')
    return { success: true, messageId: data }
  } catch (error) {
    console.error('❌ Error en addEscrowMessage:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Buscar usuario por email para crear escrow
export async function searchUserForEscrow(email: string): Promise<{ success: boolean; data?: { id: string; email: string; name?: string }; error?: string }> {
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
    console.error('❌ Error en searchUserForEscrow:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
