import { NextRequest, NextResponse } from 'next/server'
import { uploadTransactionDocument, getTransactionDocuments } from '@/lib/actions/purchase_transactions'

// =========================================================
// API PARA SUBIR DOCUMENTO DE TRANSACCIÓN
// =========================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction_id, document_type, document_name, document_url, file_size, mime_type } = body

    if (!transaction_id || !document_type || !document_name || !document_url) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const result = await uploadTransactionDocument({
      transaction_id,
      document_type,
      document_name,
      document_url,
      file_size,
      mime_type
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in POST /api/transactions/documents:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// =========================================================
// API PARA OBTENER DOCUMENTOS DE TRANSACCIÓN
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transaction_id')

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'ID de transacción requerido' },
        { status: 400 }
      )
    }

    const result = await getTransactionDocuments(transactionId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in GET /api/transactions/documents:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
