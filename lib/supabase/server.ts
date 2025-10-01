import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function supabaseServer() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {}
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: "", ...options })
        } catch {}
      },
    },
  })
}

// Cliente de Supabase con permisos de administrador para operaciones del servidor
export async function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY no está configurada. Usando cliente normal.')
    return supabaseServer()
  }

  return createServerClient(url, serviceRoleKey, {
    cookies: {
      get() { return undefined },
      set() {},
      remove() {},
    },
  })
}

export default supabaseServer


