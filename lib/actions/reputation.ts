import { supabaseServer } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// =========================================================
// TIPOS E INTERFACES PARA EL SISTEMA DE REPUTACIÓN
// =========================================================

export interface UserReview {
  id: string
  reviewer_id: string
  reviewed_id: string
  transaction_id?: string
  context_type: 'transaction' | 'service' | 'general'
  communication_rating: number
  reliability_rating: number
  quality_rating: number
  overall_rating: number
  review_text?: string
  review_title?: string
  is_verified: boolean
  is_public: boolean
  is_anonymous: boolean
  created_at: string
  updated_at: string
  reviewer_name?: string
  reviewer_avatar?: string
}

export interface UserReputationMetrics {
  id: string
  user_id: string
  overall_score: number
  total_reviews: number
  positive_reviews: number
  neutral_reviews: number
  negative_reviews: number
  five_star_count: number
  four_star_count: number
  three_star_count: number
  two_star_count: number
  one_star_count: number
  avg_communication: number
  avg_reliability: number
  avg_quality: number
  total_transactions: number
  successful_transactions: number
  cancelled_transactions: number
  disputed_transactions: number
  member_since: string
  last_activity_at: string
  response_time_avg: number
  last_calculated_at: string
  created_at: string
  updated_at: string
}

export interface ReputationBadge {
  id: string
  name: string
  display_name: string
  description: string
  icon_name: string
  color: string
  criteria_type: string
  criteria_value: number
  criteria_condition: string
  is_active: boolean
  priority: number
  category: string
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  is_displayed: boolean
  badge?: ReputationBadge
}

export interface CreateReviewData {
  reviewed_id: string
  transaction_id?: string
  context_type: 'transaction' | 'service' | 'general'
  communication_rating: number
  reliability_rating: number
  quality_rating: number
  review_text?: string
  review_title?: string
  is_anonymous?: boolean
}

// =========================================================
// FUNCIONES PARA REVIEWS
// =========================================================

/**
 * Crear una nueva review/calificación
 */
export async function createUserReview(data: CreateReviewData): Promise<{ success: boolean; review_id?: string; error?: string }> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Validar que no se esté calificando a sí mismo
    if (user.id === data.reviewed_id) {
      return { success: false, error: 'No puedes calificarte a ti mismo' }
    }

    // Calcular rating general
    const overall_rating = (data.communication_rating + data.reliability_rating + data.quality_rating) / 3

    const { data: review, error } = await supabase
      .from('user_reviews')
      .insert({
        reviewer_id: user.id,
        reviewed_id: data.reviewed_id,
        transaction_id: data.transaction_id,
        context_type: data.context_type,
        communication_rating: data.communication_rating,
        reliability_rating: data.reliability_rating,
        quality_rating: data.quality_rating,
        overall_rating: Math.round(overall_rating * 100) / 100, // Redondear a 2 decimales
        review_text: data.review_text,
        review_title: data.review_title,
        is_anonymous: data.is_anonymous || false,
        is_verified: !!data.transaction_id, // Verificado si hay transaction_id
        is_public: true
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ Error creando review:', error)
      return { success: false, error: error.message || 'Error al crear la calificación' }
    }

    console.log('✅ Review creada exitosamente:', review.id)
    
    revalidatePath('/dashboard/perfil')
    return { success: true, review_id: review.id }
  } catch (error) {
    console.error('❌ Error en createUserReview:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener reviews de un usuario específico
 */
export async function getUserReviews(userId: string, limit: number = 10, offset: number = 0): Promise<{ success: boolean; reviews?: UserReview[]; total?: number; error?: string }> {
  try {
    const supabase = await supabaseServer()

    // Obtener reviews con información del reviewer
    const { data: reviews, error } = await supabase
      .from('user_reviews')
      .select(`
        *,
        reviewer:profiles!user_reviews_reviewer_id_fkey(
          full_name,
          avatar_url
        )
      `)
      .eq('reviewed_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ Error obteniendo reviews:', error)
      return { success: false, error: error.message || 'Error al obtener calificaciones' }
    }

    // Obtener total de reviews
    const { count, error: countError } = await supabase
      .from('user_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('reviewed_id', userId)
      .eq('is_public', true)

    if (countError) {
      console.error('❌ Error obteniendo count:', countError)
    }

    // Transformar datos
    const transformedReviews: UserReview[] = reviews?.map(review => ({
      ...review,
      reviewer_name: review.reviewer?.full_name || 'Usuario Anónimo',
      reviewer_avatar: review.reviewer?.avatar_url || null
    })) || []

    return { 
      success: true, 
      reviews: transformedReviews,
      total: count || 0
    }
  } catch (error) {
    console.error('❌ Error en getUserReviews:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener métricas de reputación de un usuario
 */
export async function getUserReputationMetrics(userId: string): Promise<{ success: boolean; metrics?: UserReputationMetrics; error?: string }> {
  try {
    const supabase = await supabaseServer()

    const { data: metrics, error } = await supabase
      .from('user_reputation_metrics')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // Si no existen métricas, crear unas básicas
      if (error.code === 'PGRST116') {
        const { data: newMetrics, error: createError } = await supabase
          .from('user_reputation_metrics')
          .insert({
            user_id: userId,
            overall_score: 50.0, // Score neutral para usuarios nuevos
            total_reviews: 0,
            positive_reviews: 0,
            neutral_reviews: 0,
            negative_reviews: 0,
            avg_communication: 0.0,
            avg_reliability: 0.0,
            avg_quality: 0.0
          })
          .select('*')
          .single()

        if (createError) {
          console.error('❌ Error creando métricas:', createError)
          return { success: false, error: 'Error al crear métricas de reputación' }
        }

        return { success: true, metrics: newMetrics }
      }

      console.error('❌ Error obteniendo métricas:', error)
      return { success: false, error: error.message || 'Error al obtener métricas de reputación' }
    }

    return { success: true, metrics }
  } catch (error) {
    console.error('❌ Error en getUserReputationMetrics:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener badges de un usuario
 */
export async function getUserBadges(userId: string): Promise<{ success: boolean; badges?: UserBadge[]; error?: string }> {
  try {
    const supabase = await supabaseServer()

    const { data: badges, error } = await supabase
      .from('user_badges')
      .select(`
        *,
        badge:reputation_badges(*)
      `)
      .eq('user_id', userId)
      .eq('is_displayed', true)
      .order('earned_at', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo badges:', error)
      return { success: false, error: error.message || 'Error al obtener badges' }
    }

    return { success: true, badges: badges || [] }
  } catch (error) {
    console.error('❌ Error en getUserBadges:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener todos los badges disponibles
 */
export async function getAllBadges(): Promise<{ success: boolean; badges?: ReputationBadge[]; error?: string }> {
  try {
    const supabase = await supabaseServer()

    const { data: badges, error } = await supabase
      .from('reputation_badges')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      console.error('❌ Error obteniendo badges:', error)
      return { success: false, error: error.message || 'Error al obtener badges' }
    }

    return { success: true, badges: badges || [] }
  } catch (error) {
    console.error('❌ Error en getAllBadges:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Actualizar métricas de reputación manualmente
 */
export async function updateUserReputationMetrics(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()

    const { error } = await supabase.rpc('update_user_reputation_metrics', {
      p_user_id: userId
    })

    if (error) {
      console.error('❌ Error actualizando métricas:', error)
      return { success: false, error: error.message || 'Error al actualizar métricas' }
    }

    console.log('✅ Métricas de reputación actualizadas para usuario:', userId)
    return { success: true }
  } catch (error) {
    console.error('❌ Error en updateUserReputationMetrics:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener estadísticas de reputación para dashboard
 */
export async function getReputationStats(): Promise<{ success: boolean; stats?: any; error?: string }> {
  try {
    const supabase = await supabaseServer()

    // Obtener estadísticas generales
    const { data: stats, error } = await supabase
      .from('user_reputation_metrics')
      .select(`
        COUNT(*) as total_users,
        AVG(overall_score) as avg_score,
        AVG(total_reviews) as avg_reviews,
        COUNT(CASE WHEN overall_score >= 80 THEN 1 END) as high_reputation_users,
        COUNT(CASE WHEN overall_score >= 60 AND overall_score < 80 THEN 1 END) as medium_reputation_users,
        COUNT(CASE WHEN overall_score < 60 THEN 1 END) as low_reputation_users
      `)
      .single()

    if (error) {
      console.error('❌ Error obteniendo estadísticas:', error)
      return { success: false, error: error.message || 'Error al obtener estadísticas' }
    }

    return { success: true, stats }
  } catch (error) {
    console.error('❌ Error en getReputationStats:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Verificar si un usuario puede calificar a otro
 */
export async function canUserReview(reviewerId: string, reviewedId: string, transactionId?: string): Promise<{ success: boolean; can_review?: boolean; error?: string }> {
  try {
    const supabase = await supabaseServer()

    // Verificar que no se esté calificando a sí mismo
    if (reviewerId === reviewedId) {
      return { success: true, can_review: false }
    }

    // Verificar si ya existe una review para esta transacción
    if (transactionId) {
      const { data: existingReview, error } = await supabase
        .from('user_reviews')
        .select('id')
        .eq('reviewer_id', reviewerId)
        .eq('transaction_id', transactionId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error verificando review existente:', error)
        return { success: false, error: 'Error al verificar calificación existente' }
      }

      if (existingReview) {
        return { success: true, can_review: false }
      }
    }

    return { success: true, can_review: true }
  } catch (error) {
    console.error('❌ Error en canUserReview:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
