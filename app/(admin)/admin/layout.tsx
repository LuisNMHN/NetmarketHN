import type React from "react"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Gateo en servidor: si no es admin, redirigir a dashboard
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: isAdmin } = await supabase.rpc('has_role', { role_name: 'admin' })
  if (!isAdmin) redirect("/dashboard")

  return (
    <div className="flex min-h-screen">
      {/* Admin sidebar placeholder */}
      <aside className="w-64 bg-sidebar-background border-r border-sidebar-border">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-sidebar-foreground">Admin Sidebar (pendiente)</h2>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        {/* Admin header placeholder */}
        <header className="border-b bg-background p-4">
          <h1 className="text-lg font-semibold text-foreground">Admin Header (pendiente)</h1>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
