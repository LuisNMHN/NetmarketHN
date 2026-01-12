import { NextRequest, NextResponse } from "next/server"
import { getMarketById, deleteMarket } from "@/lib/actions/prediction_markets"

// =========================================================
// API PARA OBTENER UN MERCADO ESPECÍFICO
// =========================================================

export async function GET(
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

    const result = await getMarketById(marketId)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API get market by id:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// =========================================================
// API PARA ELIMINAR UN MERCADO
// =========================================================

export async function DELETE(
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

    const result = await deleteMarket(marketId)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API delete market:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}


