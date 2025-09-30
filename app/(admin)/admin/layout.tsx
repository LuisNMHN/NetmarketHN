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
  const supabase = supabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/login')
  }

  // Verificar si el usuario tiene rol admin
  const { data: hasAdminRole } = await supabase.rpc('has_role', { 
    role_name: 'admin' 
  })

  if (!hasAdminRole) {
    redirect('/dashboard')
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
