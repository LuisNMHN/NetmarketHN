import { getKycDraft } from "@/app/actions/kyc_data"
import { redirect } from "next/navigation"
import EstadoVerificacionClient from "./EstadoVerificacionClient"

export default async function EstadoVerificacionPage() {
  let kycData = null
  
  try {
    const result = await getKycDraft()
    if (result.ok && result.data) {
      kycData = result.data
    }
  } catch (error) {
    console.error('Error loading KYC data:', error)
  }

  // Si no hay datos de KYC, redirigir a la página de verificación
  if (!kycData) {
    redirect('/dashboard/verificacion')
  }

  return <EstadoVerificacionClient kycData={kycData} />
}
