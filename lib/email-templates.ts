export function getApprovalEmailTemplate(userName: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verificación Aprobada - NMHN</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f8f9fa;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .success-icon {
          font-size: 48px;
          color: #28a745;
          margin-bottom: 20px;
        }
        .button {
          display: inline-block;
          background: #28a745;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>¡Verificación Aprobada!</h1>
        <p>NMHN - Tu plataforma de confianza</p>
      </div>
      
      <div class="content">
        <div style="text-align: center;">
          <div class="success-icon">✅</div>
        </div>
        
        <h2>¡Felicidades, ${userName}!</h2>
        
        <p>Tu verificación de identidad ha sido <strong>aprobada exitosamente</strong>. Ahora puedes acceder a todos los servicios de NMHN.</p>
        
        <h3>¿Qué puedes hacer ahora?</h3>
        <ul>
          <li>✅ Realizar transacciones sin límites</li>
          <li>✅ Participar en subastas</li>
          <li>✅ Acceder a todas las funcionalidades premium</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">
            Acceder a mi Dashboard
          </a>
        </div>
        
        <p><strong>Tiempo de procesamiento:</strong> Tu verificación fue procesada en tiempo récord.</p>
        
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        
        <p>¡Bienvenido a NMHN!</p>
      </div>
      
      <div class="footer">
        <p>Este correo fue enviado automáticamente por NMHN</p>
        <p>© 2024 NMHN. Todos los derechos reservados.</p>
      </div>
    </body>
    </html>
  `
}

export function getRejectionEmailTemplate(userName: string, reason?: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verificación Requiere Atención - NMHN</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f8f9fa;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .warning-icon {
          font-size: 48px;
          color: #ff6b6b;
          margin-bottom: 20px;
        }
        .button {
          display: inline-block;
          background: #007bff;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 14px;
        }
        .reason-box {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Verificación Requiere Atención</h1>
        <p>NMHN - Tu plataforma de confianza</p>
      </div>
      
      <div class="content">
        <div style="text-align: center;">
          <div class="warning-icon">⚠️</div>
        </div>
        
        <h2>Hola ${userName},</h2>
        
        <p>Tu solicitud de verificación de identidad <strong>requiere atención adicional</strong> para poder ser procesada.</p>
        
        ${reason ? `
          <div class="reason-box">
            <h3>Motivo:</h3>
            <p>${reason}</p>
          </div>
        ` : ''}
        
        <h3>¿Qué puedes hacer?</h3>
        <ul>
          <li>🔍 Revisar la calidad de tus documentos</li>
          <li>📸 Asegurarte de que las fotos sean claras y legibles</li>
          <li>📋 Verificar que toda la información sea correcta</li>
          <li>🔄 Volver a enviar tu solicitud</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/verificacion" class="button">
            Revisar mi Verificación
          </a>
        </div>
        
        <p><strong>Importante:</strong> Una vez corregidos los problemas, podrás volver a enviar tu solicitud inmediatamente.</p>
        
        <p>Si necesitas ayuda, nuestro equipo de soporte está disponible para asistirte.</p>
      </div>
      
      <div class="footer">
        <p>Este correo fue enviado automáticamente por NMHN</p>
        <p>© 2024 NMHN. Todos los derechos reservados.</p>
      </div>
    </body>
    </html>
  `
}

