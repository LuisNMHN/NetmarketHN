"use client"

import React, { useState, useEffect, useRef } from "react"
import { Bell, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { notificationCenter, Notification, NotificationStats } from "@/lib/notifications/center"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useToast } from "@/hooks/use-toast"
import { supabaseBrowser } from "@/lib/supabase/client"

interface NotificationBellProps {
  className?: string
}

const getTopicIcon = (topic: string) => {
  switch (topic) {
    case 'order':
      return '💱'
    case 'kyc':
      return '🆔'
    case 'wallet':
      return '💰'
    case 'chat':
      return '💬'
    case 'system':
      return '⚙️'
    default:
      return '🔔'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-500'
    case 'normal':
      return 'bg-blue-500'
    case 'low':
      return 'bg-gray-500'
    default:
      return 'bg-gray-500'
  }
}

export function NotificationBell({ className }: NotificationBellProps) {
  const router = useRouter()
  const { toast: elegantToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, read: 0, archived: 0, high_priority: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  
  // Usar un Set compartido a nivel global para evitar duplicados entre múltiples instancias de NotificationBell
  // Esto es necesario porque hay dos instancias en el layout (desktop y mobile)
  // Usar useMemo para inicializar solo una vez
  const shownToastIds = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      if (!(window as any).__sharedShownToastIds) {
        (window as any).__sharedShownToastIds = new Set<string>()
      }
      return (window as any).__sharedShownToastIds as Set<string>
    }
    return new Set<string>()
  }, [])
  
  // Sincronizar drawerOpen con isOpen en móvil
  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(isOpen)
    }
  }, [isOpen, isMobile])

  // Cargar datos iniciales
  useEffect(() => {
    loadNotifications()
    loadStats()
  }, [])

  // Configurar listeners de tiempo real
  useEffect(() => {
    console.log('🔌 NotificationBell - Configurando listeners de tiempo real')
    
    let isSubscribed = true
    
    const unsubscribeNotification = notificationCenter.addListener((notification) => {
      if (!isSubscribed) return
      
      console.log('🔔 NotificationBell - Listener recibió notificación:', notification.id)
      
      // Log detallado para cancelaciones/eliminaciones/expiraciones/completadas
      if (notification.event === 'REQUEST_CANCELLED' || notification.event === 'REQUEST_DELETED' || notification.event === 'REQUEST_EXPIRED' || notification.event === 'REQUEST_COMPLETED') {
        console.log('🚨 NotificationBell - Notificación de solicitud:', {
          id: notification.id,
          event: notification.event,
          title: notification.title,
          request_status: notification.payload?.request_status,
          request_id: notification.payload?.request_id,
          payload: notification.payload
        })
      }
      
      setNotifications(prev => {
        // Evitar duplicados verificando si la notificación ya existe
        const exists = prev.some(n => n.id === notification.id)
        if (exists) {
          console.log('⚠️ NotificationBell - Notificación duplicada ignorada:', notification.id)
          return prev
        }
        console.log('✅ NotificationBell - Agregando notificación al estado:', {
          id: notification.id,
          event: notification.event,
          has_status: !!notification.payload?.request_status
        })
        return [notification, ...prev.slice(0, 19)] // Mantener solo las 20 más recientes
      })
      
      // Mostrar toast cuando se acepta una solicitud de compra (ORDER_ACCEPTED)
      // Evitar duplicados verificando si ya se mostró este toast
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'ORDER_ACCEPTED') {
        // Crear una clave única basada en el ID de la notificación y el request_id para evitar duplicados
        const uniqueKey = notification.dedupe_key || `${notification.id}_${notification.payload?.request_id}`
        
        // Verificar si ya se mostró este toast para evitar duplicados (usando Set compartido)
        if (!shownToastIds.has(uniqueKey)) {
          shownToastIds.add(uniqueKey)
          
          console.log('✅ Mostrando toast ORDER_ACCEPTED con clave:', uniqueKey)
          
          // Obtener código de la solicitud y nombre del vendedor
          const getToastData = async () => {
            const uniqueCode = notification.payload?.unique_code || ''
            let sellerName = 'Vendedor'
            const requestId = notification.payload?.request_id
            
            if (requestId) {
              try {
                const supabase = supabaseBrowser()
                // Obtener la solicitud para encontrar el seller_id
                const { data: request } = await supabase
                  .from('purchase_requests')
                  .select('seller_id')
                  .eq('id', requestId)
                  .maybeSingle()
                
                if (request?.seller_id) {
                  // Obtener nombre del vendedor desde profiles
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', request.seller_id)
                    .maybeSingle()
                  
                  if (profile?.full_name) {
                    sellerName = profile.full_name
                  } else {
                    // Fallback: intentar con user_profiles
                    try {
                      const { data: userProfile } = await supabase
                        .from('user_profiles')
                        .select('full_name')
                        .eq('id', request.seller_id)
                        .maybeSingle()
                      
                      if (userProfile?.full_name) {
                        sellerName = userProfile.full_name
                      }
                    } catch (err2) {
                      console.log('⚠️ No se pudo obtener nombre del vendedor desde user_profiles:', err2)
                    }
                  }
                }
              } catch (error) {
                console.log('⚠️ No se pudo obtener información del vendedor:', error)
              }
            }
            
            // Construir descripción con código y nombre del vendedor
            const codeText = uniqueCode ? `Código: ${uniqueCode}` : ''
            const description = `Se ha aceptado el trato${codeText ? ` - ${codeText}` : ''} - Vendedor: ${sellerName}`
            
            elegantToast({
              title: "Trato aceptado",
              description: description,
              variant: "info",
            })
          }
          
          getToastData()
        }
      }
      
      // Mostrar toast cuando se completa el paso 2 (STEP_2_COMPLETED)
      // Evitar duplicados verificando si ya se mostró este toast
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'STEP_2_COMPLETED') {
        // Verificar si ya se mostró este toast para evitar duplicados (usando Set compartido)
        if (!shownToastIds.has(notification.id)) {
          shownToastIds.add(notification.id)
          
          // Obtener código de la solicitud y nombre del comprador
          const getToastData = async () => {
            const uniqueCode = notification.payload?.unique_code || ''
            let buyerName = notification.payload?.buyer_name || 'El comprador'
            
            // Si no está en el payload, intentar obtenerlo
            if (!buyerName || buyerName === 'El comprador') {
              const requestId = notification.payload?.request_id
              if (requestId) {
                try {
                  const supabase = supabaseBrowser()
                  // Obtener la solicitud para encontrar el buyer_id
                  const { data: request } = await supabase
                    .from('purchase_requests')
                    .select('buyer_id')
                    .eq('id', requestId)
                    .maybeSingle()
                  
                  if (request?.buyer_id) {
                    // Obtener nombre del comprador desde profiles
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('full_name')
                      .eq('id', request.buyer_id)
                      .maybeSingle()
                    
                    if (profile?.full_name) {
                      buyerName = profile.full_name
                    } else {
                      // Fallback: intentar con user_profiles
                      try {
                        const { data: userProfile } = await supabase
                          .from('user_profiles')
                          .select('full_name')
                          .eq('id', request.buyer_id)
                          .maybeSingle()
                        
                        if (userProfile?.full_name) {
                          buyerName = userProfile.full_name
                        }
                      } catch (err2) {
                        console.log('⚠️ No se pudo obtener nombre del comprador desde user_profiles:', err2)
                      }
                    }
                  }
                } catch (error) {
                  console.log('⚠️ No se pudo obtener información del comprador:', error)
                }
              }
            }
            
            // Construir descripción con código y nombre del comprador
            const codeText = uniqueCode ? `Código: ${uniqueCode}` : ''
            const description = `Se ha completado el paso 2${codeText ? ` - ${codeText}` : ''} - Comprador: ${buyerName}`
            
            elegantToast({
              title: "Paso 2 completado",
              description: description,
              variant: "success",
            })
          }
          
          getToastData()
        }
      }
      
      // Mostrar toast cuando se completa el paso 3 (STEP_3_COMPLETED) - al comprador
      // Evitar duplicados verificando si ya se mostró este toast
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'STEP_3_COMPLETED') {
        // Verificar si ya se mostró este toast para evitar duplicados (usando Set compartido)
        if (!shownToastIds.has(notification.id)) {
          shownToastIds.add(notification.id)
          
          // Obtener código de la solicitud y nombre del vendedor
          const getToastData = async () => {
            const uniqueCode = notification.payload?.unique_code || ''
            let sellerName = notification.payload?.seller_name || 'El vendedor'
            
            // Si no está en el payload, intentar obtenerlo
            if (!sellerName || sellerName === 'El vendedor') {
              const requestId = notification.payload?.request_id
              if (requestId) {
                try {
                  const supabase = supabaseBrowser()
                  // Obtener la solicitud para encontrar el seller_id
                  const { data: request } = await supabase
                    .from('purchase_requests')
                    .select('seller_id')
                    .eq('id', requestId)
                    .maybeSingle()
                  
                  if (request?.seller_id) {
                    // Obtener nombre del vendedor desde profiles
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('full_name')
                      .eq('id', request.seller_id)
                      .maybeSingle()
                    
                    if (profile?.full_name) {
                      sellerName = profile.full_name
                    } else {
                      // Fallback: intentar con user_profiles
                      try {
                        const { data: userProfile } = await supabase
                          .from('user_profiles')
                          .select('full_name')
                          .eq('id', request.seller_id)
                          .maybeSingle()
                        
                        if (userProfile?.full_name) {
                          sellerName = userProfile.full_name
                        }
                      } catch (err2) {
                        console.log('⚠️ No se pudo obtener nombre del vendedor desde user_profiles:', err2)
                      }
                    }
                  }
                } catch (error) {
                  console.log('⚠️ No se pudo obtener información del vendedor:', error)
                }
              }
            }
            
            // Construir descripción con código y nombre del vendedor
            const codeText = uniqueCode ? `Código: ${uniqueCode}` : ''
            const description = `Se ha completado el paso 3${codeText ? ` - ${codeText}` : ''} - Vendedor: ${sellerName}`
            
            const toastResult = elegantToast({
              title: "Paso 3 completado",
              description: description,
              variant: "success",
            })
            
            // Cerrar el toast después de 3 segundos
            setTimeout(() => {
              if (toastResult?.dismiss) {
                toastResult.dismiss()
              }
            }, 3000)
          }
          
          getToastData()
        }
      }
      
      // Mostrar toast cuando se completa la transacción (TRANSACTION_COMPLETED) - verde para ambos
      // Evitar duplicados verificando si ya se mostró este toast
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'TRANSACTION_COMPLETED') {
        // Verificar si ya se mostró este toast para evitar duplicados (usando Set compartido)
        if (!shownToastIds.has(notification.id)) {
          shownToastIds.add(notification.id)
          
          // Obtener información según el role (comprador o vendedor)
          const getToastData = async () => {
            const uniqueCode = notification.payload?.unique_code || ''
            const role = notification.payload?.role || 'buyer'
            // Usar formatted_amount que ahora contiene el monto en HNLD
            const formattedHnldAmount = notification.payload?.formatted_amount || ''
            
            let description = ''
            let title = 'Transacción completada'
            
            if (role === 'buyer') {
              // Mensaje para el comprador
              const codeText = uniqueCode ? `Código: ${uniqueCode}` : ''
              description = `Se acreditó exitosamente ${formattedHnldAmount} a tu cuenta${codeText ? ` - ${codeText}` : ''}. La transacción ha finalizado correctamente.`
            } else if (role === 'seller') {
              // Mensaje para el vendedor
              const buyerName = notification.payload?.buyer_name || 'el comprador'
              const codeText = uniqueCode ? `Código: ${uniqueCode}` : ''
              description = `La transacción con ${buyerName} ha finalizado exitosamente${codeText ? ` - ${codeText}` : ''}. Los fondos han sido liberados.`
            } else {
              // Mensaje genérico si no hay role
              const codeText = uniqueCode ? `Código: ${uniqueCode}` : ''
              description = `La transacción ha finalizado exitosamente${codeText ? ` - ${codeText}` : ''}.`
            }
            
            const toastResult = elegantToast({
              title: title,
              description: description,
              variant: "created",
            })
            
            // Cerrar el toast después de 5 segundos
            setTimeout(() => {
              if (toastResult?.dismiss) {
                toastResult.dismiss()
              }
            }, 5000)
          }
          
          getToastData()
        }
      }
      
      // Mostrar toast cuando se acepta una venta (SALE_ACCEPTED)
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'SALE_ACCEPTED') {
        const uniqueKey = notification.dedupe_key || `${notification.id}_${notification.payload?.request_id}`
        
        if (!shownToastIds.has(uniqueKey)) {
          shownToastIds.add(uniqueKey)
          
          const uniqueCode = notification.payload?.unique_code || ''
          const sellerName = notification.payload?.seller_name || 'El vendedor'
          
          elegantToast({
            title: "Venta aceptada",
            description: `${sellerName} ha aceptado tu compra de HNLD${uniqueCode ? ` - Código: ${uniqueCode}` : ''}`,
            variant: "info",
          })
        }
      }
      
      // Mostrar toast cuando se inicia el pago en una venta (SALE_PAYMENT_STARTED)
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'SALE_PAYMENT_STARTED') {
        if (!shownToastIds.has(notification.id)) {
          shownToastIds.add(notification.id)
          
          const uniqueCode = notification.payload?.unique_code || ''
          const buyerName = notification.payload?.buyer_name || 'El comprador'
          
          elegantToast({
            title: "Pago iniciado",
            description: `${buyerName} ha iniciado el pago${uniqueCode ? ` - Código: ${uniqueCode}` : ''}`,
            variant: "success",
          })
        }
      }
      
      // Mostrar toast cuando se verifica el pago en una venta (SALE_PAYMENT_VERIFIED)
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'SALE_PAYMENT_VERIFIED') {
        if (!shownToastIds.has(notification.id)) {
          shownToastIds.add(notification.id)
          
          const uniqueCode = notification.payload?.unique_code || ''
          const sellerName = notification.payload?.seller_name || 'El vendedor'
          
          const toastResult = elegantToast({
            title: "Pago verificado",
            description: `${sellerName} ha verificado tu pago${uniqueCode ? ` - Código: ${uniqueCode}` : ''}`,
            variant: "success",
          })
          
          setTimeout(() => {
            if (toastResult?.dismiss) {
              toastResult.dismiss()
            }
          }, 3000)
        }
      }
      
      // Mostrar toast cuando se completa una venta (SALE_COMPLETED)
      if (notification.priority === 'high' && notification.topic === 'order' && notification.event === 'SALE_COMPLETED') {
        if (!shownToastIds.has(notification.id)) {
          shownToastIds.add(notification.id)
          
          const uniqueCode = notification.payload?.unique_code || ''
          const hnldAmount = notification.payload?.hnld_amount || 0
          const role = notification.payload?.role || 'buyer'
          
          let description = ''
          if (role === 'buyer') {
            description = `Se acreditó exitosamente L.${hnldAmount.toFixed(2)} HNLD a tu cuenta${uniqueCode ? ` - Código: ${uniqueCode}` : ''}. La venta ha finalizado correctamente.`
          } else {
            description = `La venta ha finalizado exitosamente${uniqueCode ? ` - Código: ${uniqueCode}` : ''}. Los HNLD han sido liberados al comprador.`
          }
          
          const toastResult = elegantToast({
            title: "Venta completada",
            description: description,
            variant: "created",
          })
          
          setTimeout(() => {
            if (toastResult?.dismiss) {
              toastResult.dismiss()
            }
          }, 5000)
        }
      }
      
      // Mostrar toast para notificaciones críticas del sistema (alta prioridad)
      if (notification.priority === 'high' && notification.topic === 'system') {
        // Verificar si ya se mostró este toast para evitar duplicados (usando Set compartido)
        if (!shownToastIds.has(notification.id)) {
          shownToastIds.add(notification.id)
          toast.success(notification.title, {
            description: notification.body,
            action: notification.cta_label ? {
              label: notification.cta_label,
              onClick: () => {
                if (notification.cta_href) {
                  router.push(notification.cta_href)
                }
              }
            } : undefined,
            duration: 5000,
          })
        }
      }
      
      // Actualizar estadísticas solo cuando se agrega una nueva notificación
      setStats(prev => ({
        ...prev,
        total: prev.total + 1,
        unread: prev.unread + 1
      }))
    })

    const unsubscribeStats = notificationCenter.addStatsListener((newStats) => {
      if (!isSubscribed) return
      console.log('📊 NotificationBell - Estadísticas actualizadas:', newStats)
      setStats(newStats)
    })

    console.log('✅ NotificationBell - Listeners configurados correctamente')

    return () => {
      console.log('🧹 NotificationBell - Limpiando listeners')
      isSubscribed = false
      unsubscribeNotification()
      unsubscribeStats()
    }
  }, [])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    setIsLoading(true)
    try {
      const data = await notificationCenter.getNotifications({ limit: 20 })
      console.log('🔍 NotificationBell - Cargando notificaciones:', data.length, 'notificaciones')
      console.log('🔍 IDs de notificaciones cargadas:', data.map(n => n.id))
      setNotifications(data)
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await notificationCenter.getStats()
      setStats(data)
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // Función para cerrar el drawer de manera controlada
  const closeDrawer = () => {
    setDrawerOpen(false)
    setTimeout(() => {
      setIsOpen(false)
    }, 100) // Pequeño delay para permitir animación
  }

  // Función para marcar todas las notificaciones como leídas automáticamente
  const markAllAsReadOnOpen = async () => {
    const success = await notificationCenter.markAllAsRead()
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const })))
      // Las estadísticas se actualizarán automáticamente via refreshStats() en NotificationCenter
    }
  }

  // Función para eliminar todas las notificaciones
  const handleDeleteAllNotifications = async () => {
    if (notifications.length === 0) return
    
    // Agregar todas las notificaciones a la lista de eliminación para activar la animación
    const allIds = notifications.map(n => n.id)
    setDeletingIds(new Set(allIds))
    
    // Eliminar todas las notificaciones
    const result = await notificationCenter.deleteMultipleNotifications(allIds)
    
    if (result.success) {
      // Esperar a que termine la animación antes de actualizar el estado
      setTimeout(async () => {
        setNotifications([])
        setDeletingIds(new Set())
        await loadNotifications()
      }, 300)
    } else {
      console.error('Error eliminando todas las notificaciones:', result.error)
      setDeletingIds(new Set())
    }
  }

  // Función para eliminar una notificación con efecto
  const handleDeleteNotification = async (notificationId: string) => {
    console.log('🗑️ NotificationBell - Eliminando notificación:', notificationId)
    console.log('🎬 NotificationBell - Estado deletingIds antes:', deletingIds)
    
    // Agregar a la lista de eliminación para activar la animación
    setDeletingIds(prev => {
      const newSet = new Set(prev).add(notificationId)
      console.log('🎬 NotificationBell - Nuevo estado deletingIds:', newSet)
      return newSet
    })
    
    // Eliminar inmediatamente de la base de datos
    const result = await notificationCenter.deleteNotification(notificationId)
    console.log('🗑️ NotificationBell - Resultado eliminación:', result)
    
    if (result.success) {
      // Esperar a que termine la animación antes de quitar del estado local
      setTimeout(async () => {
        console.log('🗑️ NotificationBell - Removiendo del estado local:', notificationId)
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        setDeletingIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(notificationId)
          console.log('🎬 NotificationBell - Limpiando deletingIds:', newSet)
          return newSet
        })
        
        // Recargar notificaciones para asegurar sincronización
        console.log('🔄 NotificationBell - Recargando notificaciones para sincronización')
        await loadNotifications()
      }, 300) // Duración de la animación
    } else {
      console.log('⚠️ NotificationBell - Error eliminando:', result.error)
      
      // Si es un error de "no encontrada" o "no pertenece", simplemente quitarla del estado local
      if (result.error?.includes('no encontrada') || result.error?.includes('no pertenece')) {
        console.log('🔄 NotificationBell - Notificación ya no existe, quitando del estado local')
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
      
      // Quitar de la lista de eliminación en cualquier caso
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        console.log('🎬 NotificationBell - Limpiando deletingIds por error:', newSet)
        return newSet
      })
    }
  }

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: es 
      })
    } catch {
      return 'hace un momento'
    }
  }

  // Agrupar notificaciones de chat por context_id
  const getGroupedNotifications = () => {
    // DESACTIVADO: Lógica de agrupación de chat removida
    // Ahora solo retornamos las notificaciones sin agrupación especial
    return notifications.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  // Función helper para obtener notificaciones agrupadas
  const groupedNotifications = getGroupedNotifications()

  // Renderizar lista de notificaciones
  const renderNotificationsList = () => {
    if (isLoading) {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Cargando notificaciones...
        </div>
      )
    }
    
    if (groupedNotifications.length === 0) {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No hay notificaciones
        </div>
      )
    }

    return (
      <div className="divide-y">
        {groupedNotifications.map((notification) => {
          const isDeleting = deletingIds.has(notification.id)
          
          return (
            <div
              key={notification.id}
              className={cn(
                "p-4 sm:p-5 py-4 sm:py-5 hover:bg-muted/50 transition-all duration-300 ease-in-out relative cursor-pointer min-h-[100px] sm:min-h-[110px]",
                notification.status === 'unread' && "bg-muted/30",
                isDeleting && "transform translate-x-full opacity-0"
              )}
              style={{
                transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out'
              }}
              onClick={(e) => {
                if (notification.status === 'unread') {
                  notificationCenter.markAsRead(notification.id)
                  setNotifications(prev => prev.map(n => 
                    n.id === notification.id 
                      ? { ...n, status: 'read' as const }
                      : n
                  ))
                  setStats(prev => ({
                    ...prev,
                    unread: Math.max(0, prev.unread - 1),
                    read: prev.read + 1
                  }))
                }
                if (isMobile) {
                  closeDrawer()
                } else {
                  setIsOpen(false)
                }
                if (notification.cta_href) {
                  router.push(notification.cta_href)
                }
              }}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="text-lg sm:text-xl flex-shrink-0">{getTopicIcon(notification.topic)}</div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-sm sm:text-base leading-tight">
                          {notification.title}
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-4 sm:line-clamp-5 whitespace-pre-wrap break-words">
                        {notification.body}
                      </p>
                      <div className="flex items-center gap-2 mt-3 sm:mt-4 flex-wrap">
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        {notification.priority === 'high' && (
                          <Badge 
                            variant="destructive" 
                            className="text-xs h-5 px-2 sm:h-4 sm:px-1"
                          >
                            Alta prioridad
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Botón de eliminar solo visible en desktop */}
                    {!isMobile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 h-7 w-7 sm:h-6 sm:w-6 p-0 mt-0.5 text-muted-foreground hover:text-destructive touch-manipulation"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeleteNotification(notification.id)
                        }}
                        title="Eliminar notificación"
                      >
                        <X size={14} className="sm:w-3 sm:h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Renderizar contenido completo
  const renderNotificationContent = (showHeader: boolean = true) => {
    if (isMobile) {
      return (
        <div>
          {renderNotificationsList()}
        </div>
      )
    }

    return (
      <>
        {showHeader && (
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Notificaciones</h3>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteAllNotifications}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  title="Eliminar todas las notificaciones"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Eliminar todas
                </Button>
              )}
            </div>
          </div>
        )}
        
        <ScrollArea 
          className="h-80 sm:h-96 max-h-[50vh]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {renderNotificationsList()}
        </ScrollArea>
      </>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (!isOpen && stats.unread > 0) {
            // Marcar todas como leídas cuando se abre el panel
            markAllAsReadOnOpen()
          }
          setIsOpen(!isOpen)
        }}
        className={cn(
          "relative text-muted-foreground hover:text-primary hover:bg-muted/50",
          className
        )}
        aria-label={`Notificaciones${stats.unread > 0 ? ` (${stats.unread} no leídas)` : ''}`}
      >
        <Bell size={20} />
        {stats.unread > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {stats.unread > 99 ? '99+' : stats.unread}
          </Badge>
        )}
      </Button>

      {/* Desktop: Card dropdown */}
      {isOpen && !isMobile && (
        <Card className="absolute right-0 top-12 w-80 sm:w-96 z-50 shadow-lg border max-h-[80vh]">
          <CardContent className="p-0">
            {renderNotificationContent(true)}
          </CardContent>
        </Card>
      )}

      {/* Mobile: Drawer */}
      <Drawer 
        open={drawerOpen && isMobile} 
        onOpenChange={(open) => {
          // Solo permitir cerrar con gestos nativos (deslizar hacia abajo)
          // No permitir cerrar con clicks internos
          if (!open) {
            // Solo cerrar si es un gesto nativo, no un click interno
            closeDrawer()
          }
        }}
      >
        <DrawerContent 
          className="max-h-[90vh] flex flex-col"
        >
          <DrawerHeader className="pb-3 flex-shrink-0 border-b px-4 pt-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg">Notificaciones</DrawerTitle>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteAllNotifications}
                  className="h-9 text-xs text-muted-foreground hover:text-destructive touch-manipulation"
                  title="Eliminar todas las notificaciones"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar todas
                </Button>
              )}
            </div>
          </DrawerHeader>
          
          <div className="flex-1 min-h-0 px-4 pb-4 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {renderNotificationContent(false)}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}


