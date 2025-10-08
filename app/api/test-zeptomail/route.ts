import { NextRequest, NextResponse } from 'next/server'
import { sendViaZeptoMail } from '@/lib/zeptomail'

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const to = searchParams.get('to') || process.env.ZEPTOMAIL_TEST_TO || ''
    const from = process.env.ZEPTOMAIL_FROM_EMAIL || process.env.FROM_EMAIL || ''

    if (!to) {
      return NextResponse.json({
        success: false,
        error: 'Proporcione ?to=email o configure ZEPTOMAIL_TEST_TO',
        environment: {
          ZEPTOMAIL_TOKEN: process.env.ZEPTOMAIL_TOKEN ? 'Configurada' : 'No configurada',
          ZEPTOMAIL_FROM_EMAIL: process.env.ZEPTOMAIL_FROM_EMAIL || 'No configurada',
          FROM_EMAIL: process.env.FROM_EMAIL || 'No configurada',
        }
      }, { status: 400 })
    }

    const html = `
      <h1>Prueba ZeptoMail NMHN</h1>
      <p>Este es un correo de prueba enviado a ${to}.</p>
      <p>Fecha: ${new Date().toISOString()}</p>
    `

    const result = await sendViaZeptoMail({
      from: from || 'noreply@nmhn.com',
      to: [to],
      subject: 'Prueba ZeptoMail - NMHN',
      html,
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.data,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Correo de prueba enviado con ZeptoMail',
      details: result.data,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}


