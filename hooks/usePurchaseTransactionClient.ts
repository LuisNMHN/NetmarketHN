'use client'

import { useState, useCallback } from 'react'
// import { toast } from 'sonner' // Desactivado por ahora para enfocarnos en funcionalidad
import { 
  createPurchaseTransaction, 
  updateTransactionStatus, 
  uploadTransactionDocument,
  getUserTransactions,
  cancelTransaction,
  canUserPerformAction,
  type PurchaseTransaction,
  type TransactionStep,
  type TransactionDocument
} from '@/lib/actions/purchase_transactions'

// =========================================================
// HOOK PARA MANEJAR TRANSACCIONES EN EL CLIENTE
// =========================================================

export function usePurchaseTransactionClient() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // =========================================================
  // FUNCIONES PRINCIPALES
  // =========================================================

  const createTransaction = useCallback(async (data: {
    request_id: string
    seller_id: string
    buyer_id?: string
    amount?: number
    currency?: string
    payment_method: string
    payment_details?: any
  }) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await createPurchaseTransaction(data)
      
      if (result.success) {
        // toast.success('Transacción creada exitosamente')
        return { success: true, data: result.data }
      } else {
        setError(result.error || 'Error al crear la transacción')
        // toast.error(result.error || 'Error al crear la transacción')
        return { success: false, error: result.error }
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al crear la transacción'
      setError(errorMessage)
      // toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const updateStatus = useCallback(async (data: {
    transaction_id: string
    new_status: string
    user_id?: string
  }) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await updateTransactionStatus(data)
      
      if (result.success) {
        // toast.success('Estado actualizado correctamente')
        return { success: true, data: result.data }
      } else {
        setError(result.error || 'Error al actualizar el estado')
        // toast.error(result.error || 'Error al actualizar el estado')
        return { success: false, error: result.error }
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al actualizar el estado'
      setError(errorMessage)
      // toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadDocument = useCallback(async (data: {
    transaction_id: string
    document_type: string
    document_name: string
    document_url: string
    file_size?: number
    mime_type?: string
  }) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await uploadTransactionDocument(data)
      
      if (result.success) {
        // toast.success('Documento subido correctamente')
        return { success: true, data: result.data }
      } else {
        setError(result.error || 'Error al subir el documento')
        // toast.error(result.error || 'Error al subir el documento')
        return { success: false, error: result.error }
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al subir el documento'
      setError(errorMessage)
      // toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const cancelTransactionAction = useCallback(async (data: {
    transaction_id: string
    reason?: string
  }) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await cancelTransaction(data.transaction_id, data.reason)
      
      if (result.success) {
        // toast.success('Transacción cancelada')
        return { success: true }
      } else {
        setError(result.error || 'Error al cancelar la transacción')
        // toast.error(result.error || 'Error al cancelar la transacción')
        return { success: false, error: result.error }
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al cancelar la transacción'
      setError(errorMessage)
      // toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const checkPermissions = useCallback(async (transactionId: string, action: string) => {
    try {
      const result = await canUserPerformAction(transactionId, action)
      
      if (result.success) {
        return result.data
      } else {
        return { canPerform: false, isBuyer: false, isSeller: false }
      }
    } catch (err) {
      return { canPerform: false, isBuyer: false, isSeller: false }
    }
  }, [])

  const getUserTransactionsList = useCallback(async (userId: string, type: 'buyer' | 'seller' | 'all' = 'all') => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await getUserTransactions(userId, type)
      
      if (result.success) {
        return { success: true, data: result.data }
      } else {
        setError(result.error || 'Error al obtener las transacciones')
        return { success: false, error: result.error }
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al obtener las transacciones'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  // =========================================================
  // RETORNO
  // =========================================================

  return {
    // Estados
    loading,
    error,
    
    // Acciones
    createTransaction,
    updateStatus,
    uploadDocument,
    cancelTransaction: cancelTransactionAction,
    checkPermissions,
    getUserTransactions: getUserTransactionsList,
    
    // Utilidades
    clearError: () => setError(null)
  }
}
