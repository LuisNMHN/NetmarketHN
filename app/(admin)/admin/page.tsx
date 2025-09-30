import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileCheck, Gavel, TrendingUp, LinkIcon, Wallet, DollarSign } from "lucide-react"
import { getAdminStats } from "@/app/actions/admin"

export default async function AdminPage() {
  const stats = await getAdminStats()
  
  const statsCards = [
    {
      title: "Usuarios Totales",
      value: stats.totalUsers.toString(),
      change: "+12.5%",
      icon: Users,
      description: "Registrados en el sistema",
    },
    {
      title: "KYC Pendientes",
      value: stats.pendingKyc.toString(),
      change: "+5",
      icon: FileCheck,
      description: "Requieren revisión",
    },
    {
      title: "KYC Aprobados",
      value: stats.approvedKyc.toString(),
      change: "+3",
      icon: Gavel,
      description: "Verificaciones completadas",
    },
    {
      title: "Usuarios Activos",
      value: stats.activeUsers.toString(),
      change: "+18.2%",
      icon: LinkIcon,
      description: "Con acceso al sistema",
    },
    {
      title: "KYC Rechazados",
      value: stats.rejectedKyc.toString(),
      change: "+8.5%",
      icon: Wallet,
      description: "Solicitudes denegadas",
    },
    {
      title: "Crecimiento",
      value: "18.3%",
      change: "+4.1%",
      icon: TrendingUp,
      description: "Tasa mensual",
    },
  ]

  const recentActivity = [
    { action: "Nueva solicitud KYC recibida", user: "Juan Pérez", time: "Hace 5 minutos" },
    { action: "Link de pago creado", user: "María García", time: "Hace 15 minutos" },
    { action: "Subasta finalizada", user: "Sistema", time: "Hace 1 hora" },
    { action: "Retiro procesado", user: "Carlos López", time: "Hace 2 horas" },
    { action: "Usuario verificado", user: "Ana Martínez", time: "Hace 3 horas" },
  ]

  const recentPayments = [
    { id: "PAY-001", amount: "L 1,250", status: "Completado", time: "Hace 10 min" },
    { id: "PAY-002", amount: "L 850", status: "Completado", time: "Hace 25 min" },
    { id: "PAY-003", amount: "L 2,100", status: "Pendiente", time: "Hace 1 hora" },
    { id: "PAY-004", amount: "L 450", status: "Completado", time: "Hace 2 horas" },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-2">Bienvenido al panel de administración de NMHN</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary font-medium">{stat.change}</span> {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity and Payments */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>Últimas acciones en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{activity.user}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos Recientes</CardTitle>
            <CardDescription>Últimas transacciones de links de pago</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <DollarSign className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{payment.id}</p>
                      <p className="text-xs text-muted-foreground">{payment.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{payment.amount}</p>
                    <p
                      className={`text-xs ${payment.status === "Completado" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                    >
                      {payment.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Accesos Rápidos</CardTitle>
          <CardDescription>Acciones frecuentes del administrador</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Revisar KYC", href: "/admin/kyc", icon: FileCheck },
              { label: "Gestionar Subastas", href: "/admin/auctions", icon: Gavel },
              { label: "Ver Links de Pago", href: "/admin/paylinks", icon: LinkIcon },
              { label: "Administrar Wallet", href: "/admin/wallet", icon: Wallet },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <link.icon className="size-5 text-primary" />
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
