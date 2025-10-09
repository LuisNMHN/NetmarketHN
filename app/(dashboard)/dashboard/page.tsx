"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  DollarSign,
  Users,
  ShoppingCart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Clock,
} from "lucide-react"
import Link from "next/link"
import LoadingSpinner from "@/components/ui/loading-spinner"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
      setLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  if (loading || !mounted) {
    return <LoadingSpinner message="Cargando resumen..." />
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base md:text-lg font-semibold">Balance Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,847.50</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12.5%
              </span>
              desde el mes pasado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base md:text-lg font-semibold">Subastas Activas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-blue-600 flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                +3
              </span>
              nuevas esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base md:text-lg font-semibold">Transacciones</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8
              </span>
              este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base md:text-lg font-semibold">Links Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-orange-600 flex items-center">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                -2
              </span>
              desde la semana pasada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg font-semibold">
              <Clock className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>Últimas transacciones y eventos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Pago recibido</p>
                <p className="text-xs text-muted-foreground">Link PL001 - $500.00 HNL</p>
              </div>
              <div className="text-xs text-muted-foreground">Hace 2h</div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Nueva subasta creada</p>
                <p className="text-xs text-muted-foreground">Subasta #SB005 - $150.00 USD</p>
              </div>
              <div className="text-xs text-muted-foreground">Hace 4h</div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Retiro procesado</p>
                <p className="text-xs text-muted-foreground">$200.00 USD a cuenta ****1234</p>
              </div>
              <div className="text-xs text-muted-foreground">Ayer</div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Verificación completada</p>
                <p className="text-xs text-muted-foreground">Documentos aprobados</p>
              </div>
              <div className="text-xs text-muted-foreground">Hace 2 días</div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg font-semibold">Acciones Rápidas</CardTitle>
            <CardDescription>Accede rápidamente a las funciones principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button asChild variant="outline" className="h-20 flex-col space-y-2 bg-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-md transition">
                <Link href="/dashboard/links">
                  <Users className="h-6 w-6" />
                  <span>Crear Link</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-20 flex-col space-y-2 bg-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-md transition">
                <Link href="/dashboard/subastas">
                  <ShoppingCart className="h-6 w-6" />
                  <span>Nueva Subasta</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-20 flex-col space-y-2 bg-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-md transition">
                <Link href="/dashboard/saldo">
                  <DollarSign className="h-6 w-6" />
                  <span>Balance HNLD</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-20 flex-col space-y-2 bg-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-md transition">
                <Link href="/dashboard/transacciones">
                  <Activity className="h-6 w-6" />
                  <span>Transacciones</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress & Status */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg font-semibold">Estado de la Cuenta</CardTitle>
            <CardDescription>Progreso de verificación y configuración</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Perfil completado</span>
                <span>85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Información básica</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Completo
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Verificación KYC</span>
                <Badge variant="secondary">Pendiente</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Método de pago</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Configurado
                </Badge>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full bg-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-md transition">
              <Link href="/dashboard/verificacion">Completar Verificación</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg font-semibold">
              <Calendar className="h-5 w-5" />
              Resumen Mensual
            </CardTitle>
            <CardDescription>Enero 2024</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ingresos</p>
                <p className="text-2xl font-bold text-green-600">$1,247.50</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Gastos</p>
                <p className="text-2xl font-bold text-red-600">$347.20</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Meta mensual</span>
                <span>62%</span>
              </div>
              <Progress value={62} className="h-2" />
              <p className="text-xs text-muted-foreground">$900.30 restantes para alcanzar $2,000</p>
            </div>

            <Button asChild variant="outline" className="w-full bg-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-md transition">
              <Link href="/dashboard/transacciones">Ver Detalles</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
