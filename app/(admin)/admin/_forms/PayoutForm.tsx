"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const payoutSchema = z.object({
  userId: z.string().min(1, "El ID de usuario es requerido"),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  currency: z.enum(["HNL", "USD"]),
  method: z.string().min(1, "El método de pago es requerido"),
  notes: z.string().optional(),
})

type PayoutFormData = z.infer<typeof payoutSchema>

interface PayoutFormProps {
  onSubmit: (data: PayoutFormData) => void
  onCancel: () => void
}

export function PayoutForm({ onSubmit, onCancel }: PayoutFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PayoutFormData>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      userId: "",
      amount: 0,
      currency: "HNL",
      method: "Transferencia Bancaria",
      notes: "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="userId">ID de Usuario</Label>
        <Input id="userId" placeholder="USR-123" {...register("userId")} />
        {errors.userId && <p className="text-sm text-destructive">{errors.userId.message}</p>}
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
        <Label htmlFor="method">Método de Pago</Label>
        <select
          id="method"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("method")}
        >
          <option value="Transferencia Bancaria">Transferencia Bancaria</option>
          <option value="PayPal">PayPal</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Otro">Otro</option>
        </select>
        {errors.method && <p className="text-sm text-destructive">{errors.method.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (Opcional)</Label>
        <Textarea id="notes" placeholder="Información adicional sobre el payout..." rows={3} {...register("notes")} />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Creando..." : "Crear Payout"}
        </Button>
      </div>
    </form>
  )
}
