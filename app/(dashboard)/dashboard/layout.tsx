"use client"

import type React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreditCard, Gavel, Home, LogOut, Receipt, User, Menu, MoreVertical, Link2, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface DashboardLayoutProps {
  children: React.ReactNode
  userName?: string
  userAvatar?: string
}

const menuItems = [
  { id: "resumen", label: "Resumen", icon: Home, href: "/dashboard" },
  { id: "saldo", label: "Saldo", icon: CreditCard, href: "/dashboard/saldo" },
  { id: "subastas", label: "Subastas", icon: Gavel, href: "/dashboard/subastas" },
  { id: "transacciones", label: "Transacciones", icon: Receipt, href: "/dashboard/transacciones" },
  { id: "links", label: "Links de Pago", icon: Link2, href: "/dashboard/links" },
  { id: "verificacion", label: "Verificación", icon: Shield, href: "/dashboard/verificacion" },
  { id: "perfil", label: "Perfil", icon: User, href: "/dashboard/perfil" },
]

export default function DashboardLayout({ children, userName = "Usuario", userAvatar }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  const getSectionTitle = (pathname: string) => {
    if (pathname === "/dashboard") return "Resumen"
    if (pathname.startsWith("/dashboard/subastas")) return "Subastas"
    if (pathname.startsWith("/dashboard/saldo")) return "Saldo"
    if (pathname.startsWith("/dashboard/transacciones")) return "Transacciones"
    if (pathname.startsWith("/dashboard/links")) return "Links de Pago"
    if (pathname.startsWith("/dashboard/verificacion")) return "Verificación"
    if (pathname.startsWith("/dashboard/perfil")) return "Perfil"
    return "Dashboard"
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  const toggleTheme = () => {
    if (resolvedTheme === "dark") {
      setTheme("light")
    } else {
      setTheme("dark")
    }
  }

  const handleLogout = () => {
    // Mock: Clear local storage, session data, etc.
    localStorage.clear()
    sessionStorage.clear()

    window.location.href = "/auth/login"
  }

  const handleLogoutClick = () => {
    setShowLogoutModal(true)
  }

  if (!mounted) {
    return (
      <div className="flex h-screen bg-white dark:bg-gray-950">
        <div className="hidden lg:block w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800"></div>
        <div className="flex-1 bg-white dark:bg-gray-950"></div>
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <>
      <div
        className="flex h-screen bg-background"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        <aside
          className={cn(
            "flex flex-col bg-sidebar border-r border-sidebar-border shadow transition-all duration-300",
            "hidden lg:flex", // Desktop: siempre visible en lg+
            sidebarCollapsed ? "w-16" : "w-64",
            // Móvil/tablet: overlay cuando está abierto
            "lg:relative fixed inset-y-0 left-0 z-50",
            mobileMenuOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-4 py-4 border-b border-sidebar-border">
              <div className="flex flex-col items-start space-y-1">
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-primary">NM</span>
                  {!sidebarCollapsed && <span className="text-2xl font-bold text-sidebar-foreground">HN</span>}
                </div>
                {!sidebarCollapsed && <span className="text-xs font-medium text-sidebar-foreground">Dashboard</span>}
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-2 py-4">
              <ul className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  const itemIsActive = isActive(item.href)

                  return (
                    <li key={item.id}>
                      <Button
                        asChild
                        variant={itemIsActive ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start !pl-4 !pr-3 gap-3 rounded-2xl h-12 transition-all duration-200",
                          itemIsActive
                            ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                          sidebarCollapsed && "justify-center !px-0",
                        )}
                      >
                        <Link href={item.href} title={sidebarCollapsed ? item.label : undefined}>
                          <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                            <Icon className="h-5 w-5" />
                          </span>
                          {!sidebarCollapsed && <span className="text-left">{item.label}</span>}
                        </Link>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-sidebar-border">
              <Button
                variant="ghost"
                onClick={handleLogoutClick}
                className={cn(
                  "w-full justify-start !pl-4 !pr-3 gap-3 rounded-2xl h-12 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200",
                  sidebarCollapsed && "justify-center !px-0",
                )}
                title={sidebarCollapsed ? "Salir" : undefined}
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                  <LogOut className="h-5 w-5" />
                </span>
                {!sidebarCollapsed && <span className="text-left">Salir</span>}
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-card border-b border-border shadow px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // En móvil/tablet: toggle mobile menu
                    if (window.innerWidth < 1024) {
                      setMobileMenuOpen(!mobileMenuOpen)
                    } else {
                      // En desktop: toggle collapse
                      setSidebarCollapsed(!sidebarCollapsed)
                    }
                  }}
                  className="flex rounded-full h-10 w-10 bg-muted hover:bg-muted/80 transition-all duration-200 lg:hidden xl:flex"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle sidebar</span>
                </Button>

                <h1 className="text-xl md:text-2xl font-semibold text-card-foreground">{getSectionTitle(pathname)}</h1>
              </div>

              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="hidden sm:flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="rounded-full h-11 w-11 bg-muted hover:bg-muted/80 transition-all duration-200 border border-border"
                    title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  >
                    <div className="flex items-center justify-center">
                      {isDark ? (
                        <svg className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="sr-only">Cambiar tema</span>
                  </Button>

                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarImage src={userAvatar || "/placeholder.svg"} alt={userName} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="sm:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-11 w-11 bg-muted hover:bg-muted/80 transition-all duration-200"
                      >
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">Abrir menú</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={toggleTheme} className="flex items-center space-x-2">
                        {isDark ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                            />
                          </svg>
                        )}
                        <span>{isDark ? "Modo claro" : "Modo oscuro"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Perfil</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center space-x-2">
                        <Link2 className="h-4 w-4" />
                        <span>Links de Pago</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center space-x-2">
                        <Shield className="h-4 w-4" />
                        <span>Verificación</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleLogoutClick} className="flex items-center space-x-2">
                        <LogOut className="h-4 w-4" />
                        <span>Salir</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 pb-24 lg:pb-6">{children}</div>
          </main>
        </div>

        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50"
          style={{
            paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <nav className="flex justify-around px-2 py-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const itemIsActive = isActive(item.href)

              return (
                <Button
                  key={item.id}
                  asChild
                  variant="ghost"
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center h-12 rounded-xl transition-all duration-200 mx-1",
                    itemIsActive
                      ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Link href={item.href} className="flex flex-col items-center justify-center w-full h-full">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="text-xs font-medium leading-none mt-1 truncate hidden md:inline">
                      {item.label}
                    </span>
                  </Link>
                </Button>
              )
            })}
          </nav>
        </div>
      </div>

      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              Confirmar Salida
            </DialogTitle>
            <DialogDescription className="text-left space-y-2">
              <p>¿Estás seguro que deseas cerrar sesión?</p>
              <p className="text-sm text-muted-foreground">
                Esta acción cerrará tu sesión actual y limpiará todos los datos locales almacenados en tu dispositivo.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowLogoutModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
              Sí, Cerrar Sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
