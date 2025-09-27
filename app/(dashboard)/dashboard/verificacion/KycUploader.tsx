'use client';

import React, { useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { registerKycFilePath } from '@/app/actions/kyc_data';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, User, Home, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';

type Props = {
  userId: string;
  docType: 'document_front' | 'document_back' | 'selfie' | 'address_proof';
  bucket?: string; // default 'public'
  // reglas front
  maxSizeMB?: number;        // tamaño máximo
  minWidth?: number;         // resolución mínima
  minHeight?: number;
  compress?: boolean;        // intentar comprimir si excede límites
  onUploadSuccess?: () => void; // callback cuando se sube exitosamente
  isAlreadyUploaded?: boolean; // si el archivo ya está subido
  onRemoveFile?: () => void; // callback para eliminar archivo
};

const ACCEPTED = [
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/webp', 
  'image/heic', 
  'image/heif',
  'application/pdf'
];

const ACCEPTED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf'
];

const getFileExtension = (filename: string): string => {
  return filename.toLowerCase().substring(filename.lastIndexOf('.'));
};

const getMimeTypeFromExtension = (extension: string): string => {
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.pdf': 'application/pdf'
  };
  return mimeMap[extension] || 'application/octet-stream';
};

export default function KycUploader({
  userId,
  docType,
  bucket = 'kyc',
  maxSizeMB = 5,
  minWidth = 600,
  minHeight = 400,
  compress = true,
  onUploadSuccess,
  isAlreadyUploaded = false,
  onRemoveFile,
}: Props) {
  const supabase = supabaseBrowser();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // solo front
  const [tempFile, setTempFile] = useState<File | null>(null);       // solo front
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function readImageDims(file: File): Promise<{ w: number; h: number }> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('No se pudo leer la imagen'));
        i.src = url;
      });
      return { w: img.naturalWidth, h: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function compressImage(file: File, maxW = 1600, maxH = 1200, quality = 0.82): Promise<File> {
    const { w, h } = await readImageDims(file);
    const scale = Math.min(maxW / w, maxH / h, 1);
    // si ya está por debajo, solo re-encode para limpiar metadatos
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    const bmp = await createImageBitmap(file, { resizeWidth: targetW, resizeHeight: targetH });
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, targetW, targetH);
    // Determinar el formato de salida basado en el archivo original
    const originalExt = getFileExtension(file.name);
    let outputType = 'image/jpeg';
    let outputExt = '.jpg';
    
    if (originalExt === '.png') {
      outputType = 'image/png';
      outputExt = '.png';
    } else if (originalExt === '.webp') {
      outputType = 'image/webp';
      outputExt = '.webp';
    }
    
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), outputType, quality)
    );
    if (!blob) throw new Error('No se pudo comprimir la imagen');
    
    const newName = file.name.replace(/\.[^/.]+$/, outputExt);
    return new File([blob], newName, { type: outputType });
  }


  function resetTemp() {
    setTempFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
    setWarning(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function processFile(f: File) {
    setError(null);
    setWarning(null);

    // Validación de formato más flexible
    const fileExtension = getFileExtension(f.name);
    const isValidExtension = ACCEPTED_EXTENSIONS.includes(fileExtension);
    const isValidMimeType = ACCEPTED.includes(f.type);
    
    // Si el MIME type no es válido pero la extensión sí, intentar corregir
    if (!isValidMimeType && isValidExtension) {
      console.log(`MIME type incorrecto (${f.type}), pero extensión válida (${fileExtension}). Continuando...`);
      
      // Mostrar advertencia para formatos problemáticos
      if (fileExtension === '.heic' || fileExtension === '.heif') {
        console.warn('Formato HEIC/HEIF detectado. Algunos navegadores pueden tener problemas con este formato.');
      }
    } else if (!isValidExtension && !isValidMimeType) {
      const supportedFormats = ACCEPTED_EXTENSIONS.join(', ').toUpperCase();
      setError(`Formato no soportado. Formatos permitidos: ${supportedFormats}`);
      return resetTemp();
    }

    // Validación tamaño más flexible
    const sizeMB = f.size / (1024 * 1024);
    let candidate = f;
    
    // Mostrar advertencia si el archivo es grande pero no excede el límite
    if (sizeMB > maxSizeMB * 0.8 && sizeMB <= maxSizeMB) {
      setWarning(`Archivo grande: ${sizeMB.toFixed(2)}MB (límite recomendado: ${maxSizeMB}MB). Se recomienda comprimir.`);
    }

    // Solo validar resolución para imágenes (no PDFs)
    if (f.type.startsWith('image/')) {
      try {
        const { w, h } = await readImageDims(f);
        
        // Validación más flexible - permitir 20% menos de la resolución mínima
        const minWidthFlexible = Math.floor(minWidth * 0.8);
        const minHeightFlexible = Math.floor(minHeight * 0.8);
        
        if (w < minWidthFlexible || h < minHeightFlexible) {
          setError(`Resolución muy baja (${w}x${h}). Mínimo recomendado ${minWidth}x${minHeight}px (mínimo aceptable ${minWidthFlexible}x${minHeightFlexible}px).`);
          return resetTemp();
        } else if (w < minWidth || h < minHeight) {
          // Mostrar advertencia pero permitir continuar
          setWarning(`Resolución baja: ${w}x${h}px (recomendado: ${minWidth}x${minHeight}px). La calidad puede verse afectada.`);
        }
      } catch (err) {
        console.error('Error leyendo imagen:', err);
        const fileExt = getFileExtension(f.name);
        if (fileExt === '.heic' || fileExt === '.heif') {
          setError('Formato HEIC/HEIF no soportado por este navegador. Convierte a JPG o PNG.');
        } else {
          setError('No se pudo leer la imagen. Verifica que el archivo no esté corrupto.');
        }
        return resetTemp();
      }
    }

    // Compresión opcional si excede peso (solo para imágenes)
    if (sizeMB > maxSizeMB && compress && f.type.startsWith('image/')) {
      try {
        candidate = await compressImage(f);
        const newSizeMB = candidate.size / (1024 * 1024);
        console.log(`Imagen comprimida: ${sizeMB.toFixed(2)}MB → ${newSizeMB.toFixed(2)}MB`);
        
        // Si después de comprimir sigue siendo muy grande, mostrar advertencia pero permitir
        if (newSizeMB > maxSizeMB * 1.2) {
          setWarning(`Archivo sigue siendo grande después de compresión: ${newSizeMB.toFixed(2)}MB. Puede tardar más en subir.`);
        }
      } catch (err: any) {
        console.error('Error comprimiendo imagen:', err);
        const fileExt = getFileExtension(f.name);
        if (fileExt === '.heic' || fileExt === '.heif') {
          setError('Formato HEIC/HEIF no se puede comprimir. Convierte a JPG o PNG primero.');
        } else {
          setError('No se pudo comprimir la imagen. Intenta con otra.');
        }
        return resetTemp();
      }
    } else if (sizeMB > maxSizeMB * 1.5) {
      // Solo rechazar si es significativamente más grande (50% más)
      setError(`Archivo muy grande (${sizeMB.toFixed(2)} MB). Máximo recomendado ${maxSizeMB} MB.`);
      return resetTemp();
    } else if (sizeMB > maxSizeMB) {
      // Mostrar advertencia pero permitir continuar
      setWarning(`Archivo grande: ${sizeMB.toFixed(2)}MB (límite recomendado: ${maxSizeMB}MB). Puede tardar más en subir.`);
    }

    // Previsualización temporal (NO se sube aún)
    const url = URL.createObjectURL(candidate);
    setTempFile(candidate);
    setPreviewUrl(url);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await processFile(f);
  }

  async function onConfirmUpload() {
    if (!tempFile) return;
    setBusy(true);
    setError(null);
    try {
    // nombre/ubicación consistente por docType
    const fileExtension = getFileExtension(tempFile.name);
    const ext = fileExtension.substring(1); // quitar el punto
    const path = `${userId}/${docType}/documento_frontal.${ext}`;

      console.log('SUBIENDO A:', path, 'type:', tempFile.type, 'size:', tempFile.size);

      // Intentar subir directamente al bucket especificado
      console.log(`📤 Intentando subir al bucket: ${bucket}`);
      let uploadResult = await supabase.storage
        .from(bucket)
        .upload(path, tempFile, {
          upsert: true,
          contentType: tempFile.type || 'image/jpeg',
          cacheControl: '3600',
        });

      // Si falla por RLS o permisos, intentar con otros buckets
      if (uploadResult.error && (
        uploadResult.error.message?.includes('row-level security') ||
        uploadResult.error.message?.includes('permission denied') ||
        uploadResult.error.message?.includes('bucket not found') ||
        uploadResult.error.message?.includes('not found')
      )) {
        console.log(`🔄 Error con bucket '${bucket}':`, uploadResult.error.message);
        
        // Listar buckets disponibles para fallback
        console.log('📋 Buscando buckets alternativos...');
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        
        if (bucketError) {
          console.error('❌ Error al listar buckets:', bucketError);
          throw new Error(`Error de conexión con Supabase: ${bucketError.message}`);
        }

        console.log('📋 Buckets disponibles:', buckets?.map(b => b.name) || 'Ninguno');

        // Intentar con otros buckets disponibles
        if (buckets && buckets.length > 0) {
          for (const availableBucket of buckets) {
            if (availableBucket.name !== bucket) {
              console.log(`🔄 Intentando con bucket alternativo: ${availableBucket.name}`);
              uploadResult = await supabase.storage
                .from(availableBucket.name)
                .upload(path, tempFile, {
                  upsert: true,
                  contentType: tempFile.type || 'image/jpeg',
                  cacheControl: '3600',
                });
              
              if (!uploadResult.error) {
                console.log(`✅ Archivo subido exitosamente al bucket alternativo: ${availableBucket.name}`);
                return uploadResult;
              } else {
                console.log(`❌ Error con bucket alternativo ${availableBucket.name}:`, uploadResult.error.message);
              }
            }
          }
        }
        
        // Si todos los buckets fallan, mostrar error específico
        throw new Error(`No se pudo subir el archivo. Error: ${uploadResult.error.message}. Contacta al administrador para configurar las políticas RLS del bucket '${bucket}'.`);
      }


      if (uploadResult.error) {
        throw new Error(uploadResult.error.message);
      }

      // Actualizar la base de datos
      const result = await registerKycFilePath(docType, path);
      if (!result.ok) {
        throw new Error(result.message);
      }

      // Limpia temporal y muestra éxito
      resetTemp();
      toast.success('Archivo subido correctamente', {
        description: 'El archivo ha sido guardado en la base de datos',
        duration: 4000,
      });
      
      // Callback opcional (con delay para evitar navegación inmediata)
      if (onUploadSuccess) {
        setTimeout(() => {
          onUploadSuccess();
        }, 1000); // Delay de 1 segundo para que el usuario vea el mensaje de éxito
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error subiendo el archivo.');
      toast.error('Error al subir el archivo', {
        description: err.message || 'No se pudo guardar el archivo en la base de datos',
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  }

  const getDocTypeInfo = (type: string) => {
    const info: Record<string, { label: string; icon: any; description: string; color: string; bgColor: string }> = {
      document_front: { 
        label: 'Documento Frontal', 
        icon: FileText, 
        description: 'Frente de tu DNI o pasaporte hondureño',
        color: 'text-primary',
        bgColor: 'bg-primary/10'
      },
      document_back: { 
        label: 'Documento Reverso', 
        icon: FileText, 
        description: 'Reverso de tu DNI o pasaporte hondureño',
        color: 'text-primary',
        bgColor: 'bg-primary/10'
      },
      selfie: { 
        label: 'Selfie de Verificación', 
        icon: User, 
        description: 'Foto tuya sosteniendo el documento',
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/30'
      },
      address_proof: { 
        label: 'Comprobante de Domicilio', 
        icon: Home, 
        description: 'Recibo de servicios o estado bancario',
        color: 'text-violet-600 dark:text-violet-400',
        bgColor: 'bg-violet-50 dark:bg-violet-950/30'
      }
    };
    return info[type] || { label: type, icon: FileText, description: 'Archivo requerido', color: 'text-muted-foreground', bgColor: 'bg-muted/50' };
  };

  const docInfo = getDocTypeInfo(docType);
  const IconComponent = docInfo.icon;

  return (
    <Card className="w-full border-border/50">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${docInfo.bgColor} ${docInfo.color}`}>
              <IconComponent className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{docInfo.label}</h3>
              <p className="text-sm text-muted-foreground">{docInfo.description}</p>
            </div>
          </div>

          {/* Upload Area */}
          {!previewUrl && !isAlreadyUploaded && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-all duration-200 bg-muted/20 hover:bg-muted/30">
                <div className="space-y-6">
                  <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-base font-medium text-foreground">Selecciona un archivo</p>
                    <p className="text-sm text-muted-foreground">
                      Formatos: JPG, PNG, WEBP, HEIC, PDF • Máx. recomendado {maxSizeMB} MB
                      {docType !== 'address_proof' && ` • Mín. recomendado ${minWidth}×${minHeight}px`}
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={onPickFile}
                      className="hidden"
                      id={`file-input-${docType}`}
                    />
                    <Button
                      asChild
                      variant="outline"
                      className="flex items-center gap-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                    >
                      <label htmlFor={`file-input-${docType}`} className="cursor-pointer">
                        <Upload className="h-4 w-4" />
                        Seleccionar archivo
                      </label>
                    </Button>
                  </div>
                  
                </div>
              </div>
            </div>
          )}

          {/* Confirmation State */}
          {isAlreadyUploaded && !previewUrl && (
            <div className="space-y-4">
              <div className="border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-8 text-center bg-emerald-50 dark:bg-emerald-950/30">
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-base font-medium text-emerald-900 dark:text-emerald-100">Documento cargado exitosamente</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      {docInfo.label} ha sido guardado correctamente
                    </p>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Preview Area */}
          {previewUrl && (
            <div className="space-y-6">
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-foreground">Vista previa</span>
                  <span className="text-xs text-muted-foreground">(aún no se ha subido)</span>
                </div>
                
                {tempFile?.type.startsWith('image/') ? (
                  <div className="flex justify-center">
                    <img
                      src={previewUrl}
                      alt="Previsualización"
                      className="max-h-80 w-auto rounded-lg border border-border/50 shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-8 bg-background rounded-lg border border-border/50">
                    <div className="text-center space-y-3">
                      <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
                      <div>
                        <p className="text-base font-medium text-foreground">{tempFile?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {((tempFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  onClick={resetTemp}
                  disabled={busy}
                  className="flex items-center gap-2 border-border hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive transition-all duration-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  Cambiar archivo
                </Button>
                <Button
                  onClick={onConfirmUpload}
                  disabled={busy}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {busy ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Confirmar y subir
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Warning Display */}
          {warning && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </CardContent>

    </Card>
  );
}
