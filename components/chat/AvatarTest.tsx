"use client"

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabaseBrowser } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/utils/avatar-utils'

interface AvatarTestProps {
  userId: string
}

export default function AvatarTest({ userId }: AvatarTestProps) {
  const [avatarData, setAvatarData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAvatarData = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log('🔍 AvatarTest: Iniciando consulta para userId:', userId)

        // Consulta directa a user_profiles
        const supabase = supabaseBrowser()
        const { data: userProfileData, error: userProfileError } = await supabase
          .from('user_profiles')
          .select(`
            user_id,
            avatar_url,
            display_name
          `)
          .eq('user_id', userId)
          .single()

        if (userProfileError) {
          console.error('❌ AvatarTest: Error en user_profiles:', userProfileError)
          setError(`Error user_profiles: ${userProfileError.message}`)
          return
        }

        console.log('✅ AvatarTest: Datos de user_profiles:', userProfileData)

        // Consulta directa a profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name
          `)
          .eq('id', userId)
          .single()

        if (profileError) {
          console.error('❌ AvatarTest: Error en profiles:', profileError)
          setError(`Error profiles: ${profileError.message}`)
          return
        }

        console.log('✅ AvatarTest: Datos de profiles:', profileData)

        // Si no hay user_profiles, crear uno básico
        if (!userProfileData) {
          console.log('⚠️ AvatarTest: Usuario sin user_profiles, creando uno básico...')
          
          const { data: newUserProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: userId,
              display_name: profileData?.full_name,
              avatar_url: null,
              bio: null,
              theme: 'system',
              notification_email: true,
              notification_push: true,
              notification_sms: false
            })
            .select()
            .single()

          if (createError) {
            console.error('❌ AvatarTest: Error creando user_profiles:', createError)
            setError(`Error creando user_profiles: ${createError.message}`)
            return
          }

          console.log('✅ AvatarTest: User_profiles creado:', newUserProfile)
          userProfileData = newUserProfile
        }

        // Combinar datos
        const combinedData = {
          user_id: userId,
          full_name: profileData?.full_name,
          display_name: userProfileData?.display_name,
          avatar_url: userProfileData?.avatar_url
        }

        console.log('✅ AvatarTest: Datos combinados:', combinedData)
        setAvatarData(combinedData)

      } catch (err) {
        console.error('❌ AvatarTest: Error general:', err)
        setError(`Error general: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchAvatarData()
    }
  }, [userId])

  if (loading) {
    return (
      <div className="p-4 border rounded-lg">
        <p className="text-sm text-muted-foreground">Cargando datos de avatar...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg border-red-200 bg-red-50">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-sm font-semibold mb-2">Prueba de Avatar</h3>
      
      <div className="flex items-center gap-3 mb-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={getAvatarUrl(avatarData?.avatar_url) || ''} alt={avatarData?.display_name || avatarData?.full_name || 'Usuario'} />
          <AvatarFallback className="text-sm bg-primary/10 text-primary">
            {avatarData?.display_name?.charAt(0) || avatarData?.full_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div>
          <p className="text-sm font-medium">
            {avatarData?.display_name || avatarData?.full_name || 'Usuario'}
          </p>
          <p className="text-xs text-muted-foreground">
            ID: {avatarData?.user_id}
          </p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Avatar URL:</strong> {avatarData?.avatar_url || 'null'}</p>
        <p><strong>Display Name:</strong> {avatarData?.display_name || 'null'}</p>
        <p><strong>Full Name:</strong> {avatarData?.full_name || 'null'}</p>
        <p><strong>Estado:</strong> {
          avatarData?.avatar_url 
            ? '✅ Con avatar' 
            : '❌ Sin avatar'
        }</p>
      </div>
    </div>
  )
}