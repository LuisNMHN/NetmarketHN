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
  placeBet,
  buyMarketShares, // Mantener para compatibilidad
  sellMarketShares, // Mantener para compatibilidad
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
  
  // User role state
  const [isCreator, setIsCreator] = useState(false)
  const [isParticipant, setIsParticipant] = useState(false)
  const [userRole, setUserRole] = useState<'creator' | 'participant' | 'creator_and_participant' | 'viewer'>('viewer')
  const [creatorStats, setCreatorStats] = useState<any>(null)
  const [participantStats, setParticipantStats] = useState<any>(null)
  
  // Betting state (Parimutuel)
  const [betDialogOpen, setBetDialogOpen] = useState(false)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | null>(null)
  const [betAmount, setBetAmount] = useState<string>("")
  const [betting, setBetting] = useState(false)
  
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

      // Verificar rol del usuario
      const { data: roleData } = await supabase.rpc('get_user_market_role', {
        p_user_id: user.id,
        p_market_id: marketId
      })
      
      if (roleData) {
        setUserRole(roleData as any)
        setIsCreator(roleData === 'creator' || roleData === 'creator_and_participant')
        setIsParticipant(roleData === 'participant' || roleData === 'creator_and_participant')
      }
      
      // Si es creador, obtener estadísticas del creador
      if (roleData === 'creator' || roleData === 'creator_and_participant') {
        const { data: stats } = await supabase.rpc('get_market_creator_stats', {
          p_market_id: marketId
        })
        if (stats && stats.length > 0) {
          setCreatorStats(stats[0])
        }
      }
      
      // Si es participante, obtener estadísticas del participante
      if (roleData === 'participant' || roleData === 'creator_and_participant') {
        const { data: stats } = await supabase.rpc('get_market_participant_stats', {
          p_user_id: user.id,
          p_market_id: marketId
        })
        if (stats && stats.length > 0) {
          setParticipantStats(stats[0])
        }
      }
      
      // Obtener participaciones del usuario en este mercado
      const { data: bets } = await supabase
        .from('market_bets')
        .select('*, outcome:market_outcomes(*)')
        .eq('user_id', user.id)
        .eq('market_id', marketId)
      
      if (bets) {
        // Convertir bets a formato compatible con positions
        setUserPositions(bets.map(bet => ({
          ...bet,
          outcome_id: bet.outcome_id,
          shares: bet.bet_amount, // Para compatibilidad
          total_invested_hnld: bet.bet_amount,
          current_value_hnld: bet.potential_payout
        })))
      }
    } catch (error) {
      console.error('Error cargando datos del usuario:', error)
    }
  }

  const handleOpenBet = (outcome: MarketOutcome) => {
    setSelectedOutcome(outcome)
    setBetAmount("")
    setBetDialogOpen(true)
  }

  const handleBet = async () => {
    if (!selectedOutcome || !betAmount || parseFloat(betAmount) <= 0) {
      toast({
        title: "Error",
        description: "Debes ingresar una cantidad válida para participar",
        variant: "destructive",
      })
      return
    }

    try {
      setBetting(true)
      const result = await placeBet(
        marketId,
        selectedOutcome.id,
        parseFloat(betAmount)
      )

      if (result.success) {
        // No mostrar toast - la notificación aparecerá en la campana
        setBetDialogOpen(false)
        loadMarket()
        loadUserData()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al realizar la participación",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error en participación:', error)
      toast({
        title: "Error",
        description: "Error inesperado",
        variant: "destructive",
      })
    } finally {
      setBetting(false)
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
        // No mostrar toast - la notificación aparecerá en la campana
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

  // Función para obtener el color del botón según el tipo de mercado y la opción
  const getButtonColor = (outcome: MarketOutcome, index: number) => {
    // Si es mercado binario
    if (market?.market_type === 'binary') {
      const outcomeName = outcome.name.toLowerCase().trim()
      // Verificar si es "Sí" o variantes
      if (outcomeName === 'sí' || outcomeName === 'si' || outcomeName === 'yes' || outcomeName === 'verdadero' || outcomeName === 'true') {
        return '!bg-green-600 hover:!bg-green-700 !text-white border-0'
      }
      // Verificar si es "No" o variantes
      if (outcomeName === 'no' || outcomeName === 'false' || outcomeName === 'falso') {
        return '!bg-red-600 hover:!bg-red-700 !text-white border-0'
      }
    }
    
    // Para mercados múltiples (3 o más opciones), usar colores diferentes
    const colors = [
      '!bg-blue-600 hover:!bg-blue-700 !text-white border-0',
      '!bg-purple-600 hover:!bg-purple-700 !text-white border-0',
      '!bg-orange-600 hover:!bg-orange-700 !text-white border-0',
      '!bg-teal-600 hover:!bg-teal-700 !text-white border-0',
      '!bg-pink-600 hover:!bg-pink-700 !text-white border-0',
      '!bg-indigo-600 hover:!bg-indigo-700 !text-white border-0',
      '!bg-cyan-600 hover:!bg-cyan-700 !text-white border-0',
      '!bg-amber-600 hover:!bg-amber-700 !text-white border-0',
    ]
    
    return colors[index % colors.length]
  }

  const formatProbability = (probability: number) => {
    return `${(probability * 100).toFixed(2)}%`
  }

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
              <Link href="/dashboard/predicciones">Volver a mercados</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userPosition = userPositions.find(p => p.outcome_id === selectedOutcome?.id || (p as any).outcome?.id === selectedOutcome?.id)
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
          {/* Badge de rol del usuario */}
          {isCreator && (
            <Badge variant="default" className="bg-purple-100 text-purple-800">
              <Users className="h-3 w-3 mr-1" />
              Creador
            </Badge>
          )}
          {isParticipant && !isCreator && (
            <Badge variant="default" className="bg-blue-100 text-blue-800">
              <TrendingUp className="h-3 w-3 mr-1" />
              Participante
            </Badge>
          )}
          {isCreator && isParticipant && (
            <Badge variant="default" className="bg-indigo-100 text-indigo-800">
              <Users className="h-3 w-3 mr-1" />
              Creador y Participante
            </Badge>
          )}
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
              <CardTitle>Información del mercado</CardTitle>
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
                  <Label className="text-sm font-medium">Fecha de resolución estimada</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(market.resolution_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {market.resolution_source && (
                <div>
                  <Label className="text-sm font-medium">Fuente de resolución</Label>
                  <p className="text-sm text-muted-foreground mt-1">{market.resolution_source}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opciones/Outcomes */}
          <Card>
            <CardHeader>
              <CardTitle>Opciones de predicción</CardTitle>
              <CardDescription>
                {isCreator 
                  ? "Como creador, también puedes participar"
                  : "Selecciona una opción para participar"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {market.outcomes?.map((outcome, index) => {
                  const position = userPositions.find(p => p.outcome_id === outcome.id)
                  const isWinner = outcome.is_winner
                  const buttonColor = getButtonColor(outcome, index)
                  
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
                          <div className="text-2xl font-bold">
                            {formatProbability(outcome.probability || outcome.current_price || 0.5)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(outcome.total_bet_amount || outcome.total_volume_hnld || 0, 'HNLD')} participado
                          </div>
                        </div>
                      </div>
                      
                      {position && (position.shares > 0 || position.bet_amount > 0) && (
                        <div className="mb-3 p-2 bg-muted rounded">
                          <div className="text-sm">
                            <span className="font-medium">Tu participación: </span>
                            {formatCurrency(position.bet_amount || position.shares || 0, 'HNLD')} · 
                            Ganancia potencial: {formatCurrency(position.potential_payout || position.current_value_hnld || 0, 'HNLD')}
                          </div>
                        </div>
                      )}

                      {market.status === 'active' && (
                        <div className="flex gap-2">
                          {/* Los creadores también pueden apostar en sus propios mercados */}
                          {(!isCreator || (isCreator && isParticipant)) && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenBet(outcome)}
                              className={`flex-1 ${buttonColor}`}
                            >
                              <TrendingUp className="h-4 w-4 mr-2" />
                              {isCreator ? 'Participar (como usuario)' : 'Participar'}
                            </Button>
                          )}
                          {isCreator && !isParticipant && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenBet(outcome)}
                              className={`flex-1 ${buttonColor}`}
                            >
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Participar en mi mercado
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
          {/* Estadísticas para Creador */}
          {isCreator && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Estadísticas del creador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total de participaciones</Label>
                  <p className="text-2xl font-bold">{creatorStats?.total_bets || 0}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total de participantes</Label>
                  <p className="text-2xl font-bold">{creatorStats?.total_participants || 0}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fondo total</Label>
                  <p className="text-2xl font-bold">{formatCurrency(creatorStats?.total_pool || market.total_pool_hnld || 0, 'HNLD')}</p>
                </div>
                {market.status === 'active' && (
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium text-muted-foreground">Distribución por opción</Label>
                    <div className="mt-2 space-y-2">
                      {market.outcomes?.map((outcome) => {
                        const outcomeData = creatorStats?.total_bets_by_outcome?.find((o: any) => o.outcome_id === outcome.id)
                        return (
                          <div key={outcome.id} className="flex justify-between text-sm">
                            <span>{outcome.name}:</span>
                            <span className="font-medium">
                              {formatCurrency(outcomeData?.total_bet_amount || 0, 'HNLD')} ({outcomeData?.bet_count || 0} participaciones)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Estadísticas para Participante */}
          {isParticipant && !isCreator && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Mis participaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total participado</Label>
                  <p className="text-2xl font-bold">{formatCurrency(participantStats?.total_bet_amount || 0, 'HNLD')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Número de participaciones</Label>
                  <p className="text-2xl font-bold">{participantStats?.total_bets || 0}</p>
                </div>
                {market.status === 'active' && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Ganancia potencial total</Label>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(participantStats?.potential_total_payout || 0, 'HNLD')}</p>
                  </div>
                )}
                {market.status === 'resolved' && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Ganancia recibida</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        participantStats?.bets_by_outcome?.reduce((sum: number, bet: any) => sum + (bet.payout_received || 0), 0) || 0,
                        'HNLD'
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Estadísticas Generales (para viewers) */}
          {!isCreator && !isParticipant && (
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas del mercado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fondo total</Label>
                  <p className="text-2xl font-bold">{formatCurrency(market.total_pool_hnld || market.liquidity_pool_hnld || 0, 'HNLD')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total de participaciones</Label>
                  <p className="text-2xl font-bold">{market.total_bets || market.total_trades || 0}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balance del Usuario (siempre visible) */}
          <Card>
            <CardHeader>
              <CardTitle>Tu balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(userBalance, 'HNLD')}</p>
            </CardContent>
          </Card>

          {/* Acciones del creador */}
          {isCreator && market.status === 'active' && (
            <Card>
              <CardHeader>
                <CardTitle>Acciones del creador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => setResolveDialogOpen(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolver mercado
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Como creador, puedes resolver el mercado cuando se cumpla la condición establecida.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de Participación */}
      <Dialog open={betDialogOpen} onOpenChange={setBetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Hacer una Predicción
            </DialogTitle>
            <DialogDescription>
              {selectedOutcome?.name} - Probabilidad actual: {selectedOutcome ? formatProbability(selectedOutcome.probability || selectedOutcome.current_price || 0.5) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cantidad a participar</Label>
              <Input
                type="number"
                min={market.min_trade_amount || 1}
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo: {formatCurrency(market.min_trade_amount || 1, 'HNLD')}
                {market.max_trade_amount && ` · Máximo: ${formatCurrency(market.max_trade_amount, 'HNLD')}`}
              </p>
            </div>
            {selectedOutcome && betAmount && parseFloat(betAmount) > 0 && (
              <div className="p-3 bg-muted rounded space-y-2">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Participación:</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(betAmount), 'HNLD')}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t text-xs">
                  <p className="text-muted-foreground">
                    <strong>Nota:</strong> Las ganancias se distribuyen proporcionalmente entre los ganadores al resolver el mercado.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBet} disabled={betting}>
              {betting ? "Procesando..." : 'Participar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Resolución */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver mercado</DialogTitle>
            <DialogDescription>
              Selecciona la opción ganadora y agrega notas (opcional)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Opción ganadora *</Label>
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
              <Label>Notas de resolución (opcional)</Label>
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
              {resolving ? "Resolviendo..." : "Resolver mercado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

