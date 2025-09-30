"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const auctionSchema = z
  .object({
    title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
    description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
    basePrice: z.number().min(1, "El precio base debe ser mayor a 0"),
    startDate: z.string().min(1, "La fecha de inicio es requerida"),
    endDate: z.string().min(1, "La fecha de fin es requerida"),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "La fecha de fin debe ser posterior a la fecha de inicio",
    path: ["endDate"],
  })

type AuctionFormData = z.infer<typeof auctionSchema>

interface AuctionFormProps {
  initialData?: Partial<AuctionFormData>
  onSubmit: (data: AuctionFormData) => void
  onCancel: () => void
}

export function AuctionForm({ initialData, onSubmit, onCancel }: AuctionFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuctionFormData>({
    resolver: zodResolver(auctionSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      basePrice: initialData?.basePrice || 0,
      startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().slice(0, 16) : "",
      endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().slice(0, 16) : "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" placeholder="Ej: iPhone 15 Pro Max" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          placeholder="Describe el artículo en subasta..."
          rows={4}
          {...register("description")}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="basePrice">Precio Base (HNL)</Label>
        <Input
          id="basePrice"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register("basePrice", { valueAsNumber: true })}
        />
        {errors.basePrice && <p className="text-sm text-destructive">{errors.basePrice.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Fecha y Hora de Inicio</Label>
          <Input id="startDate" type="datetime-local" {...register("startDate")} />
          {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">Fecha y Hora de Fin</Label>
          <Input id="endDate" type="datetime-local" {...register("endDate")} />
          {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Imágenes del Producto</Label>
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">TODO: Implementar uploader de imágenes</p>
          <p className="text-xs text-muted-foreground mt-1">Arrastra archivos aquí o haz clic para seleccionar</p>
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Subasta"}
        </Button>
      </div>
    </form>
  )
}
