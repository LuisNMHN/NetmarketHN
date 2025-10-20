"use client"

import { useEffect } from "react"
import { notificationCenter } from "@/lib/notifications/center"
import { supabaseBrowser } from "@/lib/supabase/client"

/**
 * Componente que maneja la inicialización del sistema de notificaciones
 * y la suscripción en tiempo real. Debe ser incluido en el layout principal.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let mounted = true

    const initializeNotifications = async () => {
      try {
        // Verificar autenticación
        const { data: { user } } = await supabaseBrowser().auth.getUser()
        
        if (!user) {
          console.log('Usuario no autenticado, saltando inicialización de notificaciones')
          return
        }

        // Inicializar el centro de notificaciones
        await notificationCenter.getStats()
        
        console.log('Sistema de notificaciones inicializado para usuario:', user.id)
      } catch (error) {
        console.error('Error inicializando sistema de notificaciones:', error)
      }
    }

    // Inicializar cuando el componente se monta
    if (mounted) {
      initializeNotifications()
    }

    // Cleanup al desmontar
    return () => {
      mounted = false
      notificationCenter.cleanup()
    }
  }, [])

  return <>{children}</>
}


