import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server"
import { emitNotification, emitBroadcastNotification } from "@/lib/notifications/emitter"

// =========================================================
// TIPOS E INTERFACES
// =========================================================

export interface PredictionMarket {
  id: string
  creator_id: string
  creator_name?: string
  title: string
  description?: string
  category?: string
  question: string
  market_type: 'binary' | 'multiple'
  resolution_source?: string
  resolution_date?: string
  status: 'active' | 'closed' | 'resolved' | 'cancelled'
  liquidity_pool_hnld: number
  created_at: string
  closed_at?: string
  resolved_at?: string
  cancelled_at?: string
  min_trade_amount: number
  max_trade_amount?: number
  trading_fee_percent: number
  platform_fee_percent: number
  winning_outcome_id?: string
  resolution_notes?: string
  total_volume_hnld?: number
  total_trades?: number
}

export interface MarketOutcome {
  id: string
  market_id: string
  name: string
  description?: string
  order_index: number
  current_price: number
  total_shares: number
  total_volume_hnld: number
  is_winner: boolean
  created_at: string
}

export interface MarketPosition {
  id: string
  user_id: string
  market_id: string
  outcome_id: string
  shares: number
  average_cost_hnld: number
  total_invested_hnld: number
  current_value_hnld: number
  unrealized_pnl_hnld: number
  updated_at: string
  market?: PredictionMarket
  outcome?: MarketOutcome
}

export interface MarketTrade {
  id: string
  market_id: string
  outcome_id: string
  user_id: string
  trade_type: 'buy' | 'sell'
  shares: number
  price_per_share: number
  total_cost_hnld: number
  creator_fee_hnld: number
  platform_fee_hnld: number
  shares_after: number
  balance_after_hnld: number
  created_at: string
  market?: PredictionMarket
  outcome?: MarketOutcome
}

export interface CreateMarketData {
  title: string
  description?: string
  question: string
  category?: string
  market_type?: 'binary' | 'multiple'
  resolution_source?: string
  resolution_date?: string
  outcomes?: Array<{ name: string; description?: string; order_index?: number }>
}

// =========================================================
// FUNCIONES PARA MERCADOS
// =========================================================

/**
 * Verificar si el usuario puede crear mercados
 */
export async function canUserCreateMarkets(): Promise<{ success: boolean; canCreate: boolean; reason?: string }> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, canCreate: false, reason: 'Usuario no autenticado' }
    }
    
    const { data, error } = await supabase.rpc('can_create_market', {
      p_user_id: user.id
    })
    
    if (error) {
      console.error('Error verificando permisos:', error)
      return { success: false, canCreate: false, reason: error.message }
    }
    
    return { success: true, canCreate: data === true }
  } catch (error) {
    console.error('Error en canUserCreateMarkets:', error)
    return { success: false, canCreate: false, reason: 'Error interno' }
  }
}

/**
 * Obtener mercados activos
 */
export async function getActiveMarkets(limit: number = 50, offset: number = 0): Promise<{
  success: boolean
  data?: PredictionMarket[]
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    const { data: markets, error } = await supabase
      .from('prediction_markets')
      .select('*')
      .in('status', ['active', 'cancelled'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('Error obteniendo mercados:', error)
      return { success: false, error: error.message }
    }
    
    // Obtener nombres de creadores
    const creatorIds = markets?.map(m => m.creator_id).filter((id, index, self) => self.indexOf(id) === index) || []
    let creatorNames: Record<string, string> = {}
    
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds)
      
      if (profiles) {
        creatorNames = profiles.reduce((acc, profile) => {
          acc[profile.id] = profile.full_name || 'Usuario'
          return acc
        }, {} as Record<string, string>)
      }
    }
    
    const formattedMarkets: PredictionMarket[] = markets?.map(m => ({
      ...m,
      creator_name: creatorNames[m.creator_id] || 'Usuario'
    })) || []
    
    return { success: true, data: formattedMarkets }
  } catch (error) {
    console.error('Error obteniendo mercados:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener un mercado específico con sus outcomes
 */
export async function getMarketById(marketId: string): Promise<{
  success: boolean
  data?: PredictionMarket & { outcomes: MarketOutcome[] }
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    
    const { data: market, error: marketError } = await supabase
      .from('prediction_markets')
      .select('*')
      .eq('id', marketId)
      .single()
    
    if (marketError || !market) {
      console.error('Error obteniendo mercado:', marketError)
      return { success: false, error: 'Mercado no encontrado' }
    }
    
    // Obtener nombre del creador
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', market.creator_id)
      .maybeSingle()
    
    const { data: outcomes, error: outcomesError } = await supabase
      .from('market_outcomes')
      .select('*')
      .eq('market_id', marketId)
      .order('order_index', { ascending: true })
    
    if (outcomesError) {
      return { success: false, error: outcomesError.message }
    }
    
    // Obtener estadísticas del mercado
    const { count: totalTrades } = await supabase
      .from('market_trades')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)
    
    const { data: volumeData } = await supabase
      .from('market_trades')
      .select('total_cost_hnld')
      .eq('market_id', marketId)
    
    const totalVolume = volumeData?.reduce((sum, t) => sum + (t.total_cost_hnld || 0), 0) || 0
    
    return {
      success: true,
      data: {
        ...market,
        creator_name: creatorProfile?.full_name || 'Usuario',
        outcomes: outcomes || [],
        total_trades: totalTrades || 0,
        total_volume_hnld: totalVolume
      }
    }
  } catch (error) {
    console.error('Error obteniendo mercado:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Crear un nuevo mercado de predicción
 */
export async function createPredictionMarket(data: CreateMarketData): Promise<{
  success: boolean
  marketId?: string
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Verificar permisos
    const canCreate = await canUserCreateMarkets()
    if (!canCreate.canCreate) {
      return { success: false, error: canCreate.reason || 'No tienes permisos para crear mercados' }
    }
    
    // Preparar outcomes - pasar como JSONB directamente, no como string
    let outcomesJson: any = null
    if (data.outcomes && data.outcomes.length > 0) {
      // Pasar el array directamente, Supabase lo convertirá a JSONB
      outcomesJson = data.outcomes
    } else if (data.market_type === 'binary') {
      // Para mercados binarios, pasar null para que la función SQL cree los outcomes por defecto
      outcomesJson = null
    }
    
    const { data: marketId, error } = await supabase.rpc('create_prediction_market', {
      p_creator_id: user.id,
      p_title: data.title,
      p_description: data.description || null,
      p_question: data.question,
      p_category: data.category || null,
      p_market_type: data.market_type || 'binary',
      p_resolution_source: data.resolution_source || null,
      p_resolution_date: data.resolution_date || null,
      // Pasar el array directamente, Supabase lo convertirá automáticamente a JSONB
      p_outcomes: outcomesJson
    })
    
    if (error) {
      console.error('Error creando mercado:', error)
      return { success: false, error: error.message }
    }
    
    // Emitir notificaciones
    if (marketId) {
      try {
        // Notificación al creador del mercado
        await emitNotification({
          user_id: user.id,
          topic: 'prediction',
          event: 'MARKET_CREATED',
          title: 'Mercado creado exitosamente',
          body: `Tu mercado "${data.title}" ha sido creado y está disponible para participar.`,
          priority: 'normal',
          cta_label: 'Ver mercado',
          cta_href: `/dashboard/predicciones/${marketId}`,
          payload: {
            market_id: marketId,
            market_title: data.title,
            market_type: data.market_type || 'binary'
          }
        })
        
        // Notificación general a todos los usuarios (broadcast)
        // Obtener nombre del creador para la notificación
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        
        const creatorName = creatorProfile?.full_name || 'Un usuario'
        
        // Notificación broadcast a todos EXCEPTO al creador (para evitar duplicados)
        // Obtener todos los usuarios excepto el creador
        const { data: allUsers } = await supabase
          .from('profiles')
          .select('id')
          .neq('id', user.id)
        
        if (allUsers && allUsers.length > 0) {
          // Emitir notificaciones a todos los usuarios excepto al creador
          const notificationPromises = allUsers.map(u => 
            emitNotification({
              user_id: u.id,
              topic: 'prediction',
              event: 'NEW_MARKET_AVAILABLE',
              title: 'Nuevo mercado de predicción disponible',
              body: `${creatorName} ha creado un nuevo mercado: "${data.title}". ¡Participa ahora!`,
              priority: 'normal',
              cta_label: 'Ver mercado',
              cta_href: `/dashboard/predicciones/${marketId}`,
              payload: {
                market_id: marketId,
                market_title: data.title,
                market_type: data.market_type || 'binary',
                creator_id: user.id,
                creator_name: creatorName
              }
            })
          )
          
          await Promise.allSettled(notificationPromises)
        }
      } catch (notifError) {
        console.error('Error emitiendo notificaciones de mercado creado:', notifError)
        // No fallar la operación si la notificación falla
      }
    }
    
    return { success: true, marketId }
  } catch (error) {
    console.error('Error en createPredictionMarket:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Comprar acciones en un mercado
 */
export async function buyMarketShares(
  marketId: string,
  outcomeId: string,
  shares: number,
  maxPrice?: number
): Promise<{
  success: boolean
  tradeId?: string
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Obtener información del mercado antes de la compra
    const { data: market } = await supabase
      .from('prediction_markets')
      .select('id, title, creator_id')
      .eq('id', marketId)
      .single()
    
    const { data: tradeId, error } = await supabase.rpc('buy_market_shares', {
      p_user_id: user.id,
      p_market_id: marketId,
      p_outcome_id: outcomeId,
      p_shares: shares,
      p_max_price: maxPrice || null
    })
    
    if (error) {
      console.error('Error comprando acciones:', error)
      return { success: false, error: error.message }
    }
    
    // Emitir notificaciones
    if (tradeId && market) {
      try {
        // Notificación al participante
        await emitNotification({
          user_id: user.id,
          topic: 'prediction',
          event: 'MARKET_PARTICIPATION',
          title: 'Participación exitosa',
          body: `Has comprado ${shares} acción(es) en el mercado "${market.title}".`,
          priority: 'normal',
          cta_label: 'Ver mercado',
          cta_href: `/dashboard/predicciones/${marketId}`,
          payload: {
            market_id: marketId,
            market_title: market.title,
            trade_id: tradeId,
            shares: shares,
            trade_type: 'buy'
          }
        })
        
        // Notificación al creador del mercado (si no es el mismo usuario)
        if (market.creator_id !== user.id) {
          // Obtener nombre del participante
          const { data: participantProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
          
          const participantName = participantProfile?.full_name || 'Un usuario'
          
          await emitNotification({
            user_id: market.creator_id,
            topic: 'prediction',
            event: 'MARKET_PARTICIPATION',
            title: 'Nueva participación en tu mercado',
            body: `${participantName} ha comprado ${shares} acción(es) en tu mercado "${market.title}".`,
            priority: 'normal',
            cta_label: 'Ver mercado',
            cta_href: `/dashboard/predicciones/${marketId}`,
            payload: {
              market_id: marketId,
              market_title: market.title,
              trade_id: tradeId,
              participant_id: user.id,
              participant_name: participantName,
              shares: shares,
              trade_type: 'buy'
            }
          })
        }
      } catch (notifError) {
        console.error('Error emitiendo notificaciones de compra:', notifError)
        // No fallar la operación si la notificación falla
      }
    }
    
    return { success: true, tradeId }
  } catch (error) {
    console.error('Error en buyMarketShares:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Vender acciones en un mercado
 */
export async function sellMarketShares(
  marketId: string,
  outcomeId: string,
  shares: number,
  minPrice?: number
): Promise<{
  success: boolean
  tradeId?: string
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Obtener información del mercado antes de la venta
    const { data: market } = await supabase
      .from('prediction_markets')
      .select('id, title, creator_id')
      .eq('id', marketId)
      .single()
    
    const { data: tradeId, error } = await supabase.rpc('sell_market_shares', {
      p_user_id: user.id,
      p_market_id: marketId,
      p_outcome_id: outcomeId,
      p_shares: shares,
      p_min_price: minPrice || null
    })
    
    if (error) {
      console.error('Error vendiendo acciones:', error)
      return { success: false, error: error.message }
    }
    
    // Emitir notificaciones
    if (tradeId && market) {
      try {
        // Notificación al participante
        await emitNotification({
          user_id: user.id,
          topic: 'prediction',
          event: 'MARKET_PARTICIPATION',
          title: 'Venta exitosa',
          body: `Has vendido ${shares} acción(es) en el mercado "${market.title}".`,
          priority: 'normal',
          cta_label: 'Ver mercado',
          cta_href: `/dashboard/predicciones/${marketId}`,
          payload: {
            market_id: marketId,
            market_title: market.title,
            trade_id: tradeId,
            shares: shares,
            trade_type: 'sell'
          }
        })
        
        // Notificación al creador del mercado (si no es el mismo usuario)
        if (market.creator_id !== user.id) {
          // Obtener nombre del participante
          const { data: participantProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
          
          const participantName = participantProfile?.full_name || 'Un usuario'
          
          await emitNotification({
            user_id: market.creator_id,
            topic: 'prediction',
            event: 'MARKET_PARTICIPATION',
            title: 'Nueva participación en tu mercado',
            body: `${participantName} ha vendido ${shares} acción(es) en tu mercado "${market.title}".`,
            priority: 'normal',
            cta_label: 'Ver mercado',
            cta_href: `/dashboard/predicciones/${marketId}`,
            payload: {
              market_id: marketId,
              market_title: market.title,
              trade_id: tradeId,
              participant_id: user.id,
              participant_name: participantName,
              shares: shares,
              trade_type: 'sell'
            }
          })
        }
      } catch (notifError) {
        console.error('Error emitiendo notificaciones de venta:', notifError)
        // No fallar la operación si la notificación falla
      }
    }
    
    return { success: true, tradeId }
  } catch (error) {
    console.error('Error en sellMarketShares:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener posiciones del usuario
 */
export async function getUserPositions(): Promise<{
  success: boolean
  data?: MarketPosition[]
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    const { data: positions, error } = await supabase
      .from('market_positions')
      .select(`
        *,
        market:prediction_markets(*),
        outcome:market_outcomes(*)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true, data: positions || [] }
  } catch (error) {
    console.error('Error obteniendo posiciones:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener mercados creados por el usuario
 */
export async function getUserMarkets(): Promise<{
  success: boolean
  data?: PredictionMarket[]
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    const { data: markets, error } = await supabase
      .from('prediction_markets')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true, data: markets || [] }
  } catch (error) {
    console.error('Error obteniendo mercados del usuario:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Resolver un mercado (solo para creadores)
 */
export async function resolveMarket(
  marketId: string,
  winningOutcomeId: string,
  resolutionNotes?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Obtener información completa del mercado y el outcome ganador
    const { data: marketData } = await supabase
      .from('prediction_markets')
      .select('id, title, creator_id')
      .eq('id', marketId)
      .single()
    
    if (!marketData || marketData.creator_id !== user.id) {
      return { success: false, error: 'Solo el creador puede resolver el mercado' }
    }
    
    const { data: winningOutcome } = await supabase
      .from('market_outcomes')
      .select('id, name')
      .eq('id', winningOutcomeId)
      .single()
    
    // Obtener todas las posiciones antes de resolver
    const { data: allPositions } = await supabase
      .from('market_positions')
      .select('user_id, outcome_id, shares')
      .eq('market_id', marketId)
    
    const { error } = await supabase.rpc('resolve_prediction_market', {
      p_market_id: marketId,
      p_winning_outcome_id: winningOutcomeId,
      p_resolution_notes: resolutionNotes || null
    })
    
    if (error) {
      console.error('Error resolviendo mercado:', error)
      return { success: false, error: error.message }
    }
    
    // Emitir notificaciones después de resolver exitosamente
    if (allPositions && marketData && winningOutcome) {
      try {
        // Notificar al creador
        await emitNotification({
          user_id: user.id,
          topic: 'prediction',
          event: 'MARKET_RESOLVED',
          title: 'Mercado resuelto',
          body: `Has resuelto el mercado "${marketData.title}" con la opción ganadora: "${winningOutcome.name}".`,
          priority: 'high',
          cta_label: 'Ver mercado',
          cta_href: `/dashboard/predicciones/${marketId}`,
          payload: {
            market_id: marketId,
            market_title: marketData.title,
            winning_outcome_id: winningOutcomeId,
            winning_outcome_name: winningOutcome.name
          }
        })
        
        // Notificar a todos los participantes con posiciones
        const uniqueUserIds = [...new Set(allPositions.map(p => p.user_id))]
        
        for (const participantId of uniqueUserIds) {
          // Obtener posiciones del participante
          const participantPositions = allPositions.filter(p => p.user_id === participantId)
          const hasWinningPosition = participantPositions.some(p => p.outcome_id === winningOutcomeId)
          
          if (hasWinningPosition) {
            // Calcular total de acciones ganadoras
            const winningShares = participantPositions
              .filter(p => p.outcome_id === winningOutcomeId)
              .reduce((sum, p) => sum + p.shares, 0)
            
            await emitNotification({
              user_id: participantId,
              topic: 'prediction',
              event: 'POSITION_WINNER',
              title: '¡Felicidades! Ganaste en el mercado',
              body: `Tu posición en el mercado "${marketData.title}" resultó ganadora. Has ganado ${winningShares} HNLD por tus ${winningShares} acción(es) ganadora(s).`,
              priority: 'high',
              cta_label: 'Ver posición',
              cta_href: `/dashboard/predicciones/mis-posiciones`,
              payload: {
                market_id: marketId,
                market_title: marketData.title,
                winning_outcome_id: winningOutcomeId,
                winning_outcome_name: winningOutcome.name,
                winning_shares: winningShares,
                payout: winningShares
              }
            })
          } else {
            // Notificar a los perdedores
            await emitNotification({
              user_id: participantId,
              topic: 'prediction',
              event: 'POSITION_LOSER',
              title: 'Mercado resuelto',
              body: `El mercado "${marketData.title}" ha sido resuelto. Tu posición no resultó ganadora. La opción ganadora fue: "${winningOutcome.name}".`,
              priority: 'normal',
              cta_label: 'Ver posición',
              cta_href: `/dashboard/predicciones/mis-posiciones`,
              payload: {
                market_id: marketId,
                market_title: marketData.title,
                winning_outcome_id: winningOutcomeId,
                winning_outcome_name: winningOutcome.name
              }
            })
          }
        }
      } catch (notifError) {
        console.error('Error emitiendo notificaciones de resolución:', notifError)
        // No fallar la operación si la notificación falla
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error en resolveMarket:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Cancelar un mercado (solo para creadores)
 * Solo se puede cancelar si el mercado está activo y no tiene posiciones
 */
export async function cancelMarket(
  marketId: string,
  reason?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Obtener información del mercado
    const { data: marketData } = await supabase
      .from('prediction_markets')
      .select('id, title, creator_id, status, liquidity_pool_hnld')
      .eq('id', marketId)
      .single()
    
    if (!marketData) {
      return { success: false, error: 'Mercado no encontrado' }
    }
    
    if (marketData.creator_id !== user.id) {
      return { success: false, error: 'Solo el creador puede cancelar el mercado' }
    }
    
    // Verificar que el mercado esté activo
    if (marketData.status !== 'active') {
      return { success: false, error: `No se puede cancelar un mercado con estado: ${marketData.status}` }
    }
    
    // Verificar si hay posiciones activas
    const { data: positions, error: positionsError } = await supabase
      .from('market_positions')
      .select('id, shares')
      .eq('market_id', marketId)
      .gt('shares', 0)
    
    if (positionsError) {
      console.error('Error verificando posiciones:', positionsError)
      return { success: false, error: 'Error al verificar posiciones del mercado' }
    }
    
    // Si hay posiciones activas, no se puede cancelar (debe resolverse o esperar)
    if (positions && positions.length > 0) {
      const totalShares = positions.reduce((sum, p) => sum + p.shares, 0)
      return { 
        success: false, 
        error: `No se puede cancelar un mercado con posiciones activas (${totalShares} acciones en total). Debe resolver el mercado o esperar a que los participantes vendan sus posiciones.` 
      }
    }
    
    // Cancelar el mercado
    const cancelledAt = new Date().toISOString()
    const { error } = await supabase
      .from('prediction_markets')
      .update({
        status: 'cancelled',
        cancelled_at: cancelledAt,
        updated_at: cancelledAt
      })
      .eq('id', marketId)
    
    if (error) {
      console.error('Error cancelando mercado:', error)
      return { success: false, error: error.message }
    }
    
    // Emitir notificaciones
    try {
      // Notificación al creador
      await emitNotification({
        user_id: user.id,
        topic: 'prediction',
        event: 'MARKET_CANCELLED',
        title: 'Mercado cancelado',
        body: `Has cancelado el mercado "${marketData.title}".${reason ? ` Razón: ${reason}` : ''}`,
        priority: 'normal',
        cta_label: 'Ver mercado',
        cta_href: `/dashboard/predicciones/${marketId}`,
        payload: {
          market_id: marketId,
          market_title: marketData.title,
          reason: reason || null
        }
      })
      
      // Notificación broadcast a todos los usuarios EXCEPTO al creador
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', user.id)
      
      if (allUsers && allUsers.length > 0) {
        const notificationPromises = allUsers.map(u => 
          emitNotification({
            user_id: u.id,
            topic: 'prediction',
            event: 'MARKET_CANCELLED',
            title: 'Mercado cancelado',
            body: `El mercado "${marketData.title}" ha sido cancelado por su creador.${reason ? ` Razón: ${reason}` : ''}`,
            priority: 'normal',
            cta_label: 'Ver mercados',
            cta_href: `/dashboard/predicciones`,
            payload: {
              market_id: marketId,
              market_title: marketData.title,
              reason: reason || null
            }
          })
        )
        
        await Promise.allSettled(notificationPromises)
      }
    } catch (notifError) {
      console.error('Error emitiendo notificaciones de cancelación:', notifError)
      // No fallar la operación si la notificación falla
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error en cancelMarket:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Eliminar un mercado (solo para creadores)
 * Solo se puede eliminar si el mercado está cancelado y no tiene trades ni posiciones
 */
export async function deleteMarket(
  marketId: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Obtener información del mercado
    const { data: marketData } = await supabase
      .from('prediction_markets')
      .select('id, title, creator_id, status')
      .eq('id', marketId)
      .single()
    
    if (!marketData) {
      return { success: false, error: 'Mercado no encontrado' }
    }
    
    if (marketData.creator_id !== user.id) {
      return { success: false, error: 'Solo el creador puede eliminar el mercado' }
    }
    
    // Solo se puede eliminar mercados cancelados
    if (marketData.status !== 'cancelled') {
      return { success: false, error: 'Solo se pueden eliminar mercados cancelados. Primero debes cancelar el mercado.' }
    }
    
    // Verificar si hay trades (operaciones realizadas)
    const { data: trades, error: tradesError } = await supabase
      .from('market_trades')
      .select('id')
      .eq('market_id', marketId)
      .limit(1)
    
    if (tradesError) {
      console.error('Error verificando trades:', tradesError)
      return { success: false, error: 'Error al verificar operaciones del mercado' }
    }
    
    if (trades && trades.length > 0) {
      return { 
        success: false, 
        error: 'No se puede eliminar un mercado que tiene operaciones registradas. Los mercados con historial de trading no pueden ser eliminados.' 
      }
    }
    
    // Verificar si hay posiciones
    const { data: positions, error: positionsError } = await supabase
      .from('market_positions')
      .select('id')
      .eq('market_id', marketId)
      .limit(1)
    
    if (positionsError) {
      console.error('Error verificando posiciones:', positionsError)
      return { success: false, error: 'Error al verificar posiciones del mercado' }
    }
    
    if (positions && positions.length > 0) {
      return { 
        success: false, 
        error: 'No se puede eliminar un mercado que tiene posiciones registradas.' 
      }
    }
    
    // Eliminar outcomes primero (dependencia)
    const { error: outcomesError } = await supabase
      .from('market_outcomes')
      .delete()
      .eq('market_id', marketId)
    
    if (outcomesError) {
      console.error('Error eliminando outcomes:', outcomesError)
      return { success: false, error: 'Error al eliminar opciones del mercado' }
    }
    
    // Eliminar el mercado
    // Primero intentar con el cliente normal (respetando RLS)
    const { error } = await supabase
      .from('prediction_markets')
      .delete()
      .eq('id', marketId)
    
    if (error) {
      console.error('Error eliminando mercado:', error)
      // Si el error es de RLS, intentar con admin
      if (error.message?.includes('policy') || error.message?.includes('permission') || error.message?.includes('row-level security')) {
        console.log('⚠️ Error de RLS al eliminar, intentando con admin...')
        const adminClient = await supabaseAdmin()
        const { error: adminError } = await adminClient
          .from('prediction_markets')
          .delete()
          .eq('id', marketId)
        
        if (adminError) {
          console.error('Error eliminando mercado con admin:', adminError)
          return { success: false, error: adminError.message }
        }
      } else {
        return { success: false, error: error.message }
      }
    }
    
    // Emitir notificaciones
    try {
      // Notificación al creador
      await emitNotification({
        user_id: user.id,
        topic: 'prediction',
        event: 'MARKET_DELETED',
        title: 'Mercado eliminado',
        body: `Has eliminado el mercado "${marketData.title}".`,
        priority: 'normal',
        cta_label: 'Ver mis mercados',
        cta_href: `/dashboard/predicciones/mis-mercados`,
        payload: {
          market_id: marketId,
          market_title: marketData.title
        }
      })
      
      // Notificación broadcast a todos los usuarios EXCEPTO al creador
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', user.id)
      
      if (allUsers && allUsers.length > 0) {
        const notificationPromises = allUsers.map(u => 
          emitNotification({
            user_id: u.id,
            topic: 'prediction',
            event: 'MARKET_DELETED',
            title: 'Mercado eliminado',
            body: `El mercado "${marketData.title}" ha sido eliminado por su creador.`,
            priority: 'normal',
            cta_label: 'Ver mercados',
            cta_href: `/dashboard/predicciones`,
            payload: {
              market_id: marketId,
              market_title: marketData.title
            }
          })
        )
        
        await Promise.allSettled(notificationPromises)
      }
    } catch (notifError) {
      console.error('Error emitiendo notificaciones de eliminación:', notifError)
      // No fallar la operación si la notificación falla
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error en deleteMarket:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

