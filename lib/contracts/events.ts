import type { BalanceDTO, AuctionDTO, TransactionDTO, KycDraft, BidDTO } from "./types"

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

const mockAuctions: AuctionDTO[] = [
  {
    id: "AU001",
    title: "Subasta de ejemplo 1",
    amount: 100.0,
    currency: "USD",
    status: "active",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    description: "Esta es una subasta de ejemplo",
    currentBid: 120.0,
    bidCount: 3,
  },
  {
    id: "AU002",
    title: "Subasta de ejemplo 2",
    amount: 250.0,
    currency: "USD",
    status: "active",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    description: "Otra subasta de ejemplo",
    currentBid: 275.0,
    bidCount: 5,
  },
]

// Mock bids store
const mockBidsByAuctionId: Record<string, BidDTO[]> = {
  AU001: [
    {
      id: "BID-1",
      auctionId: "AU001",
      userId: "USR-1001",
      amount: 110,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "BID-2",
      auctionId: "AU001",
      userId: "USR-1022",
      amount: 120,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
  AU002: [],
}

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

// Auction operations
export const onLoadAuctions = async (): Promise<AuctionDTO[]> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 400))
  return mockAuctions
}

export const onCreateAuction = async (
  auctionData: Omit<AuctionDTO, "id" | "createdAt" | "status" | "currentBid" | "bidCount">,
): Promise<AuctionDTO> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 600))

  const newAuction: AuctionDTO = {
    id: `AU${String(mockAuctions.length + 1).padStart(3, "0")}`,
    ...auctionData,
    status: "active",
    createdAt: new Date().toISOString(),
    currentBid: auctionData.amount,
    bidCount: 0,
  }

  mockAuctions.unshift(newAuction)
  return newAuction
}

export const onLoadAuction = async (auctionId: string): Promise<AuctionDTO> => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const found = mockAuctions.find((a) => a.id === auctionId)
  if (!found) {
    throw new Error("Auction not found")
  }
  return found
}

export const onLoadBids = async (auctionId: string): Promise<BidDTO[]> => {
  await new Promise((resolve) => setTimeout(resolve, 250))
  return (mockBidsByAuctionId[auctionId] || []).slice().sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
}

export const onEditAuction = async (
  auctionId: string,
  data: { title: string; amount: number; currency: AuctionDTO["currency"]; expiresAt: Date; description?: string },
): Promise<AuctionDTO> => {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const index = mockAuctions.findIndex((a) => a.id === auctionId)
  if (index === -1) {
    throw new Error("Auction not found")
  }
  const updated: AuctionDTO = {
    ...mockAuctions[index],
    title: data.title,
    amount: data.amount,
    currency: data.currency,
    expiresAt: data.expiresAt.toISOString(),
    description: data.description,
  }
  mockAuctions[index] = updated
  return updated
}

export const onCloseAuction = async (auctionId: string): Promise<AuctionDTO> => {
  await new Promise((resolve) => setTimeout(resolve, 400))
  const index = mockAuctions.findIndex((a) => a.id === auctionId)
  if (index === -1) {
    throw new Error("Auction not found")
  }
  const closed: AuctionDTO = { ...mockAuctions[index], status: "closed" }
  mockAuctions[index] = closed
  return closed
}

export const onBidAuction = async (auctionId: string, amount: number): Promise<BidDTO> => {
  await new Promise((resolve) => setTimeout(resolve, 450))
  const auction = mockAuctions.find((a) => a.id === auctionId)
  if (!auction) {
    throw new Error("Auction not found")
  }
  const bid: BidDTO = {
    id: `BID-${Math.random().toString(36).slice(2, 8)}`,
    auctionId,
    userId: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
    amount,
    createdAt: new Date().toISOString(),
  }
  mockBidsByAuctionId[auctionId] = [bid, ...(mockBidsByAuctionId[auctionId] || [])]
  auction.currentBid = amount
  auction.bidCount = (auction.bidCount || 0) + 1
  return bid
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
