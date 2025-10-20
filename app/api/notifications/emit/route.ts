import { NextRequest, NextResponse } from "next/server"
import { emitNotification } from "@/lib/notifications/emitter"
import { supabaseServer } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validar que el usuario solo puede emitir notificaciones para sí mismo
    // (en producción, esto podría ser más flexible según roles)
    if (body.user_id && body.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para emitir notificaciones a otros usuarios' },
        { status: 403 }
      )
    }

    // Usar el ID del usuario autenticado si no se proporciona
    const payload = {
      ...body,
      user_id: body.user_id || user.id
    }

    const result = await emitNotification(payload)
    
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error en API de notificaciones:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}


