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
  liquidity_pool_hnld: number // Mantener para compatibilidad
  total_pool_hnld: number // Pool total Parimutuel
  created_at: string
  closed_at?: string
  resolved_at?: string
  cancelled_at?: string
  min_trade_amount: number // Mínimo de apuesta
  max_trade_amount?: number // Máximo de apuesta
  trading_fee_percent: number // Mantener para compatibilidad
  platform_fee_percent: number
  winning_outcome_id?: string
  resolution_notes?: string
  total_volume_hnld?: number
  total_trades?: number
  total_bets?: number // Total de apuestas
}

export interface MarketOutcome {
  id: string
  market_id: string
  name: string
  description?: string
  order_index: number
  current_price?: number // Mantener para compatibilidad
  probability: number // Probabilidad Parimutuel (0-1)
  total_shares?: number // Mantener para compatibilidad
  total_bet_amount: number // Total apostado en esta opción
  total_volume_hnld?: number // Mantener para compatibilidad
  is_winner: boolean
  created_at: string
}

export interface MarketBet {
  id: string
  user_id: string
  market_id: string
  outcome_id: string
  bet_amount: number // Cantidad apostada en HNLD
  probability_at_bet: number // Probabilidad al momento de la apuesta
  potential_payout: number // Ganancia potencial si gana
  is_winner: boolean
  payout_received: number // Ganancia recibida al resolver
  created_at: string
  market?: PredictionMarket
  outcome?: MarketOutcome
}

// Mantener MarketPosition para compatibilidad (ahora será basado en bets)
export interface MarketPosition {
  id: string
  user_id: string
  market_id: string
  outcome_id: string
  shares?: number // Mantener para compatibilidad
  bet_amount: number // Cantidad apostada
  average_cost_hnld?: number // Mantener para compatibilidad
  total_invested_hnld: number // Total apostado
  current_value_hnld?: number // Mantener para compatibilidad
  potential_payout: number // Ganancia potencial
  unrealized_pnl_hnld?: number // Mantener para compatibilidad
  updated_at: string
  market?: PredictionMarket
  outcome?: MarketOutcome
}

// Mantener MarketTrade para compatibilidad (ahora será bet history)
export interface MarketTrade {
  id: string
  market_id: string
  outcome_id: string
  user_id: string
  trade_type?: 'buy' | 'sell' // Mantener para compatibilidad
  bet_amount: number // Cantidad apostada
  shares?: number // Mantener para compatibilidad
  price_per_share?: number // Mantener para compatibilidad
  probability_at_bet: number // Probabilidad al momento de la apuesta
  total_cost_hnld: number // Total de la apuesta
  creator_fee_hnld?: number // Mantener para compatibilidad
  platform_fee_hnld: number
  shares_after?: number // Mantener para compatibilidad
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
 * Obtener rol del usuario en un mercado
 */
export async function getUserMarketRole(marketId: string): Promise<{
  success: boolean
  role?: 'creator' | 'participant' | 'creator_and_participant' | 'viewer'
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: true, role: 'viewer' }
    }
    
    const { data: role, error } = await supabase.rpc('get_user_market_role', {
      p_user_id: user.id,
      p_market_id: marketId
    })
    
    if (error) {
      console.error('Error obteniendo rol:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, role: role as any || 'viewer' }
  } catch (error) {
    console.error('Error en getUserMarketRole:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener un mercado específico con sus outcomes
 */
export async function getMarketById(marketId: string): Promise<{
  success: boolean
  data?: PredictionMarket & { outcomes: MarketOutcome[]; user_role?: string }
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
    
    // Obtener estadísticas del mercado (usando market_bets)
    const { count: totalBets } = await supabase
      .from('market_bets')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)
    
    // Recalcular probabilidades antes de devolver
    await supabase.rpc('calculate_parimutuel_probabilities', {
      p_market_id: marketId
    })
    
    // Obtener outcomes actualizados con probabilidades
    const { data: updatedOutcomes } = await supabase
      .from('market_outcomes')
      .select('*')
      .eq('market_id', marketId)
      .order('order_index', { ascending: true })
    
    // Obtener rol del usuario
    const roleResult = await getUserMarketRole(marketId)
    
    return {
      success: true,
      data: {
        ...market,
        creator_name: creatorProfile?.full_name || 'Usuario',
        outcomes: updatedOutcomes || outcomes || [],
        total_trades: totalBets || 0,
        total_bets: totalBets || 0,
        total_volume_hnld: market.total_pool_hnld || market.liquidity_pool_hnld || 0,
        user_role: roleResult.role
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
 * Realizar apuesta Parimutuel en un mercado
 */
export async function placeParimutuelBet(
  marketId: string,
  outcomeId: string,
  betAmount: number
): Promise<{
  success: boolean
  betId?: string
  error?: string
}> {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }
    
    // Obtener información del mercado antes de la participación
    const { data: market } = await supabase
      .from('prediction_markets')
      .select('id, title, creator_id')
      .eq('id', marketId)
      .single()
    
    const { data: betId, error } = await supabase.rpc('place_parimutuel_bet', {
      p_user_id: user.id,
      p_market_id: marketId,
      p_outcome_id: outcomeId,
      p_bet_amount: betAmount
    })
    
    if (error) {
      console.error('Error realizando apuesta:', error)
      return { success: false, error: error.message }
    }
    
    // Emitir notificaciones
    if (betId && market) {
      try {
        // Notificación al participante
        await emitNotification({
          user_id: user.id,
          topic: 'prediction',
          event: 'MARKET_PARTICIPATION',
          title: 'Participación realizada exitosamente',
          body: `Has participado con ${formatCurrency(betAmount, 'HNLD')} en el mercado "${market.title}".`,
          priority: 'normal',
          cta_label: 'Ver mercado',
          cta_href: `/dashboard/predicciones/${marketId}`,
          payload: {
            market_id: marketId,
            market_title: market.title,
            bet_id: betId,
            bet_amount: betAmount,
            bet_type: 'parimutuel'
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
            body: `${participantName} ha participado con ${formatCurrency(betAmount, 'HNLD')} en tu mercado "${market.title}".`,
            priority: 'normal',
            cta_label: 'Ver mercado',
            cta_href: `/dashboard/predicciones/${marketId}`,
            payload: {
              market_id: marketId,
              market_title: market.title,
              bet_id: betId,
              participant_id: user.id,
              participant_name: participantName,
              bet_amount: betAmount,
              bet_type: 'parimutuel'
            }
          })
        }
      } catch (notifError) {
        console.error('Error emitiendo notificaciones de participación:', notifError)
        // No fallar la operación si la notificación falla
      }
    }
    
    return { success: true, betId }
  } catch (error) {
    console.error('Error en placeParimutuelBet:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * @deprecated Usar placeParimutuelBet en su lugar
 * Mantener para compatibilidad temporal
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
  // Convertir shares a betAmount (asumiendo 1 share = 1 HNLD para compatibilidad)
  return placeParimutuelBet(marketId, outcomeId, shares)
}

/**
 * @deprecated No se pueden vender participaciones, solo participar
 * Las participaciones se mantienen hasta la resolución del mercado
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
  return { 
    success: false, 
    error: 'En el sistema Parimutuel no se pueden vender apuestas. Las apuestas se mantienen hasta la resolución del mercado.' 
  }
}

/**
 * Obtener participaciones del usuario (predicciones realizadas)
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
    
    // Obtener apuestas del usuario
    const { data: bets, error } = await supabase
      .from('market_bets')
      .select(`
        *,
        market:prediction_markets(*),
        outcome:market_outcomes(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    // Convertir bets a formato MarketPosition para compatibilidad
    const positions: MarketPosition[] = (bets || []).map(bet => ({
      id: bet.id,
      user_id: bet.user_id,
      market_id: bet.market_id,
      outcome_id: bet.outcome_id,
      bet_amount: bet.bet_amount,
      total_invested_hnld: bet.bet_amount,
      potential_payout: bet.potential_payout,
      updated_at: bet.created_at,
      market: bet.market,
      outcome: bet.outcome
    }))
    
    return { success: true, data: positions }
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
    
    // Obtener todas las participaciones antes de resolver
    const { data: allBets } = await supabase
      .from('market_bets')
      .select('user_id, outcome_id, bet_amount')
      .eq('market_id', marketId)
    
    const { error } = await supabase.rpc('resolve_parimutuel_market', {
      p_market_id: marketId,
      p_winning_outcome_id: winningOutcomeId,
      p_resolution_notes: resolutionNotes || null
    })
    
    if (error) {
      console.error('Error resolviendo mercado:', error)
      return { success: false, error: error.message }
    }
    
    // Emitir notificaciones después de resolver exitosamente
    if (allBets && marketData && winningOutcome) {
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
        
        // Obtener información de pagos para notificar a ganadores
        const { data: winningBets } = await supabase
          .from('market_bets')
          .select('user_id, payout_received, bet_amount')
          .eq('market_id', marketId)
          .eq('outcome_id', winningOutcomeId)
          .eq('is_winner', true)
        
        // Notificar a todos los participantes con predicciones
        const uniqueUserIds = [...new Set(allBets.map(b => b.user_id))]
        
        for (const participantId of uniqueUserIds) {
          // Obtener apuestas del participante
          const participantBets = allBets.filter(b => b.user_id === participantId)
          const hasWinningBet = participantBets.some(b => b.outcome_id === winningOutcomeId)
          
          if (hasWinningBet) {
            // Obtener pago del participante
            const participantWinningBet = winningBets?.find(b => b.user_id === participantId)
            const payout = participantWinningBet?.payout_received || 0
            const betAmount = participantWinningBet?.bet_amount || 0
            
            await emitNotification({
              user_id: participantId,
              topic: 'prediction',
              event: 'POSITION_WINNER',
              title: '¡Felicidades! Ganaste en el mercado',
              body: `Tu apuesta en el mercado "${marketData.title}" resultó ganadora. Has ganado ${payout.toFixed(2)} HNLD (apostaste ${betAmount.toFixed(2)} HNLD).`,
              priority: 'high',
              cta_label: 'Ver posición',
              cta_href: `/dashboard/predicciones/mis-posiciones`,
              payload: {
                market_id: marketId,
                market_title: marketData.title,
                winning_outcome_id: winningOutcomeId,
                winning_outcome_name: winningOutcome.name,
                bet_amount: betAmount,
                payout: payout
              }
            })
          } else {
            // Notificar a los perdedores
            await emitNotification({
              user_id: participantId,
              topic: 'prediction',
              event: 'POSITION_LOSER',
              title: 'Mercado resuelto',
              body: `El mercado "${marketData.title}" ha sido resuelto. Tu apuesta no resultó ganadora. La opción ganadora fue: "${winningOutcome.name}".`,
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
    
    // Verificar si hay participaciones activas
    const { data: bets, error: betsError } = await supabase
      .from('market_bets')
      .select('id, bet_amount')
      .eq('market_id', marketId)
      .gt('bet_amount', 0)
    
    if (betsError) {
      console.error('Error verificando apuestas:', betsError)
      return { success: false, error: 'Error al verificar apuestas del mercado' }
    }
    
    // Si hay apuestas activas, no se puede cancelar (debe resolverse)
    if (bets && bets.length > 0) {
      const totalBets = bets.reduce((sum, b) => sum + (b.bet_amount || 0), 0)
      return { 
        success: false, 
        error: `No se puede cancelar un mercado con participaciones activas (${formatCurrency(totalBets, 'HNLD')} en participaciones). Debe resolver el mercado primero.` 
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
    
    // Verificar si hay participaciones (historial)
    const { data: bets, error: betsError } = await supabase
      .from('market_bets')
      .select('id')
      .eq('market_id', marketId)
      .limit(1)
    
    if (betsError) {
      console.error('Error verificando apuestas:', betsError)
      return { success: false, error: 'Error al verificar apuestas del mercado' }
    }
    
    if (bets && bets.length > 0) {
      return { 
        success: false, 
        error: 'No se puede eliminar un mercado que tiene apuestas registradas. Los mercados con historial de apuestas no pueden ser eliminados.' 
      }
    }
    
    // Verificar si hay historial de participaciones
    const { data: betHistory, error: historyError } = await supabase
      .from('market_bets_history')
      .select('id')
      .eq('market_id', marketId)
      .limit(1)
    
    if (historyError) {
      console.error('Error verificando historial de apuestas:', historyError)
      return { success: false, error: 'Error al verificar historial del mercado' }
    }
    
    if (betHistory && betHistory.length > 0) {
      return { 
        success: false, 
        error: 'No se puede eliminar un mercado que tiene historial de participaciones registrado.' 
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

