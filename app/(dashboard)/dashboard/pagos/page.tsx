"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatAmount } from "@/lib/utils"
import { 
  createNAVPOID,
  createNAVPPayment,
  processOCRScan,
  validateNAVPPayment,
  completeNAVPPayment,
  getUserNAVPPayments,
  getUserOIDs,
  getAvailableSTCs,
  getPaymentByCode,
  type NAVPPayment,
  type NAVPOID,
  type NAVPSTC
} from "@/lib/actions/navp"
import { 
  simpleOCRTextExtraction,
  generateSimpleQRCode
} from "@/lib/utils/navp-utils"
import { 
  QrCode, 
  Link, 
  Scan, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Plus,
  Eye,
  Copy,
  Download,
  Upload,
  RefreshCw,
  CreditCard,
  Smartphone
} from "lucide-react"

export default function PagosPage() {
  const [payments, setPayments] = useState<NAVPPayment[]>([])
  const [oids, setOids] = useState<NAVPOID[]>([])
  const [stcs, setStcs] = useState<NAVPSTC[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false)
  const [createOIDOpen, setCreateOIDOpen] = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<NAVPPayment | null>(null)
  const { toast } = useToast()

  // Form states
  const [paymentForm, setPaymentForm] = useState({
    oidId: "",
    stcId: "",
    amount: "",
    currency: "HNLD",
    description: "",
    expiresInHours: "24"
  })
  const [oidForm, setOidForm] = useState({
    oidCode: "",
    oidName: "",
    oidType: "individual"
  })
  const [scanForm, setScanForm] = useState({
    scanData: "",
    scanType: "text"
  })
  const [processing, setProcessing] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Cargar pagos
      const paymentsResult = await getUserNAVPPayments()
      if (paymentsResult.success && paymentsResult.data) {
        setPayments(paymentsResult.data)
      }
      
      // Cargar OIDs
      const oidsResult = await getUserOIDs()
      if (oidsResult.success && oidsResult.data) {
        setOids(oidsResult.data)
      }
      
      // Cargar STCs
      const stcsResult = await getAvailableSTCs()
      if (stcsResult.success && stcsResult.data) {
        setStcs(stcsResult.data)
      }
    } catch (error) {
      console.error('❌ Error cargando datos:', error)
      toast({
        title: "Error",
        description: "Error cargando datos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
  }

  const handleCreateOID = async () => {
    if (!oidForm.oidCode || !oidForm.oidName || !oidForm.oidType) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await createNAVPOID(oidForm.oidCode, oidForm.oidName, oidForm.oidType)
      
      if (result.success) {
        toast({
          title: "✅ OID creado",
          description: `OID ${oidForm.oidCode} creado exitosamente`,
        })
        setOidForm({ oidCode: "", oidName: "", oidType: "individual" })
        setCreateOIDOpen(false)
        await loadData()
      } else {
        toast({
          title: "❌ Error creando OID",
          description: result.error || "No se pudo crear el OID",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear el OID",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCreatePayment = async () => {
    if (!paymentForm.oidId || !paymentForm.stcId || !paymentForm.amount) {
      toast({
        title: "Error",
        description: "Todos los campos requeridos deben estar completos",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(paymentForm.amount)
    if (amount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const result = await createNAVPPayment(
        paymentForm.oidId,
        paymentForm.stcId,
        amount,
        paymentForm.currency,
        paymentForm.description,
        undefined, // payeeId (usuario actual)
        parseInt(paymentForm.expiresInHours)
      )
      
      if (result.success) {
        toast({
          title: "✅ Pago creado",
          description: `Pago de ${paymentForm.currency} ${formatAmount(amount)} creado exitosamente`,
        })
        setPaymentForm({
          oidId: "",
          stcId: "",
          amount: "",
          currency: "HNLD",
          description: "",
          expiresInHours: "24"
        })
        setCreatePaymentOpen(false)
        await loadData()
      } else {
        toast({
          title: "❌ Error creando pago",
          description: result.error || "No se pudo crear el pago",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al crear el pago",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleScanPayment = async () => {
    if (!scanForm.scanData.trim()) {
      toast({
        title: "Error",
        description: "Ingresa datos para escanear",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      // Procesar OCR simple
      const ocrResult = simpleOCRTextExtraction(scanForm.scanData)
      
      if (ocrResult.success && ocrResult.extractedData?.paymentCode) {
        // Buscar pago por código
        const paymentResult = await getPaymentByCode(ocrResult.extractedData.paymentCode)
        
        if (paymentResult.success && paymentResult.data) {
          const payment = paymentResult.data
          
          // Procesar escaneo OCR
          await processOCRScan(
            payment.id,
            scanForm.scanType,
            scanForm.scanData,
            ocrResult.extractedData,
            ocrResult.confidence
          )
          
          // Validar pago
          await validateNAVPPayment(
            payment.id,
            'ocr_validation',
            true,
            'Validación OCR exitosa'
          )
          
          toast({
            title: "✅ Pago escaneado",
            description: `Pago ${payment.payment_code} procesado exitosamente`,
          })
          
          setScanForm({ scanData: "", scanType: "text" })
          setScanModalOpen(false)
          await loadData()
        } else {
          toast({
            title: "❌ Pago no encontrado",
            description: "No se encontró un pago con ese código",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "❌ Error en OCR",
          description: "No se pudo extraer información válida del texto",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al procesar el escaneo",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCompletePayment = async (paymentId: string) => {
    setProcessing(true)
    try {
      const result = await completeNAVPPayment(paymentId)
      
      if (result.success) {
        toast({
          title: "✅ Pago completado",
          description: "El pago ha sido procesado exitosamente",
        })
        await loadData()
        if (selectedPayment?.id === paymentId) {
          setSelectedPayment(prev => prev ? { ...prev, status: 'completed' } : null)
        }
      } else {
        toast({
          title: "❌ Error completando pago",
          description: result.error || "No se pudo completar el pago",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error inesperado al completar el pago",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleViewPaymentDetails = (payment: NAVPPayment) => {
    setSelectedPayment(payment)
    setPaymentDetailsOpen(true)
  }

  const handleCopyPaymentLink = (paymentLink: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${paymentLink}`)
    toast({
      title: "✅ Link copiado",
      description: "Link de pago copiado al portapapeles",
    })
  }

  const handleDownloadQR = (qrData: string, paymentCode: string) => {
    // En una implementación real, generarías una imagen QR
    const qrText = generateSimpleQRCode(qrData)
    const blob = new Blob([qrText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${paymentCode}.txt`
    a.click()
    URL.revokeObjectURL(url)
    
    toast({
      title: "✅ QR descargado",
      description: "Código QR descargado exitosamente",
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />
      case 'expired':
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Procesando</Badge>
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completado</Badge>
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>
      case 'cancelled':
        return <Badge variant="outline">Cancelado</Badge>
      case 'expired':
        return <Badge className="bg-orange-100 text-orange-800">Expirado</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <LoadingSpinner message="Cargando pagos NAVP..." />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pagos NAVP</h1>
          <p className="text-muted-foreground">Sistema de pagos automatizados con OID/STC + OCR</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Dialog open={createOIDOpen} onOpenChange={setCreateOIDOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Crear OID
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear OID (Originator ID)</DialogTitle>
                <DialogDescription>Crear un identificador de originador para pagos</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="oid-code">Código OID</Label>
                  <Input
                    id="oid-code"
                    placeholder="Ej: NMHN001"
                    value={oidForm.oidCode}
                    onChange={(e) => setOidForm(prev => ({ ...prev, oidCode: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="oid-name">Nombre</Label>
                  <Input
                    id="oid-name"
                    placeholder="Nombre del originador"
                    value={oidForm.oidName}
                    onChange={(e) => setOidForm(prev => ({ ...prev, oidName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="oid-type">Tipo</Label>
                  <Select
                    value={oidForm.oidType}
                    onValueChange={(value) => setOidForm(prev => ({ ...prev, oidType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="merchant">Comerciante</SelectItem>
                      <SelectItem value="fintech">Fintech</SelectItem>
                      <SelectItem value="bank">Banco</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOIDOpen(false)} disabled={processing}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateOID} disabled={processing}>
                  {processing ? "Creando..." : "Crear OID"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={createPaymentOpen} onOpenChange={setCreatePaymentOpen}>
            <DialogTrigger asChild>
              <Button>
                <QrCode className="mr-2 h-4 w-4" />
                Crear Pago
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Pago NAVP</DialogTitle>
                <DialogDescription>Crear un pago con código QR y link</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="oid-select">OID (Originador)</Label>
                  <Select
                    value={paymentForm.oidId}
                    onValueChange={(value) => setPaymentForm(prev => ({ ...prev, oidId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un OID" />
                    </SelectTrigger>
                    <SelectContent>
                      {oids.map((oid) => (
                        <SelectItem key={oid.id} value={oid.id}>
                          {oid.oid_code} - {oid.oid_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="stc-select">STC (Tipo de Transacción)</Label>
                  <Select
                    value={paymentForm.stcId}
                    onValueChange={(value) => setPaymentForm(prev => ({ ...prev, stcId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un STC" />
                    </SelectTrigger>
                    <SelectContent>
                      {stcs.map((stc) => (
                        <SelectItem key={stc.id} value={stc.id}>
                          {stc.stc_code} - {stc.stc_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Monto</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Moneda</Label>
                    <Select
                      value={paymentForm.currency}
                      onValueChange={(value) => setPaymentForm(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HNLD">HNLD</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    placeholder="Descripción del pago..."
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="expires">Expira en (horas)</Label>
                  <Input
                    id="expires"
                    type="number"
                    placeholder="24"
                    value={paymentForm.expiresInHours}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, expiresInHours: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreatePaymentOpen(false)} disabled={processing}>
                  Cancelar
                </Button>
                <Button onClick={handleCreatePayment} disabled={processing}>
                  {processing ? "Creando..." : "Crear Pago"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Scan className="mr-2 h-4 w-4" />
                Escanear
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Escanear Pago NAVP</DialogTitle>
                <DialogDescription>Escanear código QR o texto para procesar pago</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="scan-type">Tipo de Escaneo</Label>
                  <Select
                    value={scanForm.scanType}
                    onValueChange={(value) => setScanForm(prev => ({ ...prev, scanType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="qr">Código QR</SelectItem>
                      <SelectItem value="image">Imagen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="scan-data">Datos a Escanear</Label>
                  <Textarea
                    id="scan-data"
                    placeholder="Pega aquí el texto o datos del código QR..."
                    value={scanForm.scanData}
                    onChange={(e) => setScanForm(prev => ({ ...prev, scanData: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setScanModalOpen(false)} disabled={processing}>
                  Cancelar
                </Button>
                <Button onClick={handleScanPayment} disabled={processing}>
                  {processing ? "Escaneando..." : "Escanear"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="oids">OIDs</TabsTrigger>
          <TabsTrigger value="stcs">STCs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="payments" className="space-y-6">
          {/* Payments List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base md:text-lg font-semibold">Mis Pagos NAVP</CardTitle>
              <CardDescription>Gestiona tus pagos con códigos QR y links</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tienes pagos aún</p>
                  <p className="text-sm text-muted-foreground">Crea tu primer pago para comenzar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.payment_code}</p>
                            <p className="text-sm text-muted-foreground">{payment.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {payment.currency} {formatAmount(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(payment.status)}
                            {getStatusBadge(payment.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(payment.created_at).toLocaleDateString('es-HN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPaymentDetails(payment)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {payment.payment_link && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyPaymentLink(payment.payment_link!)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            {payment.qr_code_data && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadQR(payment.qr_code_data!, payment.payment_code)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {payment.status === 'processing' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCompletePayment(payment.id)}
                                disabled={processing}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="oids" className="space-y-6">
          {/* OIDs List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base md:text-lg font-semibold">Mis OIDs</CardTitle>
              <CardDescription>Identificadores de originador para pagos</CardDescription>
            </CardHeader>
            <CardContent>
              {oids.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tienes OIDs creados</p>
                  <p className="text-sm text-muted-foreground">Crea tu primer OID para comenzar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {oids.map((oid) => (
                      <TableRow key={oid.id}>
                        <TableCell className="font-medium">{oid.oid_code}</TableCell>
                        <TableCell>{oid.oid_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {oid.oid_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={oid.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                            {oid.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(oid.created_at).toLocaleDateString('es-HN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="stcs" className="space-y-6">
          {/* STCs List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base md:text-lg font-semibold">STCs Disponibles</CardTitle>
              <CardDescription>Códigos de transacción de servicio</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stcs.map((stc) => (
                    <TableRow key={stc.id}>
                      <TableCell className="font-medium">{stc.stc_code}</TableCell>
                      <TableCell>{stc.stc_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {stc.stc_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {stc.description}
                      </TableCell>
                      <TableCell>
                        <Badge className={stc.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {stc.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Details Dialog */}
      <Dialog open={paymentDetailsOpen} onOpenChange={setPaymentDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Pago</DialogTitle>
            <DialogDescription>
              {selectedPayment?.payment_code} - {getStatusBadge(selectedPayment?.status || '')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Monto</Label>
                  <p className="text-lg font-semibold">
                    {selectedPayment.currency} {formatAmount(selectedPayment.amount)}
                  </p>
                </div>
                <div>
                  <Label>Estado</Label>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(selectedPayment.status)}
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                </div>
                <div>
                  <Label>Fecha de Creación</Label>
                  <p>{new Date(selectedPayment.created_at).toLocaleString('es-HN')}</p>
                </div>
                <div>
                  <Label>Fecha de Expiración</Label>
                  <p>
                    {selectedPayment.expires_at 
                      ? new Date(selectedPayment.expires_at).toLocaleString('es-HN')
                      : 'Sin expiración'
                    }
                  </p>
                </div>
              </div>
              
              {selectedPayment.description && (
                <div>
                  <Label>Descripción</Label>
                  <p className="text-sm">{selectedPayment.description}</p>
                </div>
              )}
              
              {selectedPayment.payment_link && (
                <div>
                  <Label>Link de Pago</Label>
                  <div className="flex items-center space-x-2">
                    <Input value={`${window.location.origin}${selectedPayment.payment_link}`} readOnly />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyPaymentLink(selectedPayment.payment_link!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {selectedPayment.qr_code_data && (
                <div>
                  <Label>Código QR</Label>
                  <div className="flex items-center space-x-2">
                    <Textarea value={selectedPayment.qr_code_data} readOnly rows={3} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadQR(selectedPayment.qr_code_data!, selectedPayment.payment_code)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
