import { NextRequest, NextResponse } from "next/server"
import { cancelMarket } from "@/lib/actions/prediction_markets"

// =========================================================
// API PARA CANCELAR UN MERCADO
// =========================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params

    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'marketId es requerido' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const reason = body.reason || undefined

    const result = await cancelMarket(marketId, reason)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API cancel market:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
