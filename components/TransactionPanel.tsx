"use client"

import { useState, useEffect } from "react"
import { X, MessageSquare, Clock, User, DollarSign, CheckCircle, ArrowRight, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { PurchaseCompletionPanel } from "@/components/PurchaseCompletionPanel"
import { UseTransactionalChatParams } from "@/hooks/useTransactionalChat"
import { PurchaseRequest } from "@/lib/types/purchase_requests"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { toast } from "sonner"

interface TransactionPanelProps {
  isOpen: boolean
  onClose: () => void
  request: PurchaseRequest
  userId: string
  className?: string
}

export function TransactionPanel({ 
  isOpen, 
  onClose, 
  request, 
  userId, 
  className 
}: TransactionPanelProps) {
  const [chatOpen, setChatOpen] = useState(false)
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<'negotiation' | 'terms' | 'confirmation'>('negotiation')
  const [transactionId, setTransactionId] = useState<string | null>(null)

  // Configuración del chat
  const chatParams: UseTransactionalChatParams = {
    contextType: 'order',
    contextId: request.id,
    partyA: request.buyer_id,
    partyB: userId,
    contextTitle: 'Negociación de Solicitud',
    contextData: {
      requestId: request.id,
      amount: request.amount,
      paymentMethod: request.payment_method,
      status: request.status
    }
  }

  // Información de la solicitud
  const requestInfo = {
    amount: request.amount,
    paymentMethod: request.payment_method || '',
    uniqueCode: request.unique_code,
    currency: request.currency_type
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'local_transfer':
        return 'Transferencia Local'
      case 'international_transfer':
        return 'Transferencia Internacional'
      case 'card':
        return 'Tarjeta de Crédito/Débito'
      case 'digital_balance':
        return 'Saldo Digital'
      default:
        return method
    }
  }

  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'USD':
        return 'USD'
      case 'EUR':
        return 'EUR'
      default:
        return 'L.'
    }
  }

  const handleOpenChat = () => {
    setChatOpen(true)
  }

  const handleCloseChat = () => {
    setChatOpen(false)
  }

  const handleNextStep = () => {
    if (currentStep === 'negotiation') {
      setCurrentStep('terms')
    } else if (currentStep === 'terms') {
      setCurrentStep('confirmation')
    }
  }

  const handleStartTransaction = () => {
    setCompletionPanelOpen(true)
    toast.success('Iniciando proceso de compra...')
  }

  const handleTransactionCreated = (newTransactionId: string) => {
    setTransactionId(newTransactionId)
    setCompletionPanelOpen(false)
    onClose()
    toast.success('Transacción creada exitosamente')
  }

  const handlePrevStep = () => {
    if (currentStep === 'terms') {
      setCurrentStep('negotiation')
    } else if (currentStep === 'confirmation') {
      setCurrentStep('terms')
    }
  }

  const handleClose = () => {
    setCurrentStep('negotiation')
    setChatOpen(false)
    onClose()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <DialogTitle className="text-xl font-semibold">
              Panel de Transacción
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* Panel izquierdo - Información de la solicitud */}
            <div className="flex-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Detalles de la Solicitud
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Monto
                      </label>
                      <p className="text-lg font-semibold">
                        {formatCurrency(request.amount)} {getCurrencySymbol(request.currency_type)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Método de Pago
                      </label>
                      <p className="text-sm">
                        {getPaymentMethodLabel(request.payment_method || '')}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Código Único
                    </label>
                    <p className="font-mono text-sm bg-muted p-2 rounded">
                      {request.unique_code}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Estado
                    </label>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Activa
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Panel de pasos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Proceso de Negociación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className={`flex items-center gap-3 p-3 rounded-lg ${
                      currentStep === 'negotiation' ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentStep === 'negotiation' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        1
                      </div>
                      <div>
                        <p className="font-medium text-black dark:text-white">Negociación</p>
                        <p className="text-sm text-black dark:text-white">
                          Discute términos y condiciones
                        </p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-3 p-3 rounded-lg ${
                      currentStep === 'terms' ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentStep === 'terms' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        2
                      </div>
                      <div>
                        <p className="font-medium text-black dark:text-white">Términos</p>
                        <p className="text-sm text-black dark:text-white">
                          Define condiciones finales
                        </p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-3 p-3 rounded-lg ${
                      currentStep === 'confirmation' ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentStep === 'confirmation' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        3
                      </div>
                      <div>
                        <p className="font-medium text-black dark:text-white">Confirmación</p>
                        <p className="text-sm text-black dark:text-white">
                          Finaliza la transacción
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Panel derecho - Chat y acciones */}
            <div className="flex-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Chat de Negociación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Usa el chat para discutir los términos de la transacción con el comprador.
                    </p>
                    
                    <Button 
                      onClick={handleOpenChat}
                      className="w-full"
                      variant="outline"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Abrir Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Panel de acciones según el paso actual */}
              <Card>
                <CardHeader>
                  <CardTitle>Acciones</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentStep === 'negotiation' && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Usa el chat para negociar los términos. Cuando estés listo, continúa al siguiente paso.
                      </p>
                      <Button 
                        onClick={handleNextStep}
                        className="w-full"
                      >
                        Continuar a Términos
                      </Button>
                    </div>
                  )}

                  {currentStep === 'terms' && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Define los términos finales de la transacción.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handlePrevStep}
                          variant="outline"
                          className="flex-1"
                        >
                          Atrás
                        </Button>
                        <Button 
                          onClick={handleNextStep}
                          className="flex-1"
                        >
                          Continuar a Confirmación
                        </Button>
                      </div>
                    </div>
                  )}

                  {currentStep === 'confirmation' && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Revisa todos los detalles antes de finalizar la transacción.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handlePrevStep}
                          variant="outline"
                          className="flex-1"
                        >
                          Atrás
                        </Button>
                        <Button 
                          onClick={handleStartTransaction}
                          className="flex-1"
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Completar Compra
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Panel integrado */}
      {chatOpen && (
        <ChatPanel
          isOpen={chatOpen}
          onClose={handleCloseChat}
          chatParams={chatParams}
          requestInfo={requestInfo}
        />
      )}

      {/* Panel de Completar Compra */}
      <PurchaseCompletionPanel
        requestId={request.id}
        sellerId={userId}
        buyerId={request.buyer_id}
        amount={request.amount}
        currency={request.currency_type || 'USD'}
        paymentMethod={request.payment_method || 'local_transfer'}
        isOpen={completionPanelOpen}
        onClose={() => setCompletionPanelOpen(false)}
        onTransactionCreated={handleTransactionCreated}
      />
    </>
  )
}
