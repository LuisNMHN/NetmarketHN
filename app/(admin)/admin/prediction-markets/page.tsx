"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { 
  getActiveMarkets,
  type PredictionMarket
} from "@/lib/actions/prediction_markets_client"
import { formatCurrency } from "@/lib/utils"
import { 
  Search,
  Eye,
  RefreshCw,
  TrendingUp,
  Clock,
  Users,
  Settings
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function AdminPredictionMarketsPage() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { toast } = useToast()

  useEffect(() => {
    loadMarkets()
  }, [])

  const loadMarkets = async () => {
    try {
      setLoading(true)
      const result = await getActiveMarkets(100, 0) // Más mercados para admin
      
      if (result.success && result.data) {
        setMarkets(result.data)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron cargar los mercados",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error cargando mercados:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar mercados",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadMarkets()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activo</Badge>
      case 'closed':
        return <Badge variant="secondary">Cerrado</Badge>
      case 'resolved':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Resuelto</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredMarkets = markets.filter(market => {
    const matchesSearch = 
      market.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.creator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || market.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <LoadingSpinner message="Cargando mercados..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mercados de Predicción</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona y monitorea todos los mercados de predicción
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/prediction-markets/permissions">
              <Settings className="mr-2 h-4 w-4" />
              Gestionar Permisos
            </Link>
          </Button>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, pregunta, creador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="closed">Cerrados</SelectItem>
                <SelectItem value="resolved">Resueltos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de mercados */}
      <Card>
        <CardHeader>
          <CardTitle>Mercados ({filteredMarkets.length})</CardTitle>
          <CardDescription>
            Lista completa de mercados de predicción en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMarkets.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron mercados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mercado</TableHead>
                  <TableHead>Creador</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Volumen</TableHead>
                  <TableHead>Operaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMarkets.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{market.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {market.question}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{market.creator_name || 'Usuario'}</div>
                    </TableCell>
                    <TableCell>
                      {market.category ? (
                        <Badge variant="outline">{market.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {formatCurrency(market.total_volume_hnld || 0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{market.total_trades || 0}</div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(market.status)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(market.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/predicciones/${market.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


