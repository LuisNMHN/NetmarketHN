"use client"

import { useState, useEffect, useRef } from "react"
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
import { supabaseBrowser } from "@/lib/supabase/client"
import { notificationCenter } from "@/lib/notifications/center"
import { 
  Search,
  Plus,
  Eye,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  Ban,
  ArrowLeft
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cancelMarket, deleteMarket } from "@/lib/actions/prediction_markets_client"
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
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const { toast } = useToast()
  const realtimeChannelRef = useRef<any>(null)

  useEffect(() => {
    loadMarkets()
    checkPermissions()
    getCurrentUser()
  }, [])

  // Configurar suscripción Realtime para actualizaciones en tiempo real
  useEffect(() => {
    if (!userId) {
      console.log('⏳ Esperando userId para configurar Realtime...')
      return
    }

    const setupRealtimeSubscription = async () => {
      try {
        const supabase = supabaseBrowser()
        
        // Limpiar suscripción anterior si existe
        if (realtimeChannelRef.current) {
          console.log('🧹 Limpiando suscripción Realtime anterior (mis-mercados)')
          await realtimeChannelRef.current.unsubscribe()
        }
        
        console.log('🔌 Configurando suscripción Realtime para mis mercados (userId:', userId, ')')
        
        // Crear canal para escuchar cambios en los mercados del usuario
        realtimeChannelRef.current = supabase
          .channel('my_markets_realtime')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'prediction_markets',
              filter: `creator_id=eq.${userId}`
            },
            async (payload: any) => {
              try {
                console.log('🔄 Mi mercado actualizado en tiempo real:', payload)
                console.log('📦 Payload completo:', JSON.stringify(payload, null, 2))
                
                if (!payload.new) {
                  console.warn('⚠️ Payload UPDATE no tiene campo "new"')
                  return
                }
                
                const updatedMarket = payload.new as PredictionMarket
                
                if (!updatedMarket || !updatedMarket.id) {
                  console.warn('⚠️ Mercado actualizado no tiene ID válido')
                  return
                }
                
                console.log(`📊 Mercado a actualizar: ID=${updatedMarket.id}, Status=${updatedMarket.status}, Title=${updatedMarket.title}`)
                
                // Actualizar el mercado en la lista (mantenerlo visible incluso si está cancelado)
                setMarkets(prev => {
                  console.log(`🔍 Buscando mercado ${updatedMarket.id} en lista de ${prev.length} mercados`)
                  const index = prev.findIndex(m => m.id === updatedMarket.id)
                  
                  if (index !== -1) {
                    // Actualizar el mercado existente
                    const updated = [...prev]
                    updated[index] = updatedMarket
                    console.log(`✅ Mercado actualizado en tiempo real (status: ${updatedMarket.status}, id: ${updatedMarket.id}, title: ${updatedMarket.title})`)
                    console.log(`📊 Total de mercados después de actualizar: ${updated.length}`)
                    return updated
                  } else {
                    // Si no estaba en la lista, agregarlo (puede ser un mercado nuevo o que se reactivó)
                    console.log(`➕ Agregando mercado a la lista (status: ${updatedMarket.status}, id: ${updatedMarket.id}, title: ${updatedMarket.title})`)
                    const newList = [updatedMarket, ...prev]
                    console.log(`📊 Total de mercados después de agregar: ${newList.length}`)
                    return newList
                  }
                })
              } catch (error) {
                console.error('❌ Error procesando actualización de mercado en tiempo real:', error)
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'prediction_markets',
              filter: `creator_id=eq.${userId}`
            },
            async (payload: any) => {
              try {
                console.log('🗑️ Mi mercado eliminado en tiempo real:', payload)
                console.log('📦 Payload completo:', JSON.stringify(payload, null, 2))
                
                if (!payload.old) {
                  console.warn('⚠️ Payload DELETE no tiene campo "old"')
                  return
                }
                
                const deletedMarketId = payload.old?.id
                
                if (!deletedMarketId) {
                  console.warn('⚠️ Mercado eliminado no tiene ID válido')
                  return
                }
                
                console.log(`🗑️ Mercado a eliminar: ID=${deletedMarketId} (tipo: ${typeof deletedMarketId})`)
                
                // Remover el mercado de la lista
                setMarkets(prev => {
                  console.log(`🔍 Buscando mercado ${deletedMarketId} en lista de ${prev.length} mercados para eliminar`)
                  
                  // Convertir ambos IDs a string para comparación segura
                  const deletedIdStr = String(deletedMarketId)
                  
                  // Log de todos los IDs en la lista para debugging
                  const marketIds = prev.map(m => m.id)
                  console.log(`📋 IDs en la lista:`, marketIds)
                  
                  const filtered = prev.filter(m => {
                    const marketIdStr = String(m.id)
                    const shouldKeep = marketIdStr !== deletedIdStr
                    if (!shouldKeep) {
                      console.log(`🗑️ Removiendo mercado: ${m.id} (${m.title})`)
                    }
                    return shouldKeep
                  })
                  
                  const wasRemoved = filtered.length < prev.length
                  
                  if (wasRemoved) {
                    console.log(`✅ Mercado ${deletedMarketId} removido exitosamente. Quedan ${filtered.length} mercados`)
                    // Forzar re-render asegurando que el estado se actualice
                    return [...filtered]
                  } else {
                    console.log(`⚠️ Mercado ${deletedMarketId} no estaba en la lista`)
                    console.log(`📋 IDs disponibles:`, marketIds)
                    // Aún así retornar la lista filtrada (por si acaso)
                    return prev
                  }
                })
              } catch (error) {
                console.error('❌ Error procesando eliminación de mercado en tiempo real:', error)
              }
            }
          )
          .subscribe((status: string, err?: any) => {
            console.log('📡 Estado de suscripción Realtime (mis-mercados):', status)
            if (status === 'SUBSCRIBED') {
              console.log('✅ Suscrito exitosamente a cambios de mis mercados')
              console.log('📋 Suscripciones activas:')
              console.log('   - UPDATE: actualizaciones de mis mercados (incluyendo cancelaciones)')
              console.log('   - DELETE: eliminación de mis mercados')
            } else if (status === 'CHANNEL_ERROR') {
              if (err) {
                console.error('❌ Error en canal Realtime (mis-mercados):', err)
                console.error('📋 Detalles del error:', JSON.stringify(err, null, 2))
              }
            } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
              console.log('📡 Canal Realtime (mis-mercados):', status)
            } else {
              console.log('📡 Estado desconocido de Realtime (mis-mercados):', status, err)
            }
          })
      } catch (error) {
        console.error('❌ Error configurando suscripción Realtime (mis-mercados):', error)
      }
    }
    
    setupRealtimeSubscription()
    
    // Fallback: Escuchar notificaciones de eliminación como respaldo
    const unsubscribeNotification = notificationCenter.addListener((notification) => {
      if (notification.event === 'MARKET_DELETED' && notification.payload?.market_id) {
        const deletedMarketId = notification.payload.market_id
        console.log('🔔 Notificación MARKET_DELETED recibida (mis-mercados), removiendo mercado:', deletedMarketId)
        
        setMarkets(prev => {
          console.log(`🔍 Notificación DELETE: Buscando mercado ${deletedMarketId} en lista de ${prev.length} mercados`)
          const deletedIdStr = String(deletedMarketId)
          const marketIds = prev.map(m => m.id)
          console.log(`📋 IDs en la lista (notificación):`, marketIds)
          
          const filtered = prev.filter(m => {
            const marketIdStr = String(m.id)
            const shouldKeep = marketIdStr !== deletedIdStr
            if (!shouldKeep) {
              console.log(`🗑️ Removiendo mercado por notificación: ${m.id} (${m.title})`)
            }
            return shouldKeep
          })
          
          if (filtered.length < prev.length) {
            console.log(`✅ Mercado ${deletedMarketId} removido por notificación (mis-mercados). Quedan ${filtered.length} mercados`)
            // Forzar re-render con spread operator
            return [...filtered]
          }
          
          console.log(`⚠️ Mercado ${deletedMarketId} no estaba en la lista (notificación mis-mercados)`)
          console.log(`📋 IDs disponibles:`, marketIds)
          return prev
        })
      }
    })
    
    // Cleanup al desmontar
    return () => {
      if (realtimeChannelRef.current) {
        console.log('🧹 Limpiando suscripción Realtime (mis-mercados) al desmontar')
        realtimeChannelRef.current.unsubscribe()
        realtimeChannelRef.current = null
      }
      if (unsubscribeNotification) {
        unsubscribeNotification()
      }
    }
  }, [userId])

  const getCurrentUser = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error('Error obteniendo usuario:', error)
    }
  }

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

  const handleCancelMarket = async (marketId: string, reason?: string) => {
    try {
      setCancellingId(marketId)
      const result = await cancelMarket(marketId, reason)
      
      if (result.success) {
        // No mostrar toast - la notificación aparecerá en la campana
        // No recargar - Realtime actualizará automáticamente
        setCancelDialogOpen(false)
        setCancelReason("")
        setSelectedMarketId(null)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo cancelar el mercado",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error cancelando mercado:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cancelar el mercado",
        variant: "destructive",
      })
    } finally {
      setCancellingId(null)
    }
  }

  const handleDeleteMarket = async (marketId: string) => {
    try {
      setDeletingId(marketId)
      const result = await deleteMarket(marketId)
      
      if (result.success) {
        // No mostrar toast - la notificación aparecerá en la campana
        // No recargar - Realtime removerá automáticamente
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el mercado",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error eliminando mercado:', error)
      toast({
        title: "Error",
        description: "Error inesperado al eliminar el mercado",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
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
  const cancelledMarkets = filteredMarkets.filter(m => m.status === 'cancelled')

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <LoadingSpinner message="Cargando mercados..." />
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
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/dashboard/predicciones/${market.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            
                            {/* Botón cancelar - solo para mercados activos */}
                            {market.status === 'active' && (
                              <Dialog open={cancelDialogOpen && selectedMarketId === market.id} onOpenChange={(open) => {
                                if (!open) {
                                  setCancelDialogOpen(false)
                                  setSelectedMarketId(null)
                                  setCancelReason("")
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedMarketId(market.id)
                                      setCancelDialogOpen(true)
                                    }}
                                    title="Cancelar mercado"
                                  >
                                    <Ban className="h-4 w-4 text-orange-600" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Cancelar Mercado</DialogTitle>
                                    <DialogDescription>
                                      ¿Estás seguro de que deseas cancelar el mercado "{market.title}"? 
                                      Solo puedes cancelar mercados que no tengan posiciones activas.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="reason">Razón de cancelación (opcional)</Label>
                                      <Textarea
                                        id="reason"
                                        placeholder="Explica por qué cancelas este mercado..."
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setCancelDialogOpen(false)
                                        setSelectedMarketId(null)
                                        setCancelReason("")
                                      }}
                                    >
                                      No cancelar
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => handleCancelMarket(market.id, cancelReason || undefined)}
                                      disabled={cancellingId === market.id}
                                    >
                                      {cancellingId === market.id ? "Cancelando..." : "Cancelar Mercado"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
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

          {cancelledMarkets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mercados Cancelados</CardTitle>
                <CardDescription>
                  Mercados que han sido cancelados por el creador
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
                    {cancelledMarkets.map((market) => (
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
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/dashboard/predicciones/${market.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            
                            {/* Botón eliminar - solo para mercados cancelados */}
                            {market.status === 'cancelled' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Eliminar mercado"
                                    disabled={deletingId === market.id}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar mercado?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      ¿Estás seguro de que deseas eliminar permanentemente el mercado "{market.title}"? 
                                      Esta acción no se puede deshacer. Solo puedes eliminar mercados cancelados que no tengan operaciones registradas.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteMarket(market.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={deletingId === market.id}
                                    >
                                      {deletingId === market.id ? "Eliminando..." : "Eliminar"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
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

