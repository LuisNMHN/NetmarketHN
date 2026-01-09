"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { AuthSpinner } from "@/components/ui/auth-spinner"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { PurchaseHNLDModal } from "@/components/PurchaseHNLDModal"
import { SaleHNLDModal } from "@/components/SaleHNLDModal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { 
  getUserHNLDBalance, 
  emitHNLD, 
  getTransactionHistory,
  type HNLDBalance,
  type HNLDTransaction
} from "@/lib/actions/hnld"
import { supabaseBrowser } from "@/lib/supabase/client"
import {
  createDirectTransfer,
  findUserByEmail,
  type DirectTransfer
} from "@/lib/actions/direct_transfers"
import {
  createPurchaseRequest,
  processCardPurchase,
  type PurchaseRequest
} from "@/lib/actions/purchase_requests"
import { 
  Wallet, 
  Plus, 
  Minus, 
  ArrowRightLeft, 
  RefreshCw, 
  DollarSign, 
  Banknote,
  Coins,
  TrendingUp,
  TrendingDown,
  Send,
  History,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  Shield,
  HelpCircle,
  User
} from "lucide-react"
import Link from "next/link"

export default function SaldoPage() {
  const [hnldBalance, setHnldBalance] = useState<HNLDBalance | null>(null)
  const [transactions, setTransactions] = useState<HNLDTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const { toast } = useToast()

  // Form states
  const [transferForm, setTransferForm] = useState({ 
    email: "", 
    amount: "", 
    description: "" 
  })
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; full_name?: string } | null>(null)
  const [validatingEmail, setValidatingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cargar datos inmediatamente al montar el componente
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Obtener usuario y cargar datos en paralelo
        const supabase = supabaseBrowser()
        const [userResult, balanceResult, historyResult] = await Promise.all([
          supabase.auth.getUser(),
          getUserHNLDBalance(),
          getTransactionHistory(50, 0) // Aumentar límite para mostrar más transacciones
        ])

        // Establecer usuario
        if (userResult.data?.user) {
          setCurrentUserId(userResult.data.user.id)
        }

        // Establecer balance
        if (balanceResult.success && balanceResult.data) {
          setHnldBalance(balanceResult.data)
        } else {
          toast({
            title: "Error",
            description: balanceResult.error || "No se pudo cargar el balance HNLD",
            variant: "destructive",
          })
        }

        // Establecer transacciones
        if (historyResult.success && historyResult.data) {
          setTransactions(historyResult.data)
        }
      } catch (error) {
        console.error('❌ Error inicializando datos:', error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    }

    initializeData()
  }, [])

  const loadHNLDData = async () => {
    try {
      // Cargar balance HNLD y transacciones en paralelo
      const [balanceResult, historyResult] = await Promise.all([
        getUserHNLDBalance(),
        getTransactionHistory(50, 0) // Aumentar límite para mostrar más transacciones
      ])

      if (balanceResult.success && balanceResult.data) {
        setHnldBalance(balanceResult.data)
      } else {
        toast({
          title: "Error",
          description: balanceResult.error || "No se pudo cargar el balance HNLD",
          variant: "destructive",
        })
      }

      if (historyResult.success && historyResult.data) {
        setTransactions(historyResult.data)
      }
    } catch (error) {
      console.error('❌ Error cargando datos HNLD:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadHNLDData()
  }


  // Validar formato de email
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Buscar usuario por email con debounce
  const handleEmailChange = (email: string) => {
    setTransferForm(prev => ({ ...prev, email }))
    setSelectedUser(null)
    setEmailError(null)

    // Limpiar timeout anterior
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current)
    }

    // Si el email está vacío, no hacer nada
    if (!email || email.trim() === '') {
      return
    }

    // Validar formato de email
    if (!isValidEmail(email)) {
      setEmailError('Formato de email inválido')
      return
    }

    // Buscar usuario después de 500ms de inactividad (debounce)
    setValidatingEmail(true)
    emailTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await findUserByEmail(email.trim().toLowerCase())
        if (result && result.success && result.data) {
          setSelectedUser(result.data)
          setEmailError(null)
        } else {
          setSelectedUser(null)
          setEmailError(result.error || 'Usuario no encontrado')
        }
      } catch (error) {
        console.error('Error buscando usuario:', error)
        setSelectedUser(null)
        setEmailError('Error al buscar usuario')
      } finally {
        setValidatingEmail(false)
      }
    }, 500)
  }

  const handleTransfer = async () => {
    // Validar email si no hay usuario seleccionado
    if (!selectedUser) {
      if (!transferForm.email || !isValidEmail(transferForm.email)) {
        toast({
          title: "Error",
          description: "Debes ingresar un email válido",
          variant: "destructive",
        })
        return
      }
      
      // Intentar buscar el usuario una vez más
      setValidatingEmail(true)
      try {
        const result = await findUserByEmail(transferForm.email.trim().toLowerCase())
        if (result && result.success && result.data) {
          setSelectedUser(result.data)
        } else {
          toast({
            title: "Error",
            description: result.error || "Usuario no encontrado",
            variant: "destructive",
          })
          return
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Error al buscar usuario",
          variant: "destructive",
        })
        return
      } finally {
        setValidatingEmail(false)
      }
    }

    if (!selectedUser) {
      toast({
        title: "Error",
        description: "Debes ingresar un email válido de un usuario registrado",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(transferForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    if (hnldBalance && amount > hnldBalance.available_balance) {
      toast({
        title: "Error",
        description: `Balance insuficiente. Disponible: ${formatCurrency(hnldBalance.available_balance, 'HNLD')}`,
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await createDirectTransfer(
        selectedUser.id,
        amount,
        transferForm.description || undefined
      )

      if (result.success) {
        toast({
          title: "Transferencia completada",
          description: `Has transferido ${formatCurrency(amount, 'HNLD')} a ${selectedUser.full_name || selectedUser.email}`,
          variant: "created",
        })
        
        // Limpiar formulario
        setSelectedUser(null)
        setTransferForm({ email: "", amount: "", description: "" })
        setEmailError(null)
        setTransferOpen(false)
        
        // Limpiar timeout si existe
        if (emailTimeoutRef.current) {
          clearTimeout(emailTimeoutRef.current)
        }
        
        // Recargar datos
        await loadHNLDData()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error procesando transferencia",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error inesperado",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current)
      }
    }
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completado</Badge>
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'withdrawal':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      case 'transfer':
        return <Send className="h-4 w-4 text-blue-500" />
      default:
        return <ArrowRightLeft className="h-4 w-4 text-gray-500" />
    }
  }

  const getTransactionTypeLabel = (type: string): string => {
    switch (type) {
      case 'deposit':
        return 'Compra de HNLD'
      case 'withdrawal':
        return 'Venta de HNLD'
      case 'transfer':
        return 'Transferencia directa de HNLD'
      default:
        return type
    }
  }

  const getTransactionTitle = (transaction: HNLDTransaction): string => {
    switch (transaction.transaction_type) {
      case 'deposit':
        return 'Compra de HNLD'
      case 'withdrawal':
        return 'Venta de HNLD'
      case 'transfer':
        return 'Transferencia de HNLD'
      default:
        return 'Transacción HNLD'
    }
  }

  const formatAmountWithHNLD = (amount: number): string => {
    const formattedAmount = amount.toLocaleString('es-HN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return `HNLD ${formattedAmount}`
  }

  // Determinar si el monto debe mostrarse en rojo (débito)
  const isDebit = (transaction: HNLDTransaction): boolean => {
    // Ventas (withdrawal) siempre son débitos
    if (transaction.transaction_type === 'withdrawal') {
      return true
    }
    // Transferencias salientes (cuando el usuario es el remitente) son débitos
    if (transaction.transaction_type === 'transfer' && currentUserId && transaction.from_user_id === currentUserId) {
      return true
    }
    return false
  }

  useEffect(() => {
    loadHNLDData()
  }, [])

  // Efecto para desenfoque del contenido de fondo cuando se abre el modal
  useEffect(() => {
    if (transferOpen) {
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
  }, [transferOpen])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="Cargando balance HNLD..." />
      </div>
    )
  }

  if (!hnldBalance) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="No se pudo cargar el balance HNLD" />
      </div>
    )
  }

  return (
    <>
      {refreshing && <AuthSpinner message="Actualizando datos..." />}
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setInfoOpen(true)}
          className="transition-all duration-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:border-blue-800 dark:hover:text-blue-300"
        >
          <Info className="mr-2 h-4 w-4" />
          ¿Qué es HNLD?
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="transition-all duration-200 hover:bg-green-50 hover:border-green-200 hover:text-green-700 dark:hover:bg-green-950 dark:hover:border-green-800 dark:hover:text-green-300 disabled:hover:bg-transparent disabled:hover:border-border disabled:hover:text-muted-foreground"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {/* Balance Overview */}
      <TooltipProvider>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-sm border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base md:text-lg font-semibold">Balance Total</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-green-600 transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="font-semibold mb-2 text-sm">Balance Total</p>
                      <p className="text-xs leading-relaxed">Todo el dinero HNLD que tienes en tu cuenta, incluyendo el disponible y el reservado en transacciones pendientes. Cada HNLD equivale a un lempira físico.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Coins className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                <span className="text-lg mr-2">HNLD</span>
                {hnldBalance.balance.toLocaleString('es-HN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <p className="text-xs text-muted-foreground">HNLD en tu cuenta</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base md:text-lg font-semibold">Disponible</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="font-semibold mb-2 text-sm">Balance Disponible</p>
                      <p className="text-xs leading-relaxed">Dinero que puedes usar inmediatamente para transferencias, retiros o pagos. No está bloqueado en transacciones pendientes. Cada lempira digital está respaldado por un lempira físico.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                <span className="text-lg mr-2">HNLD</span>
                {hnldBalance.available_balance.toLocaleString('es-HN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <p className="text-xs text-muted-foreground">Listo para usar</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base md:text-lg font-semibold">Reservado</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-orange-600 transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="font-semibold mb-2 text-sm">Balance Reservado</p>
                      <p className="text-xs leading-relaxed">Dinero temporalmente bloqueado en transacciones pendientes, escrows o pagos en proceso. Se libera automáticamente cuando se completa la transacción. El lempira digital mantiene su valor 1:1 con el lempira físico.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Banknote className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                <span className="text-lg mr-2">HNLD</span>
                {hnldBalance.reserved_balance.toLocaleString('es-HN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <p className="text-xs text-muted-foreground">En transacciones pendientes</p>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Action Buttons */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base md:text-lg font-semibold">Acciones HNLD</CardTitle>
          <CardDescription>Gestiona tu balance de Honduras Lempira Digital (HNLD)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
              <DialogTrigger asChild>
                <Button className="h-16 flex-col space-y-2" disabled={processing}>
                  <Plus className="h-5 w-5" />
                  <span>Comprar HNLD</span>
                </Button>
              </DialogTrigger>
              <PurchaseHNLDModal
                open={depositOpen}
                onOpenChange={setDepositOpen}
                onSuccess={loadHNLDData}
                defaultMethod="request"
              />
            </Dialog>

            <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="h-16 flex-col space-y-2" disabled={processing}>
                  <Minus className="h-5 w-5" />
                  <span>Vender HNLD</span>
                </Button>
              </DialogTrigger>
              <SaleHNLDModal
                open={saleOpen}
                onOpenChange={setSaleOpen}
                onSuccess={loadHNLDData}
                defaultMethod="local_transfer"
              />
            </Dialog>

            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button className="h-16 flex-col space-y-2 bg-blue-600 hover:bg-blue-700 text-white" disabled={processing}>
                  <ArrowRightLeft className="h-5 w-5" />
                  <span>Transferir HNLD</span>
                </Button>
              </DialogTrigger>
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
                <DialogHeader className="pb-3 sm:pb-4 border-b border-border">
                  <DialogTitle className="text-lg sm:text-xl font-semibold text-center sm:text-left flex items-center gap-2 text-foreground">
                    <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Transferir HNLD
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm sm:text-base text-center sm:text-left">
                    Transfiere HNLD directamente a otro usuario de la plataforma
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 sm:space-y-6 py-2">
                  {/* Balance disponible destacado */}
                  {hnldBalance && (
                    <div className="p-4 border border-blue-200 dark:border-blue-800/50 rounded-lg bg-transparent">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Balance disponible</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          <span className="text-lg mr-2">HNLD</span>
                          {hnldBalance.available_balance.toLocaleString('es-HN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Email del destinatario */}
                  <div className="space-y-2">
                    <Label htmlFor="transfer-email" className="text-sm font-medium flex items-center gap-2 text-foreground">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Correo electrónico del destinatario
                    </Label>
                    <div className="relative">
                      <Input
                        id="transfer-email"
                        type="email"
                        placeholder="usuario@ejemplo.com"
                        value={transferForm.email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className={`h-11 pr-10 ${
                          emailError ? 'border-red-500 dark:border-red-500 focus:border-red-500 dark:focus:border-red-500 focus:ring-red-500/20 dark:focus:ring-red-500/20' : 
                          selectedUser ? 'border-green-500 dark:border-green-500 focus:border-green-500 dark:focus:border-green-500 focus:ring-green-500/20 dark:focus:ring-green-500/20' : 
                          'focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 dark:focus:ring-blue-400/20'
                        }`}
                        disabled={processing}
                      />
                      {validatingEmail && (
                        <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!validatingEmail && selectedUser && (
                        <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                      {!validatingEmail && emailError && (
                        <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    
                    {/* Mensaje de error o éxito */}
                    {emailError && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {emailError}
                      </p>
                    )}
                    
                    {selectedUser && !emailError && (
                      <div className="border-2 border-green-200 dark:border-green-800/50 rounded-lg p-3 bg-green-50/50 dark:bg-muted/50 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-green-900 dark:text-green-200 truncate">
                              {selectedUser.full_name || 'Usuario'}
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-300 truncate">
                              {selectedUser.email}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(null)
                              setTransferForm(prev => ({ ...prev, email: "" }))
                              setEmailError(null)
                            }}
                            className="flex-shrink-0 h-8"
                          >
                            Cambiar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Monto */}
                  <div className="space-y-2">
                    <Label htmlFor="transfer-amount" className="text-sm font-medium flex items-center gap-2 text-foreground">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      Monto (HNLD)
                    </Label>
                    <div className="relative">
                      <Input
                        id="transfer-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
                        disabled={!selectedUser}
                        className="h-11 text-lg font-semibold focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                    </div>
                    {transferForm.amount && !isNaN(parseFloat(transferForm.amount)) && hnldBalance && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Disponible:</span>
                        <span className={`font-medium ${
                          parseFloat(transferForm.amount) > hnldBalance.available_balance 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {formatCurrency(hnldBalance.available_balance, 'HNLD')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Descripción */}
                  <div className="space-y-2">
                    <Label htmlFor="transfer-description" className="text-sm font-medium text-foreground">
                      Descripción (opcional)
                    </Label>
                    <Textarea
                      id="transfer-description"
                      placeholder="Mensaje o motivo de la transferencia..."
                      value={transferForm.description}
                      onChange={(e) => setTransferForm((prev) => ({ ...prev, description: e.target.value }))}
                      disabled={!selectedUser}
                      rows={3}
                      className="resize-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 dark:focus:ring-blue-400/20"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTransferOpen(false)
                        setSelectedUser(null)
                        setTransferForm({ email: "", amount: "", description: "" })
                        setEmailError(null)
                        if (emailTimeoutRef.current) {
                          clearTimeout(emailTimeoutRef.current)
                        }
                      }}
                      disabled={processing}
                      className="w-full sm:w-auto"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleTransfer}
                      disabled={!selectedUser || !transferForm.amount || processing || validatingEmail}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing || validatingEmail ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          {validatingEmail ? "Verificando..." : "Procesando..."}
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Transferir HNLD
                        </>
                      )}
                    </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base md:text-lg font-semibold">Historial de Transacciones</CardTitle>
            <CardDescription>Últimas transacciones de tu cuenta HNLD</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/saldo/historial">
              <History className="mr-2 h-4 w-4" />
              Ver Todo
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay transacciones aún</p>
              <p className="text-sm text-muted-foreground">Realiza tu primera transacción HNLD</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div>
                      <p className="font-medium">{getTransactionTitle(transaction)}</p>
                      {transaction.description && (
                        <p className="text-sm text-muted-foreground font-mono">{transaction.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isDebit(transaction) ? 'text-red-500' : 'text-green-500'}`}>
                      {isDebit(transaction) ? '-' : '+'}{formatAmountWithHNLD(transaction.amount)}
                    </p>
                    {getStatusBadge(transaction.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de información sobre HNLD */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Coins className="h-6 w-6 text-green-600" />
              <span>¿Qué es HNLD?</span>
            </DialogTitle>
            <DialogDescription>
              Honduras Lempira Digital - Tu moneda digital respaldada 1:1
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4 pr-2">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Respaldo 1:1</h4>
                    <p className="text-sm text-muted-foreground">
                      Cada HNLD está respaldado por 1 lempira físico en reserva
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Estabilidad</h4>
                    <p className="text-sm text-muted-foreground">
                      Valor fijo equivalente al lempira hondureño
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    <Send className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Transferencias</h4>
                    <p className="text-sm text-muted-foreground">
                      Envía y recibe dinero de forma instantánea
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Seguridad</h4>
                    <p className="text-sm text-muted-foreground">
                      Transacciones seguras con tecnología blockchain
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold mb-2">¿Cómo funciona?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Depositas lempiras físicos y recibes HNLD equivalentes</li>
                <li>• Puedes transferir HNLD a otros usuarios instantáneamente</li>
                <li>• Retiras tus HNLD y recibes lempiras físicos de vuelta</li>
                <li>• Todas las transacciones quedan registradas y auditadas</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold mb-2">⚠️ Importante</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="font-bold flex-shrink-0">•</span>
                  <span><strong>No es una criptomoneda:</strong> HNLD es una representación digital del lempira hondureño, no una criptomoneda como Bitcoin o Ethereum.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="font-bold flex-shrink-0">•</span>
                  <span><strong>Sin especulación:</strong> Su valor es fijo y estable, siempre equivale a 1 lempira físico. No hay fluctuaciones de precio ni riesgo de pérdida por volatilidad.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="font-bold flex-shrink-0">•</span>
                  <span><strong>Respaldo garantizado:</strong> Cada HNLD está respaldado por lempiras físicos en reserva, garantizando su valor y convertibilidad.</span>
                </li>
              </ul>
            </div>
            
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Banknote className="h-4 w-4" />
              <span>HNLD = Honduras Lempira Digital</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}