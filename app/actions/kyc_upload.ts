'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function uploadKyc({
  userId,
  docType,
  file,          // debe llegarte como Blob desde un formData en el cliente
  fileName,      // ej: 'documento_frontal.png'
  contentType,   // ej: 'image/png'
}: {
  userId: string
  docType: string
  file: Blob
  fileName: string
  contentType: string
}) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      cookies: { 
        get: (k) => cookieStore.get(k)?.value,
        set: (name, value, options) => {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {}
        },
        remove: (name, options) => {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {}
        }
      } 
    }
  )

  const safeDoc = docType.replace(/\s+/g, '_').toLowerCase()
  const path = `${userId}/${safeDoc}/${fileName}`

  console.log('SERVER UPLOAD:', { path, contentType, size: file.size })

  const { error } = await supabase.storage.from('kyc').upload(path, file, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  })

  if (error) {
    console.error('SERVER UPLOAD ERROR:', error)
    return { ok: false, error: error.message }
  }

  // Actualiza/crea registro en BD si aplica
  const columnMap: Record<string, string> = {
    document_front: "document_front_path",
    document_back: "document_back_path",
    selfie: "selfie_path",
    address_proof: "address_proof_path",
  }
  const column = columnMap[safeDoc]

  if (column) {
    const { error: dbError } = await supabase
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

    if (dbError) {
      console.error('SERVER DB ERROR:', dbError)
      return { ok: false, error: "Error actualizando base de datos" }
    }
  }

  return { ok: true, path }
}


