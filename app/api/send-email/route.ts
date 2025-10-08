import { NextRequest, NextResponse } from 'next/server'
import { sendViaZeptoMail } from '@/lib/zeptomail'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, html, type, userName } = await request.json()

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Variables de entorno ZeptoMail
    const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL || process.env.FROM_EMAIL
    console.log('📧 Enviando correo a:', to)
    console.log('📨 Asunto:', subject)
    console.log('👤 Usuario:', userName)

    const sender = fromEmail || 'noreply@nmhn.com'

    console.log('📨 Configuración del correo:', {
      from: sender,
      to,
      subject,
      hasHtmlContent: !!html
    })

    const result = await sendViaZeptoMail({
      from: sender,
      to: [to],
      subject,
      html,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al enviar con ZeptoMail', details: result.data },
        { status: 500 }
      )
    }

    console.log(`✅ Correo ${type} enviado a ${to}:`, result.data)
    return NextResponse.json({ 
      success: true, 
      id: result.data?.data?.[0]?.message_id || result.data?.message_id,
      message: 'Correo enviado exitosamente con ZeptoMail'
    })
  } catch (error: any) {
    console.error('❌ Error en API de correo:', error)
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error.message
      },
      { status: 500 }
    )
  }
}
