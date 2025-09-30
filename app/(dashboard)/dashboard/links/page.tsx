"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Copy, ExternalLink, MoreHorizontal, Plus, Search, Filter } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { PaymentLinkDTO } from "@/lib/contracts/types"
import LoadingSpinner from "@/components/ui/loading-spinner"

const mockPaymentLinks: PaymentLinkDTO[] = [
  {
    id: "PL001",
    amount: 500,
    currency: "HNL",
    concept: "Pago de servicios de consultoría",
    status: "active",
    createdAt: "2024-01-20T10:00:00Z",
    expiresAt: "2024-02-20T10:00:00Z",
    maxUses: 1,
    url: "https://pay.nmhn.com/link/PL001",
  },
  {
    id: "PL002",
    amount: 25,
    currency: "USD",
    concept: "Suscripción mensual premium",
    status: "active",
    createdAt: "2024-01-18T10:00:00Z",
    expiresAt: "2024-02-18T10:00:00Z",
    maxUses: 1,
    url: "https://pay.nmhn.com/link/PL002",
  },
  {
    id: "PL003",
    amount: 1000,
    currency: "HNL",
    concept: "Pago de factura #12345",
    status: "expired",
    createdAt: "2024-01-15T10:00:00Z",
    expiresAt: "2024-01-30T10:00:00Z",
    maxUses: 3,
    url: "https://pay.nmhn.com/link/PL003",
  },
  {
    id: "PL004",
    amount: 150,
    currency: "USD",
    concept: "Curso online de desarrollo web",
    status: "active",
    createdAt: "2024-01-12T10:00:00Z",
    expiresAt: "2024-03-12T10:00:00Z",
    maxUses: 5,
    url: "https://pay.nmhn.com/link/PL004",
  },
]

export default function LinksPage() {
  const [loading, setLoading] = useState(true)
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkDTO[]>(mockPaymentLinks)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [createdLink, setCreatedLink] = useState<PaymentLinkDTO | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all")

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    currency: "HNL" as "HNL" | "USD",
    concept: "",
    expirationDate: undefined as Date | undefined,
    usageLimit: "",
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Simular carga inicial
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const filteredLinks = paymentLinks
    .filter((link) => {
      const matchesSearch =
        link.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || link.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      errors.amount = "El monto debe ser mayor a 0"
    }

    if (!formData.concept.trim()) {
      errors.concept = "El concepto es requerido"
    }

    if (!formData.expirationDate) {
      errors.expirationDate = "La fecha de expiración es requerida"
    } else if (formData.expirationDate <= new Date()) {
      errors.expirationDate = "La fecha debe ser futura"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const onCreatePaymentLink = async (linkData: Omit<PaymentLinkDTO, "id" | "url" | "createdAt">) => {
    const linkId = `PL${String(paymentLinks.length + 1).padStart(3, "0")}`
    const newLink: PaymentLinkDTO = {
      id: linkId,
      ...linkData,
      url: `https://pay.nmhn.com/link/${linkId}`,
      createdAt: new Date().toISOString(),
      status: "active",
    }

    setPaymentLinks([newLink, ...paymentLinks])
    setCreatedLink(newLink)

    // Reset form
    setFormData({
      amount: "",
      currency: "HNL",
      concept: "",
      expirationDate: undefined,
      usageLimit: "",
    })
    setFormErrors({})

    setIsCreateModalOpen(false)
    setIsPreviewModalOpen(true)
    toast.success("Link de pago creado exitosamente")
  }

  const onDisablePaymentLink = async (id: string) => {
    setPaymentLinks((links) => links.map((link) => (link.id === id ? { ...link, status: "expired" as const } : link)))
    toast.success("Link de pago deshabilitado")
  }

  const onCopyPaymentLink = async (url: string) => {
    await navigator.clipboard.writeText(url)
    toast.success("Link copiado al portapapeles")
  }

  const handleCreatePaymentLink = () => {
    if (!validateForm()) return

    onCreatePaymentLink({
      amount: Number.parseFloat(formData.amount),
      currency: formData.currency,
      concept: formData.concept,
      expiresAt: formData.expirationDate!.toISOString(),
      maxUses: formData.usageLimit ? Number.parseInt(formData.usageLimit) : undefined,
    })
  }

  const getStatusBadge = (status: PaymentLinkDTO["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Activo
          </Badge>
        )
      case "expired":
        return <Badge variant="secondary">Expirado</Badge>
    }
  }

  const isFormValid = () => {
    return (
      formData.amount &&
      Number.parseFloat(formData.amount) > 0 &&
      formData.concept.trim() &&
      formData.expirationDate &&
      formData.expirationDate > new Date()
    )
  }

  const getPreviewUrl = () => {
    if (!formData.concept) return "https://pay.nmhn.com/link/PLxxx"
    const previewId = `PL${String(paymentLinks.length + 1).padStart(3, "0")}`
    return `https://pay.nmhn.com/link/${previewId}`
  }

  if (loading) {
    return <LoadingSpinner message="Cargando links de pago..." />
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Links de Pago</h2>
            <p className="text-muted-foreground">Crea y gestiona links de pago para tus clientes</p>
          </div>

          {/* Botón desktop */}
          <Button className="hidden sm:flex items-center gap-2" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Crear Link de Pago
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros y Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por concepto o ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onValueChange={(value: "all" | "active" | "expired") => setStatusFilter(value)}
              >
                <SelectTrigger className="w-full">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links de Pago ({filteredLinks.length})</CardTitle>
          <CardDescription>Gestiona todos tus links de pago activos y pasados</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLinks.length === 0 ? (
            <div className="text-center py-12">
              <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay links de pago</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "No se encontraron links con los filtros aplicados"
                  : "Crea tu primer link de pago para empezar"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLinks.map((link) => (
                <Card key={link.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-mono">{link.id}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(link.status)}
                          <Badge variant="outline" className="text-xs">
                            {link.currency}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Abrir menú</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onCopyPaymentLink(link.url!)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar Link
                          </DropdownMenuItem>
                          {link.status === "active" && (
                            <DropdownMenuItem onClick={() => onDisablePaymentLink(link.id!)} className="text-red-600">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Deshabilitar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Concepto</p>
                      <p className="text-sm line-clamp-2" title={link.concept}>
                        {link.concept}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monto</p>
                      <p className="text-lg font-semibold">
                        {link.currency} {link.amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-medium text-muted-foreground">Creado</p>
                        <p>{format(new Date(link.createdAt!), "dd/MM/yyyy", { locale: es })}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Expira</p>
                        <p>{format(new Date(link.expiresAt!), "dd/MM/yyyy", { locale: es })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        className="fixed bottom-16 right-4 sm:hidden h-14 w-14 rounded-full shadow-lg"
        size="icon"
        onClick={() => setIsCreateModalOpen(true)}
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Crear Link de Pago</span>
      </Button>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Link de Pago</DialogTitle>
            <DialogDescription>Completa los datos para generar un nuevo link de pago</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className={`w-full ${formErrors.amount ? "border-red-500" : ""}`}
                />
                {formErrors.amount && <p className="text-sm text-red-500">{formErrors.amount}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Moneda *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value: "HNL" | "USD") => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HNL">HNL</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="concept">Concepto *</Label>
              <Textarea
                id="concept"
                placeholder="Describe el motivo del pago"
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                className={`w-full ${formErrors.concept ? "border-red-500" : ""}`}
              />
              {formErrors.concept && <p className="text-sm text-red-500">{formErrors.concept}</p>}
            </div>

            <div className="space-y-2">
              <Label>Fecha de Expiración *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${formErrors.expirationDate ? "border-red-500" : ""}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expirationDate
                      ? format(formData.expirationDate, "PPP", { locale: es })
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.expirationDate}
                    onSelect={(date) => setFormData({ ...formData, expirationDate: date })}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {formErrors.expirationDate && <p className="text-sm text-red-500">{formErrors.expirationDate}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageLimit">Límite de Usos (Opcional)</Label>
              <Input
                id="usageLimit"
                type="number"
                min="1"
                placeholder="Sin límite"
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview del Link:</Label>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-mono text-muted-foreground break-all">{getPreviewUrl()}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleCreatePaymentLink} disabled={!isFormValid()} className="w-full sm:w-auto">
              Crear Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link de Pago Creado</DialogTitle>
            <DialogDescription>Tu link de pago ha sido generado exitosamente</DialogDescription>
          </DialogHeader>

          {createdLink && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">ID:</Label>
                  <p className="font-mono font-medium">{createdLink.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Monto:</Label>
                  <p className="font-semibold">
                    {createdLink.currency} {createdLink.amount.toLocaleString()}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Concepto:</Label>
                  <p className="text-sm">{createdLink.concept}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">URL del Link de Pago:</Label>
                <div className="p-3 bg-background border rounded-lg">
                  <p className="text-sm font-mono break-all">{createdLink.url}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                if (createdLink) onCopyPaymentLink(createdLink.url!)
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
