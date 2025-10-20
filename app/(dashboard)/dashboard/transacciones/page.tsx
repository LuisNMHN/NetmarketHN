"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { 
  createEscrow,
  lockEscrow,
  releaseEscrow,
  cancelEscrow,
  disputeEscrow,
  getUserEscrows,
  getEscrowEvents,
  getEscrowMessages,
  addEscrowMessage,
  searchUserForEscrow,
  type Escrow,
  type EscrowEvent,
  type EscrowMessage
} from "@/lib/actions/escrow"
import { 
  Shield, 
  Lock, 
  Unlock, 
  X, 
  AlertTriangle,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Send,
  RefreshCw
} from "lucide-react"

export default function TransaccionesPage() {
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null)
  const [escrowEvents, setEscrowEvents] = useState<EscrowEvent[]>([])
  const [escrowMessages, setEscrowMessages] = useState<EscrowMessage[]>([])
  const { toast } = useToast()

  // Form states
  const [createForm, setCreateForm] = useState({
    payeeEmail: "",
    amount: "",
    title: "",
    description: "",
    terms: "",
    escrowType: "custom",
    expiresInHours: "168"
  })
  const [searchUser, setSearchUser] = useState({ email: "", user: null as any })
  const [messageForm, setMessageForm] = useState({ message: "" })
  const [processing, setProcessing] = useState(false)

  const loadEscrows = async () => {
    try {
      const result = await getUserEscrows()
      if (result.success && result.data) {
        setEscrows(result.data)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron cargar los escrows",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('❌ Error cargando escrows:', error)
      toast({
        title: "Error",
        description: "Error cargando escrows",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadEscrows()
  }

  const handleSearchUser = async () => {
    if (!searchUser.email) {
      toast({
        title: "Error",
        description: "Ingresa un email válido",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await searchUserForEscrow(searchUser.email)
      if (result.success && result.data) {
        setSearchUser(prev => ({ ...prev, user: result.data }))
        toast({
          title: "✅ Usuario encontrado",
          description: `${result.data.name || result.data.email}`,
        })
      } else {
        setSearchUser(prev => ({ ...prev, user: null }))
        toast({
          title: "❌ Usuario no encontrado",
          description: result.error || "No se encontró el usuario",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error buscando usuario",
        variant: "destructive",
      })
    }
  }

  const handleCreateEscrow = async () => {
    if (!createForm.amount || !createForm.title || !searchUser.user) {
      toast({
        title: "Error",
        description: "Todos los campos requeridos deben estar completos",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(createForm.amount)
    if (amount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await createEscrow(
        searchUser.user.id,
        amount,
        createForm.title,
        createForm.description,
        createForm.terms,
        createForm.escrowType,
        parseInt(createForm.expiresInHours)
      )
      
      if (result.success) {
        toast({
          title: "✅ Escrow creado",
          description: `Escrow de ${formatCurrency(amount)} creado exitosamente`,
        })
        setCreateForm({
          payeeEmail: "",
          amount: "",
          title: "",
          description: "",
          terms: "",
          escrowType: "custom",
          expiresInHours: "168"
        })
        setSearchUser({ email: "", user: null })
        setCreateOpen(false)
        await loadEscrows()
      } else {
        toast({
          title: "❌ Error creando escrow",
          description: result.error || "No se pudo crear el escrow",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear el escrow",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleLockEscrow = async (escrowId: string) => {
    setProcessing(true)
    try {
      const result = await lockEscrow(escrowId)
      
      if (result.success) {
        toast({
          title: "✅ Escrow confirmado",
          description: "Los fondos han sido bloqueados",
        })
        await loadEscrows()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'locked' } : null)
        }
      } else {
        toast({
          title: "❌ Error confirmando escrow",
          description: result.error || "No se pudo confirmar el escrow",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al confirmar el escrow",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReleaseEscrow = async (escrowId: string) => {
    setProcessing(true)
    try {
      const result = await releaseEscrow(escrowId)
      
      if (result.success) {
        toast({
          title: "✅ Escrow liberado",
          description: "Los fondos han sido transferidos al beneficiario",
        })
        await loadEscrows()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'released' } : null)
        }
      } else {
        toast({
          title: "❌ Error liberando escrow",
          description: result.error || "No se pudo liberar el escrow",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al liberar el escrow",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCancelEscrow = async (escrowId: string) => {
    setProcessing(true)
    try {
      const result = await cancelEscrow(escrowId)
      
      if (result.success) {
        toast({
          title: "✅ Escrow cancelado",
          description: "Los fondos han sido devueltos",
        })
        await loadEscrows()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'cancelled' } : null)
        }
      } else {
        toast({
          title: "❌ Error cancelando escrow",
          description: result.error || "No se pudo cancelar el escrow",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al cancelar el escrow",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleDisputeEscrow = async (escrowId: string) => {
    const reason = prompt("¿Cuál es la razón de la disputa?")
    if (!reason) return

    setProcessing(true)
    try {
      const result = await disputeEscrow(escrowId, reason)
      
      if (result.success) {
        toast({
          title: "✅ Escrow disputado",
          description: "La disputa ha sido registrada",
        })
        await loadEscrows()
        if (selectedEscrow?.id === escrowId) {
          setSelectedEscrow(prev => prev ? { ...prev, status: 'disputed' } : null)
        }
      } else {
        toast({
          title: "❌ Error disputando escrow",
          description: result.error || "No se pudo disputar el escrow",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al disputar el escrow",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleViewDetails = async (escrow: Escrow) => {
    setSelectedEscrow(escrow)
    setDetailsOpen(true)
    
    // Cargar eventos y mensajes
    try {
      const [eventsResult, messagesResult] = await Promise.all([
        getEscrowEvents(escrow.id),
        getEscrowMessages(escrow.id)
      ])
      
      if (eventsResult.success && eventsResult.data) {
        setEscrowEvents(eventsResult.data)
      }
      
      if (messagesResult.success && messagesResult.data) {
        setEscrowMessages(messagesResult.data)
      }
    } catch (error) {
      console.error('❌ Error cargando detalles:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedEscrow || !messageForm.message.trim()) return

    try {
      const result = await addEscrowMessage(selectedEscrow.id, messageForm.message)
      
      if (result.success) {
        setMessageForm({ message: "" })
        // Recargar mensajes
        const messagesResult = await getEscrowMessages(selectedEscrow.id)
        if (messagesResult.success && messagesResult.data) {
          setEscrowMessages(messagesResult.data)
        }
      } else {
        toast({
          title: "❌ Error enviando mensaje",
          description: result.error || "No se pudo enviar el mensaje",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al enviar el mensaje",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'locked':
        return <Lock className="h-4 w-4 text-blue-500" />
      case 'released':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'disputed':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>
      case 'locked':
        return <Badge className="bg-blue-100 text-blue-800">Bloqueado</Badge>
      case 'released':
        return <Badge className="bg-green-100 text-green-800">Liberado</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>
      case 'disputed':
        return <Badge className="bg-orange-100 text-orange-800">Disputado</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'p2p_trade':
        return 'Comercio P2P'
      case 'service':
        return 'Servicio'
      case 'auction':
        return 'Subasta'
      case 'guarantee':
        return 'Garantía'
      case 'custom':
        return 'Personalizado'
      default:
        return type
    }
  }

  useEffect(() => {
    loadEscrows()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="Cargando transacciones..." />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Sistema Escrow</h1>
          <p className="text-muted-foreground">Depósito en garantía con estados lock/release</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear Escrow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Escrow</DialogTitle>
                <DialogDescription>Crear un depósito en garantía para una transacción</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payee-email">Email del Beneficiario</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="payee-email"
                      type="email"
                      placeholder="email@ejemplo.com"
                      value={searchUser.email}
                      onChange={(e) => setSearchUser(prev => ({ ...prev, email: e.target.value }))}
                    />
                    <Button type="button" onClick={handleSearchUser} size="sm">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {searchUser.user && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm font-medium text-green-800">
                        ✅ {searchUser.user.name || searchUser.user.email}
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Monto (L.)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={createForm.amount}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="escrow-type">Tipo de Escrow</Label>
                    <Select
                      value={createForm.escrowType}
                      onValueChange={(value) => setCreateForm(prev => ({ ...prev, escrowType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="p2p_trade">Comercio P2P</SelectItem>
                        <SelectItem value="service">Servicio</SelectItem>
                        <SelectItem value="auction">Subasta</SelectItem>
                        <SelectItem value="guarantee">Garantía</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    placeholder="Descripción breve del escrow"
                    value={createForm.title}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descripción detallada..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="terms">Términos y Condiciones (opcional)</Label>
                  <Textarea
                    id="terms"
                    placeholder="Términos específicos del escrow..."
                    value={createForm.terms}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, terms: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="expires">Expira en (horas)</Label>
                  <Input
                    id="expires"
                    type="number"
                    placeholder="168"
                    value={createForm.expiresInHours}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, expiresInHours: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={processing}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateEscrow} disabled={processing || !searchUser.user}>
                  {processing ? "Creando..." : "Crear Escrow"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Escrows List */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base md:text-lg font-semibold">Mis Escrows</CardTitle>
          <CardDescription>Gestiona tus depósitos en garantía</CardDescription>
        </CardHeader>
        <CardContent>
          {escrows.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tienes escrows aún</p>
              <p className="text-sm text-muted-foreground">Crea tu primer escrow para comenzar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escrows.map((escrow) => (
                  <TableRow key={escrow.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{escrow.title}</p>
                        <p className="text-sm text-muted-foreground">{escrow.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeLabel(escrow.escrow_type)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(escrow.amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(escrow.status)}
                        {getStatusBadge(escrow.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(escrow.created_at).toLocaleDateString('es-HN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(escrow)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {escrow.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLockEscrow(escrow.id)}
                            disabled={processing}
                          >
                            <Lock className="h-4 w-4" />
                          </Button>
                        )}
                        {escrow.status === 'locked' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReleaseEscrow(escrow.id)}
                              disabled={processing}
                            >
                              <Unlock className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisputeEscrow(escrow.id)}
                              disabled={processing}
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(escrow.status === 'pending' || escrow.status === 'locked') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelEscrow(escrow.id)}
                            disabled={processing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Escrow</DialogTitle>
            <DialogDescription>
              {selectedEscrow?.title} - {getStatusBadge(selectedEscrow?.status || '')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEscrow && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Detalles</TabsTrigger>
                <TabsTrigger value="events">Eventos</TabsTrigger>
                <TabsTrigger value="messages">Mensajes</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monto</Label>
                    <p className="text-lg font-semibold">{formatCurrency(selectedEscrow.amount)}</p>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <p>{getTypeLabel(selectedEscrow.escrow_type)}</p>
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(selectedEscrow.status)}
                      {getStatusBadge(selectedEscrow.status)}
                    </div>
                  </div>
                  <div>
                    <Label>Fecha de Creación</Label>
                    <p>{new Date(selectedEscrow.created_at).toLocaleString('es-HN')}</p>
                  </div>
                </div>
                
                {selectedEscrow.description && (
                  <div>
                    <Label>Descripción</Label>
                    <p className="text-sm">{selectedEscrow.description}</p>
                  </div>
                )}
                
                {selectedEscrow.terms && (
                  <div>
                    <Label>Términos y Condiciones</Label>
                    <p className="text-sm">{selectedEscrow.terms}</p>
                  </div>
                )}
                
                {selectedEscrow.expires_at && (
                  <div>
                    <Label>Expira</Label>
                    <p className="text-sm">{new Date(selectedEscrow.expires_at).toLocaleString('es-HN')}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="events" className="space-y-4">
                <div className="space-y-2">
                  {escrowEvents.map((event) => (
                    <div key={event.id} className="flex items-center space-x-3 p-3 border rounded">
                      <div className="flex-shrink-0">
                        {getStatusIcon(event.new_status || event.event_type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString('es-HN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="messages" className="space-y-4">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {escrowMessages.map((message) => (
                    <div key={message.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Usuario {message.sender_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString('es-HN')}
                        </p>
                      </div>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  ))}
                </div>
                
                <div className="flex space-x-2">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={messageForm.message}
                    onChange={(e) => setMessageForm({ message: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}