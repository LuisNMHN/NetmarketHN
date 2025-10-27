// =========================================================
// TIPOS PARA SOLICITUDES DE COMPRA (CLIENTE)
// =========================================================
// Este archivo contiene solo los tipos, sin lógica del servidor
// =========================================================

export interface PurchaseRequest {
  id: string
  user_id: string
  title: string
  description: string
  amount: number
  currency: string
  exchange_rate: number
  amount_hnld: number
  payment_method: string
  payment_details?: any
  status: 'active' | 'accepted' | 'completed' | 'cancelled' | 'expired'
  expires_at?: string
  created_at: string
  updated_at: string
  // Campos relacionados
  user?: {
    id: string
    full_name: string
    avatar_url?: string
  }
  accepted_by?: string
  accepted_at?: string
  completed_at?: string
  cancelled_at?: string
  cancelled_reason?: string
}

export interface CreatePurchaseRequestData {
  title: string
  description: string
  amount: number
  currency: string
  payment_method: string
  payment_details?: any
  expires_at?: string
}

export interface UpdatePurchaseRequestData {
  title?: string
  description?: string
  amount?: number
  currency?: string
  payment_method?: string
  payment_details?: any
  expires_at?: string
}

export interface PurchaseRequestFilters {
  status?: string
  currency?: string
  payment_method?: string
  min_amount?: number
  max_amount?: number
  user_id?: string
  search?: string
}

export interface PurchaseRequestStats {
  total: number
  active: number
  accepted: number
  completed: number
  cancelled: number
  expired: number
  total_amount: number
  total_amount_hnld: number
}
