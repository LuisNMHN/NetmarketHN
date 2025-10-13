"use client"

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAvatarUrl } from '@/lib/utils/avatar-utils'

interface AvatarDebugProps {
  avatarName: string
}

export default function AvatarDebug({ avatarName }: AvatarDebugProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  
  const avatarUrl = getAvatarUrl(avatarName)
  
  useEffect(() => {
    setImageError(false)
    setImageLoaded(false)
  }, [avatarName])

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setImageLoaded(false)
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-sm font-semibold mb-2">Debug de Avatar</h3>
      
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          <strong>Nombre:</strong> {avatarName}
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>URL generada:</strong> {avatarUrl || 'null'}
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>Estado:</strong> {
            imageError ? '❌ Error cargando' : 
            imageLoaded ? '✅ Cargado' : 
            '⏳ Cargando...'
          }
        </p>
      </div>
      
      <div className="mt-4">
        <Avatar className="h-16 w-16">
          <AvatarImage 
            src={avatarUrl || ''} 
            alt={avatarName}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          <AvatarFallback className="text-lg bg-primary/10 text-primary">
            {avatarName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
      
      {imageError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          ❌ No se pudo cargar la imagen. Verifica que el archivo existe en Supabase Storage.
        </div>
      )}
      
      {imageLoaded && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-600">
          ✅ Imagen cargada correctamente.
        </div>
      )}
    </div>
  )
}
