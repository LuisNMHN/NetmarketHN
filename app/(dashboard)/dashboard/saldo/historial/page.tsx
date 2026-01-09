"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import LoadingSpinner from "@/components/ui/loading-spinner"
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
  getTransactionHistory,
  type HNLDTransaction
} from "@/lib/actions/hnld"
import { formatCurrency } from "@/lib/utils"
import { 
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Send,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Printer,
  Filter
} from "lucide-react"

export default function HistorialPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<HNLDTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadTransactions()
    // Obtener ID del usuario actual
    const getCurrentUser = async () => {
      const { supabaseBrowser } = await import("@/lib/supabase/client")
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const result = await getTransactionHistory(200, 0) // Cargar más transacciones
      
      if (result.success && result.data) {
        setTransactions(result.data)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron cargar las transacciones",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error cargando transacciones:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar transacciones",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTransactions()
  }

  const handlePrint = () => {
    window.print()
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
      case 'cancelled':
        return <Badge variant="outline">Cancelado</Badge>
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
        return 'Transferencia de HNLD'
      case 'fee':
        return 'Comisión'
      default:
        return type
    }
  }

  const getTransactionTitle = (transaction: HNLDTransaction): string => {
    if (transaction.transaction_type === 'transfer' && currentUserId) {
      if (transaction.from_user_id === currentUserId) {
        return 'Transferencia Enviada'
      } else if (transaction.to_user_id === currentUserId) {
        return 'Transferencia Recibida'
      }
    }
    return getTransactionTypeLabel(transaction.transaction_type)
  }

  const formatAmountWithHNLD = (amount: number): string => {
    // Formato más elegante con separadores de miles
    const formattedAmount = new Intl.NumberFormat('es-HN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).format(amount)
    return formattedAmount
  }

  const isDebit = (transaction: HNLDTransaction): boolean => {
    // Ventas (withdrawal) siempre son débitos
    if (transaction.transaction_type === 'withdrawal') {
      return true
    }
    // Transferencias salientes (cuando el usuario es el remitente) son débitos
    if (transaction.transaction_type === 'transfer' && currentUserId && transaction.from_user_id === currentUserId) {
      return true
    }
    // Fees son débitos
    if (transaction.transaction_type === 'fee') {
      return true
    }
    return false
  }

  // Filtrar transacciones
  const filteredTransactions = transactions.filter(transaction => {
    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesSearch = 
        transaction.description?.toLowerCase().includes(search) ||
        getTransactionTitle(transaction).toLowerCase().includes(search) ||
        getTransactionTypeLabel(transaction.transaction_type).toLowerCase().includes(search)
      if (!matchesSearch) return false
    }

    // Filtro por tipo
    if (filterType !== 'all' && transaction.transaction_type !== filterType) {
      return false
    }

    // Filtro por estado
    if (filterStatus !== 'all' && transaction.status !== filterStatus) {
      return false
    }

    return true
  })

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="Cargando historial de transacciones..." />
      </div>
    )
  }

  return (
    <>
      {/* Estilos para impresión */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area,
          .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .print-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .print-subtitle {
            font-size: 14px;
            color: #666;
          }
          /* Estilos para tabla en impresión - asegurar que encabezados y columnas se muestren */
          .printable-area table {
            width: 100% !important;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .printable-area table thead {
            display: table-header-group !important;
          }
          .printable-area table tbody {
            display: table-row-group !important;
          }
          .printable-area table th,
          .printable-area table td {
            border: 1px solid #ddd;
            padding: 6px 4px;
            text-align: left;
            font-size: 11px;
            display: table-cell !important;
          }
          .printable-area table th {
            background-color: #f5f5f5 !important;
            font-weight: bold;
            border-bottom: 2px solid #000;
          }
          .printable-area table tr {
            page-break-inside: avoid;
            display: table-row !important;
          }
          .print-summary {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #000;
          }
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Historial de Transacciones HNLD</h1>
            <p className="text-muted-foreground mt-1">
              Detalle completo de todas tus transacciones
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handlePrint}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* Header para impresión */}
      <div className="print-header printable-area" style={{ display: 'none' }}>
        <div className="print-title">Historial de Transacciones HNLD</div>
        <div className="print-subtitle">
          Generado el {new Date().toLocaleDateString('es-HN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        <div className="print-subtitle">
          Total de transacciones: {filteredTransactions.length}
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Busca y filtra tus transacciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar
              </label>
              <Input
                placeholder="Buscar por código o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Tipo de Transacción
              </label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">Todos los tipos</option>
                <option value="deposit">Compras (Depósitos)</option>
                <option value="withdrawal">Ventas (Retiros)</option>
                <option value="transfer">Transferencias</option>
                <option value="fee">Comisiones</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Estado
              </label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="completed">Completadas</option>
                <option value="pending">Pendientes</option>
                <option value="failed">Fallidas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Transacciones */}
      <Card className="printable-area">
        <CardHeader className="no-print">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transacciones</CardTitle>
              <CardDescription>
                {filteredTransactions.length} transacción(es) encontrada(s)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron transacciones</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all' 
                  ? "Intenta ajustar los filtros" 
                  : "Aún no tienes transacciones"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[22%]" />
                  <col className="w-[20%]" />
                  <col className="w-[18%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold px-3 py-3">Código</TableHead>
                    <TableHead className="font-semibold px-3 py-3">Descripción</TableHead>
                    <TableHead className="font-semibold px-3 py-3">Monto</TableHead>
                    <TableHead className="font-semibold px-3 py-3">Estado</TableHead>
                    <TableHead className="font-semibold px-3 py-3">Fecha y Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="px-3 py-3">
                        <div className="font-mono text-sm font-medium text-foreground">
                          {transaction.description || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.transaction_type)}
                          <span className="text-sm text-muted-foreground">
                            {getTransactionTitle(transaction)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={`px-3 py-3 ${
                        isDebit(transaction) ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-semibold">
                            {isDebit(transaction) ? '-' : '+'}
                          </span>
                          <span className="text-base font-bold">
                            {formatAmountWithHNLD(transaction.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground font-normal">HNLD</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transaction.status)}
                          {getStatusBadge(transaction.status)}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-foreground">
                            {new Date(transaction.created_at).toLocaleDateString('es-HN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleTimeString('es-HN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen para impresión */}
      <div className="print-summary printable-area" style={{ display: 'none' }}>
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #000' }}>
          <div style={{ fontSize: '14px', marginBottom: '10px' }}>
            <strong>Resumen:</strong>
          </div>
          <div style={{ fontSize: '12px' }}>
            <div>Total de transacciones: {filteredTransactions.length}</div>
            <div>
              Completadas: {filteredTransactions.filter(t => t.status === 'completed').length}
            </div>
            <div>
              Pendientes: {filteredTransactions.filter(t => t.status === 'pending').length}
            </div>
            <div>
              Fallidas: {filteredTransactions.filter(t => t.status === 'failed').length}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

