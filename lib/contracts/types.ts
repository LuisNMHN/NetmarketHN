// Balance and wallet types
export interface BalanceDTO {
  total: number
  available: number
  blocked: number
}

// Transaction types
export interface TransactionDTO {
  id: string
  type: "deposit" | "withdrawal" | "payment" | "refund"
  amount: number
  status: "completed" | "pending" | "failed" | "cancelled"
  createdAt: Date
  description?: string
  currency?: string
  note?: string
}

// KYC types
export type KycStatus = "none" | "draft" | "review" | "approved" | "rejected"

export interface KycDraft {
  fullName: string
  birthDate: string
  country: string
  docType: "ID" | "Passport"
  docNumber: string
}
