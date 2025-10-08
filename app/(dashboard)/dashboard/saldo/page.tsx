"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
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
  burnHNLD, 
  transferHNLD, 
  getTransactionHistory,
  searchUserByEmail,
  type HNLDBalance,
  type HNLDTransaction
} from "@/lib/actions/hnld"
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
  Clock
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
  const { toast } = useToast()

  // Form states
  const [depositForm, setDepositForm] = useState({ amount: "", method: "", description: "" })
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", account: "", description: "" })
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

  const handleDeposit = async () => {
    if (!depositForm.amount || !depositForm.method) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(depositForm.amount)
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
      const result = await emitHNLD(amount, depositForm.description || `Depósito via ${depositForm.method}`)
      
      if (result.success) {
        toast({
          title: "✅ Depósito exitoso",
          description: `Se emitieron L.${amount.toFixed(2)} HNLD a tu cuenta`,
        })
        setDepositForm({ amount: "", method: "", description: "" })
        setDepositOpen(false)
        await loadHNLDData()
      } else {
        toast({
          title: "❌ Error en depósito",
          description: result.error || "No se pudo procesar el depósito",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar el depósito",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawForm.amount || !withdrawForm.account) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(withdrawForm.amount)
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
        description: `Balance insuficiente. Disponible: L.${hnldBalance.available_balance.toFixed(2)}`,
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await burnHNLD(amount, withdrawForm.description || `Retiro a ${withdrawForm.account}`)
      
      if (result.success) {
        toast({
          title: "✅ Retiro exitoso",
          description: `Se quemaron L.${amount.toFixed(2)} HNLD de tu cuenta`,
        })
        setWithdrawForm({ amount: "", account: "", description: "" })
        setWithdrawOpen(false)
        await loadHNLDData()
      } else {
        toast({
          title: "❌ Error en retiro",
          description: result.error || "No se pudo procesar el retiro",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar el retiro",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
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
        description: `Balance insuficiente. Disponible: L.${hnldBalance.available_balance.toFixed(2)}`,
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
          description: `Se transfirieron L.${amount.toFixed(2)} HNLD a ${searchUser.user.name || searchUser.user.email}`,
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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Balance HNLD</h1>
          <p className="text-muted-foreground">Honduras Lempira Digital - Respaldo 1:1</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Balance Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base md:text-lg font-semibold">Balance Total</CardTitle>
            <Coins className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">L.{hnldBalance.balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">HNLD en tu cuenta</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base md:text-lg font-semibold">Disponible</CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">L.{hnldBalance.available_balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Listo para usar</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base md:text-lg font-semibold">Reservado</CardTitle>
            <Banknote className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">L.{hnldBalance.reserved_balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">En transacciones pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base md:text-lg font-semibold">Acciones HNLD</CardTitle>
          <CardDescription>Gestiona tu balance de Honduras Lempira Digital</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
              <DialogTrigger asChild>
                <Button className="h-16 flex-col space-y-2" disabled={processing}>
                  <Plus className="h-5 w-5" />
                  <span>Emitir HNLD</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Emitir HNLD (Depósito)</DialogTitle>
                  <DialogDescription>Convierte Lempiras físicas en HNLD digitales</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deposit-amount">Monto en Lempiras</Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder="0.00"
                      value={depositForm.amount}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deposit-method">Método de Depósito</Label>
                    <Select
                      value={depositForm.method}
                      onValueChange={(value) => setDepositForm((prev) => ({ ...prev, method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Transferencia Bancaria</SelectItem>
                        <SelectItem value="cash">Depósito en Efectivo</SelectItem>
                        <SelectItem value="mobile">Pago Móvil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="deposit-description">Descripción (opcional)</Label>
                    <Textarea
                      id="deposit-description"
                      placeholder="Agregar una descripción..."
                      value={depositForm.description}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDepositOpen(false)} disabled={processing}>
                    Cancelar
                  </Button>
                  <Button onClick={handleDeposit} disabled={processing}>
                    {processing ? "Procesando..." : "Emitir HNLD"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-16 flex-col space-y-2 bg-transparent" disabled={processing}>
                  <Minus className="h-5 w-5" />
                  <span>Quemar HNLD</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Quemar HNLD (Retiro)</DialogTitle>
                  <DialogDescription>Convierte HNLD digitales en Lempiras físicas</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="withdraw-amount">Monto en HNLD</Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      placeholder="0.00"
                      value={withdrawForm.amount}
                      onChange={(e) => setWithdrawForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Disponible: L.{hnldBalance.available_balance.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="withdraw-account">Cuenta Destino</Label>
                    <Input
                      id="withdraw-account"
                      placeholder="Número de cuenta bancaria"
                      value={withdrawForm.account}
                      onChange={(e) => setWithdrawForm((prev) => ({ ...prev, account: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="withdraw-description">Descripción (opcional)</Label>
                    <Textarea
                      id="withdraw-description"
                      placeholder="Agregar una descripción..."
                      value={withdrawForm.description}
                      onChange={(e) => setWithdrawForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWithdrawOpen(false)} disabled={processing}>
                    Cancelar
                  </Button>
                  <Button onClick={handleWithdraw} disabled={processing}>
                    {processing ? "Procesando..." : "Quemar HNLD"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
                      Disponible: L.{hnldBalance.available_balance.toFixed(2)}
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
                    <p className="font-semibold">L.{transaction.amount.toFixed(2)}</p>
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
                      <TableCell className="font-semibold">L.{transaction.amount.toFixed(2)}</TableCell>
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
    </div>
  )
}