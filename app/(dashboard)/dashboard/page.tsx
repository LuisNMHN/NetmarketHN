import { redirect } from "next/navigation"

export default function DashboardPage() {
  // Redirect del servidor - más rápido que redirect del cliente
  redirect("/dashboard/saldo")
}
