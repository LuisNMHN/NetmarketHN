export interface ZeptoMailSendParams {
  from: string
  to: string[]
  subject: string
  html: string
}

export interface ZeptoMailSendResult {
  success: boolean
  data?: any
  error?: string
}

const ZEPTO_API_URL = 'https://api.zeptomail.com/v1.1/email'

export async function sendViaZeptoMail(params: ZeptoMailSendParams): Promise<ZeptoMailSendResult> {
  const { ZEPTOMAIL_TOKEN, ZEPTOMAIL_FROM_EMAIL } = process.env as Record<string, string | undefined>

  if (!ZEPTOMAIL_TOKEN) {
    return { success: false, error: 'ZEPTOMAIL_TOKEN no configurado' }
  }

  const fromAddress = params.from || ZEPTOMAIL_FROM_EMAIL || ''
  if (!fromAddress) {
    return { success: false, error: 'Remitente no configurado (ZEPTOMAIL_FROM_EMAIL o from)' }
  }

  const payload = {
    from: {
      address: fromAddress,
    },
    to: params.to.map((addr) => ({ email_address: { address: addr } })),
    subject: params.subject,
    htmlbody: params.html,
  }

  const response = await fetch(ZEPTO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let details: any = undefined
    try {
      details = await response.json()
    } catch {}
    return {
      success: false,
      error: `ZeptoMail error ${response.status}`,
      data: details,
    }
  }

  const data = await response.json()
  return { success: true, data }
}


