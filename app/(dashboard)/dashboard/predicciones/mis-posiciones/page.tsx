"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { 
  getUserPositions,
  type MarketPosition
} from "@/lib/actions/prediction_markets_client"
import { formatCurrency } from "@/lib/utils"
import { 
  Search,
  TrendingUp,
  TrendingDown,
  Eye,
  RefreshCw,
  ArrowRight,
  ArrowLeft
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

export default function MyPositionsPage() {
  const [positions, setPositions] = useState<MarketPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    loadPositions()
  }, [])

  const loadPositions = async () => {
    try {
      setLoading(true)
      const result = await getUserPositions()
      
      if (result.success && result.data) {
        setPositions(result.data)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron cargar las posiciones",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error cargando posiciones:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar posiciones",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPositions()
  }

  const filteredPositions = positions.filter(position => {
    const search = searchTerm.toLowerCase()
    const marketTitle = (position.market as any)?.title?.toLowerCase() || ""
    const outcomeName = (position.outcome as any)?.name?.toLowerCase() || ""
    return (
      marketTitle.includes(search) ||
      outcomeName.includes(search) ||
      position.id.toLowerCase().includes(search)
    )
  })

  const activePositions = filteredPositions.filter(p => {
    const market = p.market as any
    return market?.status === 'active' && p.shares > 0
  })

  const closedPositions = filteredPositions.filter(p => {
    const market = p.market as any
    return market?.status !== 'active' || p.shares === 0
  })

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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <LoadingSpinner message="Cargando posiciones..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/predicciones">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Mis Posiciones</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus inversiones en mercados de predicción
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {activePositions.length === 0 && closedPositions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No tienes posiciones en mercados de predicción</p>
            <Button asChild>
              <Link href="/dashboard/predicciones">
                Explorar Mercados
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activePositions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Posiciones Activas</CardTitle>
                <CardDescription>
                  Mercados en los que tienes inversiones activas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Opción</TableHead>
                      <TableHead>Acciones</TableHead>
                      <TableHead>Inversión</TableHead>
                      <TableHead>Valor Actual</TableHead>
                      <TableHead>Ganancia/Pérdida</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePositions.map((position) => {
                      const market = position.market as any
                      const outcome = position.outcome as any
                      const pnl = position.unrealized_pnl_hnld || 0
                      
                      return (
                        <TableRow key={position.id}>
                          <TableCell>
                            <div className="font-medium">{market?.title || 'Mercado'}</div>
                            <div className="text-sm text-muted-foreground">
                              {market?.question || ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{outcome?.name || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>{position.shares.toFixed(2)}</TableCell>
                          <TableCell>{formatCurrency(position.total_invested_hnld)}</TableCell>
                          <TableCell>{formatCurrency(position.current_value_hnld)}</TableCell>
                          <TableCell>
                            <span className={pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {market?.status ? getStatusBadge(market.status) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/dashboard/predicciones/${position.market_id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {closedPositions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Posiciones Cerradas</CardTitle>
                <CardDescription>
                  Mercados resueltos o posiciones cerradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Opción</TableHead>
                      <TableHead>Acciones</TableHead>
                      <TableHead>Inversión</TableHead>
                      <TableHead>Valor Final</TableHead>
                      <TableHead>Ganancia/Pérdida</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedPositions.map((position) => {
                      const market = position.market as any
                      const outcome = position.outcome as any
                      const pnl = position.unrealized_pnl_hnld || 0
                      
                      return (
                        <TableRow key={position.id}>
                          <TableCell>
                            <div className="font-medium">{market?.title || 'Mercado'}</div>
                            <div className="text-sm text-muted-foreground">
                              {market?.question || ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{outcome?.name || 'N/A'}</Badge>
                            {outcome?.is_winner && (
                              <Badge variant="default" className="ml-2 bg-green-600">
                                Ganadora
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{position.shares.toFixed(2)}</TableCell>
                          <TableCell>{formatCurrency(position.total_invested_hnld)}</TableCell>
                          <TableCell>{formatCurrency(position.current_value_hnld)}</TableCell>
                          <TableCell>
                            <span className={pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {market?.status ? getStatusBadge(market.status) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/dashboard/predicciones/${position.market_id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}


