"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, Edit, CheckCircle, XCircle } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { CurrencyBadge } from "../_components/CurrencyBadge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "../_components/ConfirmDialog"
import { WalletAdjustForm } from "../_forms/WalletAdjustForm"
import { PayoutForm } from "../_forms/PayoutForm"
import { useToast } from "@/hooks/use-toast"

type WalletBalance = {
  id: string
  userId: string
  userName: string
  userEmail: string
  availableBalance: number
  frozenBalance: number
  currency: "HNL" | "USD"
  lastUpdated: string
}

type LedgerEntry = {
  id: string
  userId: string
  userName: string
  type: "credit" | "debit"
  concept: string
  amount: number
  currency: "HNL" | "USD"
  balanceAfter: number
  reference?: string
  status: "completed" | "pending" | "failed"
  createdAt: string
}

type Payout = {
  id: string
  userId: string
  userName: string
  amount: number
  currency: "HNL" | "USD"
  method: string
  status: "pending" | "processing" | "paid" | "failed"
  requestedAt: string
  processedAt?: string
  notes?: string
}

// TODO: tablas sugeridas: wallet_balances, wallet_ledger, payouts
// TODO: asegurar consistencia vía triggers/RPC en backend
const mockBalances: WalletBalance[] = [
  {
    id: "BAL-001",
    userId: "USR-123",
    userName: "Juan Pérez",
    userEmail: "juan.perez@example.com",
    availableBalance: 5420,
    frozenBalance: 0,
    currency: "HNL",
    lastUpdated: "2024-03-20T15:30:00Z",
  },
  {
    id: "BAL-002",
    userId: "USR-124",
    userName: "María García",
    userEmail: "maria.garcia@example.com",
    availableBalance: 12850,
    frozenBalance: 500,
    currency: "HNL",
    lastUpdated: "2024-03-20T14:20:00Z",
  },
]

const mockLedger: LedgerEntry[] = [
  {
    id: "LED-001",
    userId: "USR-123",
    userName: "Juan Pérez",
    type: "credit",
    concept: "Cobro Link #PL-001",
    amount: 500,
    currency: "HNL",
    balanceAfter: 5420,
    reference: "PAY-12345",
    status: "completed",
    createdAt: "2024-03-20T15:30:00Z",
  },
  {
    id: "LED-002",
    userId: "USR-124",
    userName: "María García",
    type: "debit",
    concept: "Retiro solicitado",
    amount: 1000,
    currency: "HNL",
    balanceAfter: 12850,
    reference: "PAYOUT-001",
    status: "completed",
    createdAt: "2024-03-20T14:20:00Z",
  },
  {
    id: "LED-003",
    userId: "USR-123",
    userName: "Juan Pérez",
    type: "credit",
    concept: "Venta de subasta",
    amount: 2500,
    currency: "HNL",
    balanceAfter: 4920,
    reference: "AUC-003",
    status: "completed",
    createdAt: "2024-03-19T10:15:00Z",
  },
]

const mockPayouts: Payout[] = [
  {
    id: "PAYOUT-001",
    userId: "USR-124",
    userName: "María García",
    amount: 1000,
    currency: "HNL",
    method: "Transferencia Bancaria",
    status: "paid",
    requestedAt: "2024-03-20T10:00:00Z",
    processedAt: "2024-03-20T14:20:00Z",
  },
  {
    id: "PAYOUT-002",
    userId: "USR-123",
    userName: "Juan Pérez",
    amount: 500,
    currency: "HNL",
    method: "Transferencia Bancaria",
    status: "pending",
    requestedAt: "2024-03-21T09:30:00Z",
  },
  {
    id: "PAYOUT-003",
    userId: "USR-125",
    userName: "Carlos López",
    amount: 250,
    currency: "HNL",
    method: "Transferencia Bancaria",
    status: "processing",
    requestedAt: "2024-03-21T11:00:00Z",
  },
]

export default function AdminWalletPage() {
  const [balances] = useState<WalletBalance[]>(mockBalances)
  const [ledger] = useState<LedgerEntry[]>(mockLedger)
  const [payouts] = useState<Payout[]>(mockPayouts)
  const [selectedBalance, setSelectedBalance] = useState<WalletBalance | null>(null)
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null)
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false)
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false)
  const [isMarkFailedDialogOpen, setIsMarkFailedDialogOpen] = useState(false)
  const { toast } = useToast()

  const handleMarkPaid = (id: string) => {
    console.log("[v0] Marking payout as paid:", id)
    toast({
      title: "Payout Marcado como Pagado",
      description: "El retiro ha sido marcado como pagado exitosamente",
    })
    // TODO: Implement mark paid logic
  }

  const handleMarkFailed = (id: string) => {
    console.log("[v0] Marking payout as failed:", id)
    toast({
      title: "Payout Marcado como Fallido",
      description: "El retiro ha sido marcado como fallido",
    })
    // TODO: Implement mark failed logic
  }

  const balanceColumns: Column<WalletBalance>[] = [
    {
      key: "userName",
      label: "Usuario",
      sortable: true,
      render: (balance) => (
        <div>
          <p className="font-medium text-foreground">{balance.userName}</p>
          <p className="text-sm text-muted-foreground">{balance.userEmail}</p>
        </div>
      ),
    },
    {
      key: "availableBalance",
      label: "Saldo Disponible",
      sortable: true,
      render: (balance) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">{balance.availableBalance.toLocaleString()}</span>
          <CurrencyBadge currency={balance.currency} />
        </div>
      ),
    },
    {
      key: "frozenBalance",
      label: "Saldo Congelado",
      sortable: true,
      render: (balance) => (
        <span className="font-mono text-muted-foreground">{balance.frozenBalance.toLocaleString()}</span>
      ),
    },
    {
      key: "lastUpdated",
      label: "Última Actualización",
      sortable: true,
      render: (balance) => new Date(balance.lastUpdated).toLocaleString("es-HN"),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (balance) => (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          onClick={() => {
            setSelectedBalance(balance)
            setIsAdjustDialogOpen(true)
          }}
        >
          <Edit className="size-4" />
          Ajustar
        </Button>
      ),
    },
  ]

  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      key: "createdAt",
      label: "Fecha",
      sortable: true,
      render: (entry) => new Date(entry.createdAt).toLocaleString("es-HN"),
    },
    {
      key: "userName",
      label: "Usuario",
      sortable: true,
    },
    {
      key: "type",
      label: "Tipo",
      sortable: true,
      render: (entry) => (
        <StatusBadge variant={entry.type === "credit" ? "success" : "warning"}>
          {entry.type === "credit" ? "Crédito" : "Débito"}
        </StatusBadge>
      ),
    },
    {
      key: "concept",
      label: "Concepto",
      sortable: true,
    },
    {
      key: "amount",
      label: "Monto",
      sortable: true,
      render: (entry) => (
        <div className="flex items-center gap-2">
          <span
            className={`font-mono font-semibold ${entry.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
          >
            {entry.type === "credit" ? "+" : "-"}
            {entry.amount.toLocaleString()}
          </span>
          <CurrencyBadge currency={entry.currency} />
        </div>
      ),
    },
    {
      key: "balanceAfter",
      label: "Balance Resultante",
      sortable: true,
      render: (entry) => <span className="font-mono">{entry.balanceAfter.toLocaleString()}</span>,
    },
    {
      key: "reference",
      label: "Ref/TxID",
      render: (entry) => entry.reference && <span className="font-mono text-xs">{entry.reference}</span>,
    },
    {
      key: "status",
      label: "Estado",
      sortable: true,
      render: (entry) => {
        const variant = entry.status === "completed" ? "success" : entry.status === "pending" ? "warning" : "danger"
        return (
          <StatusBadge variant={variant}>
            {entry.status === "completed" && "Completado"}
            {entry.status === "pending" && "Pendiente"}
            {entry.status === "failed" && "Fallido"}
          </StatusBadge>
        )
      },
    },
  ]

  const payoutColumns: Column<Payout>[] = [
    {
      key: "userName",
      label: "Usuario",
      sortable: true,
    },
    {
      key: "amount",
      label: "Monto",
      sortable: true,
      render: (payout) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">{payout.amount.toLocaleString()}</span>
          <CurrencyBadge currency={payout.currency} />
        </div>
      ),
    },
    {
      key: "method",
      label: "Método",
      sortable: true,
    },
    {
      key: "status",
      label: "Estado",
      sortable: true,
      render: (payout) => {
        const variantMap = {
          pending: "warning",
          processing: "info",
          paid: "success",
          failed: "danger",
        } as const
        return (
          <StatusBadge variant={variantMap[payout.status]}>
            {payout.status === "pending" && "Pendiente"}
            {payout.status === "processing" && "Procesando"}
            {payout.status === "paid" && "Pagado"}
            {payout.status === "failed" && "Fallido"}
          </StatusBadge>
        )
      },
    },
    {
      key: "requestedAt",
      label: "Solicitado",
      sortable: true,
      render: (payout) => new Date(payout.requestedAt).toLocaleString("es-HN"),
    },
    {
      key: "processedAt",
      label: "Procesado",
      render: (payout) => payout.processedAt && new Date(payout.processedAt).toLocaleString("es-HN"),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (payout) =>
        payout.status === "pending" || payout.status === "processing" ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent"
              onClick={() => {
                setSelectedPayout(payout)
                setIsMarkPaidDialogOpen(true)
              }}
            >
              <CheckCircle className="size-4" />
              Pagado
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent"
              onClick={() => {
                setSelectedPayout(payout)
                setIsMarkFailedDialogOpen(true)
              }}
            >
              <XCircle className="size-4" />
              Fallido
            </Button>
          </div>
        ) : null,
    },
  ]

  const totalBalance = balances.reduce((sum, b) => sum + b.availableBalance, 0)
  const pendingPayouts = payouts.filter((p) => p.status === "pending")
  const recentCharges = ledger.filter((l) => l.type === "credit").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Wallet / Saldo</h2>
          <p className="text-muted-foreground mt-2">Gestiona los saldos y transacciones de usuarios</p>
        </div>
        <Button className="gap-2" onClick={() => setIsPayoutDialogOpen(true)}>
          <Plus className="size-4" />
          Crear Payout Manual
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">L {totalBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Suma de todos los saldos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payouts Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayouts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Retiros por procesar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cobros (7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentCharges}</div>
            <p className="text-xs text-muted-foreground mt-1">Créditos recientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Wallet</CardTitle>
          <CardDescription>Administra saldos, transacciones y retiros</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="balances" className="space-y-4">
            <TabsList>
              <TabsTrigger value="balances">Saldos</TabsTrigger>
              <TabsTrigger value="ledger">Transacciones (Ledger)</TabsTrigger>
              <TabsTrigger value="payouts">Retiros / Payouts</TabsTrigger>
            </TabsList>

            <TabsContent value="balances" className="space-y-4">
              <DataTable
                data={balances}
                columns={balanceColumns}
                searchPlaceholder="Buscar usuarios..."
                emptyMessage="No hay saldos registrados"
              />
            </TabsContent>

            <TabsContent value="ledger" className="space-y-4">
              <DataTable
                data={ledger}
                columns={ledgerColumns}
                searchPlaceholder="Buscar transacciones..."
                emptyMessage="No hay transacciones registradas"
              />
            </TabsContent>

            <TabsContent value="payouts" className="space-y-4">
              <DataTable
                data={payouts}
                columns={payoutColumns}
                searchPlaceholder="Buscar payouts..."
                emptyMessage="No hay payouts registrados"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Adjust Balance Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajustar Saldo</DialogTitle>
            <DialogDescription>Realiza un ajuste manual al saldo de {selectedBalance?.userName}</DialogDescription>
          </DialogHeader>
          <WalletAdjustForm
            userId={selectedBalance?.userId || ""}
            userName={selectedBalance?.userName || ""}
            currentBalance={selectedBalance?.availableBalance || 0}
            onSubmit={(data) => {
              console.log("[v0] Adjusting balance:", data)
              setIsAdjustDialogOpen(false)
              toast({
                title: "Saldo Ajustado",
                description: "El saldo ha sido ajustado exitosamente",
              })
              // TODO: Implement adjust logic
            }}
            onCancel={() => setIsAdjustDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Create Payout Dialog */}
      <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Payout Manual</DialogTitle>
            <DialogDescription>Crea un retiro manual para un usuario</DialogDescription>
          </DialogHeader>
          <PayoutForm
            onSubmit={(data) => {
              console.log("[v0] Creating payout:", data)
              setIsPayoutDialogOpen(false)
              toast({
                title: "Payout Creado",
                description: "El retiro ha sido creado exitosamente",
              })
              // TODO: Implement create payout logic
            }}
            onCancel={() => setIsPayoutDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Mark Paid Confirmation */}
      <ConfirmDialog
        open={isMarkPaidDialogOpen}
        onOpenChange={setIsMarkPaidDialogOpen}
        onConfirm={() => {
          if (selectedPayout) handleMarkPaid(selectedPayout.id)
          setIsMarkPaidDialogOpen(false)
        }}
        title="Marcar como Pagado"
        description={`¿Confirmas que el payout de ${selectedPayout?.userName} por ${selectedPayout?.amount} ${selectedPayout?.currency} ha sido pagado?`}
        confirmText="Confirmar Pago"
      />

      {/* Mark Failed Confirmation */}
      <ConfirmDialog
        open={isMarkFailedDialogOpen}
        onOpenChange={setIsMarkFailedDialogOpen}
        onConfirm={() => {
          if (selectedPayout) handleMarkFailed(selectedPayout.id)
          setIsMarkFailedDialogOpen(false)
        }}
        title="Marcar como Fallido"
        description={`¿Confirmas que el payout de ${selectedPayout?.userName} ha fallado?`}
        confirmText="Marcar Fallido"
        variant="destructive"
      />
    </div>
  )
}
