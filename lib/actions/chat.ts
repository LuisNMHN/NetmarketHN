"use server"

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Tipos para el sistema de chat
export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  attachment_url?: string
  attachment_type?: string
  attachment_size?: number
  client_message_id?: string
  is_author_deleted: boolean
  created_at: string
  updated_at: string
}

export interface ChatConversation {
  id: string
  solicitud_id: string
  created_at: string
  updated_at: string
}

export interface ChatParticipant {
  conversation_id: string
  user_id: string
  last_read_at: string
  cleared_at?: string
  created_at: string
}

// Crear o obtener conversación
export async function createOrGetChatConversation(
  solicitudId: string,
  targetUserId: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // Verificar que el usuario actual tiene rol 'user'
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', session.user.id)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!userRoles) {
      return { success: false, error: 'Acceso denegado: solo usuarios pueden crear conversaciones' }
    }

    // Verificar que el usuario objetivo tiene rol 'user'
    const { data: targetUserRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', targetUserId)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!targetUserRoles) {
      return { success: false, error: 'El usuario objetivo debe tener rol "user"' }
    }

    // Llamar a la función RPC
    const { data, error } = await supabase.rpc('create_or_get_chat_conversation', {
      p_solicitud_id: solicitudId,
      p_target_user_id: targetUserId
    })

    if (error) {
      console.error('Error creando conversación:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, conversationId: data }
  } catch (error) {
    console.error('Error en createOrGetChatConversation:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

// Enviar mensaje
export async function sendChatMessage(
  conversationId: string,
  body: string,
  attachment?: {
    url: string
    type: string
    size: number
  }
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // Verificar que el usuario tiene rol 'user'
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', session.user.id)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!userRoles) {
      return { success: false, error: 'Acceso denegado: solo usuarios pueden enviar mensajes' }
    }

    // Verificar que el usuario es participante de la conversación
    const { data: participant } = await supabase
      .from('chat_conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', session.user.id)
      .single()

    if (!participant) {
      return { success: false, error: 'No eres participante de esta conversación' }
    }

    // Insertar mensaje
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: session.user.id,
        body,
        attachment_url: attachment?.url,
        attachment_type: attachment?.type,
        attachment_size: attachment?.size,
        client_message_id: crypto.randomUUID()
      })
      .select()
      .single()

    if (error) {
      console.error('Error enviando mensaje:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true, message: data }
  } catch (error) {
    console.error('Error en sendChatMessage:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

// Marcar mensajes como leídos
export async function markChatMessagesRead(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // Verificar que el usuario tiene rol 'user'
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', session.user.id)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!userRoles) {
      return { success: false, error: 'Acceso denegado: solo usuarios pueden marcar mensajes como leídos' }
    }

    // Llamar a la función RPC
    const { error } = await supabase.rpc('mark_chat_messages_read', {
      p_conversation_id: conversationId
    })

    if (error) {
      console.error('Error marcando mensajes como leídos:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error en markChatMessagesRead:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

// Limpiar historial
export async function clearChatHistory(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // Verificar que el usuario tiene rol 'user'
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', session.user.id)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!userRoles) {
      return { success: false, error: 'Acceso denegado: solo usuarios pueden limpiar historial' }
    }

    // Llamar a la función RPC
    const { error } = await supabase.rpc('clear_chat_history', {
      p_conversation_id: conversationId
    })

    if (error) {
      console.error('Error limpiando historial:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error en clearChatHistory:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

// Eliminar mensaje propio
export async function deleteOwnChatMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // Verificar que el usuario tiene rol 'user'
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', session.user.id)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!userRoles) {
      return { success: false, error: 'Acceso denegado: solo usuarios pueden eliminar mensajes' }
    }

    // Llamar a la función RPC
    const { error } = await supabase.rpc('delete_own_chat_message', {
      p_message_id: messageId
    })

    if (error) {
      console.error('Error eliminando mensaje:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error en deleteOwnChatMessage:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

// Obtener conversaciones del usuario
export async function getUserChatConversations(): Promise<{
  success: boolean
  conversations?: any[]
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // Verificar que el usuario tiene rol 'user'
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', session.user.id)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!userRoles) {
      return { success: false, error: 'Acceso denegado: solo usuarios pueden ver conversaciones' }
    }

    // Obtener conversaciones del usuario
    const { data, error } = await supabase
      .from('chat_conversation_participants')
      .select(`
        conversation_id,
        last_read_at,
        cleared_at,
        created_at,
        chat_conversations!inner(
          id,
          solicitud_id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo conversaciones:', error)
      return { success: false, error: error.message }
    }

    return { success: true, conversations: data }
  } catch (error) {
    console.error('Error en getUserChatConversations:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}

// Obtener mensajes de una conversación
export async function getChatMessages(
  conversationId: string
): Promise<{
  success: boolean
  messages?: ChatMessage[]
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // Verificar que el usuario tiene rol 'user'
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', session.user.id)
      .eq('roles.name', 'user')
      .maybeSingle()

    if (!userRoles) {
      return { success: false, error: 'Acceso denegado: solo usuarios pueden ver mensajes' }
    }

    // Verificar que el usuario es participante de la conversación
    const { data: participant } = await supabase
      .from('chat_conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', session.user.id)
      .single()

    if (!participant) {
      return { success: false, error: 'No eres participante de esta conversación' }
    }

    // Obtener mensajes
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error obteniendo mensajes:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messages: data }
  } catch (error) {
    console.error('Error en getChatMessages:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}
