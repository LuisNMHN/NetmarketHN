import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Error exchanging code for session:', error)
        return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`)
      }

                  if (data.user) {
                    // Verificar si el usuario tiene perfil creado
                    try {
                      const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', data.user.id)
                        .maybeSingle()

                      if (profileError) {
                        console.error('❌ Error verificando perfil en callback:', profileError.message || profileError)
                        return NextResponse.redirect(`${requestUrl.origin}/login?error=profile_error`)
                      }

                      if (!profile) {
                        console.log('⚠️ Usuario sin perfil en callback')
                        return NextResponse.redirect(`${requestUrl.origin}/login?error=no_profile`)
                      }

                      console.log('✅ Perfil verificado en callback')
                    } catch (error) {
                      console.error('❌ Error en verificación de perfil en callback:', error instanceof Error ? error.message : error)
                      return NextResponse.redirect(`${requestUrl.origin}/login?error=profile_error`)
                    }

                    // Redirigir a Balance HNLD (página principal del dashboard)
                    return NextResponse.redirect(`${requestUrl.origin}/dashboard/saldo`)
                  }
    } catch (error) {
      console.error('Error in auth callback:', error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=callback_error`)
    }
  }

  // Si no hay código, redirigir al login
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}
