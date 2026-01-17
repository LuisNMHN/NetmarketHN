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
import { formatCurrency } from "@/lib/utils"
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
  const [showHnlEquivalentModal, setShowHnlEquivalentModal] = useState(false)
  const [hnlEquivalent, setHnlEquivalent] = useState("")
  const [pendingAmount, setPendingAmount] = useState<number>(0)
  const [editableAmount, setEditableAmount] = useState("") // Monto en USD/EUR editable
  const [pendingCurrencyType, setPendingCurrencyType] = useState<'USD' | 'EUR'>('USD')
  const [bchRate, setBchRate] = useState<number | null>(null)
  const [nmhnRate, setNmhnRate] = useState<number | null>(null)
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false)
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
      }
      
      // Asegurar que el modal NO tenga desenfoque
      setTimeout(() => {
        const modal = document.querySelector('[data-radix-dialog-content]')
        if (modal) {
          modal.style.filter = 'none !important'
          modal.style.backdropFilter = 'none !important'
          modal.style.zIndex = '9999'
        }
        
        const overlay = document.querySelector('[data-radix-dialog-overlay]')
        if (overlay) {
          overlay.style.filter = 'none !important'
          overlay.style.backdropFilter = 'none !important'
        }
      }, 100)
      
    } else {
      // Remover desenfoque cuando se cierra el modal
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'none'
      }
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
        // Verificar si es USD o EUR para mostrar modal de equivalente en HNL
        let currencyType: 'USD' | 'EUR' = 'USD'
        if (depositForm.country === 'España' || depositForm.country === 'Otro de la zona euro') {
          currencyType = 'EUR'
        }
        
        // Si es USD o EUR, mostrar modal para solicitar equivalente en HNL
        if (currencyType === 'USD' || currencyType === 'EUR') {
          setPendingAmount(amount)
          setPendingCurrencyType(currencyType)
          setShowHnlEquivalentModal(true)
          setProcessing(false)
          
          // Cargar tipo de cambio del Banco Central de Honduras
          loadExchangeRate(currencyType, amount)
          return
        }
        
        // Si no es USD ni EUR, procesar directamente
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
        setProcessing(false) // Liberar el estado antes de redirigir
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
          title: "Error",
          description: result.error || "Error creando la solicitud",
          variant: "destructive",
        })
        setProcessing(false)
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar la compra",
        variant: "destructive",
      })
      setProcessing(false)
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
          title: "Solicitud Creada",
          description: `Solicitud de transferencia local por L.${amount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
          variant: "created",
        })
        resetForm()
        onSuccess?.()
      } else {
        toast({
          title: "Error",
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

  const handleInternationalTransfer = async (amount: number, hnlAmount?: number) => {
    try {
      // Determinar el tipo de moneda según el país seleccionado
      let currencyType: 'USD' | 'EUR' = 'USD'
      if (depositForm.country === 'España' || depositForm.country === 'Otro de la zona euro') {
        currencyType = 'EUR'
      }

      // Calcular tasa de cambio si se proporciona el equivalente en HNL
      let exchangeRate = 1.0
      let finalAmountHnld = amount
      
      if (hnlAmount && hnlAmount > 0) {
        finalAmountHnld = hnlAmount
        exchangeRate = hnlAmount / amount
      }

      const result = await createPurchaseRequest(finalAmountHnld, "international_transfer", {
        country: depositForm.country,
        customCountry: depositForm.country === 'Otro de la zona euro' ? depositForm.customCountry : undefined,
        currencyType: currencyType,
        amountInOriginalCurrency: amount,
        exchangeRateApplied: exchangeRate,
        finalAmountHnld: finalAmountHnld,
        description: `Transferencia internacional - ${depositForm.country === 'Otro de la zona euro' ? depositForm.customCountry : depositForm.country}`
      })

      if (result.success) {
        const equivalentText = hnlAmount ? ` (Equivalente: L.${hnlAmount.toFixed(2)} HNLD)` : ''
        toast({
          title: "Solicitud Creada",
          description: `Solicitud de transferencia internacional por ${currencyType === 'USD' ? '$' : '€'}${amount.toFixed(2)}${equivalentText} creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
          variant: "created",
        })
        // Limpiar estados del modal secundario antes de resetear
        setHnlEquivalent("")
        setEditableAmount("")
        setBchRate(null)
        setNmhnRate(null)
        resetForm()
        onSuccess?.()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error creando la solicitud",
          variant: "destructive",
        })
        setProcessing(false)
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
      setProcessing(false)
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
          title: "Solicitud Creada",
          description: `Solicitud de compra con ${depositForm.wallet} por L.${amount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
          variant: "created",
        })
        resetForm()
        onSuccess?.()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error creando la solicitud",
          variant: "destructive",
        })
        setProcessing(false)
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
      setProcessing(false)
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

  // Función para cargar el tipo de cambio del Banco Central de Honduras
  const loadExchangeRate = async (currency: 'USD' | 'EUR', amount: number) => {
    setLoadingExchangeRate(true)
    try {
      const response = await fetch(`/api/exchange-rate?currency=${currency}`)
      const data = await response.json()
      
      if (data.success && data.bchRate && data.nmhnRate) {
        setBchRate(data.bchRate)
        setNmhnRate(data.nmhnRate)
        
        // Establecer el monto editable en USD/EUR
        setEditableAmount(formatWithCommas(amount.toFixed(2)))
        
        // Calcular automáticamente el equivalente en HNL usando la tasa NMHN
        const calculatedHnl = amount * data.nmhnRate
        setHnlEquivalent(formatWithCommas(calculatedHnl.toFixed(2)))
      } else {
        console.error('Error obteniendo tipo de cambio:', data.error)
        // Usar valores por defecto si falla
        // El margen del 1% se aplica restando, no sumando (a favor de la plataforma)
        const defaultBchRate = currency === 'USD' ? 26.2214 : 28.50
        const defaultNmhnRate = defaultBchRate * 0.99
        setBchRate(defaultBchRate)
        setNmhnRate(defaultNmhnRate)
        setEditableAmount(formatWithCommas(amount.toFixed(2)))
        const calculatedHnl = amount * defaultNmhnRate
        setHnlEquivalent(formatWithCommas(calculatedHnl.toFixed(2)))
      }
    } catch (error) {
      console.error('Error cargando tipo de cambio:', error)
      // Usar valores por defecto si falla
      // El margen del 1% se aplica restando, no sumando (a favor de la plataforma)
      const defaultBchRate = currency === 'USD' ? 26.2214 : 28.50
      const defaultNmhnRate = defaultBchRate * 0.99
      setBchRate(defaultBchRate)
      setNmhnRate(defaultNmhnRate)
      setEditableAmount(formatWithCommas(amount.toFixed(2)))
      const calculatedHnl = amount * defaultNmhnRate
      setHnlEquivalent(formatWithCommas(calculatedHnl.toFixed(2)))
    } finally {
      setLoadingExchangeRate(false)
    }
  }

  // Función para calcular automáticamente el equivalente usando la tasa NMHN
  const calculateEquivalent = (amount: number, rate: number) => {
    return amount * rate
  }

  // Función para recalcular el equivalente en HNL cuando cambia el monto en USD/EUR
  const recalculateHnlEquivalent = (usdEurAmount: number) => {
    if (nmhnRate) {
      if (usdEurAmount > 0) {
        const calculatedHnl = usdEurAmount * nmhnRate
        setHnlEquivalent(formatWithCommas(calculatedHnl.toFixed(2)))
      } else {
        // Si el monto es 0 o menor, establecer el equivalente en 0
        setHnlEquivalent("0.00")
      }
    }
  }

  const handleConfirmHnlEquivalent = async () => {
    const editedAmount = parseAmountString(editableAmount)
    
    if (editedAmount <= 0) {
      toast({
        title: "Error",
        description: `El monto en ${pendingCurrencyType === 'USD' ? 'USD' : 'EUR'} debe ser mayor a 0`,
        variant: "destructive",
      })
      return
    }

    // Calcular el equivalente en HNL con el monto editado
    const hnlAmount = nmhnRate ? editedAmount * nmhnRate : parseAmountString(hnlEquivalent)
    
    if (hnlAmount <= 0) {
      toast({
        title: "Error",
        description: "El monto equivalente en HNL debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    // Cerrar el modal secundario primero
    setShowHnlEquivalentModal(false)
    setProcessing(true)
    
    try {
      await handleInternationalTransfer(editedAmount, hnlAmount)
      // handleInternationalTransfer ya llama a resetForm() y onSuccess() si es exitoso
      // También limpia los estados del modal secundario
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
      setProcessing(false)
      // No limpiar estados si hay error, para que el usuario pueda reintentar
    }
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
    setHnlEquivalent("")
    setEditableAmount("")
    setShowHnlEquivalentModal(false)
    setBchRate(null)
    setNmhnRate(null)
    setLoadingExchangeRate(false)
    onOpenChange(false)
  }

  return (
    <>
      {/* Modal principal */}
      <Dialog open={open && !showHnlEquivalentModal} onOpenChange={onOpenChange}>
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
    
    {/* Modal secundario para equivalente en HNL (USD/EUR) */}
    <Dialog open={showHnlEquivalentModal} onOpenChange={(open) => {
      if (!open) {
        // Al cancelar, solo cerrar el modal secundario y volver al principal
        setShowHnlEquivalentModal(false)
        setHnlEquivalent("")
        setEditableAmount("")
        setBchRate(null)
        setNmhnRate(null)
        setLoadingExchangeRate(false)
        setProcessing(false)
        // NO cerrar el modal principal, solo limpiar el secundario
      }
    }}>
      <DialogContent 
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] sm:w-[28rem] bg-background border-border shadow-xl"
        style={{
          maxHeight: '95vh',
          overflowY: 'auto',
          minWidth: '320px',
          maxWidth: '28rem'
        }}
      >
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl font-semibold text-center sm:text-left">
            Equivalente en Lempiras (HNL)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm sm:text-base text-center sm:text-left">
            Recibirás el monto en HNLD equivalente a los {pendingCurrencyType === 'USD' ? 'USD' : 'EUR'} que ingreses, calculado con la tasa NMHN.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6">
          {/* Información del tipo de cambio del Banco Central de Honduras y NMHN */}
          {bchRate && nmhnRate && (
            <div className="space-y-3">
              {/* Tipo de Cambio Oficial BCH */}
              <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-green-900 dark:text-green-100">
                    Tipo de Cambio Oficial (BCH)
                  </Label>
                  {loadingExchangeRate && (
                    <span className="text-xs text-green-600 dark:text-green-400">Cargando...</span>
                  )}
                </div>
                <p className="text-sm text-green-800 dark:text-green-200">
                  <span className="font-medium">{pendingCurrencyType === 'USD' ? 'USD' : 'EUR'}</span> a HNL (TCR): 
                  <span className="font-bold ml-1">L. {bchRate.toFixed(4)}</span>
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Tipo de Cambio de Referencia del Banco Central de Honduras
                </p>
              </div>

              {/* Tasa NMHN con Spread */}
              <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Tasa NMHN
                  </Label>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">{pendingCurrencyType === 'USD' ? 'USD' : 'EUR'}</span> a HNL: 
                    <span className="font-bold ml-1">L. {nmhnRate.toFixed(4)}</span>
                  </p>
                  <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                    <p className="font-medium">Margen aplicado: 1% (a favor de la plataforma)</p>
                    <p className="text-xs">
                      Para operación, seguridad y soporte de la red.
                    </p>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mt-2">
                    Recibirás: {formatCurrency(editableAmount && nmhnRate ? calculateEquivalent(parseAmountString(editableAmount), nmhnRate) : 0, 'HNLD')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div>
            <Label htmlFor="currency-amount" className="text-base font-medium block mb-2">
              Monto en {pendingCurrencyType === 'USD' ? 'Dólares (USD)' : 'Euros (EUR)'}
            </Label>
            <Input
              id="currency-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={editableAmount}
              onChange={(e) => {
                const formatted = formatWithCommas(e.target.value)
                setEditableAmount(formatted)
                const parsed = parseAmountString(formatted)
                // Recalcular siempre, incluso si es 0
                if (nmhnRate !== null) {
                  recalculateHnlEquivalent(parsed)
                }
              }}
              onBlur={() => {
                const formatted = formatWithCommas(editableAmount)
                setEditableAmount(formatted)
                const parsed = parseAmountString(formatted)
                // Recalcular siempre, incluso si es 0
                if (nmhnRate !== null) {
                  recalculateHnlEquivalent(parsed)
                }
              }}
              className="h-12 text-base sm:text-lg"
              style={{
                fontSize: '16px',
                minHeight: '48px'
              }}
              autoFocus
            />
            {nmhnRate && (
              <div className="mt-3 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30">
                <p className="text-sm font-medium text-foreground">
                  Recibirás: <span className="font-bold text-primary">{formatCurrency(Number(hnlEquivalent) || 0, 'HNLD')}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado con la tasa NMHN (TCR del BCH menos 1% de margen a favor de la plataforma).
                </p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 px-0 sm:px-0">
          <Button 
            variant="outline" 
            onClick={() => {
              // Al cancelar, volver al modal principal sin cerrarlo
              setShowHnlEquivalentModal(false)
              setHnlEquivalent("")
              setEditableAmount("")
              setBchRate(null)
              setNmhnRate(null)
              setLoadingExchangeRate(false)
              setProcessing(false)
            }}
            disabled={processing}
            className="w-full sm:w-auto h-12 text-base font-medium"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmHnlEquivalent}
            disabled={processing || parseAmountString(editableAmount) <= 0}
            className="w-full sm:w-auto h-12 text-base font-medium"
          >
            {processing ? "Procesando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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
