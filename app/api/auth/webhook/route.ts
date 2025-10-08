import { NextRequest, NextResponse } from 'next/server'
import { sendViaZeptoMail } from '@/lib/zeptomail'
import { getEmailVerificationTemplate } from '@/lib/email-templates-verification'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, record } = body

    console.log('🔔 Webhook recibido:', type)

    // Solo procesar eventos de verificación de email
    if (type === 'user.created' || type === 'user.updated') {
      const user = record
      const email = user.email
      const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
      
      // Si el usuario no está confirmado, enviar correo de verificación
      if (!user.email_confirmed_at) {
        console.log('📧 Usuario no confirmado, enviando correo de verificación')
        
        // Generar URL de verificación
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm?token=${user.confirmation_token}&type=signup`
        
        const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL || process.env.FROM_EMAIL || 'no-reply@netmarkethn.com'
        
        const html = getEmailVerificationTemplate(userName, verificationUrl)
        
        const result = await sendViaZeptoMail({
          from: fromEmail,
          to: [email],
          subject: '🎉 Verifica tu correo - NMHN',
          html,
        })
        
        if (result.success) {
          console.log('✅ Correo de verificación enviado via webhook')
        } else {
          console.error('❌ Error enviando correo via webhook:', result.error)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('❌ Error en webhook:', error)
    return NextResponse.json(
      { error: 'Error procesando webhook' },
      { status: 500 }
    )
  }
}
