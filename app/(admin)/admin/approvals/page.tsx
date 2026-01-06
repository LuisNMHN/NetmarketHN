"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, Clock, Gavel, UserCheck, Search, Eye } from "lucide-react"

type RequestType = "auction" | "verification" | "other"
type RequestStatus = "pending" | "approved" | "rejected"

interface Request {
  id: string
  type: RequestType
  title: string
  user: {
    name: string
    email: string
    id: string
  }
  description: string
  status: RequestStatus
  createdAt: string
  details: Record<string, any>
}

const mockRequests: Request[] = [
  {
    id: "REQ-002",
    type: "auction",
    title: "Crear Subasta - Vehículo Toyota Corolla 2020",
    user: {
      name: "María López",
      email: "maria@example.com",
      id: "USR-124",
    },
    description: "Solicito crear una subasta para vehículo en excelente estado",
    status: "pending",
    createdAt: "2024-01-15T09:15:00",
    details: {
      startingPrice: "L 180,000.00",
      duration: "7 días",
      category: "Vehículos",
      condition: "Usado - Excelente",
    },
  },
  {
    id: "REQ-003",
    type: "verification",
    title: "Verificación de Usuario - Vendedor Profesional",
    user: {
      name: "Roberto Sánchez",
      email: "roberto@example.com",
      id: "USR-125",
    },
    description: "Solicito verificación como vendedor profesional con documentos adjuntos",
    status: "pending",
    createdAt: "2024-01-15T08:45:00",
    details: {
      businessName: "Electrónica RS",
      rtn: "08011234567890",
      documents: "RTN, Permiso de operación",
    },
  },
  {
    id: "REQ-005",
    type: "verification",
    title: "Verificación de Usuario - Cuenta Personal",
    user: {
      name: "Luis Hernández",
      email: "luis@example.com",
      id: "USR-127",
    },
    description: "Solicito verificación de identidad",
    status: "rejected",
    createdAt: "2024-01-14T14:10:00",
    details: {
      idNumber: "0801-1990-12345",
      reason: "Documentos no legibles",
    },
  },
]

const requestTypeConfig = {
  auction: {
    label: "Subasta",
    icon: Gavel,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  verification: {
    label: "Verificación",
    icon: UserCheck,
    color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  },
  other: {
    label: "Otro",
    icon: Clock,
    color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  },
}

const statusConfig = {
  pending: {
    label: "Pendiente",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  approved: {
    label: "Aprobada",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  rejected: {
    label: "Rechazada",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
  },
}

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<Request[]>(mockRequests)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [actionNote, setActionNote] = useState("")
  const [filterType, setFilterType] = useState<RequestType | "all">("all")
  const [filterStatus, setFilterStatus] = useState<RequestStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredRequests = requests.filter((request) => {
    const matchesType = filterType === "all" || request.type === filterType
    const matchesStatus = filterStatus === "all" || request.status === filterStatus
    const matchesSearch =
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.id.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesType && matchesStatus && matchesSearch
  })

  const pendingCount = requests.filter((r) => r.status === "pending").length
  const approvedCount = requests.filter((r) => r.status === "approved").length
  const rejectedCount = requests.filter((r) => r.status === "rejected").length

  const handleViewDetails = (request: Request) => {
    setSelectedRequest(request)
    setDetailsOpen(true)
  }

  const handleAction = (request: Request, action: "approve" | "reject") => {
    setSelectedRequest(request)
    setActionType(action)
    setActionDialogOpen(true)
  }

  const confirmAction = () => {
    if (!selectedRequest) return

    setRequests(
      requests.map((r) =>
        r.id === selectedRequest.id ? { ...r, status: actionType === "approve" ? "approved" : "rejected" } : r,
      ),
    )

    setActionDialogOpen(false)
    setActionNote("")
    setSelectedRequest(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Aprobaciones</h2>
        <p className="text-muted-foreground mt-2">Gestiona las solicitudes de usuarios de la plataforma NMHN</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
            <CheckCircle className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
            <XCircle className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, título o usuario..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(value) => setFilterType(value as RequestType | "all")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="auction">Subasta</SelectItem>
                <SelectItem value="verification">Verificación</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as RequestStatus | "all")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="approved">Aprobada</SelectItem>
                <SelectItem value="rejected">Rechazada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes</CardTitle>
          <CardDescription>{filteredRequests.length} solicitud(es) encontrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No se encontraron solicitudes
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => {
                    const TypeIcon = requestTypeConfig[request.type].icon
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-sm">{request.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={requestTypeConfig[request.type].color}>
                            <TypeIcon className="size-3 mr-1" />
                            {requestTypeConfig[request.type].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{request.title}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{request.user.name}</div>
                            <div className="text-sm text-muted-foreground">{request.user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig[request.status].color}>
                            {statusConfig[request.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString("es-HN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetails(request)}>
                              <Eye className="size-4" />
                            </Button>
                            {request.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAction(request, "approve")}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <CheckCircle className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAction(request, "reject")}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="size-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Solicitud</DialogTitle>
            <DialogDescription>Información completa de la solicitud {selectedRequest?.id}</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Tipo</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={requestTypeConfig[selectedRequest.type].color}>
                      {requestTypeConfig[selectedRequest.type].label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={statusConfig[selectedRequest.status].color}>
                      {statusConfig[selectedRequest.status].label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Título</Label>
                <p className="mt-1 text-sm">{selectedRequest.title}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Descripción</Label>
                <p className="mt-1 text-sm">{selectedRequest.description}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Usuario</Label>
                <div className="mt-1 space-y-1">
                  <p className="text-sm font-medium">{selectedRequest.user.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.user.email}</p>
                  <p className="text-sm text-muted-foreground">ID: {selectedRequest.user.id}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Detalles Adicionales</Label>
                <div className="mt-2 rounded-lg bg-muted p-4 space-y-2">
                  {Object.entries(selectedRequest.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                      <span className="text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Fecha de Solicitud</Label>
                <p className="mt-1 text-sm">
                  {new Date(selectedRequest.createdAt).toLocaleString("es-HN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Cerrar
            </Button>
            {selectedRequest?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailsOpen(false)
                    handleAction(selectedRequest, "reject")
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  Rechazar
                </Button>
                <Button
                  onClick={() => {
                    setDetailsOpen(false)
                    handleAction(selectedRequest, "approve")
                  }}
                >
                  Aprobar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "approve" ? "Aprobar" : "Rechazar"} Solicitud</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas {actionType === "approve" ? "aprobar" : "rechazar"} la solicitud{" "}
              {selectedRequest?.id}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note">Nota (opcional)</Label>
              <Textarea
                id="note"
                placeholder={`Agrega una nota sobre esta ${actionType === "approve" ? "aprobación" : "rechazo"}...`}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmAction} variant={actionType === "approve" ? "default" : "destructive"}>
              {actionType === "approve" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
