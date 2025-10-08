// Utilidades NAVP (no son Server Actions)

// Función simple de OCR para texto
export function simpleOCRTextExtraction(text: string): { 
  success: boolean; 
  extractedData?: any; 
  confidence?: number;
  error?: string 
} {
  try {
    // Patrones simples para extraer información
    const patterns = {
      paymentCode: /NAVP\d+/g,
      amount: /L\.?\s*(\d+(?:\.\d{2})?)/gi,
      currency: /(L\.?|USD|EUR|GBP)/gi,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      phone: /(\+?504\s?)?[0-9]{4}[\s-]?[0-9]{4}/g
    }

    const extractedData: any = {}

    // Extraer código de pago
    const paymentCodeMatch = text.match(patterns.paymentCode)
    if (paymentCodeMatch) {
      extractedData.paymentCode = paymentCodeMatch[0]
    }

    // Extraer monto
    const amountMatch = text.match(patterns.amount)
    if (amountMatch) {
      extractedData.amount = parseFloat(amountMatch[0].replace(/[L\.\s]/g, ''))
    }

    // Extraer moneda
    const currencyMatch = text.match(patterns.currency)
    if (currencyMatch) {
      extractedData.currency = currencyMatch[0].toUpperCase()
    }

    // Extraer email
    const emailMatch = text.match(patterns.email)
    if (emailMatch) {
      extractedData.email = emailMatch[0]
    }

    // Extraer teléfono
    const phoneMatch = text.match(patterns.phone)
    if (phoneMatch) {
      extractedData.phone = phoneMatch[0]
    }

    // Calcular confianza basada en datos extraídos
    const confidence = Object.keys(extractedData).length / 5

    return { 
      success: true, 
      extractedData, 
      confidence: Math.min(confidence, 1.0) 
    }
  } catch (error) {
    console.error('❌ Error en OCR simple:', error)
    return { success: false, error: 'Error procesando texto' }
  }
}

// Generar código QR simple (simulación)
export function generateSimpleQRCode(data: string): string {
  // En una implementación real, usarías una librería como qrcode
  // Por ahora, retornamos los datos como string para simulación
  return JSON.stringify({
    data: data,
    timestamp: new Date().toISOString(),
    type: 'NAVP_PAYMENT'
  })
}
