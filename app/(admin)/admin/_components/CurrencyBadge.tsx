import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CurrencyBadgeProps {
  currency: string
  className?: string
}

export function CurrencyBadge({ currency, className }: CurrencyBadgeProps) {
  const currencyColors: Record<string, string> = {
    HNL: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800",
    USD: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-mono text-xs",
        currencyColors[currency] || "bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-400",
        className,
      )}
    >
      {currency}
    </Badge>
  )
}
