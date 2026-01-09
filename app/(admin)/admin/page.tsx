import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileCheck, TrendingUp, Wallet, DollarSign, CheckCircle, UserCheck, BarChart3, Coins, Activity } from "lucide-react"
import { getAdminStats } from "@/app/actions/admin"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

export default async function AdminPage() {
  const stats = await getAdminStats()
  
  const statsCards = [
    {
      title: "Usuarios Totales",
      value: stats.totalUsers.toString(),
      change: "+12.5%",
      icon: Users,
      description: "Registrados en el sistema",
      href: "/admin/users",
    },
    {
      title: "KYC Pendientes",
      value: stats.pendingKyc.toString(),
      change: "+5",
      icon: FileCheck,
      description: "Requieren revisión",
      href: "/admin/kyc",
      urgent: stats.pendingKyc > 0,
    },
    {
      title: "KYC Aprobados",
      value: stats.approvedKyc.toString(),
      change: "+3",
      icon: CheckCircle,
      description: "Verificaciones completadas",
      href: "/admin/kyc",
    },
    {
      title: "Usuarios Activos",
      value: stats.activeUsers.toString(),
      change: "+18.2%",
      icon: UserCheck,
      description: "Con acceso al sistema",
      href: "/admin/users",
    },
    {
      title: "Mercados Activos",
      value: stats.activeMarkets.toString(),
      change: `${stats.totalMarkets} total`,
      icon: BarChart3,
      description: "Mercados de predicción",
      href: "/admin/prediction-markets/permissions",
    },
    {
      title: "Creadores Autorizados",
      value: stats.totalMarketCreators.toString(),
      change: "Con permisos",
      icon: TrendingUp,
      description: "Pueden crear mercados",
      href: "/admin/prediction-markets/permissions",
    },
    {
      title: "Balance Total HNLD",
      value: formatCurrency(stats.totalHNLDBalance),
      change: "En circulación",
      icon: Coins,
      description: "Total en el sistema",
      href: "/admin/wallet",
    },
    {
      title: "Transacciones HNLD",
      value: stats.totalTransactions.toString(),
      change: "Total",
      icon: Activity,
      description: "Historial completo",
      href: "/admin/wallet",
    },
  ]

  const recentActivity = [
    { action: "Nueva solicitud KYC recibida", user: "Juan Pérez", time: "Hace 5 minutos" },
    { action: "Mercado de predicción creado", user: "María García", time: "Hace 15 minutos" },
    { action: "Retiro procesado", user: "Carlos López", time: "Hace 1 hora" },
    { action: "Usuario verificado", user: "Ana Martínez", time: "Hace 2 horas" },
    { action: "Transferencia completada", user: "Pedro Sánchez", time: "Hace 3 horas" },
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Link key={stat.title} href={stat.href || "#"}>
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${stat.urgent ? 'border-orange-500 border-2' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`size-4 ${stat.urgent ? 'text-orange-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-primary font-medium">{stat.change}</span> {stat.description}
                </p>
                {stat.urgent && (
                  <p className="text-xs text-orange-600 font-medium mt-1">⚠️ Requiere atención</p>
                )}
              </CardContent>
            </Card>
          </Link>
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
            <CardDescription>Últimas transacciones</CardDescription>
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
              { label: "Revisar KYC", href: "/admin/kyc", icon: FileCheck, description: "Verificar identidades" },
              { label: "Administrar Wallet", href: "/admin/wallet", icon: Wallet, description: "Gestionar saldos" },
              { label: "Gestionar Usuarios", href: "/admin/users", icon: Users, description: "Ver y editar usuarios" },
              { label: "Permisos Predicciones", href: "/admin/prediction-markets/permissions", icon: TrendingUp, description: "Controlar creadores" },
              { label: "Ver Reportes", href: "/admin/reports", icon: BarChart3, description: "Análisis y métricas" },
              { label: "Configuración", href: "/admin/settings", icon: CheckCircle, description: "Ajustes del sistema" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <link.icon className="size-5 text-primary" />
                  <span className="font-semibold">{link.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
