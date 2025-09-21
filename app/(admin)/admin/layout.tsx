import type React from "react"
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
