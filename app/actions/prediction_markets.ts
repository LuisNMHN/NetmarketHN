"use server"

import { revalidatePath } from "next/cache"
import { createPredictionMarket as createMarket, buyMarketShares as buyShares, sellMarketShares as sellShares, resolveMarket as resolve } from "@/lib/actions/prediction_markets"
import type { CreateMarketData } from "@/lib/actions/prediction_markets"

/**
 * Server Action: Crear mercado de predicción
 */
export async function createPredictionMarket(data: CreateMarketData) {
  const result = await createMarket(data)
  if (result.success) {
    revalidatePath('/dashboard/predicciones')
    revalidatePath('/dashboard/predicciones/mis-mercados')
  }
  return result
}

/**
 * Server Action: Comprar acciones
 */
export async function buyMarketShares(
  marketId: string,
  outcomeId: string,
  shares: number,
  maxPrice?: number
) {
  const result = await buyShares(marketId, outcomeId, shares, maxPrice)
  if (result.success) {
    revalidatePath('/dashboard/predicciones')
    revalidatePath(`/dashboard/predicciones/${marketId}`)
    revalidatePath('/dashboard/predicciones/mis-posiciones')
  }
  return result
}

/**
 * Server Action: Vender acciones
 */
export async function sellMarketShares(
  marketId: string,
  outcomeId: string,
  shares: number,
  minPrice?: number
) {
  const result = await sellShares(marketId, outcomeId, shares, minPrice)
  if (result.success) {
    revalidatePath('/dashboard/predicciones')
    revalidatePath(`/dashboard/predicciones/${marketId}`)
    revalidatePath('/dashboard/predicciones/mis-posiciones')
  }
  return result
}

/**
 * Server Action: Resolver mercado
 */
export async function resolveMarket(
  marketId: string,
  winningOutcomeId: string,
  resolutionNotes?: string
) {
  const result = await resolve(marketId, winningOutcomeId, resolutionNotes)
  if (result.success) {
    revalidatePath('/dashboard/predicciones')
    revalidatePath(`/dashboard/predicciones/${marketId}`)
    revalidatePath('/dashboard/predicciones/mis-mercados')
  }
  return result
}


