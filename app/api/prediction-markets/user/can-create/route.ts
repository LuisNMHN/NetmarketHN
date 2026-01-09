import { NextRequest, NextResponse } from "next/server"
import { canUserCreateMarkets } from "@/lib/actions/prediction_markets"

// =========================================================
// API PARA VERIFICAR SI EL USUARIO PUEDE CREAR MERCADOS
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const result = await canUserCreateMarkets()
    console.log('API can-create result:', result) // Debug
    
    // Asegurar que siempre retornamos un objeto con success y canCreate
    if (result && typeof result.success === 'boolean') {
      return NextResponse.json({
        success: result.success,
        canCreate: result.canCreate || false,
        reason: result.reason
      })
    } else {
      return NextResponse.json({
        success: false,
        canCreate: false,
        reason: 'Error en la verificación de permisos'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API can user create markets:', error)
    return NextResponse.json(
      { success: false, canCreate: false, reason: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

