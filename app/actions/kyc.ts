"use server"

import { supabaseServer } from "@/lib/supabase/server"
import type { KycDraft } from "@/lib/contracts/types"
import { revalidatePath } from "next/cache"

type KycFileKind = "document_front" | "document_back" | "selfie" | "address_proof"

export interface ActionResult<T = unknown> {
  ok: boolean
  message: string
  data?: T
}

async function getLatestSubmissionId(supabase: any, userId: string): Promise<string | null> {
  // Busca la fila más reciente para este usuario, tolerando ausencia de updated_at
  let id: string | null = null
  let selectError: any = null
  const { data: row, error } = await supabase
    .from("kyc_submissions")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!error && row?.id) return row.id as string
  selectError = error

  // Fallback sin order(updated_at) por si no existe la columna
  const { data: row2, error: error2 } = await supabase
    .from("kyc_submissions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (!error2 && row2?.id) id = row2.id as string
  return id
}

function getFileExtensionFromMime(mimeType: string | undefined): string {
  if (!mimeType) return "bin"
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
  }
  return map[mimeType] || "bin"
}

export async function saveKycDraft(draft: KycDraft): Promise<ActionResult> {
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  const userId = user?.id
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  const payload = {
    user_id: userId,
    full_name: draft.fullName,
    birth_date: draft.birthDate,
    country: draft.country,
    doc_type: draft.docType,
    doc_number: draft.docNumber,
    status: "draft" as const,
    updated_at: new Date().toISOString(),
  }

  // Seleccionar la fila más reciente y actualizar; si no existe, insertar
  const latestId = await getLatestSubmissionId(supabase, userId)
  if (latestId) {
    const { error: updateError } = await supabase.from("kyc_submissions").update(payload).eq("id", latestId)
    if (updateError) return { ok: false, message: "No se pudo actualizar el borrador de verificación." }
  } else {
    const { error: insertError } = await supabase
      .from("kyc_submissions")
      .insert(payload)

    if (insertError) return { ok: false, message: "No se pudo guardar el borrador de verificación." }
  }

  return { ok: true, message: "Borrador guardado correctamente" }
}

export async function uploadKycFile(
  file: File,
  kind: KycFileKind,
): Promise<ActionResult<{ url: string }>> {
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  const userId = user?.id
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_KYC_BUCKET || "kyc"

  const ext = getFileExtensionFromMime((file as any)?.type)
  const path = `${userId}/${kind}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: (file as any)?.type })

  if (uploadError) return { ok: false, message: "No se pudo subir el archivo. Inténtalo de nuevo." }

  const columnMap: Record<KycFileKind, string> = {
    document_front: "document_front_url",
    document_back: "document_back_url",
    selfie: "selfie_url",
    address_proof: "address_proof_url",
  }

  const column = columnMap[kind]

  // Obtener URL pública si el bucket es público; si no, guardamos la ruta
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
  const storedValue = pub?.publicUrl || path

  // Seleccionar la fila más reciente y actualizar; si no existe, insertar
  const latestId = await getLatestSubmissionId(supabase, userId)
  if (latestId) {
    const { error: updateError } = await supabase
      .from("kyc_submissions")
      .update({ [column]: storedValue, status: "draft", updated_at: new Date().toISOString() })
      .eq("id", latestId)

    if (updateError) return { ok: false, message: "No se pudo actualizar el archivo en tu verificación." }
  } else {
    const { error: insertError } = await supabase
      .from("kyc_submissions")
      .insert({ user_id: userId, [column]: storedValue, status: "draft", updated_at: new Date().toISOString() })

    if (insertError) return { ok: false, message: "No se pudo registrar el archivo en tu verificación." }
  }

  return { ok: true, message: "Archivo subido correctamente", data: { url: storedValue } }
}

export async function submitKyc(): Promise<ActionResult> {
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  const userId = user?.id
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  const latestId = await getLatestSubmissionId(supabase, userId)
  if (!latestId) return { ok: false, message: "No se encontró tu borrador para enviar." }
  const { error } = await supabase
    .from("kyc_submissions")
    .update({ status: "review", updated_at: new Date().toISOString() })
    .eq("id", latestId)

  if (error) return { ok: false, message: "No se pudo enviar la verificación." }
  return { ok: true, message: "Verificación enviada. Recibirás una respuesta en 24-48 h hábiles." }
}

export async function removeKycFile(kind: KycFileKind): Promise<ActionResult> {
  console.log("🔧 [SERVER] removeKycFile llamado con kind:", kind)
  
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()
  
  console.log("🔐 [SERVER] Auth result:", { user: user?.id, authError })
  
  if (authError) {
    console.error("❌ [SERVER] Error de autenticación:", authError)
    return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  }
  
  const userId = user?.id
  console.log("👤 [SERVER] Usuario ID:", userId)
  
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_KYC_BUCKET || "kyc"

  const columnMap: Record<KycFileKind, string> = {
    document_front: "document_front_path",
    document_back: "document_back_path",
    selfie: "selfie_path",
    address_proof: "address_proof_path",
  }
  const column = columnMap[kind]

  // Obtener la URL/ruta actual del archivo y el ID del registro
  console.log("🔍 [SERVER] Buscando registro en BD para columna:", column)
  const { data: row, error: fetchError } = await supabase
    .from("kyc_submissions")
    .select(`id, ${column}`)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log("📊 [SERVER] Resultado de búsqueda:", { row, fetchError })

  if (fetchError) {
    console.error("❌ [SERVER] Error al buscar en BD:", fetchError)
    return { ok: false, message: "No se pudo acceder a tus datos de verificación." }
  }
  if (!row) {
    console.warn("⚠️ [SERVER] No se encontró registro para el usuario")
    return { ok: false, message: "No se encontró tu borrador para actualizar." }
  }

  const currentValue = row[column] as string | undefined
  const recordId = row.id
  console.log("📁 [SERVER] Archivo encontrado:", { currentValue, recordId })

  // Nota: La eliminación del storage se maneja desde el cliente
  console.log("ℹ️ [SERVER] Eliminación de storage manejada desde el cliente")

  // 2) Eliminar/marcar como null en la base de datos
  console.log("💾 [SERVER] Actualizando BD, recordId:", recordId, "columna:", column)
  const { error: updateError } = await supabase
    .from("kyc_submissions")
    .update({ 
      [column]: null, 
      status: "draft", 
      updated_at: new Date().toISOString() 
    })
    .eq("id", recordId)

  console.log("📊 [SERVER] Resultado de actualización BD:", { updateError })

  if (updateError) {
    console.error("❌ [SERVER] Error al actualizar BD:", updateError)
    return { 
      ok: false, 
      message: "Se eliminó del storage pero falló la actualización en base de datos. Inténtalo de nuevo." 
    }
  }

  console.log("🔄 [SERVER] Invalidando caché...")
  // Invalidar caché para refrescar la UI
  revalidatePath("/dashboard/verificacion")

  console.log("🎉 [SERVER] Eliminación completada exitosamente")
  return { ok: true, message: "Archivo eliminado correctamente del storage y base de datos" }
}



