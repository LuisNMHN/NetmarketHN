import { NextRequest, NextResponse } from 'next/server'
import { createPurchaseTransaction, getPurchaseTransaction, getUserTransactions, updateTransactionStatus, uploadTransactionDocument, getTransactionDocuments, markNotificationAsRead, getUserTransactionNotifications, cancelTransaction, canUserPerformAction } from '@/lib/actions/purchase_transactions'

// =========================================================
// API PARA CREAR TRANSACCIÓN
// =========================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { request_id, seller_id, payment_method, payment_details } = body

    if (!request_id || !seller_id || !payment_method) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const result = await createPurchaseTransaction({
      request_id,
      seller_id,
      payment_method,
      payment_details
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in POST /api/transactions:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// =========================================================
// API PARA OBTENER TRANSACCIONES DE USUARIO
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type') as 'buyer' | 'seller' | 'all' || 'all'
    const transactionId = searchParams.get('transaction_id')

    if (transactionId) {
      // Obtener transacción específica
      const result = await getPurchaseTransaction(transactionId)
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json(result)
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      )
    }

    const result = await getUserTransactions(userId, type)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in GET /api/transactions:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
