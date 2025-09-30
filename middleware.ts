import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Rutas que requieren autenticación
  const protectedRoutes = ['/dashboard', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  // Rutas de autenticación (login, register, etc.)
  const authRoutes = ['/login', '/register', '/forgot-password']
  const isAuthRoute = authRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  // Solo verificar autenticación para rutas protegidas
  if (isProtectedRoute) {
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()

    // Si no hay sesión, redirigir al login
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Verificar que el usuario tenga un perfil en la base de datos
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle()

    // Si no hay perfil, redirigir a página de error con opción de registro
    if (error || !profile) {
      console.error('❌ Usuario sin perfil en base de datos:', session.user.email)
      // Cerrar sesión y redirigir a página de error
      await supabase.auth.signOut()
      const redirectUrl = new URL('/account-not-found', req.url)
      redirectUrl.searchParams.set('email', session.user.email || '')
      return NextResponse.redirect(redirectUrl)
    }

    // Verificación adicional para rutas de admin
    if (req.nextUrl.pathname.startsWith('/admin')) {
      const { data: hasAdminRole } = await supabase.rpc('has_role', { 
        role_name: 'admin' 
      })
      
      if (!hasAdminRole) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
  }

  // Si el usuario está autenticado y trata de acceder a rutas de auth, redirigir al dashboard
  if (isAuthRoute) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session) {
      // Verificar si es admin para redirigir al panel correcto
      const { data: hasAdminRole } = await supabase.rpc('has_role', { 
        role_name: 'admin' 
      })
      
      return NextResponse.redirect(new URL(hasAdminRole ? '/admin' : '/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match only the routes that need authentication:
     * - /dashboard/* (dashboard routes)
     * - /admin/* (admin routes)
     * - /login, /register, /forgot-password (auth routes for redirects)
     */
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/forgot-password',
  ],
}
