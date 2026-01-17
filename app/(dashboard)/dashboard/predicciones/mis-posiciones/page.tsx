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
    const betAmount = p.bet_amount || p.shares || 0
    return market?.status === 'active' && betAmount > 0
  })

  const closedPositions = filteredPositions.filter(p => {
    const market = p.market as any
    const betAmount = p.bet_amount || p.shares || 0
    return market?.status !== 'active' || betAmount === 0
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
          <h1 className="text-3xl font-bold">Mis predicciones</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus participaciones en mercados de predicción
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
                <p className="text-muted-foreground mb-4">No tienes predicciones</p>
                <Button asChild>
                  <Link href="/dashboard/predicciones">
                    Explorar mercados
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
                <CardTitle>Predicciones activas</CardTitle>
                <CardDescription>
                  Mercados en los que tienes participaciones activas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Opción</TableHead>
                      <TableHead>Participación</TableHead>
                      <TableHead>Probabilidad</TableHead>
                      <TableHead>Ganancia potencial</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePositions.map((position) => {
                      const market = position.market as any
                      const outcome = position.outcome as any
                      const betAmount = position.bet_amount || position.shares || 0
                      const potentialPayout = position.potential_payout || position.current_value_hnld || 0
                      const probability = outcome?.probability || outcome?.current_price || 0
                      
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
                          <TableCell>{formatCurrency(betAmount, 'HNLD')}</TableCell>
                          <TableCell>{(probability * 100).toFixed(2)}%</TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium">
                              {formatCurrency(potentialPayout, 'HNLD')}
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
                <CardTitle>Predicciones resueltas</CardTitle>
                <CardDescription>
                  Resultados finales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Opción</TableHead>
                      <TableHead>Participación</TableHead>
                      <TableHead>Ganancia recibida</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedPositions.map((position) => {
                      const market = position.market as any
                      const outcome = position.outcome as any
                      const betAmount = position.bet_amount || position.shares || 0
                      const payoutReceived = (position as any).payout_received || position.current_value_hnld || 0
                      const isWinner = outcome?.is_winner || false
                      
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
                            {isWinner && (
                              <Badge variant="default" className="ml-2 bg-green-600">
                                Ganadora
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(betAmount, 'HNLD')}</TableCell>
                          <TableCell>
                            {isWinner ? (
                              <span className="text-green-600 font-medium">
                                {formatCurrency(payoutReceived, 'HNLD')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isWinner ? (
                              <span className="text-green-600 font-medium">
                                +{formatCurrency(payoutReceived - betAmount, 'HNLD')}
                              </span>
                            ) : (
                              <span className="text-red-600">
                                -{formatCurrency(betAmount, 'HNLD')}
                              </span>
                            )}
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


