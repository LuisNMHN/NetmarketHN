"use server"

import { supabaseServer } from "@/lib/supabaseServer"
import type { KycDraft, KycStatus } from "@/lib/contracts/types"
import { revalidatePath } from "next/cache"

type KycFileKind = "document_front" | "document_back" | "selfie" | "address_proof"

interface ActionResult<T = unknown> {
  ok: boolean
  message: string
  data?: T
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

export async function getKycDraft(): Promise<
  ActionResult<
    (KycDraft & {
      status: KycStatus
      documentFrontPath?: string | null
      documentBackPath?: string | null
      selfiePath?: string | null
      addressProofPath?: string | null
      department?: string | null
      municipality?: string | null
      neighborhood?: string | null
      addressDesc?: string | null
    }) | null
  >
> {
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  const userId = user?.id
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  const { data: row, error } = await supabase
    .from("kyc_submissions")
    .select(
      "full_name, birth_date, country, doc_type, doc_number, status, document_front_path, document_back_path, selfie_path, address_proof_path, updated_at, address_department, address_city, address_neighborhood, address_desc",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, message: "No se pudo leer tu borrador de verificación." }
  if (!row)
    return {
      ok: true,
      message: "Sin datos de verificación",
      data: null,
    }

  return {
    ok: true,
    message: "Borrador cargado",
    data: {
      fullName: row.full_name || "",
      birthDate: row.birth_date || "",
      country: row.country || "",
      docType: (row.doc_type as any) || "ID",
      docNumber: row.doc_number || "",
      status: (row.status as KycStatus) || "none",
      documentFrontPath: row.document_front_path || null,
      documentBackPath: row.document_back_path || null,
      selfiePath: row.selfie_path || null,
      addressProofPath: row.address_proof_path || null,
      department: row.address_department || null,
      municipality: row.address_city || null,
      neighborhood: row.address_neighborhood || null,
      addressDesc: row.address_desc || null,
    },
  }
}

export async function saveKycDraft(
  payload: KycDraft & {
    department?: string
    municipality?: string
    neighborhood?: string
    addressDesc?: string
  },
): Promise<ActionResult> {
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  const userId = user?.id
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  // Normaliza el tipo de documento a los valores aceptados por la BD
  const mapDoc: Record<string, string> = {
    DNI: "DNI",
    Pasaporte: "Pasaporte",
    Licencia: "Licencia",
    Cédula: "Cédula",
    Cedula: "Cédula",
    ID: "ID",
    Passport: "Passport",
    license: "license",
  }
  const tipoDocDB = mapDoc[(payload as any)?.tipo_doc ?? payload.docType ?? ""] ?? payload.docType

  const row = {
    user_id: userId,
    full_name: payload.fullName,
    birth_date: payload.birthDate,
    country: payload.country,
    doc_type: tipoDocDB,
    doc_number: payload.docNumber,
    address_department: payload.department || null,
    address_city: payload.municipality || null,
    address_neighborhood: payload.neighborhood || null,
    address_desc: payload.addressDesc || null,
    status: "draft" as const,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("kyc_submissions").upsert(row, { onConflict: "user_id" })
  if (error) return { ok: false, message: "No se pudo guardar el borrador de verificación." }
  return { ok: true, message: "Borrador guardado correctamente" }
}

export async function uploadKycFile(
  file: File,
  kind: KycFileKind,
): Promise<ActionResult<{ path: string }>> {
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  const userId = user?.id
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  const bucket = "kyc"
  const ext = getFileExtensionFromMime((file as any)?.type)
  const path = `${userId}/${kind}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: (file as any)?.type })

  if (uploadError) return { ok: false, message: "No se pudo subir el archivo. Inténtalo de nuevo." }

  const columnMap: Record<KycFileKind, string> = {
    document_front: "document_front_path",
    document_back: "document_back_path",
    selfie: "selfie_path",
    address_proof: "address_proof_path",
  }
  const column = columnMap[kind]

  const { error: upsertError } = await supabase
    .from("kyc_submissions")
    .upsert(
      {
        user_id: userId,
        [column]: path,
        status: "draft",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

  if (upsertError) return { ok: false, message: "No se pudo registrar el archivo en tu verificación." }
  return { ok: true, message: "Archivo subido correctamente", data: { path } }
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

  // Leer último borrador
  const { data: row, error } = await supabase
    .from("kyc_submissions")
    .select(
      "full_name, birth_date, country, doc_type, doc_number, document_front_path, document_back_path, selfie_path, address_proof_path",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, message: "No se pudo validar tu verificación." }
  if (!row) return { ok: false, message: "No hay borrador para enviar." }

  const fieldsOk = Boolean(
    row.full_name && row.birth_date && row.country && row.doc_type && row.doc_number,
  )
  const filesOk = Boolean(
    row.document_front_path && row.document_back_path && row.selfie_path && row.address_proof_path,
  )

  if (!fieldsOk || !filesOk)
    return { ok: false, message: "Faltan datos o archivos para enviar la verificación." }

  const { error: updateError } = await supabase
    .from("kyc_submissions")
    .update({ status: "review", updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  if (updateError) return { ok: false, message: "No se pudo enviar la verificación." }
  return { ok: true, message: "Verificación enviada. Recibirás una respuesta en 24-48 h hábiles." }
}

export async function registerKycFilePath(
  kind: KycFileKind,
  path: string,
): Promise<ActionResult> {
  const supabase = await supabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) return { ok: false, message: "Error de autenticación. Inicia sesión nuevamente." }
  const userId = user?.id
  if (!userId) return { ok: false, message: "No hay sesión activa" }

  const columnMap: Record<KycFileKind, string> = {
    document_front: "document_front_path",
    document_back: "document_back_path",
    selfie: "selfie_path",
    address_proof: "address_proof_path",
  }
  const column = columnMap[kind]

  const { error } = await supabase
    .from("kyc_submissions")
    .upsert(
      {
        user_id: userId,
        [column]: path,
        status: "draft",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

  if (error) return { ok: false, message: "No se pudo registrar el archivo en tu verificación." }
  
  // Invalidar caché para refrescar la UI
  revalidatePath("/dashboard/verificacion")
  
  return { ok: true, message: "Archivo registrado" }
}


