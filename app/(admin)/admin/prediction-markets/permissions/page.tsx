"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  Plus,
  Edit,
  X,
  Check,
  UserPlus,
  RefreshCw,
  Trash2
} from "lucide-react"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { 
  getAllCreatorPermissions,
  grantCreatorPermission,
  updateCreatorPermission,
  revokeCreatorPermission,
  deleteCreatorPermission,
  type MarketCreatorPermission,
  type CreatePermissionData
} from "@/lib/actions/prediction_markets_admin"
import { supabaseBrowser } from "@/lib/supabase/client"

export default function PredictionMarketsPermissionsPage() {
  const [permissions, setPermissions] = useState<MarketCreatorPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<MarketCreatorPermission | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState<CreatePermissionData & { user_search?: string }>({
    user_id: "",
    max_active_markets: 10,
    max_daily_markets: 5,
    expires_at: "",
    user_search: ""
  })

  useEffect(() => {
    loadPermissions()
  }, [])

  const loadPermissions = async () => {
    try {
      setLoading(true)
      const result = await getAllCreatorPermissions()
      
      if (result.success && result.data) {
        setPermissions(result.data)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron cargar los permisos",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error cargando permisos:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar permisos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setUsers([])
      return
    }

    try {
      setLoadingUsers(true)
      const supabase = supabaseBrowser()
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10)

      if (profiles) {
        setUsers(profiles.map(p => ({
          id: p.id,
          name: p.full_name || 'Usuario',
          email: p.email || ''
        })))
      }
    } catch (error) {
      console.error('Error buscando usuarios:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleOpenDialog = (permission?: MarketCreatorPermission) => {
    if (permission) {
      setSelectedPermission(permission)
      setFormData({
        user_id: permission.user_id,
        max_active_markets: permission.max_active_markets,
        max_daily_markets: permission.max_daily_markets,
        expires_at: permission.expires_at ? permission.expires_at.split('T')[0] : "",
        user_search: permission.user_name || ""
      })
    } else {
      setSelectedPermission(null)
      setFormData({
        user_id: "",
        max_active_markets: 10,
        max_daily_markets: 5,
        expires_at: "",
        notes: "",
        user_search: ""
      })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.user_id) {
      toast({
        title: "Error",
        description: "Debes seleccionar un usuario",
        variant: "destructive",
      })
      return
    }

    try {
      let result
      if (selectedPermission) {
        result = await updateCreatorPermission(selectedPermission.id, {
          max_active_markets: formData.max_active_markets,
          max_daily_markets: formData.max_daily_markets,
          expires_at: formData.expires_at || undefined
        })
      } else {
        result = await grantCreatorPermission(formData)
      }

      if (result.success) {
        toast({
          title: "Éxito",
          description: selectedPermission 
            ? "Permisos actualizados correctamente" 
            : "Permisos otorgados correctamente",
        })
        setDialogOpen(false)
        loadPermissions()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al guardar permisos",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error guardando permisos:', error)
      toast({
        title: "Error",
        description: "Error inesperado",
        variant: "destructive",
      })
    }
  }

  const handleRevoke = async (permission: MarketCreatorPermission) => {
    try {
      const result = await revokeCreatorPermission(permission.id)
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Permisos revocados correctamente",
        })
        loadPermissions()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al revocar permisos",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error revocando permisos:', error)
      toast({
        title: "Error",
        description: "Error inesperado",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedPermission) return

    try {
      const result = await deleteCreatorPermission(selectedPermission.id)
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Permisos eliminados correctamente",
        })
        setDeleteDialogOpen(false)
        setSelectedPermission(null)
        loadPermissions()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al eliminar permisos",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error eliminando permisos:', error)
      toast({
        title: "Error",
        description: "Error inesperado",
        variant: "destructive",
      })
    }
  }

  const filteredPermissions = permissions.filter(p => {
    const search = searchTerm.toLowerCase()
    return (
      p.user_name?.toLowerCase().includes(search) ||
      p.user_email?.toLowerCase().includes(search) ||
      p.id.toLowerCase().includes(search)
    )
  })

  const activePermissions = filteredPermissions.filter(p => p.is_active)
  const inactivePermissions = filteredPermissions.filter(p => !p.is_active)

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <LoadingSpinner message="Cargando permisos..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permisos de Mercados de Predicción</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona quién puede crear mercados de predicción en la plataforma
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <UserPlus className="mr-2 h-4 w-4" />
          Otorgar Permisos
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Permisos Activos</CardTitle>
              <CardDescription>
                Usuarios que pueden crear mercados de predicción
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={loadPermissions}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Límites</TableHead>
                <TableHead>Estadísticas</TableHead>
                <TableHead>Expiración</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activePermissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay permisos activos
                  </TableCell>
                </TableRow>
              ) : (
                activePermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{permission.user_name}</div>
                        <div className="text-sm text-muted-foreground">{permission.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Activos: {permission.max_active_markets}</div>
                        <div>Diarios: {permission.max_daily_markets}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        Creados: {permission.total_markets_created}
                      </div>
                    </TableCell>
                    <TableCell>
                      {permission.expires_at ? (
                        <div className="text-sm">
                          {new Date(permission.expires_at).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin expiración</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Activo
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(permission)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(permission)}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {inactivePermissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Permisos Revocados</CardTitle>
            <CardDescription>
              Usuarios que ya no pueden crear mercados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Revocado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactivePermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{permission.user_name}</div>
                        <div className="text-sm text-muted-foreground">{permission.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(permission.updated_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedPermission(permission)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog para crear/editar permisos */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPermission ? "Editar Permisos" : "Otorgar Permisos"}
            </DialogTitle>
            <DialogDescription>
              {selectedPermission 
                ? "Actualiza los límites y configuración de los permisos"
                : "Selecciona un usuario y configura sus permisos para crear mercados"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedPermission && (
              <div className="space-y-2">
                <Label>Buscar Usuario</Label>
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={formData.user_search || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, user_search: e.target.value })
                    searchUsers(e.target.value)
                  }}
                />
                {loadingUsers && (
                  <p className="text-sm text-muted-foreground">Buscando...</p>
                )}
                {users.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="p-2 hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setFormData({ ...formData, user_id: user.id, user_search: user.name })
                          setUsers([])
                        }}
                      >
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máximo de Mercados Activos</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_active_markets}
                  onChange={(e) => setFormData({ ...formData, max_active_markets: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo de Mercados Diarios</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_daily_markets}
                  onChange={(e) => setFormData({ ...formData, max_daily_markets: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Expiración (opcional)</Label>
              <Input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {selectedPermission ? "Actualizar" : "Otorgar Permisos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Permisos</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar permanentemente estos permisos? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

