import { NextRequest, NextResponse } from 'next/server'
import { sendViaZeptoMail } from '@/lib/zeptomail'
import { getEmailVerificationTemplate } from '@/lib/email-templates-verification'

export async function POST(request: NextRequest) {
  try {
    const { email, userName, verificationUrl } = await request.json()

    if (!email || !verificationUrl) {
      return NextResponse.json(
        { error: 'Email y URL de verificación son requeridos' },
        { status: 400 }
      )
    }

    const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL || process.env.FROM_EMAIL || 'no-reply@netmarkethn.com'
    const displayName = userName || 'Usuario'

    console.log('📧 Enviando correo de verificación a:', email)
    console.log('👤 Nombre del usuario:', displayName)

    const html = getEmailVerificationTemplate(displayName, verificationUrl)

    const result = await sendViaZeptoMail({
      from: fromEmail,
      to: [email],
      subject: '🎉 Verifica tu correo - NMHN',
      html,
    })

    if (!result.success) {
      console.error('❌ Error enviando correo de verificación:', result.error)
      return NextResponse.json(
        { error: result.error || 'Error al enviar correo de verificación', details: result.data },
        { status: 500 }
      )
    }

    console.log('✅ Correo de verificación enviado exitosamente:', result.data)
    return NextResponse.json({ 
      success: true, 
      id: result.data?.data?.[0]?.message_id || result.data?.message_id,
      message: 'Correo de verificación enviado exitosamente'
    })

  } catch (error: any) {
    console.error('❌ Error en API de verificación de email:', error)
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error.message
      },
      { status: 500 }
    )
  }
}
