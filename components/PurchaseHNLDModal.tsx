"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  createPurchaseRequest,
  processCardPurchase,
} from "@/lib/actions/purchase_requests"
import { Plus } from "lucide-react"

interface PurchaseHNLDModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultMethod?: "local_transfer" | "international_transfer" | "card" | "digital_balance"
}

export function PurchaseHNLDModal({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultMethod = "card" 
}: PurchaseHNLDModalProps) {
  const [processing, setProcessing] = useState(false)
  const [depositForm, setDepositForm] = useState({
    amount: "",
    method: undefined as "local_transfer" | "international_transfer" | "card" | "digital_balance" | undefined,
    bank: undefined as string | undefined,
    customBank: "" as string,
    country: undefined as string | undefined,
    customCountry: "" as string,
    wallet: undefined as string | undefined
  })
  const { toast } = useToast()
  
  // Utilidades para formatear/parsear montos en Lempiras
  const parseAmountString = (input: string): number => {
    const normalized = (input || "").replace(/[^\d.]/g, "")
    const value = parseFloat(normalized)
    return isNaN(value) ? 0 : value
  }

  const formatWithCommas = (input: string): string => {
    // Remover todo excepto dígitos y punto decimal
    const cleaned = input.replace(/[^\d.]/g, "")
    
    // Separar parte entera y decimal
    const parts = cleaned.split('.')
    let integerPart = parts[0] || ''
    const decimalPart = parts[1] ? '.' + parts[1].slice(0, 2) : ''
    
    // Limitar a máximo 5 dígitos en la parte entera
    if (integerPart.length > 5) {
      integerPart = integerPart.slice(0, 5)
    }
    
    // Agregar comas cada 3 dígitos
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    
    return formattedInteger + decimalPart
  }

  // Sin formateo visual en el input; solo se hace parse al enviar

  // Se permite ingreso libre; el formateo se aplica al perder foco
  
  // Referencias para gestos táctiles
  const modalRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number>(0)
  const currentY = useRef<number>(0)
  const isDragging = useRef<boolean>(false)

  // 🌫️ Efecto para DESENFOCAR EL CONTENIDO DE LA PÁGINA (no el modal)
  useEffect(() => {
    if (open) {
      // Aplicar desenfoque solo al contenido de fondo, no al modal
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'blur(20px)'
        pageContent.style.transition = 'filter 0.3s ease-out'
        console.log('🌫️ Desenfoque aplicado al contenido de fondo:', pageContent)
      }
      
      // Asegurar que el modal NO tenga desenfoque
      setTimeout(() => {
        const modal = document.querySelector('[data-radix-dialog-content]')
        if (modal) {
          modal.style.filter = 'none !important'
          modal.style.backdropFilter = 'none !important'
          modal.style.zIndex = '9999'
          console.log('🌫️ Modal sin desenfoque:', modal)
        }
        
        const overlay = document.querySelector('[data-radix-dialog-overlay]')
        if (overlay) {
          overlay.style.filter = 'none !important'
          overlay.style.backdropFilter = 'none !important'
          console.log('🌫️ Overlay sin desenfoque:', overlay)
        }
      }, 100)
      
    } else {
      // Remover desenfoque cuando se cierra el modal
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'none'
      }
      
      console.log('🌫️ Desenfoque removido del contenido de la página')
    }
  }, [open])

  // Manejo del teclado virtual en móviles
  useEffect(() => {
    if (open) {
      // Prevenir zoom en iOS cuando se enfoca un input
      const viewport = document.querySelector('meta[name=viewport]')
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      }

      // Bloquear scroll del body en móvil
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'

      // Prevenir que el modal se cierre al hacer clic en SelectContent
      const handleClickOutside = (e: Event) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-radix-select-content]')) {
          e.stopPropagation()
        }
      }

      document.addEventListener('click', handleClickOutside, true)

      // Ajustar scroll cuando aparece el teclado virtual
      const handleResize = () => {
        if (modalRef.current) {
          modalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }

      window.addEventListener('resize', handleResize)
      
      return () => {
        window.removeEventListener('resize', handleResize)
        document.removeEventListener('click', handleClickOutside, true)
        // Restaurar viewport y scroll del body
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0')
        }
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.width = ''
      }
    }
  }, [open])

  const handleDeposit = async () => {
    if (!depositForm.amount || !depositForm.method) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    const amount = parseAmountString(depositForm.amount)
    if (amount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    
    try {
      if (depositForm.method === "local_transfer") {
        if (!depositForm.bank) {
          toast({
            title: "Banco requerido",
            description: "Selecciona el banco para la transferencia local",
            variant: "destructive",
          })
          setProcessing(false)
          return
        }
        if (depositForm.bank === 'Otros' && !depositForm.customBank.trim()) {
          toast({
            title: "Nombre de banco requerido",
            description: "Ingresa el nombre del banco en la opción 'Otros'",
            variant: "destructive",
          })
          setProcessing(false)
          return
        }
      }

      if (depositForm.method === "card") {
        // Procesar compra con tarjeta
        await handleCardPurchase(amount)
      } else if (depositForm.method === "local_transfer") {
        // Procesar transferencia local
        await handleLocalTransfer(amount)
      } else if (depositForm.method === "international_transfer") {
        // Procesar transferencia internacional
        await handleInternationalTransfer(amount)
      } else if (depositForm.method === "digital_balance") {
        // Procesar compra con saldo digital
        await handleDigitalBalancePurchase(amount)
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar la compra",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCardPurchase = async (amount: number) => {
    try {
      // Primero crear la solicitud en la base de datos
      const result = await createPurchaseRequest(amount, "card", {
        currencyType: 'L',
        amountInOriginalCurrency: amount,
        finalAmountHnld: amount,
        processingFeePercentage: 4.25, // Promedio entre 3.5% y 5%
        processingFeeAmount: amount * 0.0425,
        description: "Compra con tarjeta de crédito/débito"
      })

      if (result.success) {
        // Mostrar toast de redirección
        toast({
          title: "🔄 Redirigiendo a Stripe...",
          description: `Procesando compra por L.${amount.toFixed(2)} HNLD con tarjeta`,
        })
        
        // Simular redirección a Stripe
        setTimeout(() => {
          // Redirección directa en lugar de ventana nueva (mejor para móvil)
          const stripeUrl = `/stripe-payment?amount=${amount}&currency=L&processing_fee=3.5-5`
          
          // Crear página temporal de Stripe
          const stripePage = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Stripe Payment - NMHN</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 50px 20px;
                    background: #f5f5f5;
                    margin: 0;
                  }
                  .container {
                    background: white;
                    border-radius: 12px;
                    padding: 40px 20px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    max-width: 400px;
                    margin: 0 auto;
                  }
                  h1 { color: #333; margin-bottom: 20px; }
                  p { color: #666; margin: 10px 0; }
                  .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
                  .fee { color: #dc2626; font-weight: 500; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>🚧 Stripe Integration</h1>
                  <p>Esta página será el servicio de Stripe próximamente</p>
                  <p class="amount">L.${amount.toFixed(2)} HNLD</p>
                  <p class="fee">Costos de procesamiento: 3.5% - 5%</p>
                  <p><small>Redirigiendo de vuelta...</small></p>
                </div>
                <script>
                  setTimeout(() => {
                    window.close();
                    if (window.opener) {
                      window.opener.postMessage('payment_completed', '*');
                    }
                  }, 3000);
                </script>
              </body>
            </html>
          `
          
          // Crear blob y abrir en nueva ventana
          const blob = new Blob([stripePage], { type: 'text/html' })
          const url = URL.createObjectURL(blob)
          
          // Intentar abrir en nueva ventana, si falla redirigir en la misma ventana
          const newWindow = window.open(url, '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes')
          
          if (!newWindow) {
            // Si no se puede abrir ventana nueva (móvil), redirigir en la misma ventana
            window.location.href = url
          }
          
          // Limpiar URL después de un tiempo
          setTimeout(() => {
            URL.revokeObjectURL(url)
          }, 10000)
          
          resetForm()
          onSuccess?.()
        }, 1500)
      } else {
        toast({
          title: "❌ Error",
          description: result.error || "Error creando la solicitud",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar la compra",
        variant: "destructive",
      })
    }
  }


  const handleLocalTransfer = async (amount: number) => {
    try {
      const result = await createPurchaseRequest(amount, "local_transfer", {
        bankName: depositForm.bank,
        customBankName: depositForm.bank === 'Otros' ? depositForm.customBank : undefined,
        currencyType: 'L',
        amountInOriginalCurrency: amount,
        finalAmountHnld: amount,
        description: `Transferencia local - ${depositForm.bank === 'Otros' ? depositForm.customBank : depositForm.bank}`
      })

      if (result.success) {
        toast({
          title: "✅ Solicitud Creada",
          description: `Solicitud de transferencia local por L.${amount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
        })
        resetForm()
        onSuccess?.()
      } else {
        toast({
          title: "❌ Error",
          description: result.error || "Error creando la solicitud",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleInternationalTransfer = async (amount: number) => {
    try {
      // Determinar el tipo de moneda según el país seleccionado
      let currencyType: 'USD' | 'EUR' = 'USD'
      if (depositForm.country === 'España' || depositForm.country === 'Otro de la zona euro') {
        currencyType = 'EUR'
      }

      const result = await createPurchaseRequest(amount, "international_transfer", {
        country: depositForm.country,
        customCountry: depositForm.country === 'Otro de la zona euro' ? depositForm.customCountry : undefined,
        currencyType: currencyType,
        amountInOriginalCurrency: amount,
        finalAmountHnld: amount,
        description: `Transferencia internacional - ${depositForm.country === 'Otro de la zona euro' ? depositForm.customCountry : depositForm.country}`
      })

      if (result.success) {
        toast({
          title: "✅ Solicitud Creada",
          description: `Solicitud de transferencia internacional por ${currencyType === 'USD' ? '$' : '€'}${amount.toFixed(2)} creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
        })
        resetForm()
        onSuccess?.()
      } else {
        toast({
          title: "❌ Error",
          description: result.error || "Error creando la solicitud",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleDigitalBalancePurchase = async (amount: number) => {
    try {
      const result = await createPurchaseRequest(amount, "digital_balance", {
        digitalWallet: depositForm.wallet,
        currencyType: 'L',
        amountInOriginalCurrency: amount,
        finalAmountHnld: amount,
        description: `Compra con saldo digital - ${depositForm.wallet}`
      })

      if (result.success) {
        toast({
          title: "✅ Solicitud Creada",
          description: `Solicitud de compra con ${depositForm.wallet} por L.${amount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
        })
        resetForm()
        onSuccess?.()
      } else {
        toast({
          title: "❌ Error",
          description: result.error || "Error creando la solicitud",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    }
  }

  // Funciones para gestos táctiles - DESHABILITADAS
  const handleTouchStart = (e: React.TouchEvent) => {
    // Deshabilitado para evitar cierre accidental
    e.preventDefault()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Deshabilitado para evitar cierre accidental
    e.preventDefault()
  }

  const handleTouchEnd = () => {
    // Deshabilitado para evitar cierre accidental
  }

  const resetForm = () => {
    setDepositForm({ 
      amount: "", 
      method: undefined,
      bank: undefined,
      customBank: "",
      country: undefined,
      customCountry: "",
      wallet: undefined
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={modalRef}
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] sm:w-[28rem] bg-background border-border shadow-xl"
        style={{
          // Mejoras para pantallas táctiles
          maxHeight: '95vh',
          overflowY: 'auto',
          touchAction: 'none',
          WebkitOverflowScrolling: 'touch',
          transition: 'transform 0.2s ease-out',
          // Ancho fijo para mantener consistencia
          minWidth: '320px',
          maxWidth: '28rem'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDownOutside={(e) => {
          // Permitir cierre solo al hacer clic fuera del modal
          // No prevenir el comportamiento por defecto
        }}
        onInteractOutside={(e) => {
          // Permitir cierre solo al interactuar fuera del modal
          // No prevenir el comportamiento por defecto
        }}
      >
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl font-semibold text-center sm:text-left">
            Comprar HNLD
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm sm:text-base text-center sm:text-left">
            Convierte dinero físico en HNLD digitales
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="deposit-method" className="text-base font-medium block mb-2">
              Método de Compra
            </Label>
            <Select
              value={depositForm.method}
              onValueChange={(value) => setDepositForm((prev) => ({ 
                ...prev, 
                method: value as "local_transfer" | "international_transfer" | "card" | "digital_balance",
                // al cambiar de método, limpiar campos específicos
                bank: value === "local_transfer" ? prev.bank : undefined,
                country: value === "international_transfer" ? prev.country : undefined,
                customCountry: value === "international_transfer" ? prev.customCountry : "",
                wallet: value === "digital_balance" ? prev.wallet : undefined
              }))}
            >
              <SelectTrigger className="h-12 text-base sm:text-lg">
                <SelectValue placeholder="Selecciona el método de compra" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="local_transfer" className="text-base py-3">
                  🏦 Transferencia Local
                </SelectItem>
                <SelectItem value="international_transfer" className="text-base py-3">
                  🌍 Transferencia Internacional
                </SelectItem>
                <SelectItem value="card" className="text-base py-3">
                  💳 Tarjeta de Crédito/Débito
                </SelectItem>
                <SelectItem value="digital_balance" className="text-base py-3">
                  💰 Saldo Digital
                </SelectItem>
              </SelectContent>
            </Select>
            {depositForm.method === "local_transfer" && (
              <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                <p className="text-sm text-foreground dark:text-foreground font-medium">Transferencia bancaria local. El cargo ACH lo asume el comprador.</p>
                <div>
                  <Label className="text-sm font-medium block mb-2">Banco</Label>
                  <Select
                    value={depositForm.bank}
                    onValueChange={(value) => setDepositForm((prev) => ({ ...prev, bank: value, customBank: value === 'Otros' ? prev.customBank : '' }))}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Selecciona el banco" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="Banco Atlántida" className="text-base py-2">Banco Atlántida</SelectItem>
                      <SelectItem value="Banco de Occidente" className="text-base py-2">Banco de Occidente</SelectItem>
                      <SelectItem value="BAC Credomatic Honduras" className="text-base py-2">BAC Credomatic Honduras</SelectItem>
                      <SelectItem value="Banco Ficohsa" className="text-base py-2">Banco Ficohsa</SelectItem>
                      <SelectItem value="Banco Davivienda Honduras" className="text-base py-2">Banco Davivienda Honduras</SelectItem>
                      <SelectItem value="Banco Promerica Honduras" className="text-base py-2">Banco Promerica Honduras</SelectItem>
                      <SelectItem value="Banco LAFISE" className="text-base py-2">Banco LAFISE</SelectItem>
                      <SelectItem value="Banco del País (BANPAÍS)" className="text-base py-2">Banco del País (BANPAÍS)</SelectItem>
                      <SelectItem value="Banco Azteca Honduras" className="text-base py-2">Banco Azteca Honduras</SelectItem>
                      <SelectItem value="Otros" className="text-base py-2">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                  {depositForm.bank === 'Otros' && (
                    <Input
                      className="mt-3 h-11 text-base"
                      placeholder="Ingresa el nombre del banco"
                      value={depositForm.customBank}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, customBank: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            )}
            {depositForm.method === "international_transfer" && (
              <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                <p className="text-sm text-foreground dark:text-foreground font-medium">Transferencia internacional. Las comisiones por transferencia las asume el comprador.</p>
                <div>
                  <Label className="text-sm font-medium block mb-2">País</Label>
                  <Select
                    value={depositForm.country}
                    onValueChange={(value) => setDepositForm((prev) => ({ ...prev, country: value, customCountry: value === 'Otro de la zona euro' ? prev.customCountry : '' }))}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Selecciona el país" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="Estados Unidos" className="text-base py-2">🇺🇸 Estados Unidos</SelectItem>
                      <SelectItem value="España" className="text-base py-2">🇪🇸 España</SelectItem>
                      <SelectItem value="Otro de la zona euro" className="text-base py-2">🇪🇺 Otro de la zona euro</SelectItem>
                    </SelectContent>
                  </Select>
                  {depositForm.country === 'Otro de la zona euro' && (
                    <Input
                      className="mt-3 h-11 text-base"
                      placeholder="Ingresa el nombre del país"
                      value={depositForm.customCountry}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, customCountry: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            )}
            {depositForm.method === "card" && (
              <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50">
                <p className="text-sm text-foreground dark:text-foreground font-medium">Compra directa con tarjeta. Se asume un costo de 3.5% a 5% por procesamiento de tarjetas.</p>
              </div>
            )}
            {depositForm.method === "digital_balance" && (
              <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                <p className="text-sm text-foreground dark:text-foreground font-medium">Compra usando tu saldo digital disponible.</p>
                <div>
                  <Label className="text-sm font-medium block mb-2">Billetera Digital</Label>
                  <Select
                    value={depositForm.wallet}
                    onValueChange={(value) => setDepositForm((prev) => ({ ...prev, wallet: value }))}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Selecciona tu billetera digital" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="PayPal" className="text-base py-2">💳 PayPal</SelectItem>
                      <SelectItem value="Skrill" className="text-base py-2">💳 Skrill</SelectItem>
                      <SelectItem value="Payoneer" className="text-base py-2">💳 Payoneer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          
          {depositForm.method && (
            <div>
              <Label htmlFor="deposit-amount" className="text-base font-medium block mb-2">
                {depositForm.method === "international_transfer" && depositForm.country === "Estados Unidos" 
                  ? "Monto en dólares" 
                  : depositForm.method === "international_transfer" && (depositForm.country === "España" || depositForm.country === "Otro de la zona euro")
                  ? "Monto en euros"
                  : "Monto en lempiras"}
              </Label>
              <Input
                id="deposit-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={depositForm.amount}
                onChange={(e) => setDepositForm((prev) => ({ ...prev, amount: formatWithCommas(e.target.value) }))}
                onBlur={() => setDepositForm((prev) => ({ ...prev, amount: formatWithCommas(prev.amount) }))}
                className="h-12 text-base sm:text-lg"
                style={{
                  fontSize: '16px', // Previene zoom en iOS
                  minHeight: '48px'
                }}
                onFocus={() => {
                  // Scroll suave al input cuando se enfoca
                  setTimeout(() => {
                    const input = document.getElementById('deposit-amount')
                    if (input) {
                      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }, 300)
                }}
              />
              {depositForm.method === "international_transfer" && (
                <p className="text-xs text-muted-foreground mt-2">
                  La compra se realizará a la tasa de cambio actual de la divisa
                </p>
              )}
            </div>
          )}
          
          
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 px-0 sm:px-0 sticky bottom-0 bg-background border-t border-border/50 sm:border-t-0 sm:bg-transparent">
          <Button 
            variant="outline" 
            onClick={resetForm} 
            disabled={processing}
            className="w-full sm:w-auto h-12 text-base font-medium"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleDeposit} 
            disabled={
              processing ||
              !depositForm.method ||
              (depositForm.method === "local_transfer" && (
                !depositForm.bank ||
                (depositForm.bank === 'Otros' && !depositForm.customBank.trim()) ||
                parseAmountString(depositForm.amount) <= 0
              )) ||
              (depositForm.method === "international_transfer" && (
                !depositForm.country ||
                (depositForm.country === 'Otro de la zona euro' && !depositForm.customCountry.trim()) ||
                parseAmountString(depositForm.amount) <= 0
              )) ||
              (depositForm.method === "card" && (
                parseAmountString(depositForm.amount) <= 0
              )) ||
              (depositForm.method === "digital_balance" && (
                !depositForm.wallet ||
                parseAmountString(depositForm.amount) <= 0
              ))
            }
            className="w-full sm:w-auto h-12 text-base font-medium"
          >
            {processing ? "Procesando..." : "Comprar HNLD"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Componente de botón que abre el modal
interface PurchaseHNLDButtonProps {
  onSuccess?: () => void
  defaultMethod?: "local_transfer" | "international_transfer" | "card" | "digital_balance"
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
  className?: string
  children?: React.ReactNode
}

export function PurchaseHNLDButton({ 
  onSuccess,
  defaultMethod = "card",
  variant = "default",
  size = "default",
  className,
  children
}: PurchaseHNLDButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        variant={variant}
        size={size}
        className={className}
      >
        {children || (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </>
        )}
      </Button>
      
      <PurchaseHNLDModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
        defaultMethod={defaultMethod}
      />
    </>
  )
}
