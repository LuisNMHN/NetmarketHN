/**
 * Utilidades para manejar avatares
 */

/**
 * Genera la URL pública de un avatar desde Supabase Storage
 * @param avatarUrl - El nombre del avatar (ej: "animal_cat_a1b2c3")
 * @returns URL completa del avatar o null si no hay avatar
 */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null
  
  // Si ya es una URL completa, devolverla tal como está
  if (avatarUrl.startsWith('http')) {
    return avatarUrl
  }
  
  // Si es un nombre de avatar, construir la URL de Supabase Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.warn('NEXT_PUBLIC_SUPABASE_URL no está configurado')
    return null
  }
  
  // Construir URL del bucket profiles
  // Intentar con SVG primero (más común para avatares generados)
  const generatedUrl = `${supabaseUrl}/storage/v1/object/public/profiles/avatars/${avatarUrl}.svg`
  
  // Debug: Log de la URL generada
  console.log('🔍 getAvatarUrl: Generando URL:', {
    avatarUrl,
    supabaseUrl,
    generatedUrl
  })
  
  return generatedUrl
}

/**
 * Genera la URL pública de un avatar con fallback
 * @param avatarUrl - El nombre del avatar
 * @param fallback - URL de fallback si no hay avatar
 * @returns URL del avatar o fallback
 */
export function getAvatarUrlWithFallback(
  avatarUrl: string | null | undefined, 
  fallback?: string
): string {
  const url = getAvatarUrl(avatarUrl)
  return url || fallback || '/placeholder-user.jpg'
}

/**
 * Valida si una URL de avatar es válida
 * @param avatarUrl - URL del avatar
 * @returns true si la URL es válida
 */
export function isValidAvatarUrl(avatarUrl: string | null | undefined): boolean {
  if (!avatarUrl) return false
  
  // Verificar que sea una URL válida
  try {
    new URL(avatarUrl)
    return true
  } catch {
    return false
  }
}
