import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET(request: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL

    if (!resendApiKey) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY no configurada',
        environment: {
          RESEND_API_KEY: 'No configurada',
          FROM_EMAIL: fromEmail || 'No configurada'
        }
      }, { status: 400 })
    }

    console.log('🔍 Verificando configuración de Resend:', {
      apiKey: resendApiKey ? 'Configurada' : 'No configurada',
      apiKeyLength: resendApiKey?.length || 0,
      fromEmail: fromEmail || 'No configurada'
    })

    // Configurar cliente de Resend
    const resend = new Resend(resendApiKey)

    const senderEmail = fromEmail?.replace(/.*<(.+)>.*/, '$1') || 'noreply@nmhn.com'
    const senderName = fromEmail?.replace(/<.*>/, '').trim() || 'NMHN'

    // Crear correo de prueba
    const emailData = {
      from: `${senderName} <${senderEmail}>`,
      to: ['maria@netmarkethn.com'],
      subject: '✅ Prueba de Resend - NMHN',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Prueba de Resend</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
            .success { color: #28a745; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Prueba de Resend Exitosa</h1>
            </div>
            <div class="content">
              <p>¡Hola!</p>
              <p>Este es un correo de prueba para verificar que la integración con <span class="success">Resend</span> está funcionando correctamente.</p>
              <p><strong>Configuración verificada:</strong></p>
              <ul>
                <li>✅ API Key: Configurada</li>
                <li>✅ Cliente Resend: Inicializado</li>
                <li>✅ Envío de correo: Exitoso</li>
              </ul>
              <p>El sistema de correos de NMHN está listo para usar.</p>
              <p>Saludos,<br>Equipo de NMHN</p>
            </div>
          </div>
        </body>
        </html>
      `
    }

    console.log('📨 Configuración del correo de prueba:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject
    })

    try {
      const data = await resend.emails.send(emailData)
      
      return NextResponse.json({
        success: true,
        message: 'Configuración de Resend verificada exitosamente',
        details: {
          id: data.id,
          apiKey: 'Configurada y funcionando',
          fromEmail: fromEmail || 'No configurada',
          sender: emailData.from,
          timestamp: new Date().toISOString()
        }
      })
    } catch (sendError: any) {
      console.error('❌ Error al enviar correo de verificación:', sendError)
      
      return NextResponse.json({
        success: false,
        error: 'Error al enviar correo de verificación',
        details: {
          message: sendError.message,
          apiKey: 'Configurada',
          fromEmail: fromEmail || 'No configurada',
          sender: emailData.from
        }
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Error en verificación de Resend:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Error al verificar configuración de Resend',
      details: {
        message: error.message,
        stack: error.stack,
        environment: {
          RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Configurada' : 'No configurada',
          FROM_EMAIL: process.env.FROM_EMAIL || 'No configurada'
        }
      }
    }, { status: 500 })
  }
}

