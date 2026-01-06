export function getEmailVerificationTemplate(userName: string, verificationUrl: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifica tu correo - NMHN</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 40px 30px;
        }
        .welcome-section {
          text-align: center;
          margin-bottom: 30px;
        }
        .welcome-icon {
          font-size: 64px;
          margin-bottom: 20px;
          display: block;
        }
        .welcome-title {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 10px;
        }
        .welcome-subtitle {
          color: #6b7280;
          font-size: 16px;
        }
        .verification-section {
          background: #f0fdfa;
          border: 2px solid #14b8a6;
          border-radius: 8px;
          padding: 25px;
          margin: 30px 0;
          text-align: center;
        }
        .verification-title {
          font-size: 18px;
          font-weight: 600;
          color: #0d9488;
          margin-bottom: 15px;
        }
        .verification-text {
          color: #374151;
          margin-bottom: 25px;
          font-size: 16px;
        }
        .verify-button {
          display: inline-block;
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
          transition: all 0.3s ease;
        }
        .verify-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(20, 184, 166, 0.4);
        }
        .security-note {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        .security-note h4 {
          margin: 0 0 8px 0;
          color: #92400e;
          font-size: 14px;
          font-weight: 600;
        }
        .security-note p {
          margin: 0;
          color: #78350f;
          font-size: 14px;
        }
        .features {
          margin: 30px 0;
        }
        .features h3 {
          color: #1f2937;
          font-size: 18px;
          margin-bottom: 15px;
        }
        .feature-list {
          list-style: none;
          padding: 0;
        }
        .feature-list li {
          padding: 8px 0;
          color: #4b5563;
          font-size: 15px;
        }
        .feature-list li::before {
          content: "✅";
          margin-right: 10px;
        }
        .footer {
          background: #f9fafb;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 5px 0;
          color: #6b7280;
          font-size: 14px;
        }
        .footer .brand {
          font-weight: 600;
          color: #14b8a6;
        }
        .alternative-link {
          margin-top: 20px;
          padding: 15px;
          background: #f3f4f6;
          border-radius: 6px;
          font-size: 14px;
          color: #6b7280;
        }
        .alternative-link a {
          color: #14b8a6;
          word-break: break-all;
        }
        @media (max-width: 600px) {
          body {
            padding: 10px;
          }
          .header, .content, .footer {
            padding: 20px;
          }
          .welcome-icon {
            font-size: 48px;
          }
          .welcome-title {
            font-size: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Bienvenido a NMHN!</h1>
          <p>Tu plataforma de comercio digital en Honduras</p>
        </div>
        
        <div class="content">
          <div class="welcome-section">
            <span class="welcome-icon">🎉</span>
            <h2 class="welcome-title">¡Hola, ${userName}!</h2>
            <p class="welcome-subtitle">Gracias por registrarte en nuestra plataforma</p>
          </div>
          
          <div class="verification-section">
            <h3 class="verification-title">Verifica tu correo electrónico</h3>
            <p class="verification-text">
              Para completar tu registro y acceder a todos los servicios de NMHN, 
              necesitamos verificar que este correo electrónico te pertenece.
            </p>
            <a href="${verificationUrl}" class="verify-button">
              Verificar mi correo
            </a>
          </div>
          
          <div class="security-note">
            <h4>🔒 Seguridad</h4>
            <p>
              Este enlace es válido por 24 horas. Si no solicitaste esta cuenta, 
              puedes ignorar este correo de forma segura.
            </p>
          </div>
          
          <div class="features">
            <h3>¿Qué puedes hacer después de verificar?</h3>
            <ul class="feature-list">
              <li>Acceder a tu dashboard personalizado</li>
              <li>Participar en subastas y transacciones</li>
              <li>Completar tu verificación de identidad (KYC)</li>
              <li>Gestionar tu perfil y preferencias</li>
            </ul>
          </div>
          
          <div class="alternative-link">
            <p><strong>¿No puedes hacer clic en el botón?</strong></p>
            <p>Copia y pega este enlace en tu navegador:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </div>
        </div>
        
        <div class="footer">
          <p class="brand">NMHN - NetMarket Honduras</p>
          <p>La primera plataforma de comercio digital diseñada para hondureños 🇭🇳</p>
          <p>© 2024 NMHN. Todos los derechos reservados.</p>
          <p>Este correo fue enviado automáticamente, no respondas a este mensaje.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
