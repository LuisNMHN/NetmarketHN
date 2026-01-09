'use server'

import { supabaseServer } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// =========================================================
// TIPOS
// =========================================================

export interface MarketCreatorPermission {
  id: string
  user_id: string
  user_name?: string
  user_email?: string
  is_active: boolean
  max_active_markets: number
  max_daily_markets: number
  total_markets_created: number
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface CreatePermissionData {
  user_id: string
  max_active_markets?: number
  max_daily_markets?: number
  expires_at?: string
}

export interface UpdatePermissionData {
  is_active?: boolean
  max_active_markets?: number
  max_daily_markets?: number
  expires_at?: string
}

// =========================================================
// FUNCIONES DE ADMINISTRACIÓN
// =========================================================

/**
 * Obtener todos los permisos de creadores de mercados
 */
export async function getAllCreatorPermissions(): Promise<{
  success: boolean
  data?: MarketCreatorPermission[]
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    const { data: permissions, error } = await supabase
      .from('market_creator_permissions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error obteniendo permisos:', error)
      return { success: false, error: error.message }
    }
    
    // Obtener información de usuarios
    const userIds = permissions?.map(p => p.user_id).filter((id, index, self) => self.indexOf(id) === index) || []
    let userInfo: Record<string, { name: string; email: string }> = {}
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)
      
      if (profiles) {
        userInfo = profiles.reduce((acc, profile) => {
          acc[profile.id] = {
            name: profile.full_name || 'Usuario',
            email: profile.email || ''
          }
          return acc
        }, {} as Record<string, { name: string; email: string }>)
      }
    }
    
    const formattedPermissions: MarketCreatorPermission[] = permissions?.map(p => ({
      ...p,
      user_name: userInfo[p.user_id]?.name || 'Usuario',
      user_email: userInfo[p.user_id]?.email || ''
    })) || []
    
    return { success: true, data: formattedPermissions }
  } catch (error) {
    console.error('Error en getAllCreatorPermissions:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener permisos de un usuario específico
 */
export async function getUserCreatorPermission(userId: string): Promise<{
  success: boolean
  data?: MarketCreatorPermission
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    const { data: permission, error } = await supabase
      .from('market_creator_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) {
      console.error('Error obteniendo permiso:', error)
      return { success: false, error: error.message }
    }
    
    if (!permission) {
      return { success: true, data: undefined }
    }
    
    // Obtener información del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()
    
    return {
      success: true,
      data: {
        ...permission,
        user_name: profile?.full_name || 'Usuario',
        user_email: profile?.email || ''
      }
    }
  } catch (error) {
    console.error('Error en getUserCreatorPermission:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Crear o actualizar permisos de creador de mercados
 */
export async function grantCreatorPermission(data: CreatePermissionData): Promise<{
  success: boolean
  permissionId?: string
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Verificar si ya existe un permiso para este usuario
    const { data: existing } = await supabase
      .from('market_creator_permissions')
      .select('id')
      .eq('user_id', data.user_id)
      .maybeSingle()
    
    if (existing) {
      // Actualizar permiso existente
      const { data: updated, error } = await supabase
        .from('market_creator_permissions')
        .update({
          is_active: true,
          max_active_markets: data.max_active_markets || 10,
          max_daily_markets: data.max_daily_markets || 5,
          expires_at: data.expires_at || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select('id')
        .single()
      
      if (error) {
        console.error('Error actualizando permiso:', error)
        return { success: false, error: error.message }
      }
      
      revalidatePath('/admin/prediction-markets/permissions')
      return { success: true, permissionId: updated.id }
    } else {
      // Crear nuevo permiso
      const { data: created, error } = await supabase
        .from('market_creator_permissions')
        .insert({
          user_id: data.user_id,
          is_active: true,
          max_active_markets: data.max_active_markets || 10,
          max_daily_markets: data.max_daily_markets || 5,
          expires_at: data.expires_at || null
        })
        .select('id')
        .single()
      
      if (error) {
        console.error('Error creando permiso:', error)
        return { success: false, error: error.message }
      }
      
      revalidatePath('/admin/prediction-markets/permissions')
      return { success: true, permissionId: created.id }
    }
  } catch (error) {
    console.error('Error en grantCreatorPermission:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Actualizar permisos existentes
 */
export async function updateCreatorPermission(
  permissionId: string,
  data: UpdatePermissionData
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    const { error } = await supabase
      .from('market_creator_permissions')
      .update({
        is_active: data.is_active,
        max_active_markets: data.max_active_markets,
        max_daily_markets: data.max_daily_markets,
        expires_at: data.expires_at || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', permissionId)
    
    if (error) {
      console.error('Error actualizando permiso:', error)
      return { success: false, error: error.message }
    }
    
    revalidatePath('/admin/prediction-markets/permissions')
    return { success: true }
  } catch (error) {
    console.error('Error en updateCreatorPermission:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Revocar permisos (desactivar)
 */
export async function revokeCreatorPermission(permissionId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    const { error } = await supabase
      .from('market_creator_permissions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', permissionId)
    
    if (error) {
      console.error('Error revocando permiso:', error)
      return { success: false, error: error.message }
    }
    
    revalidatePath('/admin/prediction-markets/permissions')
    return { success: true }
  } catch (error) {
    console.error('Error en revokeCreatorPermission:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Eliminar permisos permanentemente
 */
export async function deleteCreatorPermission(permissionId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    const { error } = await supabase
      .from('market_creator_permissions')
      .delete()
      .eq('id', permissionId)
    
    if (error) {
      console.error('Error eliminando permiso:', error)
      return { success: false, error: error.message }
    }
    
    revalidatePath('/admin/prediction-markets/permissions')
    return { success: true }
  } catch (error) {
    console.error('Error en deleteCreatorPermission:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

