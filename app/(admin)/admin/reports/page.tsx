"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, FileText, TrendingUp, Users, ShoppingCart, Calendar, Filter } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const reports = [
    {
      title: "Reporte de Usuarios",
      description: "Estadísticas completas de usuarios registrados",
      icon: Users,
      stats: "2,543 usuarios",
      period: "Último mes",
      category: "users",
    },
    {
      title: "Reporte de Ventas",
      description: "Análisis de ventas y transacciones",
      icon: ShoppingCart,
      stats: "L. 125,430",
      period: "Este mes",
      category: "sales",
    },
    {
      title: "Reporte de Crecimiento",
      description: "Métricas de crecimiento de la plataforma",
      icon: TrendingUp,
      stats: "+18.3%",
      period: "Trimestre actual",
      category: "growth",
    },
    {
      title: "Reporte General",
      description: "Resumen completo de todas las métricas",
      icon: FileText,
      stats: "145 reportes",
      period: "Total generados",
      category: "general",
    },
  ]

  const recentReports = [
    {
      name: "Reporte Mensual de Usuarios - Marzo 2025",
      date: "30 de Marzo, 2025",
      size: "2.4 MB",
      type: "PDF",
    },
    {
      name: "Análisis de Ventas - Q1 2025",
      date: "28 de Marzo, 2025",
      size: "1.8 MB",
      type: "Excel",
    },
    {
      name: "Estadísticas de Crecimiento - Febrero 2025",
      date: "28 de Febrero, 2025",
      size: "3.1 MB",
      type: "PDF",
    },
    {
      name: "Reporte General del Sistema - Enero 2025",
      date: "31 de Enero, 2025",
      size: "4.2 MB",
      type: "PDF",
    },
  ]

  // TODO: conectar a views/RPCs de Supabase para métricas agregadas
  const kpiData = [
    { label: "Total Usuarios", value: "2,543", change: "+12.5%" },
    { label: "Ingresos Totales", value: "L 125,430", change: "+18.2%" },
    { label: "Transacciones", value: "1,234", change: "+8.7%" },
    { label: "Tasa de Conversión", value: "3.2%", change: "+0.5%" },
  ]

  const handleGenerateReport = (category: string) => {
    console.log("[v0] Generating report for:", category, { dateFrom, dateTo })
    // TODO: Implement report generation logic
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Reportes y Estadísticas</h2>
        <p className="text-muted-foreground mt-2">Genera y descarga reportes del sistema</p>
      </div>

      {/* KPI Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary font-medium">{kpi.change}</span> vs mes anterior
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs for different report types */}
      <Card>
        <CardHeader>
          <CardTitle>Generador de Reportes</CardTitle>
          <CardDescription>Selecciona el tipo de reporte y el rango de fechas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="users">Usuarios</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="growth">Crecimiento</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>

            {["users", "sales", "growth", "general"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`date-from-${tab}`}>Fecha Desde</Label>
                    <Input
                      id={`date-from-${tab}`}
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`date-to-${tab}`}>Fecha Hasta</Label>
                    <Input
                      id={`date-to-${tab}`}
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="gap-2" onClick={() => handleGenerateReport(tab)}>
                    <Download className="size-4" />
                    Generar PDF
                  </Button>
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={() => handleGenerateReport(tab)}>
                    <Download className="size-4" />
                    Generar Excel
                  </Button>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <Filter className="size-4" />
                    Filtros Avanzados
                  </Button>
                </div>

                <div className="rounded-lg border border-border p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    <strong>Vista previa:</strong> Este reporte incluirá datos de{" "}
                    {tab === "users" && "usuarios registrados, actividad y demografía"}
                    {tab === "sales" && "ventas, transacciones y análisis de ingresos"}
                    {tab === "growth" && "métricas de crecimiento, retención y engagement"}
                    {tab === "general" && "un resumen completo de todas las métricas del sistema"}
                    {dateFrom && dateTo ? ` desde ${dateFrom} hasta ${dateTo}` : " del último mes"}.
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Reports */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {reports.map((report) => (
          <Card key={report.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                  <report.icon className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm">{report.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{report.description}</p>
              <div className="mb-3">
                <p className="text-xl font-bold text-foreground">{report.stats}</p>
                <p className="text-xs text-muted-foreground">{report.period}</p>
              </div>
              <Button size="sm" variant="outline" className="w-full gap-2 bg-transparent">
                <Download className="size-4" />
                Descargar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent reports */}
      <Card>
        <CardHeader>
          <CardTitle>Reportes Recientes</CardTitle>
          <CardDescription>Últimos reportes generados en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentReports.map((report, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                    <FileText className="size-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.date} • {report.size} • {report.type}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <Download className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reportes Programados</CardTitle>
              <CardDescription>Reportes que se generan automáticamente</CardDescription>
            </div>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Calendar className="size-4" />
              Programar Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "Reporte Mensual de Usuarios", frequency: "Mensual", nextRun: "1 de Abril, 2025" },
              { name: "Análisis Semanal de Ventas", frequency: "Semanal", nextRun: "Lunes, 31 de Marzo" },
              { name: "Resumen Diario de Actividad", frequency: "Diario", nextRun: "Mañana, 8:00 AM" },
            ].map((scheduled, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium text-foreground text-sm">{scheduled.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {scheduled.frequency} • Próxima ejecución: {scheduled.nextRun}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  Editar
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
