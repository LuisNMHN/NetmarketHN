import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { event, session } = body || {}

    console.log('🔍 Auth callback received:', { event, hasSession: !!session })

    // Callback habilitado - procesar eventos de autenticación

    const supabase = await supabaseServer()

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut()
      return NextResponse.json({ ok: true })
    }

    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })

        if (error) {
          console.error('❌ Error setting session:', error)
          
          // Si el usuario no existe, es un problema de sincronización
          if (error.message.includes('User from sub claim in JWT does not exist')) {
            console.log('🔄 Usuario no existe en auth.users, pero continuando...')
            // await supabase.auth.signOut() // Temporalmente deshabilitado
            return NextResponse.json({ ok: true, message: "Usuario no encontrado pero continuando" })
          }
          
          return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
        }

        console.log('✅ Session set successfully for user:', data.user?.email)
        return NextResponse.json({ ok: true, user: data.user })
      } catch (sessionError) {
        console.error('❌ Session error:', sessionError)
        return NextResponse.json({ ok: false, message: "Session error" }, { status: 400 })
      }
    }

    // Si no hay tokens de sesión, no es un error - puede ser un evento de confirmación
    if (event === "USER_UPDATED" || event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION") {
      return NextResponse.json({ ok: true })
    }

    console.log('⚠️ Unhandled auth event:', event)
    return NextResponse.json({ ok: false, message: "Unhandled auth event" }, { status: 400 })
  } catch (error: any) {
    console.error('❌ Auth callback error:', error)
    return NextResponse.json({ ok: false, message: error?.message || "Callback error" }, { status: 500 })
  }
}


