"use server"

import { revalidatePath } from "next/cache"
import { 
  createPredictionMarket as createMarket, 
  placeParimutuelBet,
  buyMarketShares as buyShares, // Mantener para compatibilidad
  sellMarketShares as sellShares, // Mantener para compatibilidad
  resolveMarket as resolve 
} from "@/lib/actions/prediction_markets"
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
 * Server Action: Realizar participación en mercado
 */
export async function placeBet(
  marketId: string,
  outcomeId: string,
  betAmount: number
) {
  const result = await placeParimutuelBet(marketId, outcomeId, betAmount)
  if (result.success) {
    revalidatePath('/dashboard/predicciones')
    revalidatePath(`/dashboard/predicciones/${marketId}`)
    revalidatePath('/dashboard/predicciones/mis-posiciones')
  }
  return result
}

/**
 * @deprecated Usar placeBet en su lugar
 * Server Action: Comprar acciones (compatibilidad)
 */
export async function buyMarketShares(
  marketId: string,
  outcomeId: string,
  shares: number,
  maxPrice?: number
) {
  // Convertir a participación
  const result = await placeBet(marketId, outcomeId, shares)
  if (result.success) {
    revalidatePath('/dashboard/predicciones')
    revalidatePath(`/dashboard/predicciones/${marketId}`)
    revalidatePath('/dashboard/predicciones/mis-posiciones')
  }
  return result
}

/**
 * @deprecated No se pueden vender participaciones
 * Server Action: Vender acciones (compatibilidad)
 */
export async function sellMarketShares(
  marketId: string,
  outcomeId: string,
  shares: number,
  minPrice?: number
) {
  return { 
    success: false, 
    error: 'No se pueden vender participaciones. Las participaciones se mantienen hasta la resolución del mercado.' 
  }
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


