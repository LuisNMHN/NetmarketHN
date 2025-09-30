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
    // Obtener estadísticas básicas
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: pendingKyc },
      { count: approvedKyc },
      { count: rejectedKyc }
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'rejected')
    ])

    return {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      pendingKyc: pendingKyc || 0,
      approvedKyc: approvedKyc || 0,
      rejectedKyc: rejectedKyc || 0,
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        name,
        phone,
        status,
        created_at,
        updated_at,
        user_roles (
          roles (
            name
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data?.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name || '',
      phone: user.phone || '',
      roles: user.user_roles?.map((ur: any) => ur.roles.name) || [],
      status: user.status as "active" | "inactive",
      created_at: user.created_at,
      updated_at: user.updated_at
    })) || []
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
        notes,
        user_profiles (
          name,
          email
        )
      `)
      .order('submitted_at', { ascending: false })

    if (error) throw error

    return data?.map(request => ({
      id: request.id,
      user_id: request.user_id,
      user_name: request.user_profiles?.name || '',
      user_email: request.user_profiles?.email || '',
      document_type: request.document_type,
      document_number: request.document_number,
      status: request.status as "pending" | "approved" | "rejected",
      submitted_at: request.submitted_at,
      reviewed_at: request.reviewed_at,
      reviewed_by: request.reviewed_by,
      notes: request.notes,
      documents: [] // TODO: Implementar documentos
    })) || []
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
