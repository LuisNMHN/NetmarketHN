"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { createSaleRequest } from "@/lib/actions/sale_requests"
import { getUserHNLDBalance, type HNLDBalance } from "@/lib/actions/hnld"
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
  const [hnldBalance, setHnldBalance] = useState<HNLDBalance | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [saleForm, setSaleForm] = useState({
    amount: "", // Cantidad de HNLD a vender
    method: undefined as "local_transfer" | "digital_balance" | undefined,
    bank: undefined as string | undefined,
    customBank: "" as string,
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

  // Referencias para gestos táctiles
  const modalRef = useRef<HTMLDivElement>(null)

  // Cargar balance HNLD cuando se abre el modal
  useEffect(() => {
    if (open) {
      loadBalance()
    }
  }, [open])

  const loadBalance = async () => {
    setLoadingBalance(true)
    try {
      const result = await getUserHNLDBalance()
      if (result.success && result.data) {
        setHnldBalance(result.data)
      }
    } catch (error) {
      console.error('Error cargando balance:', error)
    } finally {
      setLoadingBalance(false)
    }
  }

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

  const handleSale = async () => {
    if (!saleForm.amount || !saleForm.method) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    const amount = parseAmountString(saleForm.amount)
    if (amount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    // Verificar balance disponible
    if (hnldBalance && hnldBalance.available_balance < amount) {
      toast({
        title: "Balance insuficiente",
        description: `Tienes ${formatCurrency(hnldBalance.available_balance, 'HNLD')} disponibles. Necesitas ${formatCurrency(amount, 'HNLD')} para esta venta.`,
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
            description: "Selecciona el banco donde deseas recibir el pago",
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

      if (saleForm.method === "local_transfer") {
        await handleLocalTransfer(amount)
      } else if (saleForm.method === "digital_balance") {
        if (!saleForm.wallet) {
          toast({
            title: "Billetera requerida",
            description: "Selecciona la billetera digital donde deseas recibir el pago",
            variant: "destructive",
          })
          setProcessing(false)
          return
        }
        await handleDigitalBalanceSale(amount)
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar la venta",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleLocalTransfer = async (amount: number) => {
    try {
      const result = await createSaleRequest(amount, "local_transfer", {
        bankName: saleForm.bank,
        customBankName: saleForm.bank === 'Otros' ? saleForm.customBank : undefined,
        currencyType: 'L',
        finalAmountHnld: amount,
        description: `Venta de HNLD - Transferencia local - ${saleForm.bank === 'Otros' ? saleForm.customBank : saleForm.bank}`
      })

      if (result.success) {
        toast({
          title: "Solicitud Creada",
          description: `Solicitud de venta por L.${amount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
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

  const handleDigitalBalanceSale = async (amount: number) => {
    try {
      const result = await createSaleRequest(amount, "digital_balance", {
        digitalWallet: saleForm.wallet,
        currencyType: 'L',
        finalAmountHnld: amount,
        description: `Venta de HNLD - Saldo digital - ${saleForm.wallet}`
      })

      if (result.success) {
        toast({
          title: "Solicitud Creada",
          description: `Solicitud de venta por L.${amount.toFixed(2)} HNLD creada exitosamente.${result.uniqueCode ? ` Código: ${result.uniqueCode}` : ''}`,
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
    e.preventDefault()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
  }

  const handleTouchEnd = () => {
    // Deshabilitado
  }

  const resetForm = () => {
    setSaleForm({ 
      amount: "", 
      method: undefined,
      bank: undefined,
      customBank: "",
      wallet: undefined
    })
    onOpenChange(false)
  }

  const availableBalance = hnldBalance?.available_balance || 0
  const amountToSell = parseAmountString(saleForm.amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl font-semibold text-center sm:text-left">
            Vender HNLD
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm sm:text-base text-center sm:text-left">
            Convierte HNLD digitales en dinero real
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6">
          {/* Mostrar balance disponible */}
          {loadingBalance ? (
            <div className="p-3 rounded-lg border bg-muted/50">
              <p className="text-sm text-muted-foreground">Cargando balance...</p>
            </div>
          ) : hnldBalance && (
            <div className="p-4 border border-blue-200 dark:border-blue-700/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground dark:text-slate-400 mb-1">Balance disponible</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  <span className="text-lg mr-2">HNLD</span>
                  {availableBalance.toLocaleString('es-HN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
                {amountToSell > 0 && amountToSell > availableBalance && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    ⚠️ No tienes suficiente balance disponible
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="sale-method" className="text-base font-medium block mb-2">
              Método de Pago a Recibir
            </Label>
            <Select
              value={saleForm.method}
              onValueChange={(value) => setSaleForm((prev) => ({ 
                ...prev, 
                method: value as "local_transfer" | "digital_balance",
                bank: value === "local_transfer" ? prev.bank : undefined,
                wallet: value === "digital_balance" ? prev.wallet : undefined
              }))}
            >
              <SelectTrigger className="h-12 text-base sm:text-lg">
                <SelectValue placeholder="Selecciona el metodo de pago" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="local_transfer" className="text-base py-3">
                  🏦 Transferencia Local
                </SelectItem>
                <SelectItem value="digital_balance" className="text-base py-3">
                  💰 Saldo Digital
                </SelectItem>
              </SelectContent>
            </Select>
            {saleForm.method === "local_transfer" && (
              <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                <p className="text-sm text-foreground dark:text-foreground font-medium">Recibirás el pago mediante transferencia bancaria local.</p>
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
            {saleForm.method === "digital_balance" && (
              <div className="mt-2 p-3 rounded-lg border bg-muted/50 dark:bg-muted/30 border-border dark:border-border/50 space-y-3">
                <p className="text-sm text-foreground dark:text-foreground font-medium">Recibirás el pago en tu billetera digital.</p>
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
          </div>
          
          {saleForm.method && (
            <div>
              <Label htmlFor="sale-amount" className="text-base font-medium block mb-2">
                Cantidad de HNLD a Vender
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
              {amountToSell > 0 && amountToSell > availableBalance && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  ⚠️ No tienes suficiente balance disponible. Disponible: {formatCurrency(availableBalance, 'HNLD')}
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
              amountToSell <= 0 ||
              amountToSell > availableBalance ||
              (saleForm.method === "local_transfer" && (
                !saleForm.bank ||
                (saleForm.bank === 'Otros' && !saleForm.customBank.trim())
              )) ||
              (saleForm.method === "digital_balance" && !saleForm.wallet)
            }
            className="w-full sm:w-auto h-12 text-base font-medium"
          >
            {processing ? "Procesando..." : "Vender HNLD"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Componente de botón que abre el modal
interface SaleHNLDButtonProps {
  onSuccess?: () => void
  defaultMethod?: "local_transfer" | "international_transfer" | "card" | "digital_balance" | "cash"
  variant?: "default" | "outline" | "destructive"
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

