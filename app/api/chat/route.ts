import { NextRequest, NextResponse } from "next/server"
import { chatService } from "@/lib/chat/service"
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
    const { action, ...params } = body

    switch (action) {
      case 'open_thread':
        const thread = await chatService.openOrGetThread({
          contextType: params.contextType,
          contextId: params.contextId,
          partyA: params.partyA,
          partyB: params.partyB,
          contextTitle: params.contextTitle,
          contextData: params.contextData,
          supportUserId: params.supportUserId
        })
        return NextResponse.json({ success: true, data: thread })

      case 'send_message':
        console.log('📨 API Chat - send_message recibido:', {
          threadId: params.threadId,
          senderId: user.id,
          bodyLength: params.body?.length,
          kind: params.kind
        })
        const message = await chatService.sendMessage({
          threadId: params.threadId,
          senderId: user.id,
          body: params.body,
          kind: params.kind,
          metadata: params.metadata
        })
        console.log('✅ API Chat - Mensaje enviado exitosamente')
        return NextResponse.json({ success: true, data: message })

      case 'get_messages':
        const messages = await chatService.getMessages({
          threadId: params.threadId,
          userId: user.id,
          limit: params.limit,
          offset: params.offset
        })
        return NextResponse.json({ success: true, data: messages })

      case 'mark_read':
        const readResult = await chatService.markAsRead(
          params.threadId,
          user.id,
          params.lastMessageId
        )
        return NextResponse.json({ success: true, data: readResult })

      case 'get_threads':
        const threads = await chatService.getUserThreads({
          userId: user.id,
          limit: params.limit,
          offset: params.offset
        })
        return NextResponse.json({ success: true, data: threads })

      case 'close_thread':
        const closeResult = await chatService.closeThread(params.threadId, user.id)
        return NextResponse.json({ success: true, data: closeResult })

      case 'emit_system_message':
        const systemMessage = await chatService.emitSystemMessage(
          params.threadId,
          params.action,
          params.metadata
        )
        return NextResponse.json({ success: true, data: systemMessage })

      case 'add_support':
        const supportResult = await chatService.addSupport(params.threadId, params.supportUserId)
        return NextResponse.json({ success: true, data: supportResult })

      default:
        return NextResponse.json(
          { success: false, error: 'Acción no válida' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error en API de chat:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}


