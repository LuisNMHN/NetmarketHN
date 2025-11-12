"use client"

import { useState, useEffect } from "react"
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
  transferHNLD, 
  getTransactionHistory,
  searchUserByEmail,
  type HNLDBalance,
  type HNLDTransaction
} from "@/lib/actions/hnld"
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
  HelpCircle
} from "lucide-react"

export default function SaldoPage() {
  const [hnldBalance, setHnldBalance] = useState<HNLDBalance | null>(null)
  const [transactions, setTransactions] = useState<HNLDTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const { toast } = useToast()

  // Form states
  const [transferForm, setTransferForm] = useState({ amount: "", recipient: "", description: "" })
  const [searchUser, setSearchUser] = useState({ email: "", user: null as any })
  const [processing, setProcessing] = useState(false)

  const loadHNLDData = async () => {
    try {
      // Cargar balance HNLD
      const balanceResult = await getUserHNLDBalance()
      if (balanceResult.success && balanceResult.data) {
        setHnldBalance(balanceResult.data)
      } else {
        toast({
          title: "Error",
          description: balanceResult.error || "No se pudo cargar el balance HNLD",
          variant: "destructive",
        })
      }

      // Cargar historial de transacciones
      const historyResult = await getTransactionHistory(10, 0)
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


  const handleSearchUser = async () => {
    if (!searchUser.email) {
      toast({
        title: "Error",
        description: "Ingresa un email válido",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await searchUserByEmail(searchUser.email)
      if (result.success && result.data) {
        setSearchUser(prev => ({ ...prev, user: result.data }))
        toast({
          title: "✅ Usuario encontrado",
          description: `${result.data.name || result.data.email}`,
        })
      } else {
        setSearchUser(prev => ({ ...prev, user: null }))
        toast({
          title: "❌ Usuario no encontrado",
          description: result.error || "No se encontró el usuario",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error buscando usuario",
        variant: "destructive",
      })
    }
  }

  const handleTransfer = async () => {
    if (!transferForm.amount || !searchUser.user) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(transferForm.amount)
    if (amount <= 0) {
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
        description: `Balance insuficiente. Disponible: ${formatCurrency(hnldBalance.available_balance)}`,
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await transferHNLD(
        searchUser.user.id, 
        amount, 
        transferForm.description || `Transferencia a ${searchUser.user.name || searchUser.user.email}`
      )
      
      if (result.success) {
        toast({
          title: "✅ Transferencia exitosa",
          description: `Se transfirieron ${formatCurrency(amount)} HNLD a ${searchUser.user.name || searchUser.user.email}`,
        })
        setTransferForm({ amount: "", recipient: "", description: "" })
        setSearchUser({ email: "", user: null })
        setTransferOpen(false)
        await loadHNLDData()
      } else {
        toast({
          title: "❌ Error en transferencia",
          description: result.error || "No se pudo procesar la transferencia",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar la transferencia",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

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

  useEffect(() => {
    loadHNLDData()
  }, [])

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
              <div className="text-2xl font-bold text-green-600">{formatCurrency(hnldBalance.balance)}</div>
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
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(hnldBalance.available_balance)}</div>
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
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(hnldBalance.reserved_balance)}</div>
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

            <SaleHNLDModal
              open={withdrawOpen}
              onOpenChange={setWithdrawOpen}
              onSuccess={() => {
                setWithdrawOpen(false)
                loadHNLDData()
              }}
              defaultMethod="local_transfer"
            />
            <Button 
              variant="outline" 
              className="h-16 flex-col space-y-2 bg-transparent" 
              disabled={processing}
              onClick={() => setWithdrawOpen(true)}
            >
              <Minus className="h-5 w-5" />
              <span>Vender HNLD</span>
            </Button>

            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-16 flex-col space-y-2 bg-transparent" disabled={processing}>
                  <ArrowRightLeft className="h-5 w-5" />
                  <span>Transferir HNLD</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferir HNLD</DialogTitle>
                  <DialogDescription>Transfiere HNLD a otro usuario de la plataforma</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="transfer-amount">Monto en HNLD</Label>
                    <Input
                      id="transfer-amount"
                      type="number"
                      placeholder="0.00"
                      value={transferForm.amount}
                      onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Disponible: {formatCurrency(hnldBalance.available_balance)}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="search-email">Buscar Usuario</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="search-email"
                        type="email"
                        placeholder="Email del destinatario"
                        value={searchUser.email}
                        onChange={(e) => setSearchUser((prev) => ({ ...prev, email: e.target.value }))}
                      />
                      <Button type="button" onClick={handleSearchUser} size="sm">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    {searchUser.user && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm font-medium text-green-800">
                          ✅ {searchUser.user.name || searchUser.user.email}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="transfer-description">Descripción (opcional)</Label>
                    <Textarea
                      id="transfer-description"
                      placeholder="Agregar una descripción..."
                      value={transferForm.description}
                      onChange={(e) => setTransferForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={processing}>
                    Cancelar
                  </Button>
                  <Button onClick={handleTransfer} disabled={processing || !searchUser.user}>
                    {processing ? "Procesando..." : "Transferir HNLD"}
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
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Ver Todo
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
                      <p className="font-medium capitalize">{transaction.transaction_type}</p>
                      <p className="text-sm text-muted-foreground">{transaction.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(transaction.amount)}</p>
                    {getStatusBadge(transaction.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial Completo de Transacciones</DialogTitle>
            <DialogDescription>Todas las transacciones de tu cuenta HNLD</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay transacciones aún</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getTransactionIcon(transaction.transaction_type)}
                          <span className="capitalize">{transaction.transaction_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(transaction.amount)}</TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleDateString('es-HN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Respaldo 1:1</h4>
                    <p className="text-sm text-muted-foreground">
                      Cada HNLD está respaldado por 1 lempira físico en reserva
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <Send className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Transferencias</h4>
                    <p className="text-sm text-muted-foreground">
                      Envía y recibe dinero de forma instantánea
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                    <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
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
            
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">¿Cómo funciona?</h4>
              <ul className="text-sm text-green-700 dark:text-slate-200 space-y-1">
                <li>• Depositas lempiras físicos y recibes HNLD equivalentes</li>
                <li>• Puedes transferir HNLD a otros usuarios instantáneamente</li>
                <li>• Retiras tus HNLD y recibes lempiras físicos de vuelta</li>
                <li>• Todas las transacciones quedan registradas y auditadas</li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:bg-slate-700 dark:border-slate-600 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">⚠️ Importante</h4>
              <ul className="text-sm text-blue-700 dark:text-slate-200 space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-600 dark:text-blue-300 font-bold flex-shrink-0">•</span>
                  <span><strong>No es una criptomoneda:</strong> HNLD es una representación digital del lempira hondureño, no una criptomoneda como Bitcoin o Ethereum.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-600 dark:text-blue-300 font-bold flex-shrink-0">•</span>
                  <span><strong>Sin especulación:</strong> Su valor es fijo y estable, siempre equivale a 1 lempira físico. No hay fluctuaciones de precio ni riesgo de pérdida por volatilidad.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-600 dark:text-blue-300 font-bold flex-shrink-0">•</span>
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