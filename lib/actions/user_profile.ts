import { supabaseBrowser } from "@/lib/supabase/client"

export interface ActionResult<T = any> {
  ok: boolean
  message: string
  data?: T
}

// Interface para datos combinados del usuario
export interface UserProfileData {
  // Datos básicos de auth.profiles
  email: string
  full_name: string
  created_at: string
  
  // Datos de kyc_submissions
  birth_date?: string
  country?: string
  doc_type?: string
  doc_number?: string
  kyc_status: 'none' | 'draft' | 'pending' | 'review' | 'approved' | 'rejected'
  kyc_submitted_at?: string
  
  // Datos adicionales de user_profiles (campos que sí necesitamos)
  phone?: string
  avatar_url?: string
  theme?: 'light' | 'dark' | 'system'
  notification_email?: boolean
  notification_push?: boolean
  
  // Metadatos
  member_since: string
}

// Interface para datos adicionales que solo van en user_profiles
export interface ProfilePreferences {
  phone?: string
  avatar_url?: string
  theme?: 'light' | 'dark' | 'system'
  notification_email?: boolean
  notification_push?: boolean
}

export interface ProfileUpdateData {
  display_name?: string
  bio?: string
  avatar_url?: string
  birth_date?: string
  country?: string
  website?: string
  theme?: 'light' | 'dark' | 'system'
  notification_email?: boolean
  notification_push?: boolean
  notification_sms?: boolean
}

/**
 * Obtiene toda la información del perfil del usuario desde múltiples tablas
 */
export async function getUserProfileData(): Promise<ActionResult<UserProfileData>> {
  try {
    const supabase = supabaseBrowser()
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
    if (!user?.id) return { ok: false, message: "No hay sesión activa" }

    // Consultar datos de profiles (información básica) - empezar directamente con datos del usuario
    let profileData = null
    let profileError = null
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, created_at')
        .eq('id', user.id)
        .maybeSingle()
      profileData = data
      profileError = error
    } catch (err) {
      console.log('ℹ️ No hay tabla profiles, usando solo auth.user')
      profileError = err
    }

    if (profileError) {
      console.warn('Warning obteniendo datos básicos:', profileError)
      // Continuar sin datos de profiles por ahora
    }

    // Consultar datos de kyc_submissions (información de verificación)
    const { data: kycData, error: kycError } = await supabase
      .from('kyc_submissions')
      .select('full_name, birth_date, country, doc_type, doc_number, status, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Consultar datos adicionales de user_profiles (preferencias)
    let additionalData = null
    let additionalError = null
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('display_name, phone, avatar_url, theme, notification_email, notification_push')
        .eq('user_id', user.id)
        .maybeSingle()
      additionalData = data
      additionalError = error
    } catch (err) {
      console.log('ℹ️ Tabla user_profiles no disponible, revisando localStorage')
      additionalError = err
      
      // Fallback: Intentar leer desde localStorage
      try {
        const localData = localStorage.getItem(`userPreferences_${user.id}`)
        if (localData) {
          const parsed = JSON.parse(localData)
          additionalData = {
            display_name: parsed.display_name,
            phone: parsed.phone,
            avatar_url: parsed.avatar_url,
            theme: parsed.theme,
            notification_email: parsed.notification_email,
            notification_push: parsed.notification_push
          }
          console.log('📱 Preferencias cargadas desde localStorage:', additionalData)
        }
      } catch (localErr) {
        console.log('❌ No hay datos en localStorage:', localErr)
      }
    }

    // Debug: Log de datos obtenidos
    console.log('🔍 Debug - Datos obtenidos:')
    console.log('- ProfileData:', profileData)
    console.log('- KYCData:', kycData)
    console.log('- AdditionalData:', additionalData)
    console.log('- User:', user.email)
    console.log('- User.created_at (RAW):', user.created_at)
    console.log('- User.created_at (parsed):', user.created_at ? new Date(user.created_at) : 'undefined')

    // Combinar todos los datos
    const combinedData: UserProfileData = {
      // Datos básicos de profiles
      email: profileData?.email || user.email || 'Sin email',
      full_name: kycData?.full_name || additionalData?.display_name || profileData?.full_name || 'Usuario',
      created_at: profileData?.created_at || user.created_at || '',
      
      // Datos de KYC
      birth_date: kycData?.birth_date || undefined,
      country: kycData?.country || undefined,
      doc_type: kycData?.doc_type || undefined,
      doc_number: kycData?.doc_number || undefined,
      kyc_status: kycData?.status || 'none',
      kyc_submitted_at: kycData?.updated_at || undefined,
      
      // Datos adicionales
      phone: additionalData?.phone || undefined,
      avatar_url: additionalData?.avatar_url || undefined,
      theme: additionalData?.theme || 'system',
      notification_email: additionalData?.notification_email ?? true,
      notification_push: additionalData?.notification_push ?? true,
      
      // Metadatos calculados - usar fecha de creación del usuario de auth correctamente
      member_since: user.created_at || profileData?.created_at || new Date().toISOString()
    }

    console.log('✅ Datos finales combinados:', combinedData)

    return { ok: true, message: "Perfil obtenido correctamente", data: combinedData }
  } catch (error) {
    console.error('Error en getUserProfileData:', error)
    return { ok: false, message: "Error interno del servidor." }
  }
}

/**
 * Actualiza solo las preferencias adicionales del usuario
 */
export async function updateProfilePreferences(preferences: ProfilePreferences): Promise<ActionResult<any>> {
  try {
    const supabase = supabaseBrowser()
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
    if (!user?.id) return { ok: false, message: "No hay sesión activa" }

    console.log('🔍 Intentando guardar preferencias:', preferences)

    // Datos a actualizar (solo preferencias)
    const updateData = {
      user_id: user.id,
      ...preferences,
      updated_at: new Date().toISOString()
    }

    console.log('📝 Datos para insertar:', updateData)

    try {
      // Intentar insertar en user_profiles
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .upsert(updateData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })
        .select('phone, avatar_url, theme, notification_email, notification_push')
        .single()

      if (error) {
        console.error('❌ Error actualizando preferencias en user_profiles:', error)
        return { ok: false, message: "No se pudo actualizar las preferencias." }
      }

      console.log('✅ Preferencias guardadas en user_profiles:', profile)
      return { ok: true, message: "Preferencias actualizadas correctamente", data: profile }
      
    } catch (userProfilesError) {
      console.log('⚠️ Tabla user_profiles no existe, guardando en localStorage para desarrollo')
      
      // Fallback: Guardar en localStorage para desarrollo
      try {
        const localData = {
          userId: user.id,
          ...preferences,
          saved_at: new Date().toISOString()
        }
        
        localStorage.setItem(`userPreferences_${user.id}`, JSON.stringify(localData))
        
        return { ok: true, message: "Preferencias guardadas localmente (desarrollo)", data: preferences }
        
      } catch (localError) {
        console.error('❌ Error guardando en localStorage:', localError)
        return { ok: false, message: "Error guardando preferencias." }
      }
    }
  } catch (error) {
    console.error('❌ Error general en updateProfilePreferences:', error)
    return { ok: false, message: "Error interno del servidor." }
  }
}

/**
 * Sube y actualiza el avatar del usuario
 */
export async function uploadUserAvatar(file: File): Promise<ActionResult<{ avatar_url: string }>> {
  try {
    const supabase = supabaseBrowser()
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
    if (!user?.id) return { ok: false, message: "No hay sesión activa" }

    // Validaciones del archivo
    if (!file.type.startsWith('image/')) {
      return { ok: false, message: "Solo se permiten archivos de imagen." }
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      return { ok: false, message: "La imagen no puede ser mayor a 5MB." }
    }

    // Convertir archivo a base64 para almacenamiento directo
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    console.log('🔍 Avatar convertido a base64, tamaño:', base64.length)

    // Actualizar perfil con la imagen en base64
    const updateResult = await updateProfilePreferences({ avatar_url: base64 })
    
    if (!updateResult.ok) {
      return updateResult
    }

    return { ok: true, message: "Avatar actualizado correctamente", data: { avatar_url: base64 } }
  } catch (error) {
    console.error('Error en uploadUserAvatar:', error)
    return { ok: false, message: "Error interno del servidor." }
  }
}

/**
 * Obtiene información básica del perfil para mostrar en el layout
 */
export async function getProfileBasicInfo(): Promise<ActionResult<{
  display_name: string
  avatar_url: string
}>> {
  try {
    const supabase = supabaseBrowser()
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError) return { ok: false, message: "Error de autenticación." }
    if (!user?.id) return { ok: false, message: "No hay sesión activa" }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error obteniendo info básica:', error)
      return { ok: false, message: "Error obteniendo información del perfil." }
    }

    return { 
      ok: true, 
      message: "Información obtenida", 
      data: {
        display_name: profile?.display_name || user.email?.split('@')[0] || 'Usuario',
        avatar_url: profile?.avatar_url || ''
      }
    }
  } catch (error) {
    console.error('Error en getProfileBasicInfo:', error)
    return { ok: false, message: "System error." }
  }
}
