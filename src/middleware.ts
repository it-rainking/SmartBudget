import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/budget', '/transazioni', '/fatture', '/obiettivi', '/settings', '/onboarding', '/istruzioni', '/debiti', '/aggiorna-password']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  // Auth routes (redirect if already logged in)
  const authPaths = ['/login', '/signup', '/recupera-password']
  const isAuthPath = authPaths.some(path => request.nextUrl.pathname.startsWith(path))

  // Stale refresh token: clear auth cookies and redirect to login to stop repeated errors.
  // 'refresh_token_already_used' happens when the token was rotated by a concurrent request
  // (or a stale tab) past Supabase's reuse window: the token family is revoked, so the
  // session is unrecoverable, same as 'refresh_token_not_found'.
  const staleTokenCodes = ['refresh_token_not_found', 'refresh_token_already_used']
  if (error?.code && staleTokenCodes.includes(error.code)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    request.cookies.getAll()
      .filter(cookie => cookie.name.startsWith('sb-'))
      .forEach(cookie => redirectResponse.cookies.delete(cookie.name))
    return redirectResponse
  }

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/mensile'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
