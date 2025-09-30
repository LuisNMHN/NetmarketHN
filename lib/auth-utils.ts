import { supabaseBrowser } from '@/lib/supabase/client'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Verifica si un usuario tiene un perfil válido en la base de datos
 * @param userId - ID del usuario a verificar
 * @returns Promise<boolean> - true si el usuario tiene perfil, false si no
 */
export async function hasUserProfile(userId: string): Promise<boolean> {
  try {
    const supabase = supabaseBrowser()
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error verificando perfil de usuario:', error)
      return false
    }

    return !!profile
  } catch (error) {
    console.error('Error en hasUserProfile:', error)
    return false
  }
}

/**
 * Verifica si un usuario tiene un perfil válido en la base de datos (versión servidor)
 * @param userId - ID del usuario a verificar
 * @returns Promise<boolean> - true si el usuario tiene perfil, false si no
 */
export async function hasUserProfileServer(userId: string): Promise<boolean> {
  try {
    const supabase = await supabaseServer()
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error verificando perfil de usuario (servidor):', error)
      return false
    }

    return !!profile
  } catch (error) {
    console.error('Error en hasUserProfileServer:', error)
    return false
  }
}

/**
 * Obtiene información completa del perfil de usuario
 * @param userId - ID del usuario
 * @returns Promise con datos del perfil o null si no existe
 */
export async function getUserProfile(userId: string) {
  try {
    const supabase = supabaseBrowser()
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error obteniendo perfil de usuario:', error)
      return null
    }

    return profile
  } catch (error) {
    console.error('Error en getUserProfile:', error)
    return null
  }
}

/**
 * Cierra la sesión del usuario y redirige al login
 * @param reason - Razón del cierre de sesión (opcional)
 */
export async function forceLogout(reason?: string) {
  try {
    const supabase = supabaseBrowser()
    
    if (reason) {
      console.warn('🔒 Forzando cierre de sesión:', reason)
    }
    
    await supabase.auth.signOut()
    window.location.href = '/login'
  } catch (error) {
    console.error('Error cerrando sesión:', error)
    // Forzar redirección incluso si hay error
    window.location.href = '/login'
  }
}
