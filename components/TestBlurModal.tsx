"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function TestBlurModal() {
  const [open, setOpen] = useState(false)

  // 🌫️ Efecto para DESENFOCAR EL CONTENIDO DE LA PÁGINA (no el modal)
  useEffect(() => {
    if (open) {
      // Crear un wrapper para el contenido de fondo
      const pageContent = document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'blur(20px)'
        pageContent.style.transition = 'filter 0.3s ease-out'
        console.log('🌫️ Desenfoque aplicado al contenido de fondo:', pageContent)
      }
      
      // Asegurar que el modal NO tenga desenfoque
      setTimeout(() => {
        const modal = document.querySelector('[data-radix-dialog-content]')
        if (modal) {
          modal.style.filter = 'none !important'
          modal.style.backdropFilter = 'none !important'
          modal.style.zIndex = '9999'
          console.log('🌫️ Modal sin desenfoque:', modal)
        }
        
        const overlay = document.querySelector('[data-radix-dialog-overlay]')
        if (overlay) {
          overlay.style.filter = 'none !important'
          overlay.style.backdropFilter = 'none !important'
          console.log('🌫️ Overlay sin desenfoque:', overlay)
        }
      }, 100)
      
    } else {
      // Remover desenfoque cuando se cierra el modal
      const pageContent = document.querySelector('.min-h-screen')
      if (pageContent) {
        pageContent.style.filter = 'none'
      }
      
      console.log('🌫️ Desenfoque removido del contenido de la página')
    }
  }, [open])

  return (
    <div className="p-8 min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Prueba de Desenfoque del FONDO</h2>
      <p className="mb-4 text-lg">Este contenido de fondo debería DESENFOCARSE cuando se abra el modal.</p>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mb-6">🔍 Probar Desenfoque del Fondo</Button>
        </DialogTrigger>
        <DialogContent 
          className="max-w-md"
          style={{
            // Aplicar desenfoque directamente al overlay usando CSS personalizado
            '--overlay-blur': 'blur(15px)',
          } as React.CSSProperties}
        >
          <DialogHeader>
            <DialogTitle>Modal de Prueba</DialogTitle>
            <DialogDescription>
              El fondo de la página debería estar desenfocado detrás de este modal.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Si ves el fondo desenfocado detrás de este modal, ¡funciona correctamente!</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="mt-8 space-y-6">
        <div className="p-6 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg">
          <h3 className="font-semibold text-lg">🎨 Contenido de fondo 1</h3>
          <p className="text-sm">Este contenido debería verse DESENFOCADO cuando el modal esté abierto.</p>
          <div className="mt-2 text-xs text-gray-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
          </div>
        </div>
        
        <div className="p-6 bg-gradient-to-r from-green-100 to-green-200 rounded-lg">
          <h3 className="font-semibold text-lg">🌿 Contenido de fondo 2</h3>
          <p className="text-sm">Este contenido también debería verse DESENFOCADO.</p>
          <div className="mt-2 text-xs text-gray-600">
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.
          </div>
        </div>
        
        <div className="p-6 bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-lg">
          <h3 className="font-semibold text-lg">⭐ Contenido de fondo 3</h3>
          <p className="text-sm">Todo el contenido de fondo debería tener efecto de DESENFOQUE.</p>
          <div className="mt-2 text-xs text-gray-600">
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
          </div>
        </div>
        
        <div className="p-6 bg-gradient-to-r from-purple-100 to-purple-200 rounded-lg">
          <h3 className="font-semibold text-lg">💜 Contenido de fondo 4</h3>
          <p className="text-sm">Más contenido para verificar el desenfoque del fondo.</p>
          <div className="mt-2 text-xs text-gray-600">
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </div>
        </div>
        
        <div className="p-6 bg-gradient-to-r from-pink-100 to-pink-200 rounded-lg">
          <h3 className="font-semibold text-lg">🌸 Contenido de fondo 5</h3>
          <p className="text-sm">El fondo completo debería desenfocarse cuando abras el modal.</p>
          <div className="mt-2 text-xs text-gray-600">
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.
          </div>
        </div>
      </div>
    </div>
  )
}
