import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// =========================================================
// FUNCIONES DEL SERVIDOR PARA EL SISTEMA DE COMPLETAR COMPRA
// =========================================================
// Estas funciones solo se pueden usar en Server Components o API Routes
// =========================================================

/**
 * Crear una nueva transacción de compra (Server Action)
 */
export async function createPurchaseTransactionServerAction(data: {
  request_id: string
  seller_id: string
  payment_method: string
  payment_details?: any
}) {
  try {
    const supabase = await createClient()
    
    const { data: result, error } = await supabase.rpc('create_purchase_transaction', {
      p_request_id: data.request_id,
      p_seller_id: data.seller_id,
      p_payment_method: data.payment_method,
      p_payment_details: data.payment_details || null
    })

    if (error) {
      console.error('Error creating transaction:', error)
      return { success: false, error: error.message }
    }

    // Obtener la transacción creada con todos los detalles
    const { data: transaction, error: fetchError } = await supabase
      .from('purchase_transactions')
      .select(`
        *,
        transaction_steps (*),
        buyer:buyer_id (id, full_name, avatar_url),
        seller:seller_id (id, full_name, avatar_url),
        request:purchase_requests (*)
      `)
      .eq('id', result)
      .single()

    if (fetchError) {
      console.error('Error fetching transaction:', fetchError)
      return { success: false, error: fetchError.message }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/mis-solicitudes')
    
    return { success: true, data: transaction }
  } catch (error) {
    console.error('Unexpected error creating transaction:', error)
    return { success: false, error: 'Error inesperado al crear la transacción' }
  }
}

/**
 * Actualizar el estado de una transacción (Server Action)
 */
export async function updateTransactionStatusServerAction(data: {
  transaction_id: string
  new_status: string
  user_id?: string
}) {
  try {
    const supabase = await createClient()
    
    const { data: result, error } = await supabase.rpc('update_transaction_status', {
      p_transaction_id: data.transaction_id,
      p_new_status: data.new_status,
      p_user_id: data.user_id || null
    })

    if (error) {
      console.error('Error updating transaction status:', error)
      return { success: false, error: error.message }
    }

    // Obtener la transacción actualizada
    const { data: transaction, error: fetchError } = await supabase
      .from('purchase_transactions')
      .select(`
        *,
        transaction_steps (*),
        buyer:buyer_id (id, full_name, avatar_url),
        seller:seller_id (id, full_name, avatar_url),
        request:purchase_requests (*)
      `)
      .eq('id', data.transaction_id)
      .single()

    if (fetchError) {
      console.error('Error fetching updated transaction:', fetchError)
      return { success: false, error: fetchError.message }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/mis-solicitudes')
    
    return { success: true, data: transaction }
  } catch (error) {
    console.error('Unexpected error updating transaction status:', error)
    return { success: false, error: 'Error inesperado al actualizar el estado' }
  }
}

/**
 * Subir documento de transacción (Server Action)
 */
export async function uploadTransactionDocumentServerAction(data: {
  transaction_id: string
  document_type: string
  document_name: string
  document_url: string
  file_size?: number
  mime_type?: string
}) {
  try {
    const supabase = await createClient()
    
    const { data: document, error } = await supabase
      .from('transaction_documents')
      .insert({
        transaction_id: data.transaction_id,
        document_type: data.document_type,
        document_name: data.document_name,
        document_url: data.document_url,
        file_size: data.file_size,
        mime_type: data.mime_type,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error uploading document:', error)
      return { success: false, error: error.message }
    }

    // Si es un comprobante de pago, actualizar la transacción
    if (data.document_type === 'payment_proof') {
      const { error: updateError } = await supabase
        .from('purchase_transactions')
        .update({
          payment_proof_url: data.document_url,
          payment_proof_uploaded_at: new Date().toISOString()
        })
        .eq('id', data.transaction_id)

      if (updateError) {
        console.error('Error updating transaction with payment proof:', updateError)
      }
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/mis-solicitudes')
    
    return { success: true, data: document }
  } catch (error) {
    console.error('Unexpected error uploading document:', error)
    return { success: false, error: 'Error inesperado al subir el documento' }
  }
}

/**
 * Cancelar una transacción (Server Action)
 */
export async function cancelTransactionServerAction(data: {
  transaction_id: string
  reason?: string
}) {
  try {
    const supabase = await createClient()
    
    // Actualizar estado a cancelado
    const { error: updateError } = await supabase
      .from('purchase_transactions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', data.transaction_id)

    if (updateError) {
      console.error('Error cancelling transaction:', updateError)
      return { success: false, error: updateError.message }
    }

    // Crear notificación de cancelación
    const { data: transaction } = await supabase
      .from('purchase_transactions')
      .select('buyer_id, seller_id')
      .eq('id', data.transaction_id)
      .single()

    if (transaction) {
      await supabase
        .from('transaction_notifications')
        .insert([
          {
            transaction_id: data.transaction_id,
            user_id: transaction.buyer_id,
            notification_type: 'transaction_cancelled',
            title: 'Transacción cancelada',
            message: data.reason || 'La transacción ha sido cancelada'
          },
          {
            transaction_id: data.transaction_id,
            user_id: transaction.seller_id,
            notification_type: 'transaction_cancelled',
            title: 'Transacción cancelada',
            message: data.reason || 'La transacción ha sido cancelada'
          }
        ])
    }

    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/mis-solicitudes')
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error cancelling transaction:', error)
    return { success: false, error: 'Error inesperado al cancelar la transacción' }
  }
}
