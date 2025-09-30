"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const walletAdjustSchema = z.object({
  type: z.enum(["credit", "debit"]),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  currency: z.enum(["HNL", "USD"]),
  reason: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
  reference: z.string().optional(),
})

type WalletAdjustFormData = z.infer<typeof walletAdjustSchema>

interface WalletAdjustFormProps {
  userId: string
  userName: string
  currentBalance: number
  onSubmit: (data: WalletAdjustFormData) => void
  onCancel: () => void
}

export function WalletAdjustForm({ userId, userName, currentBalance, onSubmit, onCancel }: WalletAdjustFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WalletAdjustFormData>({
    resolver: zodResolver(walletAdjustSchema),
    defaultValues: {
      type: "credit",
      amount: 0,
      currency: "HNL",
      reason: "",
      reference: "",
    },
  })

  const type = watch("type")
  const amount = watch("amount")

  const newBalance = type === "credit" ? currentBalance + amount : currentBalance - amount

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Usuario:</span>
          <span className="font-medium">{userName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Saldo Actual:</span>
          <span className="font-mono font-semibold">L {currentBalance.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Nuevo Saldo:</span>
          <span className={`font-mono font-semibold ${newBalance < 0 ? "text-destructive" : ""}`}>
            L {newBalance.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Tipo de Movimiento</Label>
        <select
          id="type"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("type")}
        >
          <option value="credit">Crédito (Agregar fondos)</option>
          <option value="debit">Débito (Restar fondos)</option>
        </select>
        {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
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
        <Label htmlFor="reason">Motivo / Nota</Label>
        <Textarea id="reason" placeholder="Describe el motivo del ajuste..." rows={3} {...register("reason")} />
        {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reference">Referencia (Opcional)</Label>
        <Input id="reference" placeholder="Ej: TXN-12345" {...register("reference")} />
        {errors.reference && <p className="text-sm text-destructive">{errors.reference.message}</p>}
      </div>

      {newBalance < 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive font-medium">
            Advertencia: Este ajuste resultará en un saldo negativo
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Procesando..." : "Confirmar Ajuste"}
        </Button>
      </div>
    </form>
  )
}
