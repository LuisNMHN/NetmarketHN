"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CreateReviewModal } from "@/components/reputation/CreateReviewModal"
import { supabaseBrowser } from "@/lib/supabase/client"

export default function ReviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewData, setReviewData] = useState<{
    reviewedUserId: string
    reviewedUserName: string
    transactionId?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const transactionId = searchParams.get('transaction_id')
    const reviewedUserId = searchParams.get('reviewed_user_id')
    const role = searchParams.get('role') // 'buyer' o 'seller'

    if (!transactionId || !reviewedUserId) {
      // Redirigir si faltan parámetros
      router.push('/dashboard/mis-solicitudes')
      return
    }

    // Cargar información del usuario a calificar y de la transacción
    const loadReviewData = async () => {
      try {
        setLoading(true)
        const supabase = supabaseBrowser()

        // Obtener información del usuario a calificar
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', reviewedUserId)
          .single()

        if (userError || !userData) {
          console.error('Error cargando usuario:', userError)
          router.push('/dashboard/mis-solicitudes')
          return
        }

        // Obtener información de la transacción para contexto
        const { data: transactionData, error: transactionError } = await supabase
          .from('purchase_transactions')
          .select('id, request_id')
          .eq('id', transactionId)
          .single()

        if (transactionError || !transactionData) {
          console.error('Error cargando transacción:', transactionError)
          router.push('/dashboard/mis-solicitudes')
          return
        }

        setReviewData({
          reviewedUserId: userData.id,
          reviewedUserName: userData.full_name || 'Usuario',
          transactionId: transactionData.id
        })

        // Abrir el modal automáticamente
        setReviewModalOpen(true)
      } catch (error) {
        console.error('Error cargando datos para calificación:', error)
        router.push('/dashboard/mis-solicitudes')
      } finally {
        setLoading(false)
      }
    }

    loadReviewData()
  }, [mounted, searchParams, router])

  const handleCloseModal = () => {
    setReviewModalOpen(false)
    // Redirigir a mis solicitudes después de cerrar
    router.push('/dashboard/mis-solicitudes')
  }

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!reviewData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">No se pudo cargar la información para calificar</p>
        </div>
      </div>
    )
  }

  return (
    <CreateReviewModal
      isOpen={reviewModalOpen}
      onClose={handleCloseModal}
      reviewedUserId={reviewData.reviewedUserId}
      reviewedUserName={reviewData.reviewedUserName}
      transactionId={reviewData.transactionId}
      contextType="transaction"
    />
  )
}

