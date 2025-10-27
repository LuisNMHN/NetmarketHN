'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  User, 
  ArrowRight,
  Eye,
  MessageSquare,
  FileText,
  Shield
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { usePurchaseTransaction } from '@/hooks/usePurchaseTransaction'
import { PurchaseCompletionPanel } from '@/components/PurchaseCompletionPanel'
import { toast } from 'sonner'

// =========================================================
// TIPOS E INTERFACES
// =========================================================

interface TransactionCardProps {
  transaction: any
  userId: string
  onViewDetails?: (transactionId: string) => void
}

interface TransactionListProps {
  userId: string
  type?: 'buyer' | 'seller' | 'all'
  limit?: number
}

// =========================================================
// COMPONENTE DE TARJETA DE TRANSACCIÓN
// =========================================================

export function TransactionCard({ transaction, userId, onViewDetails }: TransactionCardProps) {
  const [showCompletionPanel, setShowCompletionPanel] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  const isBuyer = transaction.buyer_id === userId
  const isSeller = transaction.seller_id === userId
  const counterparty = isBuyer ? transaction.seller : transaction.buyer

  // Calcular tiempo restante
  useEffect(() => {
    if (transaction.payment_deadline) {
      const interval = setInterval(() => {
        const now = new Date().getTime()
        const deadline = new Date(transaction.payment_deadline).getTime()
        const remaining = Math.max(0, deadline - now)
        setTimeRemaining(remaining)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [transaction.payment_deadline])

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      'agreement_confirmed': { 
        label: 'Acuerdo Confirmado', 
        variant: 'default' as const, 
        icon: CheckCircle,
        color: 'text-green-600'
      },
      'payment_in_progress': { 
        label: 'Pago en Proceso', 
        variant: 'secondary' as const, 
        icon: Clock,
        color: 'text-blue-600'
      },
      'payment_verified': { 
        label: 'Pago Verificado', 
        variant: 'default' as const, 
        icon: CheckCircle,
        color: 'text-green-600'
      },
      'funds_released': { 
        label: 'Fondos Liberados', 
        variant: 'default' as const, 
        icon: CheckCircle,
        color: 'text-green-600'
      },
      'completed': { 
        label: 'Completada', 
        variant: 'default' as const, 
        icon: CheckCircle,
        color: 'text-green-600'
      },
      'cancelled': { 
        label: 'Cancelada', 
        variant: 'destructive' as const, 
        icon: AlertCircle,
        color: 'text-red-600'
      },
      'disputed': { 
        label: 'En Disputa', 
        variant: 'destructive' as const, 
        icon: AlertCircle,
        color: 'text-red-600'
      }
    }

    return configs[status as keyof typeof configs] || { 
      label: status, 
      variant: 'default' as const, 
      icon: Clock,
      color: 'text-gray-600'
    }
  }

  const getProgressPercentage = () => {
    if (!transaction.transaction_steps) return 0
    const totalSteps = transaction.transaction_steps.length
    const completedSteps = transaction.transaction_steps.filter((step: any) => step.status === 'completed').length
    return (completedSteps / totalSteps) * 100
  }

  const canContinueTransaction = () => {
    return ['agreement_confirmed', 'payment_in_progress', 'payment_verified'].includes(transaction.status)
  }

  const statusConfig = getStatusConfig(transaction.status)
  const StatusIcon = statusConfig.icon

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>Transacción #{transaction.id.slice(-8)}</span>
            </CardTitle>
            <Badge variant={statusConfig.variant}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Monto</p>
              <p className="font-semibold">
                {formatCurrency(transaction.amount)} {transaction.currency}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contraparte</p>
              <p className="font-medium">{counterparty.full_name}</p>
            </div>
          </div>

          {/* Progreso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso</span>
              <span>{Math.round(getProgressPercentage())}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
          </div>

          {/* Temporizador */}
          {timeRemaining !== null && timeRemaining > 0 && (
            <div className="flex items-center space-x-2 text-sm text-orange-600">
              <Clock className="h-4 w-4" />
              <span>Tiempo restante: {formatTimeRemaining(timeRemaining)}</span>
            </div>
          )}

          {/* Información adicional */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Shield className="h-4 w-4" />
                <span>Protegido</span>
              </div>
              <div className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>{transaction.transaction_documents?.length || 0} docs</span>
              </div>
            </div>
            <span>{new Date(transaction.created_at).toLocaleDateString()}</span>
          </div>

          {/* Acciones */}
          <div className="flex space-x-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onViewDetails?.(transaction.id)}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Detalles
            </Button>
            
            {canContinueTransaction() && (
              <Button 
                size="sm" 
                onClick={() => setShowCompletionPanel(true)}
                className="flex-1"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Continuar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panel de Completar Compra */}
      <PurchaseCompletionPanel
        requestId={transaction.request_id}
        sellerId={transaction.seller_id}
        buyerId={transaction.buyer_id}
        amount={transaction.amount}
        currency={transaction.currency}
        paymentMethod={transaction.payment_method}
        isOpen={showCompletionPanel}
        onClose={() => setShowCompletionPanel(false)}
        onTransactionCreated={() => {
          setShowCompletionPanel(false)
          toast.success('Transacción actualizada')
        }}
      />
    </>
  )
}

// =========================================================
// COMPONENTE DE LISTA DE TRANSACCIONES
// =========================================================

export function TransactionList({ userId, type = 'all', limit }: TransactionListProps) {
  const { transactions, loading, error, loadUserTransactions } = usePurchaseTransaction({ userId })

  useEffect(() => {
    loadUserTransactions(type)
  }, [userId, type, loadUserTransactions])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-2 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No hay transacciones disponibles</p>
        </CardContent>
      </Card>
    )
  }

  const displayTransactions = limit ? transactions.slice(0, limit) : transactions

  return (
    <div className="space-y-4">
      {displayTransactions.map((transaction) => (
        <TransactionCard
          key={transaction.id}
          transaction={transaction}
          userId={userId}
          onViewDetails={(transactionId) => {
            // Implementar navegación a detalles
            console.log('Ver detalles de transacción:', transactionId)
          }}
        />
      ))}
    </div>
  )
}

// =========================================================
// COMPONENTE DE RESUMEN DE TRANSACCIONES
// =========================================================

export function TransactionSummary({ userId }: { userId: string }) {
  const { transactions, loading } = usePurchaseTransaction({ userId })

  useEffect(() => {
    if (userId) {
      loadUserTransactions('all')
    }
  }, [userId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/2"></div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const activeTransactions = transactions?.filter(t => 
    ['agreement_confirmed', 'payment_in_progress', 'payment_verified'].includes(t.status)
  ) || []

  const completedTransactions = transactions?.filter(t => 
    t.status === 'completed'
  ) || []

  const totalVolume = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="h-5 w-5" />
          <span>Resumen de Transacciones</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{activeTransactions.length}</p>
            <p className="text-sm text-muted-foreground">Activas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{completedTransactions.length}</p>
            <p className="text-sm text-muted-foreground">Completadas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalVolume)}</p>
            <p className="text-sm text-muted-foreground">Volumen Total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
