"use client"

// =========================================================
// TIPOS (re-exportados)
// =========================================================
export type {
  PredictionMarket,
  MarketOutcome,
  MarketPosition,
  MarketTrade,
  CreateMarketData
} from "./prediction_markets"

// =========================================================
// FUNCIONES PARA CLIENT COMPONENTS (usando API routes)
// =========================================================

/**
 * Obtener mercados activos (para client components)
 */
export async function getActiveMarkets(limit: number = 50, offset: number = 0): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  try {
    const response = await fetch(`/api/prediction-markets?limit=${limit}&offset=${offset}`)
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error obteniendo mercados:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener un mercado específico con sus outcomes (para client components)
 */
export async function getMarketById(marketId: string): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const response = await fetch(`/api/prediction-markets/${marketId}`)
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error obteniendo mercado:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Verificar si el usuario puede crear mercados (para client components)
 */
export async function canUserCreateMarkets(): Promise<{ success: boolean; canCreate: boolean; reason?: string }> {
  try {
    const response = await fetch('/api/prediction-markets/user/can-create')
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error verificando permisos:', error)
    return { success: false, canCreate: false, reason: 'Error interno' }
  }
}

/**
 * Obtener posiciones del usuario (para client components)
 */
export async function getUserPositions(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  try {
    const response = await fetch('/api/prediction-markets/user/positions')
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error obteniendo posiciones:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtener mercados creados por el usuario (para client components)
 */
export async function getUserMarkets(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  try {
    const response = await fetch('/api/prediction-markets/user/markets')
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error obteniendo mercados del usuario:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

