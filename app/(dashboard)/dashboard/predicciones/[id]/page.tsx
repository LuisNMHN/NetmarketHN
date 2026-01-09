"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { 
  getMarketById,
  type PredictionMarket,
  type MarketOutcome
} from "@/lib/actions/prediction_markets_client"
import { 
  buyMarketShares,
  sellMarketShares,
  resolveMarket
} from "@/app/actions/prediction_markets"
import { formatCurrency } from "@/lib/utils"
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabaseBrowser } from "@/lib/supabase/client"

export default function MarketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const marketId = params.id as string
  const { toast } = useToast()

  const [market, setMarket] = useState<PredictionMarket & { outcomes?: MarketOutcome[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [userPositions, setUserPositions] = useState<any[]>([])
  
  // Trading state
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | null>(null)
  const [shares, setShares] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [minPrice, setMinPrice] = useState<string>("")
  const [trading, setTrading] = useState(false)
  
  // Resolve state
  const [winningOutcomeId, setWinningOutcomeId] = useState<string>("")
  const [resolutionNotes, setResolutionNotes] = useState<string>("")
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (marketId) {
      loadMarket()
      loadUserData()
    }
  }, [marketId])

  const loadMarket = async () => {
    try {
      setLoading(true)
      const result = await getMarketById(marketId)
      
      if (result.success && result.data) {
        setMarket(result.data)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo cargar el mercado",
          variant: "destructive",
        })
        router.push('/dashboard/predicciones')
      }
    } catch (error) {
      console.error('Error cargando mercado:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar el mercado",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadUserData = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Obtener balance
      const { data: balance } = await supabase
        .from('hnld_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (balance) {
        setUserBalance(balance.balance || 0)
      }

      // Obtener posiciones del usuario en este mercado
      const { data: positions } = await supabase
        .from('market_positions')
        .select('*, outcome:market_outcomes(*)')
        .eq('user_id', user.id)
        .eq('market_id', marketId)
      
      if (positions) {
        setUserPositions(positions)
      }
    } catch (error) {
      console.error('Error cargando datos del usuario:', error)
    }
  }

  const handleOpenTrade = (outcome: MarketOutcome, type: 'buy' | 'sell') => {
    setSelectedOutcome(outcome)
    setTradeType(type)
    setShares("")
    setMaxPrice("")
    setMinPrice("")
    setTradeDialogOpen(true)
  }

  const handleTrade = async () => {
    if (!selectedOutcome || !shares || parseFloat(shares) <= 0) {
      toast({
        title: "Error",
        description: "Debes ingresar una cantidad válida de acciones",
        variant: "destructive",
      })
      return
    }

    try {
      setTrading(true)
      let result

      if (tradeType === 'buy') {
        result = await buyMarketShares(
          marketId,
          selectedOutcome.id,
          parseFloat(shares),
          maxPrice ? parseFloat(maxPrice) : undefined
        )
      } else {
        result = await sellMarketShares(
          marketId,
          selectedOutcome.id,
          parseFloat(shares),
          minPrice ? parseFloat(minPrice) : undefined
        )
      }

      if (result.success) {
        toast({
          title: "Éxito",
          description: tradeType === 'buy' 
            ? "Acciones compradas correctamente" 
            : "Acciones vendidas correctamente",
        })
        setTradeDialogOpen(false)
        loadMarket()
        loadUserData()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al realizar la operación",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error en operación:', error)
      toast({
        title: "Error",
        description: "Error inesperado",
        variant: "destructive",
      })
    } finally {
      setTrading(false)
    }
  }

  const handleResolve = async () => {
    if (!winningOutcomeId) {
      toast({
        title: "Error",
        description: "Debes seleccionar la opción ganadora",
        variant: "destructive",
      })
      return
    }

    try {
      setResolving(true)
      const result = await resolveMarket(marketId, winningOutcomeId, resolutionNotes || undefined)

      if (result.success) {
        toast({
          title: "Éxito",
          description: "Mercado resuelto correctamente",
        })
        setResolveDialogOpen(false)
        loadMarket()
        loadUserData()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al resolver el mercado",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error resolviendo mercado:', error)
      toast({
        title: "Error",
        description: "Error inesperado",
        variant: "destructive",
      })
    } finally {
      setResolving(false)
    }
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

  const formatPrice = (price: number) => {
    return `${(price * 100).toFixed(2)}%`
  }

  const [isCreator, setIsCreator] = useState(false)

  useEffect(() => {
    const checkCreator = async () => {
      if (!market?.creator_id) return
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      setIsCreator(user?.id === market.creator_id)
    }
    checkCreator()
  }, [market])

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <LoadingSpinner message="Cargando mercado..." />
      </div>
    )
  }

  if (!market) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Mercado no encontrado</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/predicciones">Volver a Mercados</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userPosition = userPositions.find(p => p.outcome_id === selectedOutcome?.id)
  const canResolve = market.status === 'active' && market.creator_id

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/predicciones">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{market.title}</h1>
          <p className="text-muted-foreground mt-1">{market.question}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(market.status)}
          <Button variant="outline" size="icon" onClick={loadMarket}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información del mercado */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Mercado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {market.description && (
                <div>
                  <Label className="text-sm font-medium">Descripción</Label>
                  <p className="text-sm text-muted-foreground mt-1">{market.description}</p>
                </div>
              )}
              {market.category && (
                <div>
                  <Label className="text-sm font-medium">Categoría</Label>
                  <Badge variant="outline" className="mt-1">{market.category}</Badge>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Tipo</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {market.market_type === 'binary' ? 'Binario (Sí/No)' : 'Múltiple'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Creado por</Label>
                  <p className="text-sm text-muted-foreground mt-1">{market.creator_name || 'Usuario'}</p>
                </div>
              </div>
              {market.resolution_date && (
                <div>
                  <Label className="text-sm font-medium">Fecha de Resolución Estimada</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(market.resolution_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {market.resolution_source && (
                <div>
                  <Label className="text-sm font-medium">Fuente de Resolución</Label>
                  <p className="text-sm text-muted-foreground mt-1">{market.resolution_source}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opciones/Outcomes */}
          <Card>
            <CardHeader>
              <CardTitle>Opciones de Predicción</CardTitle>
              <CardDescription>
                Selecciona una opción para comprar o vender acciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {market.outcomes?.map((outcome) => {
                  const position = userPositions.find(p => p.outcome_id === outcome.id)
                  const isWinner = outcome.is_winner
                  
                  return (
                    <div
                      key={outcome.id}
                      className={`border rounded-lg p-4 ${
                        isWinner ? 'bg-green-50 border-green-200' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{outcome.name}</h3>
                            {isWinner && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ganadora
                              </Badge>
                            )}
                          </div>
                          {outcome.description && (
                            <p className="text-sm text-muted-foreground mt-1">{outcome.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{formatPrice(outcome.current_price)}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(outcome.total_volume_hnld)} volumen
                          </div>
                        </div>
                      </div>
                      
                      {position && position.shares > 0 && (
                        <div className="mb-3 p-2 bg-muted rounded">
                          <div className="text-sm">
                            <span className="font-medium">Tu posición: </span>
                            {position.shares.toFixed(2)} acciones · 
                            Valor: {formatCurrency(position.current_value_hnld)}
                            {position.unrealized_pnl_hnld !== 0 && (
                              <span className={position.unrealized_pnl_hnld > 0 ? 'text-green-600' : 'text-red-600'}>
                                {' '}({position.unrealized_pnl_hnld > 0 ? '+' : ''}{formatCurrency(position.unrealized_pnl_hnld)})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {market.status === 'active' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleOpenTrade(outcome, 'buy')}
                            className="flex-1"
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Comprar
                          </Button>
                          {position && position.shares > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenTrade(outcome, 'sell')}
                              className="flex-1"
                            >
                              <TrendingDown className="h-4 w-4 mr-2" />
                              Vender
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Estadísticas */}
          <Card>
            <CardHeader>
              <CardTitle>Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Volumen Total</Label>
                <p className="text-2xl font-bold">{formatCurrency(market.total_volume_hnld || 0)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Operaciones</Label>
                <p className="text-2xl font-bold">{market.total_trades || 0}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Pool de Liquidez</Label>
                <p className="text-2xl font-bold">{formatCurrency(market.liquidity_pool_hnld)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Tu Balance HNLD</Label>
                <p className="text-2xl font-bold">{formatCurrency(userBalance)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Acciones del creador */}
          {canResolve && (
            <Card>
              <CardHeader>
                <CardTitle>Acciones del Creador</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => setResolveDialogOpen(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolver Mercado
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de Trading */}
      <Dialog open={tradeDialogOpen} onOpenChange={setTradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tradeType === 'buy' ? 'Comprar Acciones' : 'Vender Acciones'}
            </DialogTitle>
            <DialogDescription>
              {selectedOutcome?.name} - Precio actual: {selectedOutcome ? formatPrice(selectedOutcome.current_price) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cantidad de Acciones</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {tradeType === 'buy' && (
              <div className="space-y-2">
                <Label>Precio Máximo (opcional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="0.0000"
                />
                <p className="text-xs text-muted-foreground">
                  Si el precio sube por encima de este valor, la orden no se ejecutará
                </p>
              </div>
            )}
            {tradeType === 'sell' && (
              <div className="space-y-2">
                <Label>Precio Mínimo (opcional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0.0000"
                />
                <p className="text-xs text-muted-foreground">
                  Si el precio baja por debajo de este valor, la orden no se ejecutará
                </p>
              </div>
            )}
            {selectedOutcome && shares && parseFloat(shares) > 0 && (
              <div className="p-3 bg-muted rounded">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Costo estimado:</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(shares) * selectedOutcome.current_price)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>Comisiones:</span>
                    <span>
                      {formatCurrency(
                        parseFloat(shares) * selectedOutcome.current_price * 
                        ((market.trading_fee_percent + market.platform_fee_percent) / 100)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTradeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTrade} disabled={trading}>
              {trading ? "Procesando..." : tradeType === 'buy' ? 'Comprar' : 'Vender'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Resolución */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Mercado</DialogTitle>
            <DialogDescription>
              Selecciona la opción ganadora y proporciona notas sobre la resolución
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Opción Ganadora *</Label>
              <Select value={winningOutcomeId} onValueChange={setWinningOutcomeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la opción ganadora" />
                </SelectTrigger>
                <SelectContent>
                  {market.outcomes?.map((outcome) => (
                    <SelectItem key={outcome.id} value={outcome.id}>
                      {outcome.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas de Resolución (opcional)</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Explica cómo se resolvió el mercado..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResolve} disabled={resolving || !winningOutcomeId}>
              {resolving ? "Resolviendo..." : "Resolver Mercado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

