// Balance and wallet types
export interface BalanceDTO {
  total: number
  available: number
  blocked: number
}

// Payment link types
export interface PaymentLinkDTO {
  id?: string
  amount: number
  currency: "HNL" | "USD"
  concept: string
  status: "active" | "expired"
  createdAt?: string
  expiresAt?: string
  maxUses?: number
  url?: string
}

// Auction types
export type AuctionStatus = "active" | "closed" | "expired"
export type Currency = "USD" | "EUR" | "GBP" | "HNL"

export interface AuctionDTO {
  id: string
  title: string
  amount: number
  currency: Currency
  status: AuctionStatus
  createdAt: string
  expiresAt: string
  description?: string
  currentBid?: number
  bidCount?: number
}

// Bid types
export interface BidDTO {
  id: string
  auctionId: string
  userId: string
  amount: number
  createdAt: string
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
