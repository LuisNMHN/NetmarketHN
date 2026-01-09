import { supabaseServer } from "@/lib/supabase/server"

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
      .eq('status', 'active')
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
    
    // Verificar que el usuario es el creador
    const { data: market } = await supabase
      .from('prediction_markets')
      .select('creator_id')
      .eq('id', marketId)
      .single()
    
    if (!market || market.creator_id !== user.id) {
      return { success: false, error: 'Solo el creador puede resolver el mercado' }
    }
    
    const { error } = await supabase.rpc('resolve_prediction_market', {
      p_market_id: marketId,
      p_winning_outcome_id: winningOutcomeId,
      p_resolution_notes: resolutionNotes || null
    })
    
    if (error) {
      console.error('Error resolviendo mercado:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error en resolveMarket:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

