import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { event, session } = body || {}

    const supabase = await supabaseServer()

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut()
      return NextResponse.json({ ok: true })
    }

    if (session?.access_token && session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, message: "Missing session tokens" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || "Callback error" }, { status: 500 })
  }
}


