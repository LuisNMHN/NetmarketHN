import "../globals.css"

export const metadata = { title: "Acceso | NetMarketHN" }

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      {children}
    </div>
  )
}
