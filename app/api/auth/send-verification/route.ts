import { NextRequest, NextResponse } from 'next/server'
import { sendViaZeptoMail } from '@/lib/zeptomail'
import { getEmailVerificationTemplate } from '@/lib/email-templates-verification'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, userName } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      )
    }

    console.log('📧 Enviando correo de verificación personalizado a:', email)

    // Generar token de verificación usando Supabase Admin
    const supabase = await supabaseAdmin()
    
    // Generar token de confirmación
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`
      }
    })

    if (authError) {
      console.error('❌ Error generando link de verificación:', authError)
      return NextResponse.json(
        { error: 'Error generando enlace de verificación' },
        { status: 500 }
      )
    }

    const verificationUrl = authData.properties?.action_link
    const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL || process.env.FROM_EMAIL || 'no-reply@netmarkethn.com'
    const displayName = userName || email.split('@')[0]

    if (!verificationUrl) {
      return NextResponse.json(
        { error: 'No se pudo generar el enlace de verificación' },
        { status: 500 }
      )
    }

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

    console.log('✅ Correo de verificación personalizado enviado exitosamente:', result.data)
    return NextResponse.json({ 
      success: true, 
      id: result.data?.data?.[0]?.message_id || result.data?.message_id,
      message: 'Correo de verificación personalizado enviado exitosamente'
    })

  } catch (error: any) {
    console.error('❌ Error en API de verificación personalizada:', error)
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error.message
      },
      { status: 500 }
    )
  }
}
