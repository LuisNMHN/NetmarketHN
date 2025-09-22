"use client"

import { createBrowserClient } from "@supabase/ssr"

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    if (typeof window !== "undefined") {
      // Tip útil en consola para el dev
      console.warn(
        "[Supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
      )
    }
  }

  return createBrowserClient(url || "", anon || "")
}

export default supabaseBrowser


