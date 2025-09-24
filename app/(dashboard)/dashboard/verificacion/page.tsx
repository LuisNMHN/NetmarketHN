import { getKycDraft } from "@/app/actions/kyc_data"
import VerificacionClient from "./VerificacionClient"

export default async function VerificacionPage() {
  let initialDraft = null as any
  try {
    const result = await getKycDraft()
    initialDraft = result.ok ? (result.data as any) : null
  } catch {
    initialDraft = null
  }
	return <VerificacionClient initialDraft={initialDraft} />
}


