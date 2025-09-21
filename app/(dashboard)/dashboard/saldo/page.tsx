"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { onLoadBalance } from "@/lib/contracts/events"
import type { BalanceDTO } from "@/lib/contracts/types"
import { Wallet, Plus, Minus, ArrowRightLeft, RefreshCw, DollarSign, Banknote } from "lucide-react"

interface BalanceByCurrency {
  HNL: number
  USD: number
}

interface ExtendedBalance extends BalanceDTO {
  lastUpdate: Date
  byCurrency: BalanceByCurrency
}

export default function SaldoPage() {
  const [balance, setBalance] = useState<ExtendedBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const { toast } = useToast()

  // Form states
  const [depositForm, setDepositForm] = useState({ amount: "", currency: "HNL", method: "" })
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", currency: "HNL", account: "", note: "" })
  const [transferForm, setTransferForm] = useState({ amount: "", currency: "HNL", recipient: "", note: "" })

  const loadBalance = async () => {
    try {
      const data = await onLoadBalance()

      const extendedData: ExtendedBalance = {
        ...data,
        lastUpdate: new Date(),
        byCurrency: {
          HNL: Math.round(data.total * 0.6 * 24.5), // Mock HNL amount
          USD: Math.round(data.total * 0.4), // Mock USD amount
        },
      }

      setBalance(extendedData)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el saldo",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadBalance()
  }

  const handleDeposit = async () => {
    if (!depositForm.amount || !depositForm.currency || !depositForm.method) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Depósito iniciado",
      description: `Depósito de ${depositForm.currency} ${depositForm.amount} en proceso`,
    })

    setDepositForm({ amount: "", currency: "HNL", method: "" })
    setDepositOpen(false)
    handleRefresh()
  }

  const handleWithdraw = async () => {
    if (!withdrawForm.amount || !withdrawForm.currency || !withdrawForm.account) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Retiro iniciado",
      description: `Retiro de ${withdrawForm.currency} ${withdrawForm.amount} en proceso`,
    })

    setWithdrawForm({ amount: "", currency: "HNL", account: "", note: "" })
    setWithdrawOpen(false)
    handleRefresh()
  }

  const handleTransfer = async () => {
    if (!transferForm.amount || !transferForm.currency || !transferForm.recipient) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Transferencia iniciada",
      description: `Transferencia de ${transferForm.currency} ${transferForm.amount} en proceso`,
    })

    setTransferForm({ amount: "", currency: "HNL", recipient: "", note: "" })
    setTransferOpen(false)
    handleRefresh()
  }

  useEffect(() => {
    loadBalance()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!balance) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold text-muted-foreground mb-2">No se pudo cargar el saldo</h2>
          <p className="text-muted-foreground mb-4">Ocurrió un error al obtener la información de tu saldo.</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Balance Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${balance.total.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Actualizado: {balance.lastUpdate.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponible</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${balance.available.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Listo para usar</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bloqueado</CardTitle>
            <Banknote className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">${balance.blocked.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">En transacciones pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Currency Breakdown */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Desglose por Moneda</CardTitle>
            <CardDescription>Distribución de tu saldo en diferentes monedas</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-blue-600">L</span>
                </div>
                <div>
                  <p className="font-medium">Lempiras (HNL)</p>
                  <p className="text-sm text-muted-foreground">Moneda local</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">L {balance.byCurrency.HNL.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">${(balance.byCurrency.HNL / 24.5).toFixed(2)} USD</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-green-600">$</span>
                </div>
                <div>
                  <p className="font-medium">Dólares (USD)</p>
                  <p className="text-sm text-muted-foreground">Moneda internacional</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">${balance.byCurrency.USD.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">L {(balance.byCurrency.USD * 24.5).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Gestiona tu saldo con estas opciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
              <DialogTrigger asChild>
                <Button className="h-16 flex-col space-y-2">
                  <Plus className="h-5 w-5" />
                  <span>Depositar</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Realizar Depósito</DialogTitle>
                  <DialogDescription>Agrega fondos a tu cuenta desde diferentes métodos de pago</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="deposit-amount">Monto</Label>
                      <Input
                        id="deposit-amount"
                        type="number"
                        placeholder="0.00"
                        value={depositForm.amount}
                        onChange={(e) => setDepositForm((prev) => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="deposit-currency">Moneda</Label>
                      <Select
                        value={depositForm.currency}
                        onValueChange={(value) => setDepositForm((prev) => ({ ...prev, currency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HNL">Lempiras (HNL)</SelectItem>
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="deposit-method">Método de Pago</Label>
                    <Select
                      value={depositForm.method}
                      onValueChange={(value) => setDepositForm((prev) => ({ ...prev, method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">Tarjeta de Crédito/Débito</SelectItem>
                        <SelectItem value="bank">Transferencia Bancaria</SelectItem>
                        <SelectItem value="mobile">Pago Móvil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDepositOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleDeposit}>Depositar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-16 flex-col space-y-2 bg-transparent">
                  <Minus className="h-5 w-5" />
                  <span>Retirar</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Realizar Retiro</DialogTitle>
                  <DialogDescription>Retira fondos de tu cuenta a tu método de pago preferido</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="withdraw-amount">Monto</Label>
                      <Input
                        id="withdraw-amount"
                        type="number"
                        placeholder="0.00"
                        value={withdrawForm.amount}
                        onChange={(e) => setWithdrawForm((prev) => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="withdraw-currency">Moneda</Label>
                      <Select
                        value={withdrawForm.currency}
                        onValueChange={(value) => setWithdrawForm((prev) => ({ ...prev, currency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HNL">Lempiras (HNL)</SelectItem>
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="withdraw-account">Cuenta Destino</Label>
                    <Input
                      id="withdraw-account"
                      placeholder="Número de cuenta o tarjeta"
                      value={withdrawForm.account}
                      onChange={(e) => setWithdrawForm((prev) => ({ ...prev, account: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="withdraw-note">Nota (opcional)</Label>
                    <Textarea
                      id="withdraw-note"
                      placeholder="Agregar una nota..."
                      value={withdrawForm.note}
                      onChange={(e) => setWithdrawForm((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleWithdraw}>Retirar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-16 flex-col space-y-2 bg-transparent">
                  <ArrowRightLeft className="h-5 w-5" />
                  <span>Transferir</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Realizar Transferencia</DialogTitle>
                  <DialogDescription>Transfiere fondos a otro usuario de la plataforma</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="transfer-amount">Monto</Label>
                      <Input
                        id="transfer-amount"
                        type="number"
                        placeholder="0.00"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="transfer-currency">Moneda</Label>
                      <Select
                        value={transferForm.currency}
                        onValueChange={(value) => setTransferForm((prev) => ({ ...prev, currency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HNL">Lempiras (HNL)</SelectItem>
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="transfer-recipient">Destinatario</Label>
                    <Input
                      id="transfer-recipient"
                      placeholder="Email o ID del usuario"
                      value={transferForm.recipient}
                      onChange={(e) => setTransferForm((prev) => ({ ...prev, recipient: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transfer-note">Nota (opcional)</Label>
                    <Textarea
                      id="transfer-note"
                      placeholder="Agregar una nota..."
                      value={transferForm.note}
                      onChange={(e) => setTransferForm((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleTransfer}>Transferir</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
