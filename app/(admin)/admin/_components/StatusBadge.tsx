import type React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusVariant = "success" | "warning" | "danger" | "neutral" | "info"

interface StatusBadgeProps {
  variant: StatusVariant
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  const variantStyles = {
    success:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    warning:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    neutral:
      "bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
  }

  return (
    <Badge variant="outline" className={cn("border", variantStyles[variant], className)}>
      {children}
    </Badge>
  )
}
