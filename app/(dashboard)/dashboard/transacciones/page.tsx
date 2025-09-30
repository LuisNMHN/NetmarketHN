"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar, Download, Filter, HelpCircle, Search } from "lucide-react"
import { onLoadTransactions } from "@/lib/contracts/events"
import type { TransactionDTO } from "@/lib/contracts/types"
import { toast } from "sonner"
import LoadingSpinner from "@/components/ui/loading-spinner"

const TRANSACTION_TYPES = [
  { value: "deposit", label: "Depósito", description: "Dinero ingresado a tu cuenta" },
  { value: "withdrawal", label: "Retiro", description: "Dinero retirado de tu cuenta" },
  { value: "payment", label: "Pago", description: "Pago realizado a terceros" },
  { value: "refund", label: "Reembolso", description: "Dinero devuelto por una transacción" },
]

const TRANSACTION_STATUSES = [
  { value: "completed", label: "Completada", description: "Transacción procesada exitosamente" },
  { value: "pending", label: "Pendiente", description: "Transacción en proceso" },
  { value: "failed", label: "Fallida", description: "Transacción no pudo ser procesada" },
  { value: "cancelled", label: "Cancelada", description: "Transacción cancelada por el usuario" },
]

const CURRENCIES = ["USD", "EUR", "MXN", "COP"]

export default function TransaccionesPage() {
  const [transactions, setTransactions] = useState<TransactionDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    type: "",
    currency: "",
    status: "",
    search: "",
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const data = await onLoadTransactions()

      const expandedData: TransactionDTO[] = [
        ...data,
        {
          id: "tx-3",
          type: "payment",
          amount: -75.5,
          status: "completed",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          description: "Pago a proveedor ABC",
          currency: "USD",
          note: "Factura #12345",
        },
        {
          id: "tx-4",
          type: "refund",
          amount: 125.0,
          status: "pending",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          description: "Reembolso por cancelación",
          currency: "EUR",
          note: "Orden #67890",
        },
        {
          id: "tx-5",
          type: "deposit",
          amount: 1000.0,
          status: "failed",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          description: "Depósito desde transferencia",
          currency: "MXN",
          note: "Referencia: DEP001",
        },
        {
          id: "tx-6",
          type: "withdrawal",
          amount: -300.0,
          status: "cancelled",
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          description: "Retiro cancelado",
          currency: "USD",
          note: "Cancelado por usuario",
        },
      ]

      setTransactions(expandedData)
    } catch (error) {
      toast.error("Error al cargar las transacciones")
      console.error("Error loading transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesDateFrom = !filters.dateFrom || new Date(transaction.createdAt) >= new Date(filters.dateFrom)
    const matchesDateTo = !filters.dateTo || new Date(transaction.createdAt) <= new Date(filters.dateTo)
    const matchesType = !filters.type || transaction.type === filters.type
    const matchesCurrency = !filters.currency || transaction.currency === filters.currency
    const matchesStatus = !filters.status || transaction.status === filters.status
    const matchesSearch =
      !filters.search ||
      transaction.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
      transaction.note?.toLowerCase().includes(filters.search.toLowerCase()) ||
      transaction.id.toLowerCase().includes(filters.search.toLowerCase())

    return matchesDateFrom && matchesDateTo && matchesType && matchesCurrency && matchesStatus && matchesSearch
  })

  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)

  const periodTotal = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0)

  const handleExportCSV = () => {
    const headers = ["ID", "Fecha", "Tipo", "Monto", "Moneda", "Estado", "Descripción", "Nota"]
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((tx) =>
        [
          tx.id,
          tx.createdAt.toLocaleDateString(),
          TRANSACTION_TYPES.find((t) => t.value === tx.type)?.label || tx.type,
          tx.amount,
          tx.currency || "USD",
          TRANSACTION_STATUSES.find((s) => s.value === tx.status)?.label || tx.status,
          `"${tx.description || ""}"`,
          `"${tx.note || ""}"`,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transacciones-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success("Archivo CSV descargado")
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      cancelled: "outline",
    }

    const statusConfig = TRANSACTION_STATUSES.find((s) => s.value === status)
    return <Badge variant={variants[status] || "outline"}>{statusConfig?.label || status}</Badge>
  }

  const getTypeLabel = (type: string) => {
    return TRANSACTION_TYPES.find((t) => t.value === type)?.label || type
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      type: "",
      currency: "",
      status: "",
      search: "",
    })
    setCurrentPage(1)
  }

  if (loading) {
    return <LoadingSpinner message="Cargando transacciones..." />
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Resumen del período */}
        <section className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Resumen del Período</h2>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Total calculado basado en los filtros aplicados</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                $
                {Math.abs(
                  filteredTransactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
                ).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Ingresos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                $
                {Math.abs(
                  filteredTransactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0),
                ).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Egresos</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${periodTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${periodTotal.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Balance Neto</p>
            </div>
          </div>
        </section>

        {/* Filtros */}
        <section className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros y Búsqueda
            </h2>
            <p className="text-sm text-muted-foreground">Filtra las transacciones por fecha, tipo, moneda y estado</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Fecha desde</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Fecha hasta</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={filters.type}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {TRANSACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={filters.currency}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas las monedas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las monedas</SelectItem>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {TRANSACTION_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="ID, descripción o nota..."
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="pl-10 w-full"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto h-11 bg-transparent">
                Limpiar Filtros
              </Button>
              <Button variant="outline" onClick={handleExportCSV} className="w-full sm:w-auto h-11 bg-transparent">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </section>

        {/* Tabla de transacciones */}
        <section className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Historial de Transacciones</h2>
            <p className="text-sm text-muted-foreground">{filteredTransactions.length} transacciones encontradas</p>
          </div>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">No hay transacciones</h3>
              <p className="text-muted-foreground">
                No se encontraron transacciones que coincidan con los filtros aplicados.
              </p>
            </div>
          ) : (
            <>
              {/* En móvil habilitamos scroll horizontal para que la tabla no se rompa */}
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-sm">Fecha</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-sm">Tipo</th>
                      <th className="text-right px-3 py-3 font-medium text-muted-foreground text-sm">Monto</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-sm">Estado</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-sm hidden sm:table-cell">
                        Descripción
                      </th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-sm hidden md:table-cell">
                        Nota
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card">
                    {paginatedTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-3 py-3 text-sm">
                          {transaction.createdAt.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-3 text-sm">{getTypeLabel(transaction.type)}</td>
                        <td
                          className={`text-right font-medium px-3 py-3 text-sm ${
                            transaction.amount >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {transaction.amount >= 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}{" "}
                          {transaction.currency || "USD"}
                        </td>
                        <td className="px-3 py-3">{getStatusBadge(transaction.status)}</td>
                        <td className="px-3 py-3 text-sm hidden sm:table-cell">
                          <div className="max-w-[180px] truncate">{transaction.description}</div>
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground hidden md:table-cell">
                          <div className="max-w-[180px] truncate">{transaction.note}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
                  <p className="text-sm text-muted-foreground text-center sm:text-left">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length}{" "}
                    transacciones
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-11"
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-11"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </TooltipProvider>
  )
}
