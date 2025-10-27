import { NextRequest, NextResponse } from 'next/server'
import { updateTransactionStatus, cancelTransaction, canUserPerformAction } from '@/lib/actions/purchase_transactions'

// =========================================================
// API PARA ACTUALIZAR ESTADO DE TRANSACCIÓN
// =========================================================

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const transactionId = params.id
    const body = await request.json()
    const { new_status, user_id } = body

    if (!new_status) {
      return NextResponse.json(
        { success: false, error: 'Nuevo estado requerido' },
        { status: 400 }
      )
    }

    // Verificar permisos
    const permissionCheck = await canUserPerformAction(transactionId, 'view')
    if (!permissionCheck.success || !permissionCheck.data.canPerform) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para esta acción' },
        { status: 403 }
      )
    }

    const result = await updateTransactionStatus({
      transaction_id: transactionId,
      new_status,
      user_id
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in PUT /api/transactions/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// =========================================================
// API PARA CANCELAR TRANSACCIÓN
// =========================================================

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const transactionId = params.id
    const body = await request.json()
    const { reason } = body

    // Verificar permisos
    const permissionCheck = await canUserPerformAction(transactionId, 'cancel')
    if (!permissionCheck.success || !permissionCheck.data.canPerform) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para cancelar esta transacción' },
        { status: 403 }
      )
    }

    const result = await cancelTransaction(transactionId, reason)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in DELETE /api/transactions/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
