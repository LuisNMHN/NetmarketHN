"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const userSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(8, "Teléfono inválido"),
  roles: z.array(z.string()).min(1, "Selecciona al menos un rol"),
  status: z.enum(["active", "inactive"]),
})

type UserFormData = z.infer<typeof userSchema>

interface UserFormProps {
  initialData?: Partial<UserFormData>
  onSubmit: (data: UserFormData) => void
  onCancel: () => void
}

const availableRoles = [
  { id: "user", label: "Usuario" },
  { id: "vendor", label: "Vendedor" },
  { id: "admin", label: "Administrador" },
]

export function UserForm({ initialData, onSubmit, onCancel }: UserFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      roles: initialData?.roles || ["user"],
      status: initialData?.status || "active",
    },
  })

  const selectedRoles = watch("roles")

  const toggleRole = (roleId: string) => {
    const newRoles = selectedRoles.includes(roleId)
      ? selectedRoles.filter((r) => r !== roleId)
      : [...selectedRoles, roleId]
    setValue("roles", newRoles)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre completo</Label>
        <Input id="name" placeholder="Ej: Juan Pérez" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" type="email" placeholder="usuario@ejemplo.com" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" placeholder="+504 9999-9999" {...register("phone")} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Roles</Label>
        <div className="space-y-2">
          {availableRoles.map((role) => (
            <div key={role.id} className="flex items-center gap-2">
              <Checkbox
                id={role.id}
                checked={selectedRoles.includes(role.id)}
                onCheckedChange={() => toggleRole(role.id)}
              />
              <Label htmlFor={role.id} className="font-normal cursor-pointer">
                {role.label}
              </Label>
            </div>
          ))}
        </div>
        {errors.roles && <p className="text-sm text-destructive">{errors.roles.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Estado</Label>
        <select
          id="status"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("status")}
        >
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Usuario"}
        </Button>
      </div>
    </form>
  )
}
