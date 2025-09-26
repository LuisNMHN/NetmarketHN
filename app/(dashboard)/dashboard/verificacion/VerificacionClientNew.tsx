'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  FileText, 
  Camera, 
  Home, 
  CheckCircle, 
  Lock, 
  ArrowLeft, 
  ArrowRight,
  AlertCircle
} from 'lucide-react'
import { useKycWizard, StepKey, StepStatus } from '@/hooks/useKycWizard'
import KycTempUploader from '@/components/KycTempUploader'

const STEPS = [
  { id: 'datos' as StepKey, title: 'Datos personales', icon: User, description: 'Información básica' },
  { id: 'doc' as StepKey, title: 'Documento de identidad', icon: FileText, description: 'Frontal y reverso' },
  { id: 'selfie' as StepKey, title: 'Selfie de validación', icon: Camera, description: 'Foto de verificación' },
  { id: 'domicilio' as StepKey, title: 'Comprobante de domicilio', icon: Home, description: 'Documento de residencia' },
  { id: 'revision' as StepKey, title: 'Revisión y envío', icon: CheckCircle, description: 'Confirmación final' }
]

export default function VerificacionClientNew() {
  const wizard = useKycWizard()
  const { state, setFlag, canContinue, goNext, goPrev, goTo } = wizard

  // Estado local para el formulario de datos personales
  const [personalData, setPersonalData] = useState({
    fullName: '',
    birthDate: '',
    country: '',
    docType: '',
    docNumber: ''
  })

  // Validar datos personales
  const validatePersonalData = () => {
    const { fullName, birthDate, country, docType, docNumber } = personalData
    return fullName.trim() !== '' && 
           birthDate !== '' && 
           country !== '' && 
           docType !== '' && 
           docNumber.trim() !== ''
  }

  // Actualizar flag de datos personales cuando cambien los campos
  React.useEffect(() => {
    setFlag('datosOk', validatePersonalData())
  }, [personalData, setFlag])

  const handlePersonalDataChange = (field: string, value: string) => {
    setPersonalData(prev => ({ ...prev, [field]: value }))
  }

  const getStepIcon = (step: StepKey, status: StepStatus) => {
    const stepConfig = STEPS.find(s => s.id === step)
    const Icon = stepConfig?.icon || User

    if (status === 'done') {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    } else if (status === 'active') {
      return <Icon className="h-5 w-5 text-blue-600" />
    } else {
      return <Lock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStepStatusColor = (status: StepStatus) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'active':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'locked':
        return 'bg-gray-100 text-gray-500 border-gray-200'
    }
  }

  const renderStepContent = () => {
    switch (state.current) {
      case 'datos':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Datos personales</CardTitle>
              <CardDescription>
                Completa tu información básica para continuar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <Input
                    id="fullName"
                    value={personalData.fullName}
                    onChange={(e) => handlePersonalDataChange('fullName', e.target.value)}
                    placeholder="Ingresa tu nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Fecha de nacimiento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={personalData.birthDate}
                    onChange={(e) => handlePersonalDataChange('birthDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Select
                    value={personalData.country}
                    onValueChange={(value) => handlePersonalDataChange('country', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tu país" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Honduras">Honduras</SelectItem>
                      <SelectItem value="Guatemala">Guatemala</SelectItem>
                      <SelectItem value="El Salvador">El Salvador</SelectItem>
                      <SelectItem value="Nicaragua">Nicaragua</SelectItem>
                      <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                      <SelectItem value="Panamá">Panamá</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docType">Tipo de documento</Label>
                  <Select
                    value={personalData.docType}
                    onValueChange={(value) => handlePersonalDataChange('docType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ID">Cédula de identidad</SelectItem>
                      <SelectItem value="Passport">Pasaporte</SelectItem>
                      <SelectItem value="Driver">Licencia de conducir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="docNumber">Número de documento</Label>
                  <Input
                    id="docNumber"
                    value={personalData.docNumber}
                    onChange={(e) => handlePersonalDataChange('docNumber', e.target.value)}
                    placeholder="Ingresa el número de tu documento"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 'doc':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documento de identidad</CardTitle>
                <CardDescription>
                  Sube las fotos de tu documento de identidad
                </CardDescription>
              </CardHeader>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <KycTempUploader
                mode="frontal"
                accept="image/*"
                onConfirm={(file) => {
                  console.log('Documento frontal confirmado:', file.name)
                  setFlag('docFrontalOk', true)
                }}
                onReset={() => setFlag('docFrontalOk', false)}
                maxSizeMB={5}
                minWidth={600}
                minHeight={400}
              />
              
              <KycTempUploader
                mode="reverso"
                accept="image/*"
                onConfirm={(file) => {
                  console.log('Documento reverso confirmado:', file.name)
                  setFlag('docReversoOk', true)
                }}
                onReset={() => setFlag('docReversoOk', false)}
                maxSizeMB={5}
                minWidth={600}
                minHeight={400}
              />
            </div>
          </div>
        )

      case 'selfie':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Selfie de validación</CardTitle>
              <CardDescription>
                Toma una selfie para validar tu identidad
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KycTempUploader
                mode="selfie"
                accept="image/*"
                onConfirm={(file) => {
                  console.log('Selfie confirmada:', file.name)
                  setFlag('selfieOk', true)
                }}
                onReset={() => setFlag('selfieOk', false)}
                maxSizeMB={5}
                minWidth={400}
                minHeight={400}
              />
            </CardContent>
          </Card>
        )

      case 'domicilio':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Comprobante de domicilio</CardTitle>
              <CardDescription>
                Sube un comprobante de domicilio (recibo de servicios, contrato, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KycTempUploader
                mode="domicilio"
                accept="image/*,.pdf"
                onConfirm={(file) => {
                  console.log('Comprobante de domicilio confirmado:', file.name)
                  setFlag('domicilioOk', true)
                }}
                onReset={() => setFlag('domicilioOk', false)}
                maxSizeMB={10}
              />
            </CardContent>
          </Card>
        )

      case 'revision':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Revisión y envío</CardTitle>
              <CardDescription>
                Revisa tu información y confirma el envío
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Resumen de información:</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Nombre:</span> {personalData.fullName}
                  </div>
                  <div>
                    <span className="font-medium">Fecha de nacimiento:</span> {personalData.birthDate}
                  </div>
                  <div>
                    <span className="font-medium">País:</span> {personalData.country}
                  </div>
                  <div>
                    <span className="font-medium">Tipo de documento:</span> {personalData.docType}
                  </div>
                  <div>
                    <span className="font-medium">Número de documento:</span> {personalData.docNumber}
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-medium">Documentos subidos:</h5>
                  <div className="flex flex-wrap gap-2">
                    {state.flags.docFrontalOk && (
                      <Badge variant="secondary">✓ Documento frontal</Badge>
                    )}
                    {state.flags.docReversoOk && (
                      <Badge variant="secondary">✓ Documento reverso</Badge>
                    )}
                    {state.flags.selfieOk && (
                      <Badge variant="secondary">✓ Selfie</Badge>
                    )}
                    {state.flags.domicilioOk && (
                      <Badge variant="secondary">✓ Comprobante de domicilio</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="aceptoDeclaracion"
                    checked={state.flags.aceptoDeclaracion}
                    onCheckedChange={(checked) => setFlag('aceptoDeclaracion', !!checked)}
                  />
                  <Label htmlFor="aceptoDeclaracion" className="text-sm">
                    Acepto la declaración de veracidad de la información proporcionada
                  </Label>
                </div>

                {!state.flags.aceptoDeclaracion && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Debes aceptar la declaración para continuar
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  const currentStepIndex = STEPS.findIndex(step => step.id === state.current)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Verificación de identidad</h1>
          <p className="text-muted-foreground">
            Completa los pasos para verificar tu identidad
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Progreso</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Navegación de pasos */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {STEPS.map((step) => {
              const status = state.status[step.id]
              const isClickable = status === 'done' || status === 'active'
              
              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isClickable 
                      ? 'hover:shadow-md' 
                      : 'cursor-not-allowed opacity-60'
                  } ${getStepStatusColor(status)}`}
                  onClick={() => isClickable && goTo(step.id)}
                >
                  <div className="flex items-center gap-3">
                    {getStepIcon(step.id, status)}
                    <div>
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs opacity-75">{step.description}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Contenido del paso actual */}
        <div className="mb-8">
          {renderStepContent()}
        </div>

        {/* Botones de navegación */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Atrás
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => wizard.reset()}
            >
              Reiniciar
            </Button>
            
            <Button
              onClick={goNext}
              disabled={!canContinue()}
              className="flex items-center gap-2"
            >
              {state.current === 'revision' ? 'Enviar' : 'Continuar'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Debug info (solo en desarrollo) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs">
            <h4 className="font-bold mb-2">Debug Info:</h4>
            <div>Paso actual: {state.current}</div>
            <div>Puede continuar: {canContinue() ? 'Sí' : 'No'}</div>
            <div>Flags: {JSON.stringify(state.flags, null, 2)}</div>
            <div>Status: {JSON.stringify(state.status, null, 2)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

