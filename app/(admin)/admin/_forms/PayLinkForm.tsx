"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const payLinkSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  currency: z.enum(["HNL", "USD"]),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
  usageLimit: z.number().optional(),
  notes: z.string().optional(),
})

type PayLinkFormData = z.infer<typeof payLinkSchema>

interface PayLinkFormProps {
  initialData?: Partial<PayLinkFormData>
  onSubmit: (data: PayLinkFormData) => void
  onCancel: () => void
}

export function PayLinkForm({ initialData, onSubmit, onCancel }: PayLinkFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PayLinkFormData>({
    resolver: zodResolver(payLinkSchema),
    defaultValues: {
      title: initialData?.title || "",
      amount: initialData?.amount || 0,
      currency: initialData?.currency || "HNL",
      description: initialData?.description || "",
      expiresAt: initialData?.expiresAt ? new Date(initialData.expiresAt).toISOString().slice(0, 16) : "",
      usageLimit: initialData?.usageLimit || undefined,
      notes: initialData?.notes || "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" placeholder="Ej: Pago de Membresía" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("amount", { valueAsNumber: true })}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <select
            id="currency"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register("currency")}
          >
            <option value="HNL">HNL (Lempiras)</option>
            <option value="USD">USD (Dólares)</option>
          </select>
          {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          placeholder="Describe el propósito del link..."
          rows={3}
          {...register("description")}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expiresAt">Fecha de Expiración (Opcional)</Label>
          <Input id="expiresAt" type="datetime-local" {...register("expiresAt")} />
          {errors.expiresAt && <p className="text-sm text-destructive">{errors.expiresAt.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="usageLimit">Límite de Usos (Opcional)</Label>
          <Input
            id="usageLimit"
            type="number"
            placeholder="Sin límite"
            {...register("usageLimit", { valueAsNumber: true })}
          />
          {errors.usageLimit && <p className="text-sm text-destructive">{errors.usageLimit.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas Internas (Opcional)</Label>
        <Textarea id="notes" placeholder="Notas para uso interno..." rows={2} {...register("notes")} />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Link"}
        </Button>
      </div>
    </form>
  )
}
