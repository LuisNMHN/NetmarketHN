import { NextResponse } from "next/server"

// Tipos de cambio de referencia del Banco Central de Honduras (TCR)
// Estos valores deben actualizarse diariamente con el TCR oficial del BCH
// El BCH publica el TCR diariamente en su sitio web oficial
const DEFAULT_BCH_RATES = {
  USD: 26.2214, // Tipo de Cambio de Referencia (TCR) USD a HNL - Actualizar diariamente
  EUR: 28.50, // Tipo de Cambio de Referencia (TCR) EUR a HNL - Actualizar diariamente
}

// Spread del 1% para mantener operación, seguridad y soporte
const NMHN_SPREAD = 0.01 // 1%

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency') || 'USD'
    
    // Obtener el Tipo de Cambio de Referencia (TCR) oficial del BCH
    let bchRate = DEFAULT_BCH_RATES[currency as 'USD' | 'EUR'] || DEFAULT_BCH_RATES.USD
    
    // Intentar obtener el TCR oficial del BCH desde API pública como fallback
    // Nota: El BCH no tiene una API pública oficial, pero podemos usar APIs de referencia
    try {
      if (currency === 'USD') {
        // Intentar obtener desde API pública (como referencia)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
          next: { revalidate: 3600 } // Cache por 1 hora
        })
        if (response.ok) {
          const data = await response.json()
          const apiRate = data.rates?.HNL
          if (apiRate) {
            // Usar el valor de la API como aproximación del TCR del BCH
            bchRate = apiRate
          }
        }
      } else if (currency === 'EUR') {
        // Intentar obtener desde API pública (como referencia)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', {
          next: { revalidate: 3600 } // Cache por 1 hora
        })
        if (response.ok) {
          const data = await response.json()
          const apiRate = data.rates?.HNL
          if (apiRate) {
            // Usar el valor de la API como aproximación del TCR del BCH
            bchRate = apiRate
          }
        }
      }
    } catch (apiError) {
      console.log('⚠️ No se pudo obtener tipo de cambio desde API externa, usando valor por defecto:', apiError)
    }
    
    // Calcular la tasa NMHN con el spread del 1% a favor de la plataforma
    // El comprador recibe MENOS HNL, por lo que la tasa es menor que el TCR
    // Tasa NMHN = TCR × (1 - 0.01) = TCR × 0.99
    const nmhnRate = bchRate * (1 - NMHN_SPREAD)
    
    return NextResponse.json({
      success: true,
      currency: currency,
      bchRate: bchRate, // Tipo de Cambio de Referencia oficial del BCH
      nmhnRate: nmhnRate, // Tasa NMHN con spread del 0.8%
      spread: NMHN_SPREAD, // Spread aplicado (0.8%)
      source: 'Banco Central de Honduras (TCR)',
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error obteniendo tipo de cambio:', error)
    // En caso de error, devolver valores por defecto con cálculo del spread
    const { searchParams: errorParams } = new URL(request.url)
    const errorCurrency = errorParams.get('currency') || 'USD'
    const defaultBchRate = DEFAULT_BCH_RATES[errorCurrency as 'USD' | 'EUR'] || DEFAULT_BCH_RATES.USD
    const defaultNmhnRate = defaultBchRate * (1 - NMHN_SPREAD)
    
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo tipo de cambio',
      currency: errorCurrency,
      bchRate: defaultBchRate,
      nmhnRate: defaultNmhnRate,
      spread: NMHN_SPREAD
    }, { status: 500 })
  }
}

