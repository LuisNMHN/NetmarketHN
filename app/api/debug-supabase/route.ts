import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

export async function GET() {
  try {
    console.log('🔍 Iniciando diagnóstico de Supabase...')
    
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    console.log('🔧 Variables de entorno:')
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Configurada' : 'FALTANTE')
    console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'Configurada' : 'FALTANTE')
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Variables de entorno faltantes',
        details: {
          url: !!supabaseUrl,
          key: !!supabaseKey
        }
      }, { status: 500 })
    }

    // Crear cliente de Supabase
    const supabase = await supabaseServer()
    
    // Verificar conexión básica
    console.log('🔗 Probando conexión a Supabase...')
    const { data: healthCheck, error: healthError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (healthError) {
      console.error('❌ Error de conexión:', healthError)
      return NextResponse.json({
        success: false,
        error: 'Error de conexión a Supabase',
        details: healthError
      }, { status: 500 })
    }

    console.log('✅ Conexión a Supabase exitosa')

    // Verificar tablas existentes
    console.log('📊 Verificando tablas...')
    
    const tables = ['profiles', 'user_profiles', 'roles', 'user_roles']
    const tableStatus = {}
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)
        
        tableStatus[table] = {
          exists: !error,
          error: error?.message || null
        }
        
        console.log(`- ${table}:`, error ? '❌ Error' : '✅ OK')
      } catch (err) {
        tableStatus[table] = {
          exists: false,
          error: err.message
        }
        console.log(`- ${table}: ❌ Error`)
      }
    }

    // Verificar funciones SQL
    console.log('🔧 Verificando funciones SQL...')
    
    const functions = ['create_user_profile', 'has_role', 'user_has_profile']
    const functionStatus = {}
    
    for (const func of functions) {
      try {
        // Intentar llamar la función con parámetros dummy
        const { data, error } = await supabase.rpc(func, {
          p_user_id: '00000000-0000-0000-0000-000000000000',
          p_email: 'test@test.com',
          p_full_name: 'Test User',
          role_name: 'user'
        })
        
        functionStatus[func] = {
          exists: !error,
          error: error?.message || null
        }
        
        console.log(`- ${func}:`, error ? '❌ Error' : '✅ OK')
      } catch (err) {
        functionStatus[func] = {
          exists: false,
          error: err.message
        }
        console.log(`- ${func}: ❌ Error`)
      }
    }

    // Verificar roles existentes
    console.log('👥 Verificando roles...')
    
    let rolesStatus = { exists: false, roles: [], error: null }
    
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('name')
      
      if (rolesError) {
        rolesStatus.error = rolesError.message
      } else {
        rolesStatus.exists = true
        rolesStatus.roles = roles.map(r => r.name)
      }
      
      console.log('- Roles:', rolesError ? '❌ Error' : `✅ ${roles?.length || 0} roles`)
    } catch (err) {
      rolesStatus.error = err.message
      console.log('- Roles: ❌ Error')
    }

    return NextResponse.json({
      success: true,
      message: 'Diagnóstico completado',
      details: {
        environment: {
          url: !!supabaseUrl,
          key: !!supabaseKey
        },
        connection: {
          status: 'OK',
          healthCheck: !!healthCheck
        },
        tables: tableStatus,
        functions: functionStatus,
        roles: rolesStatus
      }
    })

  } catch (error: any) {
    console.error('❌ Error en diagnóstico:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
