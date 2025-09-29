"use server"

import { supabaseServer } from "@/lib/supabaseServer"
import { sendApprovalEmail, sendRejectionEmail } from "@/lib/email-service"
import { revalidatePath } from "next/cache"

interface ActionResult<T = unknown> {
  ok: boolean
  message: string
  data?: T
}

export async function approveKyc(userId: string, reason?: string): Promise<ActionResult> {
  const supabase = await supabaseServer()

  try {
    // Actualizar estado a aprobado
    const { error: updateError } = await supabase
      .from("kyc_submissions")
      .update({ 
        status: "approved", 
        updated_at: new Date().toISOString(),
        admin_notes: reason || "Verificación aprobada"
      })
      .eq("user_id", userId)

    if (updateError) {
      console.error('Error actualizando estado KYC:', updateError)
      return { ok: false, message: "No se pudo aprobar la verificación." }
    }

    // Obtener datos del usuario para enviar correo
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single()

    if (userError || !userData) {
      console.error('Error obteniendo datos del usuario:', userError)
      return { ok: false, message: "No se pudieron obtener los datos del usuario." }
    }

    // Enviar correo de aprobación
    try {
      await sendApprovalEmail(userData.email, userData.full_name || 'Usuario')
      console.log(`✅ Correo de aprobación enviado a ${userData.email}`)
    } catch (emailError) {
      console.error('Error enviando correo de aprobación:', emailError)
      // No fallar la operación si el correo falla
    }

    // Invalidar caché
    revalidatePath("/dashboard/verificacion")
    
    return { 
      ok: true, 
      message: "Verificación aprobada exitosamente. Se ha enviado un correo de confirmación al usuario." 
    }
  } catch (error) {
    console.error('Error en approveKyc:', error)
    return { ok: false, message: "Error interno del servidor." }
  }
}

export async function rejectKyc(userId: string, reason: string): Promise<ActionResult> {
  const supabase = await supabaseServer()

  try {
    // Actualizar estado a rechazado
    const { error: updateError } = await supabase
      .from("kyc_submissions")
      .update({ 
        status: "rejected", 
        updated_at: new Date().toISOString(),
        admin_notes: reason
      })
      .eq("user_id", userId)

    if (updateError) {
      console.error('Error actualizando estado KYC:', updateError)
      return { ok: false, message: "No se pudo rechazar la verificación." }
    }

    // Obtener datos del usuario para enviar correo
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single()

    if (userError || !userData) {
      console.error('Error obteniendo datos del usuario:', userError)
      return { ok: false, message: "No se pudieron obtener los datos del usuario." }
    }

    // Enviar correo de rechazo
    try {
      await sendRejectionEmail(userData.email, userData.full_name || 'Usuario', reason)
      console.log(`✅ Correo de rechazo enviado a ${userData.email}`)
    } catch (emailError) {
      console.error('Error enviando correo de rechazo:', emailError)
      // No fallar la operación si el correo falla
    }

    // Invalidar caché
    revalidatePath("/dashboard/verificacion")
    
    return { 
      ok: true, 
      message: "Verificación rechazada. Se ha enviado un correo al usuario con las instrucciones." 
    }
  } catch (error) {
    console.error('Error en rejectKyc:', error)
    return { ok: false, message: "Error interno del servidor." }
  }
}

export async function getKycSubmissions(): Promise<ActionResult<any[]>> {
  const supabase = await supabaseServer()

  try {
    const { data, error } = await supabase
      .from("kyc_submissions")
      .select(`
        *,
        profiles!inner(email, full_name)
      `)
      .eq("status", "review")
      .order("updated_at", { ascending: false })

    if (error) {
      console.error('Error obteniendo submissions KYC:', error)
      return { ok: false, message: "No se pudieron obtener las verificaciones pendientes." }
    }

    return { ok: true, message: "Verificaciones obtenidas", data }
  } catch (error) {
    console.error('Error en getKycSubmissions:', error)
    return { ok: false, message: "Error interno del servidor." }
  }
}

