"use server"

import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Tipos para el panel admin
export type AdminUser = {
  id: string
  email: string
  name?: string
  phone?: string
  roles: string[]
  status: "active" | "inactive"
  created_at: string
  updated_at: string
}

export type KycRequest = {
  id: string
  user_id: string
  user_name?: string
  user_email?: string
  document_type: string
  document_number: string
  birth_date?: string
  country?: string
  address_department?: string
  address_city?: string
  address_neighborhood?: string
  address_desc?: string
  status: "pending" | "approved" | "rejected"
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  notes?: string
  documents: Array<{
    id: string
    type: string
    url: string
    uploaded_at: string
  }>
}

// Dashboard Stats
export async function getAdminStats() {
  const supabase = await supabaseAdmin()
  
  try {
    console.log('Getting admin stats...')
    
    // Obtener estadísticas básicas de usuarios desde la tabla profiles
    const { count: totalUsers, error: totalError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      console.error('Error getting total users from profiles:', totalError)
      
      // Fallback: intentar con user_profiles
      console.log('Intentando con user_profiles como fallback...')
      const { count: totalUsersFallback, error: totalErrorFallback } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })

      if (totalErrorFallback) {
        console.error('Error getting total users from user_profiles:', totalErrorFallback)
        return {
          totalUsers: 0,
          activeUsers: 0,
          pendingKyc: 0,
          approvedKyc: 0,
          rejectedKyc: 0,
        }
      }

      return {
        totalUsers: totalUsersFallback || 0,
        activeUsers: totalUsersFallback || 0,
        pendingKyc: 0,
        approvedKyc: 0,
        rejectedKyc: 0,
      }
    }

    // Por ahora todos los usuarios en profiles se consideran activos
    const activeUsers = totalUsers

    // Obtener estadísticas de KYC desde kyc_submissions
    let pendingKyc = 0
    let approvedKyc = 0
    let rejectedKyc = 0

    try {
      const { count: pendingCount, error: pendingError } = await supabase
        .from('kyc_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'review')

      if (!pendingError) {
        pendingKyc = pendingCount || 0
      }

      const { count: approvedCount, error: approvedError } = await supabase
        .from('kyc_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')

      if (!approvedError) {
        approvedKyc = approvedCount || 0
      }

      const { count: rejectedCount, error: rejectedError } = await supabase
        .from('kyc_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected')

      if (!rejectedError) {
        rejectedKyc = rejectedCount || 0
      }
    } catch (kycError) {
      console.error('Error getting KYC stats:', kycError)
      // Mantener valores por defecto si hay error
    }

    const stats = {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers,
      pendingKyc,
      approvedKyc,
      rejectedKyc,
    }

    console.log('Admin stats:', stats)
    return stats
  } catch (error) {
    console.error('Error getting admin stats:', error instanceof Error ? error.message : 'Error desconocido')
    return {
      totalUsers: 0,
      activeUsers: 0,
      pendingKyc: 0,
      approvedKyc: 0,
      rejectedKyc: 0,
    }
  }
}

// Usuarios
export async function getAdminUsers(): Promise<AdminUser[]> {
  const supabase = await supabaseAdmin()
  
  try {
    console.log('Obteniendo usuarios desde la tabla profiles...')
    
    // Consultar la tabla profiles que es donde se crean los usuarios registrados
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error querying profiles table:', profilesError)
      console.error('Error details:', {
        message: profilesError.message,
        details: profilesError.details,
        hint: profilesError.hint,
        code: profilesError.code
      })
      
      // Si no existe la tabla profiles, intentar con user_profiles
      console.log('Intentando con user_profiles como fallback...')
      const { data: userProfiles, error: userProfilesError } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, phone, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (userProfilesError) {
        console.error('Error querying user_profiles table:', userProfilesError)
        return []
      }

      // Mapear desde user_profiles
      const usersFromUserProfiles = (userProfiles || []).map((profile) => ({
        id: profile.user_id,
        email: '', // No disponible en user_profiles
        name: profile.display_name || '',
        phone: profile.phone || '',
        roles: ['user'], // Rol por defecto
        status: 'active' as const,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }))

      console.log(`Successfully loaded ${usersFromUserProfiles.length} users from user_profiles`)
      return usersFromUserProfiles
    }

    if (!profiles || profiles.length === 0) {
      console.log('No users found in profiles table')
      return []
    }

    // Mapear usuarios desde profiles
    const usersWithRoles = profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      name: profile.full_name || '',
      phone: '', // No disponible en profiles
      roles: ['user'], // Rol por defecto
      status: 'active' as const,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    }))

    console.log(`Successfully loaded ${usersWithRoles.length} users from profiles`)
    return usersWithRoles
  } catch (error) {
    console.error('Error getting admin users:', error instanceof Error ? error.message : 'Error desconocido')
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return []
  }
}

export async function createAdminUser(userData: {
  email: string
  name: string
  phone: string
  roles: string[]
  status: "active" | "inactive"
}) {
  const supabase = await supabaseServer()
  
  try {
    // Crear usuario en auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
    })

    if (authError) throw authError

    // Crear perfil de usuario
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        status: userData.status
      })

    if (profileError) throw profileError

    // Asignar roles
    for (const roleName of userData.roles) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role_id: (await supabase.from('roles').select('id').eq('name', roleName).single()).data?.id
        })

      if (roleError) throw roleError
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error creating admin user:', error instanceof Error ? error.message : 'Error desconocido')
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

export async function updateAdminUser(userId: string, userData: {
  name?: string
  phone?: string
  roles?: string[]
  status?: "active" | "inactive"
}) {
  const supabase = await supabaseServer()
  
  try {
    // Actualizar perfil
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        name: userData.name,
        phone: userData.phone,
        status: userData.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) throw profileError

    // Actualizar roles si se proporcionan
    if (userData.roles) {
      // Eliminar roles existentes
      await supabase.from('user_roles').delete().eq('user_id', userId)

      // Agregar nuevos roles
      for (const roleName of userData.roles) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('name', roleName)
          .single()

        if (roleData) {
          await supabase.from('user_roles').insert({
            user_id: userId,
            role_id: roleData.id
          })
        }
      }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error updating admin user:', error instanceof Error ? error.message : 'Error desconocido')
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

export async function deleteAdminUser(userId: string) {
  const supabase = await supabaseServer()
  
  try {
    // Eliminar roles
    await supabase.from('user_roles').delete().eq('user_id', userId)
    
    // Eliminar perfil
    await supabase.from('user_profiles').delete().eq('id', userId)
    
    // Eliminar usuario de auth
    await supabase.auth.admin.deleteUser(userId)

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error deleting admin user:', error instanceof Error ? error.message : 'Error desconocido')
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// KYC
async function getKycRequestsWithClient(supabase: any): Promise<KycRequest[]> {
  try {
    const { data: kycData, error: kycError } = await supabase
      .from('kyc_submissions')
      .select(`
        user_id,
        full_name,
        birth_date,
        country,
        doc_type,
        doc_number,
        status,
        updated_at,
        admin_notes,
        document_front_path,
        document_back_path,
        selfie_path,
        address_proof_path,
        address_department,
        address_city,
        address_neighborhood,
        address_desc
      `)
      .in('status', ['review', 'approved', 'rejected'])
      .order('updated_at', { ascending: false })

    if (kycError) {
      console.error('Error querying kyc_submissions:', kycError)
      console.error('Error details:', {
        message: kycError.message,
        details: kycError.details,
        hint: kycError.hint,
        code: kycError.code
      })
      
      // Si la tabla no existe, retornar array vacío
      if (kycError.code === '42P01' || kycError.message.includes('does not exist')) {
        console.log('Tabla kyc_submissions no existe. Ejecuta el script CREATE_KYC_SUBMISSIONS_TABLE.sql')
        return []
      }
      
      return []
    }

    if (!kycData || kycData.length === 0) {
      console.log('No KYC submissions found')
      return []
    }

    // Mapear datos de kyc_submissions a KycRequest
    const requestsWithUsers = await Promise.all(
      kycData.map(async (submission: any) => {
        try {
          // Obtener información del usuario desde auth.users
          console.log(`🔍 Obteniendo email para usuario: ${submission.user_id}`)
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(submission.user_id)

          if (userError) {
            console.error(`❌ Error obteniendo email para ${submission.user_id}:`, userError)
          } else {
            console.log(`✅ Email obtenido para ${submission.user_id}:`, userData?.user?.email)
          }

          // Mapear status de kyc_submissions a KycRequest
          let mappedStatus: "pending" | "approved" | "rejected" = "pending"
          if (submission.status === "approved") {
            mappedStatus = "approved"
          } else if (submission.status === "rejected") {
            mappedStatus = "rejected"
          } else if (submission.status === "review" || submission.status === "draft") {
            mappedStatus = "pending"
          }

          return {
            id: submission.user_id, // Usar user_id como id único
            user_id: submission.user_id,
            user_name: submission.full_name || '',
            user_email: userData?.user?.email || '',
            document_type: submission.doc_type || '',
            document_number: submission.doc_number || '',
            birth_date: submission.birth_date || '',
            country: submission.country || '',
            address_department: submission.address_department || '',
            address_city: submission.address_city || '',
            address_neighborhood: submission.address_neighborhood || '',
            address_desc: submission.address_desc || '',
            status: mappedStatus,
            submitted_at: submission.updated_at,
            reviewed_at: submission.status === "approved" || submission.status === "rejected" ? submission.updated_at : null,
            reviewed_by: undefined, // No disponible en kyc_submissions
            notes: submission.admin_notes || '',
            documents: [
              submission.document_front_path ? { id: 'front', type: 'front', url: submission.document_front_path, uploaded_at: submission.updated_at } : null,
              submission.document_back_path ? { id: 'back', type: 'back', url: submission.document_back_path, uploaded_at: submission.updated_at } : null,
              submission.selfie_path ? { id: 'selfie', type: 'selfie', url: submission.selfie_path, uploaded_at: submission.updated_at } : null,
              submission.address_proof_path ? { id: 'address', type: 'address', url: submission.address_proof_path, uploaded_at: submission.updated_at } : null,
            ].filter(Boolean) as { id: string; type: string; url: string; uploaded_at: string }[]
          }
        } catch (userError) {
          console.error(`Error getting user data for KYC ${submission.user_id}:`, userError)
          return {
            id: submission.user_id,
            user_id: submission.user_id,
            user_name: submission.full_name || '',
            user_email: '',
            document_type: submission.doc_type || '',
            document_number: submission.doc_number || '',
            birth_date: submission.birth_date || '',
            country: submission.country || '',
            address_department: submission.address_department || '',
            address_city: submission.address_city || '',
            address_neighborhood: submission.address_neighborhood || '',
            address_desc: submission.address_desc || '',
            status: (submission.status === "approved" ? "approved" : submission.status === "rejected" ? "rejected" : "pending") as "pending" | "approved" | "rejected",
            submitted_at: submission.updated_at,
            reviewed_at: null,
            reviewed_by: undefined,
            notes: submission.admin_notes || '',
            documents: []
          }
        }
      })
    )

    console.log(`Successfully loaded ${requestsWithUsers.length} KYC requests from kyc_submissions`)
    return requestsWithUsers
  } catch (error) {
    console.error('Error getting KYC requests:', error instanceof Error ? error.message : 'Error desconocido')
    return []
  }
}

export async function getKycRequests(): Promise<KycRequest[]> {
  try {
    console.log('Obteniendo solicitudes KYC desde kyc_submissions...')
    console.log('🔍 Service key configurada:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Intentar primero con cliente de administrador
    const supabase = await supabaseAdmin()
    
    // Hacer una consulta de prueba
    const { data: testData, error: testError } = await supabase
      .from('kyc_submissions')
      .select('user_id')
      .limit(1)
    
    if (testError) {
      console.error('❌ Error con cliente admin:', testError)
      
      // Si no hay service key o falla, intentar con cliente normal
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('🔄 No hay service key, intentando con cliente normal...')
        const normalSupabase = await supabaseServer()
        return await getKycRequestsWithClient(normalSupabase)
      }
      
      // Si hay service key pero falla, también intentar con cliente normal
      console.log('🔄 Service key falló, intentando con cliente normal...')
      const normalSupabase = await supabaseServer()
      return await getKycRequestsWithClient(normalSupabase)
    }
    
    console.log('✅ Cliente admin funciona, continuando...')
    return await getKycRequestsWithClient(supabase)
  } catch (error) {
    console.error('Error getting KYC requests:', error instanceof Error ? error.message : 'Error desconocido')
    return []
  }
}

export async function updateKycStatus(requestId: string, status: "approved" | "rejected" | "pending", notes?: string) {
  const supabase = await supabaseAdmin()
  
  try {
    console.log(`🔄 Actualizando estado KYC para usuario: ${requestId} a estado: ${status}`)
    
    // Mapear "pending" a "draft" para la base de datos
    const dbStatus = status === "pending" ? "draft" : status
    console.log(`🔄 Mapeando estado ${status} a ${dbStatus} para la base de datos`)
    
    // requestId es el user_id en kyc_submissions
    const { data, error } = await supabase
      .from('kyc_submissions')
      .update({
        status: dbStatus,
        updated_at: new Date().toISOString(),
        admin_notes: notes || `Verificación ${status === "approved" ? "aprobada" : status === "rejected" ? "rechazada" : "revertida a pendiente"}`
      })
      .eq('user_id', requestId)
      .select()

    if (error) {
      console.error('❌ Error en updateKycStatus:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw error
    }

    console.log(`✅ Estado KYC actualizado exitosamente para usuario: ${requestId}`)
    console.log('📊 Datos actualizados:', data)

    // Enviar email de notificación si es aprobación o rechazo
    if (status === "approved" || status === "rejected") {
      try {
        // Obtener información del usuario para el email
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(requestId)
        
        if (userError) {
          console.error('❌ Error obteniendo datos del usuario para email:', userError)
        } else if (userData?.user?.email) {
          const { sendKycNotificationEmail } = await import('@/lib/email-service')
          
          await sendKycNotificationEmail({
            to: userData.user.email,
            userName: userData.user.user_metadata?.full_name || userData.user.email,
            type: status === "approved" ? "approval" : "rejection",
            reason: status === "rejected" ? notes : undefined
          })
          
          console.log(`✅ Email de ${status} enviado exitosamente a ${userData.user.email}`)
        }
      } catch (emailError) {
        console.error('❌ Error enviando email de notificación:', emailError)
        // No fallar la operación principal por error de email
      }
    }

    revalidatePath('/admin/kyc')
    return { success: true }
  } catch (error) {
    console.error('❌ Error updating KYC status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error message:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function revertKycStep(userId: string, step: 1, reason: string) {
  const supabase = await supabaseAdmin()
  
  try {
    console.log(`🔄 Revirtiendo paso ${step} para usuario: ${userId}`)
    console.log(`📝 Motivo: ${reason}`)
    
    // Actualizar admin_notes con el motivo de la reversión y marcar que el paso 1 debe revertirse
    const { data, error } = await supabase
      .from('kyc_submissions')
      .update({
        admin_notes: `Paso ${step} revertido: ${reason}`,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()

    if (error) {
      console.error('❌ Error actualizando admin_notes:', error)
      throw error
    }

    console.log(`✅ Paso ${step} revertido exitosamente para usuario: ${userId}`)
    console.log('📊 Datos actualizados:', data)

    revalidatePath('/admin/kyc')
    return { success: true }
  } catch (error) {
    console.error('❌ Error reverting KYC step:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error message:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function deleteKycDocument(userId: string, documentType: 'document_front_path' | 'document_back_path' | 'selfie_path' | 'address_proof_path') {
  const supabase = await supabaseAdmin()
  
  try {
    console.log(`🗑️ Eliminando documento ${documentType} para usuario: ${userId}`)
    
    // Primero obtener la información del documento para eliminarlo del storage
    const { data: kycData, error: fetchError } = await supabase
      .from('kyc_submissions')
      .select(documentType)
      .eq('user_id', userId)
      .single()
    
    if (fetchError) {
      console.error('❌ Error obteniendo datos del documento:', fetchError)
      throw fetchError
    }
    
           const documentPath = kycData[documentType as keyof typeof kycData]
    
    // Eliminar del storage si existe
    if (documentPath) {
      try {
        const { error: storageError } = await supabase.storage
          .from('kyc')
          .remove([documentPath])
        
        if (storageError) {
          console.error('❌ Error eliminando del storage:', storageError)
          // No fallar la operación si no se puede eliminar del storage
        } else {
          console.log(`✅ Documento eliminado del storage: ${documentPath}`)
        }
      } catch (storageError) {
        console.error('❌ Error en operación de storage:', storageError)
        // Continuar con la eliminación de la base de datos
      }
    }
    
    // Actualizar la base de datos para eliminar la referencia
    const { data, error } = await supabase
      .from('kyc_submissions')
      .update({
        [documentType]: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
    
    if (error) {
      console.error('❌ Error actualizando base de datos:', error)
      throw error
    }
    
    console.log(`✅ Documento ${documentType} eliminado exitosamente para usuario: ${userId}`)
    console.log('📊 Datos actualizados:', data)
    
    revalidatePath('/admin/kyc')
    return { success: true }
  } catch (error) {
    console.error('❌ Error deleting KYC document:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error message:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
