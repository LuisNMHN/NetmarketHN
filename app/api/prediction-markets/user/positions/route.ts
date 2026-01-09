import { NextRequest, NextResponse } from "next/server"
import { getUserPositions } from "@/lib/actions/prediction_markets"

// =========================================================
// API PARA OBTENER POSICIONES DEL USUARIO
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const result = await getUserPositions()
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API get user positions:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}


