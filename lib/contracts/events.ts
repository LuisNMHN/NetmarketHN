import type { BalanceDTO, TransactionDTO, KycDraft } from "./types"

// Mock data for development
const mockBalance: BalanceDTO = {
  total: 2847.5,
  available: 2547.5,
  blocked: 300.0,
}

const mockTransactions: TransactionDTO[] = [
  {
    id: "tx-1",
    type: "deposit",
    amount: 500.0,
    status: "completed",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    description: "Depósito inicial",
    currency: "USD",
    note: "Transferencia bancaria",
  },
  {
    id: "tx-2",
    type: "withdrawal",
    amount: -150.0,
    status: "completed",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    description: "Retiro a cuenta personal",
    currency: "USD",
    note: "Cuenta terminada en 1234",
  },
]

// Balance operations
export const onLoadBalance = async (): Promise<BalanceDTO> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))
  return mockBalance
}

// Transaction operations
export const onLoadTransactions = async (): Promise<TransactionDTO[]> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))
  return mockTransactions
}

// Profile operations
export const onUpdateProfile = async (profileData: {
  name: string
  phone: string
  theme: string
  avatar: string
}): Promise<void> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800))
  // In a real app, this would update the user profile
  console.log("Profile updated:", profileData)
}

export const onUploadAvatar = async (file: File): Promise<string> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1200))
  // In a real app, this would upload the file and return the URL
  return `/placeholder.svg?height=100&width=100&query=avatar`
}

// KYC operations
export const onSaveKycDraft = async (draft: KycDraft): Promise<void> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))
  console.log("KYC draft saved:", draft)
}

export const onSubmitKyc = async (draft: KycDraft): Promise<void> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000))
  console.log("KYC submitted:", draft)
}
