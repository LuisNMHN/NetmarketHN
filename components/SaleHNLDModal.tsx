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
import { createSaleRequest } from "@/lib/actions/sale_requests"
import { Minus } from "lucide-react"

interface SaleHNLDModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultMethod?: "local_transfer" | "international_transfer" | "card" | "digital_balance" | "cash"
}

export function SaleHNLDModal({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultMethod = "local_transfer" 
}: SaleHNLDModalProps) {
  const [processing, setProcessing] = useState(false)
  const [showPhysicalAmountModal, setShowPhysicalAmountModal] = useState(false)
  const [physicalAmount, setPhysicalAmount] = useState("")
  const [pendingHnldAmount, setPendingHnldAmount] = useState<number>(0)
  const [pendingCurrencyType, setPendingCurrencyType] = useState<'USD' | 'EUR'>('USD')
  const [bchRate, setBchRate] = useState<number | null>(null)
  const [nmhnRate, setNmhnRate] = useState<number | null>(null)
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false)
  const [saleForm, setSaleForm] = useState({
    amount: "", // Monto en HNLD que se quiere vender
    method: undefined as "local_transfer" | "international_transfer" | "card" | "digital_balance" | "cash" | undefined,
    bank: undefined as string | undefined,
    customBank: "" as string,
    country: undefined as string | undefined,
    customCountry: "" as string,
    wallet: undefined as string | undefined
  })
  const { toast } = useToast()
  
  // Utilidades para formatear/parsear montos
  const parseAmountString = (input: string): number => {
    const normalized = (input || "").replace(/[^\d.]/g, "")
    const value = parseFloat(normalized)
    return isNaN(value) ? 0 : value
  }

  const formatWithCommas = (input: string): string => {
    const cleaned = input.replace(/[^\d.]/g, "")
    const parts = cleaned.split('.')
    let integerPart = parts[0] || ''
    const decimalPart = parts[1] ? '.' + parts[1].slice(0, 2) : ''
    
    if (integerPart.length > 5) {
      integerPart = integerPart.slice(0, 5)
    }
    
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return formattedInteger + decimalPart
  }

  const modalRef = useRef<HTMLDivElement>(null)

  // Efecto para desenfoque del contenido de fondo
  useEffect(() => {
    if (open) {
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'blur(20px)'
        pageContent.style.transition = 'filter 0.3s ease-out'
      }
      
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
      const pageContent = document.querySelector('main') || document.querySelector('#__next') || document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'none'
      }
    }
  }, [open])

  // Manejo del teclado virtual en móviles
  useEffect(() => {
    if (open) {
      const viewport = document.querySelector('meta[name=viewport]')
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      }

      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'

      const handleClickOutside = (e: Event) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-radix-select-content]')) {
          e.stopPropagation()
        }
      }

      document.addEventListener('click', handleClickOutside, true)

      const handleResize = () => {
        if (modalRef.current) {
          modalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }

      window.addEventListener('resize', handleResize)
      
      return () => {
        window.removeEventListener('resize', handleResize)
        document.removeEventListener('click', handleClickOutside, true)
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0')
        }
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.width = ''
      }
    }
  }, [open])

  // Función para cargar el tipo de cambio del Banco Central de Honduras
  const loadExchangeRate = async (currency: 'USD' | 'EUR', hnldAmount: number) => {
    setLoadingExchangeRate(true)
    try {
      const response = await fetch(`/api/exchange-rate?currency=${currency}`)
      const data = await response.json()
      
      if (data.success && data.bchRate && data.nmhnRate) {
        setBchRate(data.bchRate)
        setNmhnRate(data.nmhnRate)
        
        // Calcular automáticamente el monto físico que recibirá (usando tasa NMHN)
        // Para ventas: HNLD / tasa = dinero físico que recibirá
        const calculatedPhysical = hnldAmount / data.nmhnRate
        setPhysicalAmount(formatWithCommas(calculatedPhysical.toFixed(2)))
      } else {
        console.error('Error obteniendo tipo de cambio:', data.error)
        const defaultBchRate = currency === 'USD' ? 26.2214 : 28.50
        const defaultNmhnRate = defaultBchRate * 0.99
        setBchRate(defaultBchRate)
        setNmhnRate(defaultNmhnRate)
        const calculatedPhysical = hnldAmount / defaultNmhnRate
        setPhysicalAmount(formatWithCommas(calculatedPhysical.toFixed(2)))
      }
    } catch (error) {
      console.error('Error cargando tipo de cambio:', error)
      const defaultBchRate = currency === 'USD' ? 26.2214 : 28.50
      const defaultNmhnRate = defaultBchRate * 0.99
      setBchRate(defaultBchRate)
      setNmhnRate(defaultNmhnRate)
      const calculatedPhysical = hnldAmount / defaultNmhnRate
      setPhysicalAmount(formatWithCommas(calculatedPhysical.toFixed(2)))
    } finally {
      setLoadingExchangeRate(false)
    }
  }

  const handleSale = async () => {
    if (!saleForm.amount || !saleForm.method) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    const hnldAmount = parseAmountString(saleForm.amount)
    if (hnldAmount <= 0) {
      toast({
        title: "Error",
        description: "El monto en HNLD debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    
    try {
      if (saleForm.method === "local_transfer") {
        if (!saleForm.bank) {
          toast({
            title: "Banco requerido",
            description: "Selecciona el banco para recibir la transferencia local",
            variant: "destructive",
          })
          setProcessing(false)
          return
        }
        if (saleForm.bank === 'Otros' && !saleForm.customBank.trim()) {
          toast({
            title: "Nombre de banco requerido",
            description: "Ingresa el nombre del banco en la opción 'Otros'",
            variant: "destructive",
          })
          setProcessing(false)
          return
        }
      }

      if (saleForm.method === "international_transfer") {
        // Verificar si es USD o EUR para mostrar modal de monto físico
        let currencyType: 'USD' | 'EUR' = 'USD'
        if (saleForm.country === 'España' || saleForm.country === 'Otro de la zona euro') {
          currencyType = 'EUR'
        }
        
        // Si es USD o EUR, mostrar modal para solicitar monto físico que quiere recibir
        if (currencyType === 'USD' || currencyType === 'EUR') {
          setPendingHnldAmount(hnldAmount)
          setPendingCurrencyType(currencyType)
          setShowPhysicalAmountModal(true)
          setProcessing(false)
          
          // Cargar tipo de cambio del Banco Central de Honduras
          loadExchangeRate(currencyType, hnldAmount)
          return
        }
        
        // Si no es USD ni EUR, procesar directamente
        await handleInternationalTransfer(hnldAmount)
      } else if (saleForm.method === "local_transfer") {
        await handleLocalTransfer(hnldAmount)
      } else if (saleForm.method === "digital_balance") {
        await handleDigitalBalanceSale(hnldAmount)
      } else if (saleForm.method === "cash") {
        await handleCashSale(hnldAmount)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al procesar la venta",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleLocalTransfer = async (hnldAmount: number) => {
    try {
      const result = await createSaleRequest(hnldAmount, "local_transfer", {
        bankName: saleForm.bank,
        customBankName: saleForm.bank === 'Otros' ? saleForm.customBank : undefined,
        currencyType: 'L',
        amountInOriginalCurrency: hnldAmount,
        finalAmountHnld: hnldAmount,
        description: `Venta de HNLD - Transferencia local - ${saleForm.bank === 'Otros' ? saleForm.customBank : saleForm.bank}`
      })

      if (result.success) {
        toast({
          title: "Solicitud Creada",
          description: `Solicitud de venta por L.${hnldAmount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
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
        title: "Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleInternationalTransfer = async (hnldAmount: number, physicalAmountValue?: number) => {
    try {
      let currencyType: 'USD' | 'EUR' = 'USD'
      if (saleForm.country === 'España' || saleForm.country === 'Otro de la zona euro') {
        currencyType = 'EUR'
      }

      let exchangeRate = 1.0
      let amountInOriginalCurrency = hnldAmount
      
      if (physicalAmountValue && physicalAmountValue > 0 && nmhnRate) {
        amountInOriginalCurrency = physicalAmountValue
        exchangeRate = hnldAmount / physicalAmountValue
      }

      const result = await createSaleRequest(hnldAmount, "international_transfer", {
        country: saleForm.country,
        customCountry: saleForm.country === 'Otro de la zona euro' ? saleForm.customCountry : undefined,
        currencyType: currencyType,
        amountInOriginalCurrency: amountInOriginalCurrency,
        exchangeRateApplied: exchangeRate,
        finalAmountHnld: hnldAmount,
        description: `Venta de HNLD - Transferencia internacional - ${saleForm.country === 'Otro de la zona euro' ? saleForm.customCountry : saleForm.country}`
      })

      if (result.success) {
        const equivalentText = physicalAmountValue ? ` (Recibirás: ${currencyType === 'USD' ? '$' : '€'}${physicalAmountValue.toFixed(2)})` : ''
        toast({
          title: "Solicitud Creada",
          description: `Solicitud de venta por L.${hnldAmount.toFixed(2)} HNLD${equivalentText} creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
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
        title: "Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleDigitalBalanceSale = async (hnldAmount: number) => {
    try {
      const result = await createSaleRequest(hnldAmount, "digital_balance", {
        digitalWallet: saleForm.wallet,
        currencyType: 'L',
        amountInOriginalCurrency: hnldAmount,
        finalAmountHnld: hnldAmount,
        description: `Venta de HNLD - Saldo digital - ${saleForm.wallet}`
      })

      if (result.success) {
        toast({
          title: "Solicitud Creada",
          description: `Solicitud de venta por L.${hnldAmount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
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
        title: "Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleCashSale = async (hnldAmount: number) => {
    try {
      const result = await createSaleRequest(hnldAmount, "cash", {
        currencyType: 'L',
        amountInOriginalCurrency: hnldAmount,
        finalAmountHnld: hnldAmount,
        description: `Venta de HNLD - Efectivo`
      })

      if (result.success) {
        toast({
          title: "Solicitud Creada",
          description: `Solicitud de venta por L.${hnldAmount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
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
        title: "Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    }
  }

  const handleConfirmPhysicalAmount = async () => {
    const physicalAmountValue = parseAmountString(physicalAmount)
    
    if (physicalAmountValue <= 0) {
      toast({
        title: "Error",
        description: "El monto físico debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    setShowPhysicalAmountModal(false)
    setProcessing(true)
    
    try {
      await handleInternationalTransfer(pendingHnldAmount, physicalAmountValue)
    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al crear la solicitud",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
      setPhysicalAmount("")
    }
  }

  const resetForm = () => {
    setSaleForm({ 
      amount: "", 
      method: undefined,
      bank: undefined,
      customBank: "",
      country: undefined,
      customCountry: "",
      wallet: undefined
    })
    setPhysicalAmount("")
    setShowPhysicalAmountModal(false)
    setBchRate(null)
    setNmhnRate(null)
    setLoadingExchangeRate(false)
    onOpenChange(false)
  }

  return (
    <>
      {/* Modal principal */}
      <Dialog open={open && !showPhysicalAmountModal} onOpenChange={onOpenChange}>
        <DialogContent 
          ref={modalRef}
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] sm:w-[28rem] bg-background border-border shadow-xl"
          style={{
            maxHeight: '95vh',
            overflowY: 'auto',
            touchAction: 'none',
            WebkitOverflowScrolling: 'touch',
            transition: 'transform 0.2s ease-out',
            minWidth: '320px',
            maxWidth: '28rem'
          }}
        >
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl font-semibold text-center sm:text-left">
              Vender HNLD
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm sm:text-base text-center sm:text-left">
              Vende tus HNLD y recibe dinero físico
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6">
            <div>
              <Label htmlFor="sale-method" className="text-base font-medium block mb-2">
                Método de Pago a Recibir
              </Label>
              <Select
                value={saleForm.method}
                onValueChange={(value) => setSaleForm((prev) => ({ 
                  ...prev, 
                  method: value as "local_transfer" | "international_transfer" | "card" | "digital_balance" | "cash",
                  bank: value === "local_transfer" ? prev.bank : undefined,
                  country: value === "international_transfer" ? prev.country : undefined,
                  customCountry: value === "international_transfer" ? prev.customCountry : "",
                  wallet: value === "digital_balance" ? prev.wallet : undefined
                }))}
              >
                <SelectTrigger className="h-12 text-base sm:text-lg">
                  <SelectValue placeholder="Selecciona cómo quieres recibir el pago" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="local_transfer" className="text-base py-3">
                    🏦 Transferencia Local
                  </SelectItem>
                  <SelectItem value="international_transfer" className="text-base py-3">
                    🌍 Transferencia Internacional
                  </SelectItem>
                  <SelectItem value="digital_balance" className="text-base py-3">
                    💰 Saldo Digital
                  </SelectItem>
                  <SelectItem value="cash" className="text-base py-3">
                    💵 Efectivo
                  </SelectItem>
                </SelectContent>
              </Select>
              {saleForm.method === "local_transfer" && (
                <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                  <p className="text-sm text-foreground dark:text-foreground font-medium">Recibirás transferencia bancaria local.</p>
                  <div>
                    <Label className="text-sm font-medium block mb-2">Banco</Label>
                    <Select
                      value={saleForm.bank}
                      onValueChange={(value) => setSaleForm((prev) => ({ ...prev, bank: value, customBank: value === 'Otros' ? prev.customBank : '' }))}
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
                    {saleForm.bank === 'Otros' && (
                      <Input
                        className="mt-3 h-11 text-base"
                        placeholder="Ingresa el nombre del banco"
                        value={saleForm.customBank}
                        onChange={(e) => setSaleForm((prev) => ({ ...prev, customBank: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              )}
              {saleForm.method === "international_transfer" && (
                <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                  <p className="text-sm text-foreground dark:text-foreground font-medium">Recibirás transferencia internacional.</p>
                  <div>
                    <Label className="text-sm font-medium block mb-2">País</Label>
                    <Select
                      value={saleForm.country}
                      onValueChange={(value) => setSaleForm((prev) => ({ ...prev, country: value, customCountry: value === 'Otro de la zona euro' ? prev.customCountry : '' }))}
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
                    {saleForm.country === 'Otro de la zona euro' && (
                      <Input
                        className="mt-3 h-11 text-base"
                        placeholder="Ingresa el nombre del país"
                        value={saleForm.customCountry}
                        onChange={(e) => setSaleForm((prev) => ({ ...prev, customCountry: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              )}
              {saleForm.method === "digital_balance" && (
                <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                  <p className="text-sm text-foreground dark:text-foreground font-medium">Recibirás pago en saldo digital.</p>
                  <div>
                    <Label className="text-sm font-medium block mb-2">Billetera Digital</Label>
                    <Select
                      value={saleForm.wallet}
                      onValueChange={(value) => setSaleForm((prev) => ({ ...prev, wallet: value }))}
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
              {saleForm.method === "cash" && (
                <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50">
                  <p className="text-sm text-foreground dark:text-foreground font-medium">Recibirás pago en efectivo.</p>
                </div>
              )}
            </div>
            
            {saleForm.method && (
              <div>
                <Label htmlFor="sale-amount" className="text-base font-medium block mb-2">
                  Monto en HNLD a Vender
                </Label>
                <Input
                  id="sale-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={saleForm.amount}
                  onChange={(e) => setSaleForm((prev) => ({ ...prev, amount: formatWithCommas(e.target.value) }))}
                  onBlur={() => setSaleForm((prev) => ({ ...prev, amount: formatWithCommas(prev.amount) }))}
                  className="h-12 text-base sm:text-lg"
                  style={{
                    fontSize: '16px',
                    minHeight: '48px'
                  }}
                  onFocus={() => {
                    setTimeout(() => {
                      const input = document.getElementById('sale-amount')
                      if (input) {
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    }, 300)
                  }}
                />
                {saleForm.method === "international_transfer" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Se calculará el monto físico que recibirás según el tipo de cambio
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
              onClick={handleSale} 
              disabled={
                processing ||
                !saleForm.method ||
                (saleForm.method === "local_transfer" && (
                  !saleForm.bank ||
                  (saleForm.bank === 'Otros' && !saleForm.customBank.trim()) ||
                  parseAmountString(saleForm.amount) <= 0
                )) ||
                (saleForm.method === "international_transfer" && (
                  !saleForm.country ||
                  (saleForm.country === 'Otro de la zona euro' && !saleForm.customCountry.trim()) ||
                  parseAmountString(saleForm.amount) <= 0
                )) ||
                (saleForm.method === "digital_balance" && (
                  !saleForm.wallet ||
                  parseAmountString(saleForm.amount) <= 0
                )) ||
                (saleForm.method === "cash" && (
                  parseAmountString(saleForm.amount) <= 0
                ))
              }
              className="w-full sm:w-auto h-12 text-base font-medium"
            >
              {processing ? "Procesando..." : "Vender HNLD"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal secundario para monto físico (USD/EUR) */}
      <Dialog open={showPhysicalAmountModal} onOpenChange={(open) => {
        if (!open) {
          setShowPhysicalAmountModal(false)
          setPhysicalAmount("")
          setProcessing(false)
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
              Monto Físico a Recibir
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm sm:text-base text-center sm:text-left">
              Ingresa el monto en {pendingCurrencyType === 'USD' ? 'dólares' : 'euros'} que quieres recibir por L.{pendingHnldAmount.toFixed(2)} HNLD
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6">
            {/* Información del tipo de cambio */}
            {bchRate && nmhnRate && (
              <div className="space-y-3">
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
                      Equivalente calculado: {pendingCurrencyType === 'USD' ? '$' : '€'} {(pendingHnldAmount / nmhnRate).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="physical-amount" className="text-base font-medium block mb-2">
                Monto en {pendingCurrencyType === 'USD' ? 'Dólares (USD)' : 'Euros (EUR)'}
              </Label>
              <Input
                id="physical-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={physicalAmount}
                onChange={(e) => setPhysicalAmount(formatWithCommas(e.target.value))}
                onBlur={() => setPhysicalAmount(formatWithCommas(physicalAmount))}
                className="h-12 text-base sm:text-lg"
                style={{
                  fontSize: '16px',
                  minHeight: '48px'
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                Este será el monto en {pendingCurrencyType === 'USD' ? 'USD' : 'EUR'} que recibirás. Puedes ajustar el valor según el tipo de cambio acordado.
              </p>
              {nmhnRate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => {
                    const calculated = pendingHnldAmount / nmhnRate
                    setPhysicalAmount(formatWithCommas(calculated.toFixed(2)))
                  }}
                >
                  Recalcular con tasa NMHN
                </Button>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 px-0 sm:px-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPhysicalAmountModal(false)
                setPhysicalAmount("")
              }}
              disabled={processing}
              className="w-full sm:w-auto h-12 text-base font-medium"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmPhysicalAmount}
              disabled={processing || parseAmountString(physicalAmount) <= 0}
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
interface SaleHNLDButtonProps {
  onSuccess?: () => void
  defaultMethod?: "local_transfer" | "international_transfer" | "card" | "digital_balance" | "cash"
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
  className?: string
  children?: React.ReactNode
}

export function SaleHNLDButton({ 
  onSuccess,
  defaultMethod = "local_transfer",
  variant = "default",
  size = "default",
  className,
  children
}: SaleHNLDButtonProps) {
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
            <Minus className="mr-2 h-4 w-4" />
            Vender HNLD
          </>
        )}
      </Button>
      
      <SaleHNLDModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
        defaultMethod={defaultMethod}
      />
    </>
  )
}

