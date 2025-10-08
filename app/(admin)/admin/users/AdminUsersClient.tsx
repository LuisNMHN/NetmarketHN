"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Edit, Trash2, Shield, ShieldOff } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "../_components/ConfirmDialog"
import { UserForm } from "../_forms/UserForm"
import { type AdminUser, createAdminUser, updateAdminUser, deleteAdminUser } from "@/app/actions/admin"
import { useToast } from "@/hooks/use-toast"
import { AuthSpinner } from "@/components/ui/auth-spinner"

interface AdminUsersClientProps {
  initialUsers: AdminUser[]
}

export default function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const handleCreate = async (userData: {
    name: string
    email: string
    phone: string
    roles: string[]
    status: "active" | "inactive"
  }) => {
    const result = await createAdminUser(userData)
    if (result.success) {
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente",
      })
      setIsCreateDialogOpen(false)
      // Recargar la página para obtener los datos actualizados
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo crear el usuario",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async (userData: {
    name?: string
    phone?: string
    roles?: string[]
    status?: "active" | "inactive"
  }) => {
    if (!selectedUser) return

    const result = await updateAdminUser(selectedUser.id, userData)
    if (result.success) {
      toast({
        title: "Usuario actualizado",
        description: "El usuario ha sido actualizado exitosamente",
      })
      setIsEditDialogOpen(false)
      // Recargar la página para obtener los datos actualizados
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo actualizar el usuario",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (userId: string) => {
    setIsDeleting(true)
    console.log(`🗑️ Iniciando eliminación del usuario: ${userId}`)
    
    try {
      const result = await deleteAdminUser(userId)
      if (result.success) {
        toast({
          title: "Usuario eliminado",
          description: "El usuario ha sido eliminado completamente de todas las tablas",
        })
        setIsDeleteDialogOpen(false)
        // Recargar la página para obtener los datos actualizados
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el usuario",
          variant: "destructive",
        })
        setIsDeleting(false)
      }
    } catch (error) {
      console.error('❌ Error eliminando usuario:', error)
      toast({
        title: "Error",
        description: "Error inesperado al eliminar el usuario",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      label: "Usuario",
      sortable: true,
      render: (user) => {
        const displayName = user.name || user.email || "Usuario";
        const initial = displayName.charAt(0).toUpperCase();
        
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary">
              <span className="text-sm font-semibold text-primary-foreground">
                {initial}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">{user.name || "Sin nombre"}</p>
              <p className="text-sm text-muted-foreground">{user.email || "Sin email"}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "phone",
      label: "Teléfono",
      sortable: true,
      render: (user) => user.phone || "No especificado",
    },
    {
      key: "roles",
      label: "Roles",
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <StatusBadge key={role} variant="info">
              {role === "admin" && "Administrador"}
              {role === "vendor" && "Vendedor"}
              {role === "user" && "Usuario"}
            </StatusBadge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      label: "Estado",
      sortable: true,
      render: (user) => (
        <StatusBadge variant={user.status === "active" ? "success" : "neutral"}>
          {user.status === "active" ? "Activo" : "Inactivo"}
        </StatusBadge>
      ),
    },
    {
      key: "created_at",
      label: "Fecha de Registro",
      sortable: true,
      render: (user) => new Date(user.created_at).toLocaleDateString("es-HN"),
    },
    {
      key: "actions",
      label: "Acciones",
      render: (user) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedUser(user)
              setIsEditDialogOpen(true)
            }}
          >
            <Edit className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedUser(user)
              setIsDeleteDialogOpen(true)
            }}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" title="Gestionar roles">
            {user.roles.includes("admin") ? <Shield className="size-4" /> : <ShieldOff className="size-4" />}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      {isDeleting && <AuthSpinner message="Eliminando usuario completamente..." />}
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Usuarios</h2>
          <p className="text-muted-foreground mt-2">Administra los usuarios del sistema</p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="size-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Registrados en el sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter((u) => u.status === "active").length}</div>
            <p className="text-xs text-muted-foreground mt-1">Con acceso al sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter((u) => u.roles.includes("vendor")).length}</div>
            <p className="text-xs text-muted-foreground mt-1">Usuarios con tienda</p>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>Todos los usuarios registrados en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={users}
            columns={columns}
            searchPlaceholder="Buscar usuarios..."
            emptyMessage="No se encontraron usuarios"
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>Completa los datos para crear un nuevo usuario en el sistema</DialogDescription>
          </DialogHeader>
          <UserForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modifica los datos del usuario seleccionado</DialogDescription>
          </DialogHeader>
          <UserForm
            initialData={selectedUser || undefined}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (selectedUser) handleDelete(selectedUser.id)
        }}
        title="Eliminar Usuario"
        description={`¿Estás seguro de que deseas eliminar a ${selectedUser?.name || selectedUser?.email}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="destructive"
      />
    </div>
    </>
  )
}
