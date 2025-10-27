'use client'

import { supabaseBrowser } from '@/lib/supabase/client'

// =========================================================
// SCRIPT PARA CONFIGURAR LA BASE DE DATOS
// =========================================================
// Este script crea las tablas necesarias para el sistema de transacciones
// =========================================================

export async function setupDatabase() {
  try {
    const supabase = supabaseBrowser()
    
    console.log('🚀 Iniciando configuración de base de datos...')
    
    // Verificar si las tablas ya existen
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['purchase_transactions', 'transaction_steps', 'transaction_documents'])

    if (tablesError) {
      console.log('⚠️ No se pudo verificar tablas existentes, continuando...')
    } else if (tables && tables.length > 0) {
      console.log('✅ Las tablas ya existen:', tables.map(t => t.table_name))
      return { success: true, message: 'Las tablas ya están configuradas' }
    }

    // Crear tabla purchase_transactions
    console.log('📋 Creando tabla purchase_transactions...')
    const { error: createTransactionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS purchase_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          request_id UUID NOT NULL,
          buyer_id UUID NOT NULL,
          seller_id UUID NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'USD',
          exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
          final_amount_hnld DECIMAL(15,2) NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          payment_details JSONB,
          status VARCHAR(30) NOT NULL DEFAULT 'pending',
          payment_deadline TIMESTAMP WITH TIME ZONE,
          verification_deadline TIMESTAMP WITH TIME ZONE,
          escrow_amount DECIMAL(15,2),
          escrow_status VARCHAR(20) DEFAULT 'protected',
          payment_proof_url TEXT,
          payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
          payment_verified_at TIMESTAMP WITH TIME ZONE,
          funds_released_at TIMESTAMP WITH TIME ZONE,
          terms_accepted_at TIMESTAMP WITH TIME ZONE,
          agreement_confirmed_at TIMESTAMP WITH TIME ZONE,
          payment_started_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (createTransactionsError) {
      console.error('❌ Error creando purchase_transactions:', createTransactionsError)
    } else {
      console.log('✅ Tabla purchase_transactions creada')
    }

    // Crear tabla transaction_steps
    console.log('📋 Creando tabla transaction_steps...')
    const { error: createStepsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS transaction_steps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
          step_name VARCHAR(50) NOT NULL,
          step_order INTEGER NOT NULL,
          step_description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          completed_at TIMESTAMP WITH TIME ZONE,
          completed_by UUID,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (createStepsError) {
      console.error('❌ Error creando transaction_steps:', createStepsError)
    } else {
      console.log('✅ Tabla transaction_steps creada')
    }

    // Crear tabla transaction_documents
    console.log('📋 Creando tabla transaction_documents...')
    const { error: createDocsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS transaction_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          transaction_id UUID NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
          document_type VARCHAR(50) NOT NULL,
          document_name VARCHAR(255) NOT NULL,
          document_url TEXT NOT NULL,
          file_size INTEGER,
          mime_type VARCHAR(100),
          uploaded_by UUID NOT NULL,
          is_verified BOOLEAN DEFAULT FALSE,
          verified_by UUID,
          verified_at TIMESTAMP WITH TIME ZONE,
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (createDocsError) {
      console.error('❌ Error creando transaction_documents:', createDocsError)
    } else {
      console.log('✅ Tabla transaction_documents creada')
    }

    console.log('🎉 Configuración de base de datos completada')
    return { success: true, message: 'Base de datos configurada correctamente' }

  } catch (error) {
    console.error('❌ Error en configuración de base de datos:', error)
    return { success: false, error: 'Error configurando la base de datos' }
  }
}

// =========================================================
// FUNCIÓN PARA CREAR TRANSACCIÓN REAL
// =========================================================

export async function createRealTransaction(data: {
  request_id: string
  seller_id: string
  buyer_id: string
  amount: number
  currency: string
  payment_method: string
  payment_details?: any
}) {
  try {
    const supabase = supabaseBrowser()
    
    console.log('🚀 Creando transacción real...', data)
    
    // Crear la transacción directamente en la tabla
    const { data: transaction, error } = await supabase
      .from('purchase_transactions')
      .insert({
        request_id: data.request_id,
        buyer_id: data.buyer_id,
        seller_id: data.seller_id,
        amount: data.amount,
        currency: data.currency,
        exchange_rate: 1.0,
        final_amount_hnld: data.amount,
        payment_method: data.payment_method,
        payment_details: data.payment_details || null,
        status: 'pending',
        escrow_status: 'protected',
        payment_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        verification_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        terms_accepted_at: new Date().toISOString(),
        agreement_confirmed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creando transacción:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Transacción creada:', transaction)

    // Crear los pasos iniciales
    const steps = [
      {
        transaction_id: transaction.id,
        step_name: 'confirm_agreement',
        step_order: 1,
        step_description: 'Confirmar acuerdo de compra',
        status: 'completed',
        completed_at: new Date().toISOString()
      },
      {
        transaction_id: transaction.id,
        step_name: 'payment_process',
        step_order: 2,
        step_description: 'Proceso de pago',
        status: 'in_progress'
      },
      {
        transaction_id: transaction.id,
        step_name: 'receipt_verification',
        step_order: 3,
        step_description: 'Verificación del recibo',
        status: 'pending'
      },
      {
        transaction_id: transaction.id,
        step_name: 'fund_release',
        step_order: 4,
        step_description: 'Liberación de fondos',
        status: 'pending'
      }
    ]

    const { error: stepsError } = await supabase
      .from('transaction_steps')
      .insert(steps)

    if (stepsError) {
      console.error('❌ Error creando pasos:', stepsError)
    } else {
      console.log('✅ Pasos creados')
    }

    // Obtener la transacción completa con pasos
    const { data: fullTransaction, error: fetchError } = await supabase
      .from('purchase_transactions')
      .select(`
        *,
        transaction_steps (*)
      `)
      .eq('id', transaction.id)
      .single()

    if (fetchError) {
      console.error('❌ Error obteniendo transacción completa:', fetchError)
      return { success: true, data: transaction }
    }

    console.log('🎉 Transacción completa creada:', fullTransaction)
    return { success: true, data: fullTransaction }

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return { success: false, error: 'Error inesperado al crear la transacción' }
  }
}

// =========================================================
// FUNCIÓN PARA ACTUALIZAR ESTADO REAL
// =========================================================

export async function updateRealTransactionStatus(data: {
  transaction_id: string
  new_status: string
  user_id?: string
}) {
  try {
    const supabase = supabaseBrowser()
    
    console.log('🔄 Actualizando estado de transacción...', data)
    
    const { error } = await supabase
      .from('purchase_transactions')
      .update({
        status: data.new_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.transaction_id)

    if (error) {
      console.error('❌ Error actualizando estado:', error)
      return { success: false, error: error.message }
    }

    // Actualizar pasos relacionados
    const stepUpdates: any = {}
    
    if (data.new_status === 'payment_verified') {
      stepUpdates['payment_process'] = 'completed'
      stepUpdates['receipt_verification'] = 'in_progress'
    } else if (data.new_status === 'funds_released') {
      stepUpdates['receipt_verification'] = 'completed'
      stepUpdates['fund_release'] = 'in_progress'
    } else if (data.new_status === 'completed') {
      stepUpdates['fund_release'] = 'completed'
    }

    for (const [stepName, status] of Object.entries(stepUpdates)) {
      await supabase
        .from('transaction_steps')
        .update({
          status: status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', data.transaction_id)
        .eq('step_name', stepName)
    }

    console.log('✅ Estado actualizado correctamente')
    return { success: true }

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return { success: false, error: 'Error inesperado al actualizar el estado' }
  }
}
