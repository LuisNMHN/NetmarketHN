'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UserProfileData {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  phone?: string
  bio?: string
  location?: string
  website?: string
  twitter?: string
  linkedin?: string
  github?: string
  created_at: string
  updated_at: string
  preferences?: {
    theme?: 'light' | 'dark' | 'system'
    language?: string
    notifications?: {
      email?: boolean
      push?: boolean
      marketing?: boolean
    }
  }
}

// Obtener datos del perfil del usuario
export async function getUserProfileData(): Promise<{ success: boolean; data?: UserProfileData; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener datos del perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('❌ Error obteniendo perfil:', profileError)
      return { success: false, error: 'Error obteniendo datos del perfil' }
    }

    // Combinar datos del usuario y perfil
    const userProfileData: UserProfileData = {
      id: user.id,
      email: user.email || '',
      full_name: profile?.full_name || '',
      avatar_url: profile?.avatar_url || '',
      phone: profile?.phone || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      website: profile?.website || '',
      twitter: profile?.twitter || '',
      linkedin: profile?.linkedin || '',
      github: profile?.github || '',
      created_at: profile?.created_at || user.created_at,
      updated_at: profile?.updated_at || new Date().toISOString(),
      preferences: profile?.preferences || {
        theme: 'system',
        language: 'es',
        notifications: {
          email: true,
          push: true,
          marketing: false
        }
      }
    }

    return { success: true, data: userProfileData }
  } catch (error) {
    console.error('❌ Error en getUserProfileData:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Actualizar preferencias del perfil
export async function updateProfilePreferences(
  preferences: Partial<UserProfileData['preferences']>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Actualizar preferencias en el perfil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        preferences: preferences,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error actualizando preferencias:', updateError)
      return { success: false, error: 'Error actualizando preferencias' }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en updateProfilePreferences:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Subir avatar del usuario
export async function uploadUserAvatar(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Generar nombre único para el archivo
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    // Subir archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('❌ Error subiendo avatar:', uploadError)
      return { success: false, error: 'Error subiendo imagen' }
    }

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath)

    // Actualizar perfil con nueva URL de avatar
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error actualizando avatar:', updateError)
      return { success: false, error: 'Error actualizando perfil' }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true, url: publicUrl }
  } catch (error) {
    console.error('❌ Error en uploadUserAvatar:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Actualizar datos básicos del perfil
export async function updateUserProfile(
  profileData: Partial<Pick<UserProfileData, 'full_name' | 'phone' | 'bio' | 'location' | 'website' | 'twitter' | 'linkedin' | 'github'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Actualizar datos del perfil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error actualizando perfil:', updateError)
      return { success: false, error: 'Error actualizando perfil' }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en updateUserProfile:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Eliminar avatar del usuario
export async function deleteUserAvatar(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener URL actual del avatar
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    if (profile?.avatar_url) {
      // Extraer path del archivo de la URL
      const urlParts = profile.avatar_url.split('/')
      const fileName = urlParts[urlParts.length - 1]
      const filePath = `avatars/${fileName}`

      // Eliminar archivo del storage
      const { error: deleteError } = await supabase.storage
        .from('profiles')
        .remove([filePath])

      if (deleteError) {
        console.error('❌ Error eliminando avatar del storage:', deleteError)
        // Continuar aunque falle la eliminación del archivo
      }
    }

    // Actualizar perfil para remover URL del avatar
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error actualizando perfil:', updateError)
      return { success: false, error: 'Error actualizando perfil' }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true }
  } catch (error) {
    console.error('❌ Error en deleteUserAvatar:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

