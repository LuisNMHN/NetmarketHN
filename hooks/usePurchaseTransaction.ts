'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { 
  createPurchaseTransaction, 
  getPurchaseTransaction, 
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
// TIPOS E INTERFACES
// =========================================================

interface UsePurchaseTransactionParams {
  transactionId?: string
  userId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface TransactionData extends PurchaseTransaction {
  transaction_steps: TransactionStep[]
  transaction_documents: TransactionDocument[]
  buyer: { id: string; full_name: string; avatar_url?: string }
  seller: { id: string; full_name: string; avatar_url?: string }
  request: any
}

interface UsePurchaseTransactionReturn {
  // Estados
  transaction: TransactionData | null
  transactions: TransactionData[]
  loading: boolean
  error: string | null
  
  // Acciones
  createTransaction: (data: {
    request_id: string
    seller_id: string
    payment_method: string
    payment_details?: any
  }) => Promise<boolean>
  
  updateStatus: (newStatus: string) => Promise<boolean>
  uploadDocument: (file: File, documentType: string) => Promise<boolean>
  cancelTransaction: (reason?: string) => Promise<boolean>
  refreshTransaction: () => Promise<void>
  loadUserTransactions: (type?: 'buyer' | 'seller' | 'all') => Promise<void>
  
  // Utilidades
  canPerformAction: (action: string) => Promise<{ canPerform: boolean; isBuyer: boolean; isSeller: boolean }>
  getCurrentStep: () => TransactionStep | null
  getStepProgress: () => number
  getTimeRemaining: () => number | null
  isPaymentOverdue: () => boolean
}

// =========================================================
// HOOK PRINCIPAL
// =========================================================

export function usePurchaseTransaction({
  transactionId,
  userId,
  autoRefresh = false,
  refreshInterval = 30000 // 30 segundos
}: UsePurchaseTransactionParams = {}): UsePurchaseTransactionReturn {
  
  // Estados
  const [transaction, setTransaction] = useState<TransactionData | null>(null)
  const [transactions, setTransactions] = useState<TransactionData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // =========================================================
  // FUNCIONES PRINCIPALES
  // =========================================================

  const createTransaction = useCallback(async (data: {
    request_id: string
    seller_id: string
    payment_method: string
    payment_details?: any
  }) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await createPurchaseTransaction(data)
      
      if (result.success) {
        setTransaction(result.data)
        toast.success('Transacción creada exitosamente')
        return true
      } else {
        setError(result.error || 'Error al crear la transacción')
        toast.error(result.error || 'Error al crear la transacción')
        return false
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al crear la transacción'
      setError(errorMessage)
      toast.error(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const updateStatus = useCallback(async (newStatus: string) => {
    if (!transaction) return false
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await updateTransactionStatus({
        transaction_id: transaction.id,
        new_status: newStatus as any
      })
      
      if (result.success) {
        setTransaction(result.data)
        toast.success('Estado actualizado correctamente')
        return true
      } else {
        setError(result.error || 'Error al actualizar el estado')
        toast.error(result.error || 'Error al actualizar el estado')
        return false
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al actualizar el estado'
      setError(errorMessage)
      toast.error(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [transaction])

  const uploadDocument = useCallback(async (file: File, documentType: string) => {
    if (!transaction) return false
    
    setLoading(true)
    setError(null)
    
    try {
      // Aquí implementarías la subida del archivo a Supabase Storage
      // Por ahora simulamos la URL
      const documentUrl = `https://example.com/documents/${file.name}`
      
      const result = await uploadTransactionDocument({
        transaction_id: transaction.id,
        document_type: documentType,
        document_name: file.name,
        document_url: documentUrl,
        file_size: file.size,
        mime_type: file.type
      })
      
      if (result.success) {
        // Refrescar la transacción para obtener los documentos actualizados
        await refreshTransaction()
        toast.success('Documento subido correctamente')
        return true
      } else {
        setError(result.error || 'Error al subir el documento')
        toast.error(result.error || 'Error al subir el documento')
        return false
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al subir el documento'
      setError(errorMessage)
      toast.error(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [transaction])

  const cancelTransactionAction = useCallback(async (reason?: string) => {
    if (!transaction) return false
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await cancelTransaction(transaction.id, reason)
      
      if (result.success) {
        await refreshTransaction()
        toast.success('Transacción cancelada')
        return true
      } else {
        setError(result.error || 'Error al cancelar la transacción')
        toast.error(result.error || 'Error al cancelar la transacción')
        return false
      }
    } catch (err) {
      const errorMessage = 'Error inesperado al cancelar la transacción'
      setError(errorMessage)
      toast.error(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [transaction])

  const refreshTransaction = useCallback(async () => {
    if (!transactionId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await getPurchaseTransaction(transactionId)
      
      if (result.success) {
        setTransaction(result.data)
      } else {
        setError(result.error || 'Error al obtener la transacción')
      }
    } catch (err) {
      setError('Error inesperado al obtener la transacción')
    } finally {
      setLoading(false)
    }
  }, [transactionId])

  const loadUserTransactions = useCallback(async (type: 'buyer' | 'seller' | 'all' = 'all') => {
    if (!userId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await getUserTransactions(userId, type)
      
      if (result.success) {
        setTransactions(result.data)
      } else {
        setError(result.error || 'Error al obtener las transacciones')
      }
    } catch (err) {
      setError('Error inesperado al obtener las transacciones')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const canPerformAction = useCallback(async (action: string) => {
    if (!transactionId) {
      return { canPerform: false, isBuyer: false, isSeller: false }
    }
    
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
  }, [transactionId])

  // =========================================================
  // FUNCIONES UTILITARIAS
  // =========================================================

  const getCurrentStep = useCallback((): TransactionStep | null => {
    if (!transaction?.transaction_steps) return null
    
    return transaction.transaction_steps.find(step => step.status === 'in_progress') || 
           transaction.transaction_steps.find(step => step.status === 'pending') ||
           null
  }, [transaction])

  const getStepProgress = useCallback((): number => {
    if (!transaction?.transaction_steps) return 0
    
    const totalSteps = transaction.transaction_steps.length
    const completedSteps = transaction.transaction_steps.filter(step => step.status === 'completed').length
    
    return (completedSteps / totalSteps) * 100
  }, [transaction])

  const getTimeRemaining = useCallback((): number | null => {
    if (!transaction?.payment_deadline) return null
    
    const now = new Date().getTime()
    const deadline = new Date(transaction.payment_deadline).getTime()
    const remaining = Math.max(0, deadline - now)
    
    return remaining
  }, [transaction])

  const isPaymentOverdue = useCallback((): boolean => {
    const timeRemaining = getTimeRemaining()
    return timeRemaining !== null && timeRemaining <= 0
  }, [getTimeRemaining])

  // =========================================================
  // EFECTOS
  // =========================================================

  // Cargar transacción inicial
  useEffect(() => {
    if (transactionId) {
      refreshTransaction()
    }
  }, [transactionId, refreshTransaction])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !transactionId) return
    
    const interval = setInterval(() => {
      refreshTransaction()
    }, refreshInterval)
    
    return () => clearInterval(interval)
  }, [autoRefresh, transactionId, refreshTransaction, refreshInterval])

  // Cargar transacciones del usuario
  useEffect(() => {
    if (userId && !transactionId) {
      loadUserTransactions()
    }
  }, [userId, transactionId, loadUserTransactions])

  // =========================================================
  // RETORNO
  // =========================================================

  return {
    // Estados
    transaction,
    transactions,
    loading,
    error,
    
    // Acciones
    createTransaction,
    updateStatus,
    uploadDocument,
    cancelTransaction: cancelTransactionAction,
    refreshTransaction,
    loadUserTransactions,
    
    // Utilidades
    canPerformAction,
    getCurrentStep,
    getStepProgress,
    getTimeRemaining,
    isPaymentOverdue
  }
}
