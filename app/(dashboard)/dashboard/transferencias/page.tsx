"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { supabaseBrowser } from "@/lib/supabase/client"
import { 
  getUserDirectTransfers,
  createDirectTransfer,
  searchUserForTransfer,
  type DirectTransfer
} from "@/lib/actions/direct_transfers"
import { getUserHNLDBalance } from "@/lib/actions/hnld"
import { formatCurrency } from "@/lib/utils"
import { 
  Send, 
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  RefreshCw,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2
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

export default function TransferenciasPage() {
  const [transfers, setTransfers] = useState<DirectTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [balance, setBalance] = useState<{ balance: number; available_balance: number } | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ id: string; email: string; full_name?: string }>>([])
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; full_name?: string } | null>(null)
  const [transferAmount, setTransferAmount] = useState("")
  const [transferDescription, setTransferDescription] = useState("")
  const [processing, setProcessing] = useState(false)
  const [searching, setSearching] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
    setupRealtime()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([loadTransfers(), loadBalance()])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadTransfers = async () => {
    try {
      const result = await getUserDirectTransfers(50, 0)
      if (result && result.success && result.data) {
        setTransfers(result.data)
      }
    } catch (error) {
      console.error('Error cargando transferencias:', error)
    }
  }

  const loadBalance = async () => {
    try {
      const result = await getUserHNLDBalance()
      if (result && result.success && result.data) {
        setBalance({
          balance: result.data.balance || 0,
          available_balance: result.data.available_balance || 0
        })
      }
    } catch (error) {
      console.error('Error cargando balance:', error)
    }
  }

  const setupRealtime = () => {
    const supabase = supabaseBrowser()
    
    const channel = supabase
      .channel('direct_transfers_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'hnld_direct_transfers'
      }, (payload) => {
        const newTransfer = payload.new as DirectTransfer
        setTransfers(prev => {
          if (prev.some(t => t.id === newTransfer.id)) return prev
          return [newTransfer, ...prev]
        })
        loadBalance() // Actualizar balance
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'hnld_direct_transfers'
      }, (payload) => {
        const updatedTransfer = payload.new as DirectTransfer
        setTransfers(prev => prev.map(t => t.id === updatedTransfer.id ? updatedTransfer : t))
        loadBalance() // Actualizar balance
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción realtime activa para transferencias')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const result = await searchUserForTransfer(query)
      if (result && result.success && result.data) {
        setSearchResults(result.data)
      }
    } catch (error) {
      console.error('Error buscando usuarios:', error)
    } finally {
      setSearching(false)
    }
  }

  const handleCreateTransfer = async () => {
    if (!selectedUser) {
      toast({
        title: "Error",
        description: "Debes seleccionar un usuario",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(transferAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    if (balance && amount > balance.available_balance) {
      toast({
        title: "Error",
        description: `Balance insuficiente. Disponible: ${formatCurrency(balance.available_balance)}`,
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await createDirectTransfer(
        selectedUser.id,
        amount,
        transferDescription || undefined
      )

      if (result.success) {
        toast({
          title: "Transferencia completada",
          description: `Has transferido ${formatCurrency(amount)} a ${selectedUser.full_name || selectedUser.email}`,
          variant: "success",
        })
        
        // Limpiar formulario
        setSelectedUser(null)
        setTransferAmount("")
        setTransferDescription("")
        setSearchQuery("")
        setSearchResults([])
        setCreateDialogOpen(false)
        
        // Recargar datos
        await loadData()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error procesando transferencia",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error inesperado",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (transfer: DirectTransfer) => {
    switch (transfer.status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completada</Badge>
      case 'processing':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Procesando</Badge>
      case 'failed':
        return <Badge variant="destructive">Fallida</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelada</Badge>
      default:
        return <Badge variant="outline">Pendiente</Badge>
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transferencias de HNLD</h1>
          <p className="text-muted-foreground mt-1">
            Transfiere HNLD directamente a otros usuarios
          </p>
        </div>
        <div className="flex items-center gap-4">
          {balance && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Balance disponible</p>
              <p className="text-2xl font-bold">{formatCurrency(balance.available_balance)}</p>
            </div>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Nueva Transferencia
          </Button>
          <Button variant="outline" onClick={() => { setRefreshing(true); loadData() }}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Historial de transferencias */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transferencias</CardTitle>
          <CardDescription>
            Todas tus transferencias enviadas y recibidas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transferencias aún
            </div>
          ) : (
            <div className="space-y-4">
              {transfers.map((transfer) => (
                <Card key={transfer.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {transfer.is_sent ? (
                        <ArrowUpRight className="h-5 w-5 text-red-600 mt-1" />
                      ) : (
                        <ArrowDownLeft className="h-5 w-5 text-green-600 mt-1" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">
                            {transfer.is_sent ? 'Enviado a' : 'Recibido de'}
                          </h3>
                          <span className="text-sm text-muted-foreground">
                            {transfer.is_sent 
                              ? transfer.to_user_name || 'Usuario'
                              : transfer.from_user_name || 'Usuario'
                            }
                          </span>
                        </div>
                        {transfer.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {transfer.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-mono">
                            {transfer.is_sent ? '-' : '+'}{formatCurrency(transfer.amount)}
                          </span>
                          {transfer.unique_code && (
                            <span className="text-muted-foreground">
                              Código: {transfer.unique_code}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {new Date(transfer.created_at).toLocaleDateString('es-HN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(transfer)}
                      {transfer.status === 'completed' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {transfer.status === 'failed' && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      {transfer.status === 'processing' && (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear transferencia */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva Transferencia</DialogTitle>
            <DialogDescription>
              Transfiere HNLD directamente a otro usuario
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Buscar usuario */}
            <div className="space-y-2">
              <Label>Buscar usuario</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email o nombre..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {/* Resultados de búsqueda */}
              {searchResults.length > 0 && !selectedUser && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="w-full text-left p-3 hover:bg-muted flex items-center gap-3"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{user.full_name || 'Usuario'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Usuario seleccionado */}
              {selectedUser && (
                <div className="border rounded-md p-3 bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedUser.full_name || 'Usuario'}</p>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(null)
                      setSearchQuery("")
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              )}
            </div>

            {/* Monto */}
            <div className="space-y-2">
              <Label>Monto (HNLD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                disabled={!selectedUser}
              />
              {balance && transferAmount && (
                <p className="text-xs text-muted-foreground">
                  Disponible: {formatCurrency(balance.available_balance)}
                </p>
              )}
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                placeholder="Mensaje o motivo de la transferencia..."
                value={transferDescription}
                onChange={(e) => setTransferDescription(e.target.value)}
                disabled={!selectedUser}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false)
                setSelectedUser(null)
                setTransferAmount("")
                setTransferDescription("")
                setSearchQuery("")
                setSearchResults([])
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTransfer}
              disabled={!selectedUser || !transferAmount || processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Transferir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

