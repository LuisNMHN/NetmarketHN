import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Información legal | NetMarketHN",
  description: "Términos y condiciones, Política de privacidad y avisos legales de NetMarketHN.",
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container-page py-6">
          <nav className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              Inicio
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">Información legal</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Información legal</h1>
        </div>
      </header>
      <main className="container-page py-8">{children}</main>
    </div>
  )
}
