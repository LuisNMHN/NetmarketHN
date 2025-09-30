"use client"

import { useState } from "react"
import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  from?: Date
  to?: Date
  onSelect: (from: Date | undefined, to: Date | undefined) => void
}

export function DateRangePicker({ from, to, onSelect }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const formatDate = (date: Date | undefined) => {
    if (!date) return ""
    return date.toLocaleDateString("es-HN", { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal gap-2", !from && "text-muted-foreground")}
        >
          <Calendar className="size-4" />
          {from ? (
            to ? (
              <>
                {formatDate(from)} - {formatDate(to)}
              </>
            ) : (
              formatDate(from)
            )
          ) : (
            <span>Seleccionar rango de fechas</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha inicial</label>
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={from ? from.toISOString().split("T")[0] : ""}
              onChange={(e) => onSelect(e.target.value ? new Date(e.target.value) : undefined, to)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha final</label>
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={to ? to.toISOString().split("T")[0] : ""}
              onChange={(e) => onSelect(from, e.target.value ? new Date(e.target.value) : undefined)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onSelect(undefined, undefined)
                setIsOpen(false)
              }}
            >
              Limpiar
            </Button>
            <Button size="sm" onClick={() => setIsOpen(false)}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
