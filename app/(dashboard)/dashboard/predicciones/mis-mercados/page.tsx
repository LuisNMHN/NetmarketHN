"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { 
  getUserMarkets,
  canUserCreateMarkets,
  type PredictionMarket
} from "@/lib/actions/prediction_markets_client"
import { formatCurrency } from "@/lib/utils"
import { 
  Search,
  Plus,
  Eye,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle
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

export default function MyMarketsPage() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [canCreate, setCanCreate] = useState<boolean>(false)
  const { toast } = useToast()

  useEffect(() => {
    loadMarkets()
    checkPermissions()
  }, [])

  const checkPermissions = async () => {
    try {
      const result = await canUserCreateMarkets()
      console.log('Permisos verificados (mis-mercados):', result) // Debug
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

  const loadMarkets = async () => {
    try {
      setLoading(true)
      const result = await getUserMarkets()
      
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

  const filteredMarkets = markets.filter(market => {
    const search = searchTerm.toLowerCase()
    return (
      market.title.toLowerCase().includes(search) ||
      market.question.toLowerCase().includes(search) ||
      market.id.toLowerCase().includes(search)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4 text-green-600" />
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4" />
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

  const activeMarkets = filteredMarkets.filter(m => m.status === 'active')
  const resolvedMarkets = filteredMarkets.filter(m => m.status === 'resolved')
  const otherMarkets = filteredMarkets.filter(m => m.status !== 'active' && m.status !== 'resolved')

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
          <h1 className="text-3xl font-bold">Mis Mercados</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los mercados de predicción que has creado
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button asChild>
              <Link href="/dashboard/predicciones/crear">
                <Plus className="mr-2 h-4 w-4" />
                Crear Mercado
              </Link>
            </Button>
          )}
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

      {filteredMarkets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No has creado ningún mercado de predicción</p>
            {canCreate && (
              <Button asChild>
                <Link href="/dashboard/predicciones/crear">
                  Crear tu Primer Mercado
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {activeMarkets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mercados Activos</CardTitle>
                <CardDescription>
                  Mercados que están actualmente abiertos para trading
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Pregunta</TableHead>
                      <TableHead>Volumen</TableHead>
                      <TableHead>Operaciones</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMarkets.map((market) => (
                      <TableRow key={market.id}>
                        <TableCell>
                          <div className="font-medium">{market.title}</div>
                          {market.category && (
                            <Badge variant="outline" className="mt-1">{market.category}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-md truncate">
                            {market.question}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(market.total_volume_hnld || 0)}</TableCell>
                        <TableCell>{market.total_trades || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimeAgo(market.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(market.status)}
                            {getStatusBadge(market.status)}
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
              </CardContent>
            </Card>
          )}

          {resolvedMarkets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mercados Resueltos</CardTitle>
                <CardDescription>
                  Mercados que ya han sido resueltos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Pregunta</TableHead>
                      <TableHead>Volumen</TableHead>
                      <TableHead>Operaciones</TableHead>
                      <TableHead>Resuelto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedMarkets.map((market) => (
                      <TableRow key={market.id}>
                        <TableCell>
                          <div className="font-medium">{market.title}</div>
                          {market.category && (
                            <Badge variant="outline" className="mt-1">{market.category}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-md truncate">
                            {market.question}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(market.total_volume_hnld || 0)}</TableCell>
                        <TableCell>{market.total_trades || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {market.resolved_at ? formatTimeAgo(market.resolved_at) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(market.status)}
                            {getStatusBadge(market.status)}
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
              </CardContent>
            </Card>
          )}

          {otherMarkets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Otros Mercados</CardTitle>
                <CardDescription>
                  Mercados cerrados o cancelados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Pregunta</TableHead>
                      <TableHead>Volumen</TableHead>
                      <TableHead>Operaciones</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherMarkets.map((market) => (
                      <TableRow key={market.id}>
                        <TableCell>
                          <div className="font-medium">{market.title}</div>
                          {market.category && (
                            <Badge variant="outline" className="mt-1">{market.category}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-md truncate">
                            {market.question}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(market.total_volume_hnld || 0)}</TableCell>
                        <TableCell>{market.total_trades || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(market.status)}
                            {getStatusBadge(market.status)}
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
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

