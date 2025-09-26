'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, Image, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react'

export type KycTempUploaderProps = {
  mode: 'frontal' | 'reverso' | 'selfie' | 'domicilio'
  accept: string
  onConfirm: (file: File) => void
  onReset?: () => void
  maxSizeMB?: number
  minWidth?: number
  minHeight?: number
}

export default function KycTempUploader({
  mode,
  accept,
  onConfirm,
  onReset,
  maxSizeMB = 5,
  minWidth,
  minHeight
}: KycTempUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [tempFile, setTempFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const getModeInfo = () => {
    switch (mode) {
      case 'frontal':
        return { title: 'Documento frontal', icon: FileText, description: 'Sube la foto del frente de tu documento' }
      case 'reverso':
        return { title: 'Documento reverso', icon: FileText, description: 'Sube la foto del reverso de tu documento' }
      case 'selfie':
        return { title: 'Selfie de validación', icon: Image, description: 'Toma una selfie para validar tu identidad' }
      case 'domicilio':
        return { title: 'Comprobante de domicilio', icon: FileText, description: 'Sube un comprobante de domicilio (imagen o PDF)' }
      default:
        return { title: 'Archivo', icon: Upload, description: 'Sube un archivo' }
    }
  }

  const { title, icon: Icon, description } = getModeInfo()

  const readImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = URL.createObjectURL(file)
    })
  }

  const validateFile = async (file: File): Promise<string | null> => {
    // Validar tipo de archivo
    const acceptedTypes = accept.split(',').map(type => type.trim())
    const isAccepted = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        const baseType = type.replace('/*', '')
        return file.type.startsWith(baseType)
      }
      return file.type === type
    })

    if (!isAccepted) {
      return `Tipo de archivo no permitido. Formatos aceptados: ${accept}`
    }

    // Validar tamaño
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxSizeMB) {
      return `El archivo es muy grande (${sizeMB.toFixed(2)} MB). Máximo permitido: ${maxSizeMB} MB`
    }

    // Validar dimensiones para imágenes
    if (file.type.startsWith('image/') && minWidth && minHeight) {
      try {
        const { width, height } = await readImageDimensions(file)
        if (width < minWidth || height < minHeight) {
          return `Resolución muy baja (${width}x${height}px). Mínimo requerido: ${minWidth}x${minHeight}px`
        }
      } catch (error) {
        return 'No se pudo validar las dimensiones de la imagen'
      }
    }

    return null
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsValidating(true)

    try {
      const validationError = await validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setTempFile(file)

      // Crear preview para imágenes
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
      } else {
        setPreviewUrl(null)
      }
    } catch (error) {
      setError('Error al procesar el archivo')
    } finally {
      setIsValidating(false)
    }
  }

  const handleConfirm = () => {
    if (tempFile) {
      onConfirm(tempFile)
    }
  }

  const handleReset = () => {
    setTempFile(null)
    setPreviewUrl(null)
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    onReset?.()
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {!tempFile && (
          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              onClick={() => inputRef.current?.click()}
              variant="outline"
              className="w-full h-32 border-dashed border-2 hover:border-primary/50"
              disabled={isValidating}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm">
                  {isValidating ? 'Validando...' : 'Seleccionar archivo'}
                </span>
              </div>
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Formatos aceptados: {accept}</p>
              <p>Tamaño máximo: {maxSizeMB} MB</p>
              {minWidth && minHeight && (
                <p>Resolución mínima: {minWidth}x{minHeight}px</p>
              )}
            </div>
          </div>
        )}

        {tempFile && (
          <div className="space-y-4">
            {previewUrl ? (
              <div className="space-y-2">
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  className="max-h-64 w-auto mx-auto rounded-lg border"
                />
                <div className="text-center text-sm text-muted-foreground">
                  {tempFile.name} ({formatFileSize(tempFile.size)})
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{tempFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(tempFile.size)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reintentar
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Confirmar
              </Button>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  )
}
