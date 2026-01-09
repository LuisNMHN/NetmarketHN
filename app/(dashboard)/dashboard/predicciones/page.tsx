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
  canUserCreateMarkets,
  type PredictionMarket
} from "@/lib/actions/prediction_markets_client"
import { formatCurrency } from "@/lib/utils"
import { 
  Search, 
  TrendingUp,
  Clock,
  Users,
  Plus,
  Eye,
  RefreshCw,
  BarChart3
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"

export default function PrediccionesPage() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [canCreate, setCanCreate] = useState<boolean>(false)
  const { toast } = useToast()

  const loadMarkets = async () => {
    try {
      setLoading(true)
      const result = await getActiveMarkets(50, 0)
      
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

  useEffect(() => {
    loadMarkets()
    checkPermissions()
  }, [])

  const checkPermissions = async () => {
    try {
      const result = await canUserCreateMarkets()
      console.log('Permisos verificados:', result) // Debug
      if (result.success && result.canCreate) {
        setCanCreate(true)
      } else {
        setCanCreate(false)
      }
    } catch (error) {
      console.error('Error verificando permisos:', error)
      setCanCreate(false)
    }
  }

  const filteredMarkets = markets.filter(market => {
    return (
      market.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Hace menos de 1 hora"
    if (diffInHours < 24) return `Hace ${diffInHours} horas`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `Hace ${diffInDays} días`
    const diffInWeeks = Math.floor(diffInDays / 7)
    return `Hace ${diffInWeeks} semanas`
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="Cargando mercados de predicción..." />
      </div>
    )
  }

  // Vista para usuarios SIN permisos (solo ver y participar)
  if (!canCreate) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header simplificado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Mercados de Predicción</h1>
            <p className="text-muted-foreground">Participa en mercados de predicción y gana con tus conocimientos</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* Quick Links simplificados - solo para participantes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button asChild variant="outline" className="h-auto flex-col py-4">
            <Link href="/dashboard/predicciones/mis-posiciones">
              <TrendingUp className="h-5 w-5 mb-2" />
              <span className="text-sm font-medium">Mis Posiciones</span>
              <span className="text-xs text-muted-foreground mt-1">Ver mis inversiones</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col py-4">
            <Link href="/dashboard/predicciones">
              <Eye className="h-5 w-5 mb-2" />
              <span className="text-sm font-medium">Todos los Mercados</span>
              <span className="text-xs text-muted-foreground mt-1">Explorar mercados</span>
            </Link>
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, pregunta, categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Markets Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMarkets.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay mercados disponibles</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "No se encontraron mercados que coincidan con tu búsqueda" 
                  : "No hay mercados de predicción activos en este momento"}
              </p>
            </div>
          ) : (
            filteredMarkets.map((market) => (
              <Card key={market.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{market.title}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {market.question}
                      </CardDescription>
                    </div>
                    {getStatusBadge(market.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeAgo(market.created_at)}</span>
                    </div>
                    {market.category && (
                      <Badge variant="outline" className="text-xs">
                        {market.category}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Liquidez:</span>
                      <span className="font-semibold">{formatCurrency(market.liquidity_pool_hnld)} HNLD</span>
                    </div>
                    {market.total_volume_hnld && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Volumen:</span>
                        <span className="font-semibold">{formatCurrency(market.total_volume_hnld)} HNLD</span>
                      </div>
                    )}
                    {market.total_trades && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Operaciones:</span>
                        <span className="font-semibold">{market.total_trades}</span>
                      </div>
                    )}
                  </div>

                  {market.creator_name && (
                    <div className="text-xs text-muted-foreground">
                      Creado por: <span className="font-medium">{market.creator_name}</span>
                    </div>
                  )}

                  <Button asChild className="w-full" size="sm">
                    <Link href={`/dashboard/predicciones/${market.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Participar
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  // Vista para usuarios CON permisos (creadores)
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header completo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Mercados de Predicción</h1>
          <p className="text-muted-foreground">Crea y participa en mercados de predicción usando HNLD</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
            <Link href="/dashboard/predicciones/crear">
              <Plus className="mr-2 h-4 w-4" />
              Crear Mercado
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Quick Links completos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button asChild variant="outline" className="h-auto flex-col py-4">
          <Link href="/dashboard/predicciones/mis-posiciones">
            <TrendingUp className="h-5 w-5 mb-2" />
            <span className="text-sm font-medium">Mis Posiciones</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col py-4">
          <Link href="/dashboard/predicciones/mis-mercados">
            <Users className="h-5 w-5 mb-2" />
            <span className="text-sm font-medium">Mis Mercados</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col py-4">
          <Link href="/dashboard/predicciones">
            <Eye className="h-5 w-5 mb-2" />
            <span className="text-sm font-medium">Todos los Mercados</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col py-4">
          <Link href="/dashboard/predicciones/crear">
            <Plus className="h-5 w-5 mb-2" />
            <span className="text-sm font-medium">Crear Mercado</span>
          </Link>
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, pregunta, categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Markets Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredMarkets.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay mercados disponibles</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "No se encontraron mercados que coincidan con tu búsqueda" 
                : "No hay mercados de predicción activos en este momento"}
            </p>
            {canCreate && (
              <Button asChild>
                <Link href="/dashboard/predicciones/crear">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primer Mercado
                </Link>
              </Button>
            )}
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <Card key={market.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{market.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {market.question}
                    </CardDescription>
                  </div>
                  {getStatusBadge(market.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatTimeAgo(market.created_at)}</span>
                  </div>
                  {market.category && (
                    <Badge variant="outline" className="text-xs">
                      {market.category}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Liquidez:</span>
                    <span className="font-semibold">{formatCurrency(market.liquidity_pool_hnld)} HNLD</span>
                  </div>
                  {market.total_volume_hnld && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Volumen:</span>
                      <span className="font-semibold">{formatCurrency(market.total_volume_hnld)} HNLD</span>
                    </div>
                  )}
                  {market.total_trades && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Operaciones:</span>
                      <span className="font-semibold">{market.total_trades}</span>
                    </div>
                  )}
                </div>

                {market.creator_name && (
                  <div className="text-xs text-muted-foreground">
                    Creado por: <span className="font-medium">{market.creator_name}</span>
                  </div>
                )}

                <Button asChild className="w-full" size="sm">
                  <Link href={`/dashboard/predicciones/${market.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Mercado
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

