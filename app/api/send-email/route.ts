import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// Configurar cliente de Resend
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { to, subject, html, type, userName } = await request.json()

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Verificar variables de entorno de Resend
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL

    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY no configurada')
      return NextResponse.json(
        { error: 'API key de Resend no configurada' },
        { status: 500 }
      )
    }

    console.log('🔑 Resend API Key configurada:', resendApiKey ? 'Sí' : 'No')
    console.log('📧 Enviando correo a:', to)
    console.log('📨 Asunto:', subject)
    console.log('👤 Usuario:', userName)

    const senderEmail = fromEmail?.replace(/.*<(.+)>.*/, '$1') || 'noreply@nmhn.com'
    const senderName = fromEmail?.replace(/<.*>/, '').trim() || 'NMHN'

    const emailData = {
      from: `${senderName} <${senderEmail}>`,
      to: [to],
      subject: subject,
      html: html,
    }

    console.log('📨 Configuración del correo:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      hasHtmlContent: !!emailData.html
    })

    const data = await resend.emails.send(emailData)

    console.log(`✅ Correo ${type} enviado a ${to}:`, data.id)
    return NextResponse.json({ 
      success: true, 
      id: data.id,
      message: 'Correo enviado exitosamente con Resend'
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
