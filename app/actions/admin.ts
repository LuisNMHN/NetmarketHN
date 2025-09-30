"use server"

import { supabaseServer } from "@/lib/supabase/server"
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
  const supabase = await supabaseServer()
  
  try {
    // Obtener estadísticas básicas de usuarios
    const { count: totalUsers, error: totalError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      console.error('Error getting total users:', totalError)
    }

    const { count: activeUsers, error: activeError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    if (activeError) {
      console.error('Error getting active users:', activeError)
    }

    // Por ahora usar valores por defecto para KYC
    const pendingKyc = 0
    const approvedKyc = 0
    const rejectedKyc = 0

    return {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      pendingKyc,
      approvedKyc,
      rejectedKyc,
    }
  } catch (error) {
    console.error('Error getting admin stats:', error)
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
  const supabase = await supabaseServer()
  
  try {
    // Consulta simple solo de user_profiles
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email, name, phone, status, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('Error querying user_profiles:', usersError)
      throw usersError
    }

    if (!users) {
      console.log('No users found in user_profiles table')
      return []
    }

    // Mapear usuarios sin roles por ahora
    const usersWithRoles = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name || '',
      phone: user.phone || '',
      roles: [], // Por ahora sin roles
      status: (user.status as "active" | "inactive") || "active",
      created_at: user.created_at,
      updated_at: user.updated_at
    }))

    console.log(`Successfully loaded ${usersWithRoles.length} users`)
    return usersWithRoles
  } catch (error) {
    console.error('Error getting admin users:', error)
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
    console.error('Error creating admin user:', error)
    return { success: false, error: error.message }
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
    console.error('Error updating admin user:', error)
    return { success: false, error: error.message }
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
    console.error('Error deleting admin user:', error)
    return { success: false, error: error.message }
  }
}

// KYC
export async function getKycRequests(): Promise<KycRequest[]> {
  const supabase = await supabaseServer()
  
  try {
    // Verificar si la tabla existe
    const { data, error } = await supabase
      .from('kyc_requests')
      .select(`
        id,
        user_id,
        document_type,
        document_number,
        status,
        submitted_at,
        reviewed_at,
        reviewed_by,
        notes
      `)
      .order('submitted_at', { ascending: false })
      .limit(1)

    if (error) {
      console.log('KYC table not found or error:', error.message)
      return []
    }

    // Si no hay datos, retornar array vacío
    if (!data || data.length === 0) {
      return []
    }

    // Obtener todos los datos
    const { data: allData, error: allError } = await supabase
      .from('kyc_requests')
      .select(`
        id,
        user_id,
        document_type,
        document_number,
        status,
        submitted_at,
        reviewed_at,
        reviewed_by,
        notes
      `)
      .order('submitted_at', { ascending: false })

    if (allError) throw allError

    // Obtener información de usuarios por separado
    const requestsWithUsers = await Promise.all(
      (allData || []).map(async (request) => {
        try {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('name, email')
            .eq('id', request.user_id)
            .single()

          return {
            id: request.id,
            user_id: request.user_id,
            user_name: userData?.name || '',
            user_email: userData?.email || '',
            document_type: request.document_type,
            document_number: request.document_number,
            status: request.status as "pending" | "approved" | "rejected",
            submitted_at: request.submitted_at,
            reviewed_at: request.reviewed_at,
            reviewed_by: request.reviewed_by,
            notes: request.notes,
            documents: [] // TODO: Implementar documentos
          }
        } catch (userError) {
          console.error(`Error getting user data for KYC ${request.id}:`, userError)
          return {
            id: request.id,
            user_id: request.user_id,
            user_name: '',
            user_email: '',
            document_type: request.document_type,
            document_number: request.document_number,
            status: request.status as "pending" | "approved" | "rejected",
            submitted_at: request.submitted_at,
            reviewed_at: request.reviewed_at,
            reviewed_by: request.reviewed_by,
            notes: request.notes,
            documents: []
          }
        }
      })
    )

    return requestsWithUsers
  } catch (error) {
    console.error('Error getting KYC requests:', error)
    return []
  }
}

export async function updateKycStatus(requestId: string, status: "approved" | "rejected", notes?: string) {
  const supabase = await supabaseServer()
  
  try {
    const { error } = await supabase
      .from('kyc_requests')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'Admin', // TODO: Obtener del usuario actual
        notes
      })
      .eq('id', requestId)

    if (error) throw error

    revalidatePath('/admin/kyc')
    return { success: true }
  } catch (error) {
    console.error('Error updating KYC status:', error)
    return { success: false, error: error.message }
  }
}
