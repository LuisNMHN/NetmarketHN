import { NextRequest, NextResponse } from "next/server"
import { 
  createUserReview, 
  getUserReviews, 
  getUserReputationMetrics, 
  getUserBadges,
  getAllBadges,
  updateUserReputationMetrics,
  getReputationStats,
  canUserReview
} from "@/lib/actions/reputation"

// =========================================================
// API PARA CREAR REVIEWS
// =========================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const result = await createUserReview(body)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API create review:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// =========================================================
// API PARA OBTENER REVIEWS DE UN USUARIO
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      )
    }

    const result = await getUserReviews(userId, limit, offset)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    console.error('Error en API get reviews:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
