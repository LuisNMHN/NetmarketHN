import { NextRequest, NextResponse } from "next/server"
import { getUserBadges } from "@/lib/actions/reputation"

// =========================================================
// API PARA OBTENER BADGES DE UN USUARIO
// =========================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      )
    }

    const result = await getUserBadges(userId)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API get user badges:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
