import { getApprovalEmailTemplate, getRejectionEmailTemplate } from './email-templates'

export interface EmailData {
  to: string
  userName: string
  type: 'approval' | 'rejection'
  reason?: string
}

export async function sendKycNotificationEmail(emailData: EmailData) {
  try {
    const { to, userName, type, reason } = emailData
    
    let subject: string
    let html: string
    
    if (type === 'approval') {
      subject = '✅ Verificación Aprobada - NMHN'
      html = getApprovalEmailTemplate(userName)
    } else {
      subject = '⚠️ Verificación Requiere Atención - NMHN'
      html = getRejectionEmailTemplate(userName, reason)
    }
    
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        type,
        userName,
      }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error al enviar correo')
    }
    
    const result = await response.json()
    console.log(`✅ Correo ${type} enviado exitosamente:`, result.id)
    return result
  } catch (error) {
    console.error(`❌ Error enviando correo ${emailData.type}:`, error)
    throw error
  }
}

export async function sendApprovalEmail(email: string, userName: string) {
  return sendKycNotificationEmail({
    to: email,
    userName,
    type: 'approval',
  })
}

export async function sendRejectionEmail(email: string, userName: string, reason?: string) {
  return sendKycNotificationEmail({
    to: email,
    userName,
    type: 'rejection',
    reason,
  })
}

