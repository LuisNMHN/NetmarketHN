import type React from "react"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import AdminLayoutClient from "./AdminLayoutClient"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Gateo SSR: verificar autenticación y rol admin
  const supabase = await supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/login')
  }

  // Verificar si el usuario tiene rol admin
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles!inner(name)
    `)
    .eq('user_id', session.user.id)
    .eq('roles.name', 'admin')
    .maybeSingle()

  if (!userRoles) {
    redirect('/dashboard')
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
