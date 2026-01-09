import { NextRequest, NextResponse } from "next/server"
import { getActiveMarkets } from "@/lib/actions/prediction_markets"

// =========================================================
// API PARA OBTENER MERCADOS ACTIVOS
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await getActiveMarkets(limit, offset)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      console.error('Error en getActiveMarkets:', result.error)
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API get active markets:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

