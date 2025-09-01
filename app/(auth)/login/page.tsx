"use client"
import Link from "next/link"

export default function LoginPage() {
  return (
    <div className="w-full max-w-md rounded-2xl border bg-card text-card-foreground p-6 shadow">
      <h1 className="text-2xl font-semibold text-center">Iniciar sesión</h1>
      <p className="text-sm text-center text-muted-foreground mt-1">Accede a tu cuenta</p>
      {/* Aquí luego pegas la UI de v0 para login */}
      <p className="text-sm text-center mt-4">
        ¿No tienes cuenta? <Link href="/register" className="underline">Crear cuenta</Link>
      </p>
    </div>
  )
}
