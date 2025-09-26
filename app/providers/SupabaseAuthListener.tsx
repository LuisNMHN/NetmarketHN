"use client"

import { useEffect } from "react"
import { supabaseBrowser } from "@/lib/supabase/client"

export default function SupabaseAuthListener() {
  useEffect(() => {
    const supabase = supabaseBrowser()
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session }),
        })
      } catch {}
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  return null
}


