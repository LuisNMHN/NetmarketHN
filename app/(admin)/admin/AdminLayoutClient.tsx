"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Gavel,
  LinkIcon,
  Wallet,
  FileText,
  Settings,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { Suspense } from "react"
import { supabaseBrowser } from "@/lib/supabase/client"
import { AuthSpinner } from "@/components/ui/auth-spinner"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Usuarios", href: "/admin/users", icon: Users },
  { name: "KYC", href: "/admin/kyc", icon: FileCheck },
  { name: "Subastas", href: "/admin/auctions", icon: Gavel },
  { name: "Links de Pago", href: "/admin/paylinks", icon: LinkIcon },
  { name: "Wallet/Saldo", href: "/admin/wallet", icon: Wallet },
  { name: "Reportes", href: "/admin/reports", icon: FileText },
  { name: "Ajustes", href: "/admin/settings", icon: Settings },
]

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [adminName, setAdminName] = useState<string>("Administrador")
  const [adminEmail, setAdminEmail] = useState<string>("admin@nmhn.com")
  const [adminInitials, setAdminInitials] = useState<string>("AD")
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    const loadAdmin = async () => {
      try {
        const supabase = supabaseBrowser()
        const { data } = await supabase.auth.getSession()
        const session = data.session
        if (!session) return

        const fallbackEmail = session.user.email || "admin@nmhn.com"
        setAdminEmail(fallbackEmail)

        // Intentar traer nombre desde perfiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .maybeSingle()

        const name = profile?.full_name || session.user.user_metadata?.full_name || fallbackEmail
        setAdminName(name)

        const initials = name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s.charAt(0).toUpperCase())
          .join("") || "AD"
        setAdminInitials(initials)
      } catch (e) {
        // En caso de error, dejamos los valores por defecto
      }
    }
    loadAdmin()
  }, [])

  const handleSignOut = async () => {
    setLogoutLoading(true)
    try {
      const supabase = supabaseBrowser()
      await supabase.auth.signOut()
    } catch {}
    // Pequeño delay para mostrar el spinner
    setTimeout(() => {
      window.location.href = "/login"
    }, 1000)
  }

  const handleConfirmSignOut = async () => {
    setLogoutLoading(true)
    setShowLogoutModal(false)
    try {
      const supabase = supabaseBrowser()
      await supabase.auth.signOut()
    } catch {}
    // Pequeño delay para mostrar el spinner
    setTimeout(() => {
      window.location.href = "/login"
    }, 1000)
  }

  const handleSignOutClick = () => {
    setShowLogoutModal(true)
  }

  const generateBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean)
    const breadcrumbs = [{ name: "Admin", href: "/admin" }]

    let currentPath = ""
    paths.forEach((path, index) => {
      if (index === 0) return // Skip 'admin'
      currentPath += `/${path}`
      const navItem = navigation.find((item) => item.href === `/admin${currentPath}`)
      breadcrumbs.push({
        name: navItem?.name || path.charAt(0).toUpperCase() + path.slice(1),
        href: `/admin${currentPath}`,
      })
    })

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {logoutLoading && <AuthSpinner message="Cerrando sesión..." />}
      <div className="flex min-h-screen bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            sidebarCollapsed ? "lg:w-16" : "lg:w-64",
            !sidebarCollapsed && "w-64",
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
              {!sidebarCollapsed && (
                <Link href="/admin" className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary">
                    <span className="text-lg font-bold text-sidebar-primary-foreground">N</span>
                  </div>
                  <span className="text-lg font-semibold text-sidebar-foreground">NMHN Admin</span>
                </Link>
              )}
              {sidebarCollapsed && (
                <Link href="/admin" className="flex items-center justify-center w-full">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary">
                    <span className="text-lg font-bold text-sidebar-primary-foreground">N</span>
                  </div>
                </Link>
              )}
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      sidebarCollapsed && "justify-center",
                    )}
                  >
                    <item.icon className="size-5 shrink-0" />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </Link>
                )
              })}
            </nav>

            {/* Collapse toggle (desktop only) */}
            <div className="hidden lg:block border-t border-sidebar-border p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full justify-center"
              >
                <Menu className="size-4" />
              </Button>
            </div>

            {/* User info */}
            {!sidebarCollapsed && (
              <div className="border-t border-sidebar-border p-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 w-full hover:bg-sidebar-accent rounded-lg p-2 transition-colors">
                      <div className="flex size-10 items-center justify-center rounded-full bg-sidebar-primary shrink-0">
                        <span className="text-sm font-semibold text-sidebar-primary-foreground">{adminInitials}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-sidebar-foreground truncate">{adminName}</p>
                        <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Perfil</DropdownMenuItem>
                    <DropdownMenuItem>Configuración</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOutClick} className="text-destructive">Cerrar Sesión</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="size-5" />
              </Button>

              {/* Breadcrumbs */}
              <nav className="hidden md:flex items-center gap-2 text-sm flex-1">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center gap-2">
                    {index > 0 && <ChevronRight className="size-4 text-muted-foreground" />}
                    <Link
                      href={crumb.href}
                      className={cn(
                        "hover:text-foreground transition-colors",
                        index === breadcrumbs.length - 1 ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      {crumb.name}
                    </Link>
                  </div>
                ))}
              </nav>

              {/* Search */}
              <div className="hidden sm:block relative w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-9 h-9" />
              </div>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="size-5" />
                    <span className="absolute top-1 right-1 size-2 bg-destructive rounded-full" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-96 overflow-y-auto">
                    <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                      <p className="text-sm font-medium">Nueva solicitud KYC</p>
                      <p className="text-xs text-muted-foreground">Hace 5 minutos</p>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                      <p className="text-sm font-medium">Subasta finalizada</p>
                      <p className="text-xs text-muted-foreground">Hace 1 hora</p>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                      <p className="text-sm font-medium">Nuevo pago recibido</p>
                      <p className="text-xs text-muted-foreground">Hace 2 horas</p>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-primary">
                    Ver todas las notificaciones
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View site button */}
              <Button variant="outline" size="sm" asChild className="hidden sm:flex bg-transparent">
                <Link href="/">Ver sitio</Link>
              </Button>
            </div>
          </header>

          {/* Main content area */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>

      {/* Modal de confirmación de logout */}
      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              Confirmar Salida
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-left space-y-2">
                <p>¿Estás seguro que deseas cerrar sesión?</p>
                <p className="text-sm text-muted-foreground">
                  Esta acción cerrará tu sesión actual y limpiará todos los datos locales almacenados en tu dispositivo.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowLogoutModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmSignOut} 
              className="w-full sm:w-auto"
              disabled={logoutLoading}
            >
              {logoutLoading ? "Cerrando..." : "Sí, Cerrar Sesión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Suspense>
  )
}
