import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Función para formatear cantidades con separadores de miles
export function formatCurrency(amount: number, currency: string = 'L'): string {
  // Formatear el número con separadores de miles
  const formattedAmount = amount.toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  
  // HNLD no lleva punto y va separado de la cantidad por un espacio
  if (currency === 'HNLD') {
    return `HNLD ${formattedAmount}`
  }
  return `${currency}.${formattedAmount}`
}

// Función para formatear cantidades sin símbolo de moneda
export function formatAmount(amount: number): string {
  return amount.toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}
