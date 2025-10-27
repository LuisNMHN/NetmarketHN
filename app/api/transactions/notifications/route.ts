import { NextRequest, NextResponse } from 'next/server'
import { markNotificationAsRead, getUserTransactionNotifications } from '@/lib/actions/purchase_transactions'

// =========================================================
// API PARA OBTENER NOTIFICACIONES DE TRANSACCIÓN
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      )
    }

    const result = await getUserTransactionNotifications(userId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in GET /api/transactions/notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// =========================================================
// API PARA MARCAR NOTIFICACIÓN COMO LEÍDA
// =========================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { notification_id } = body

    if (!notification_id) {
      return NextResponse.json(
        { success: false, error: 'ID de notificación requerido' },
        { status: 400 }
      )
    }

    const result = await markNotificationAsRead(notification_id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in PUT /api/transactions/notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
