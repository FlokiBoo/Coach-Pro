import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  const { pathname } = request.nextUrl

  // Routes publiques (dont la vue sportif — accès par lien personnel)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/api/athlete-view')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response = NextResponse.next({ request })
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const athleteToken = user.app_metadata?.athlete_token
  const needsPassword = user.app_metadata?.needs_password

  // Forcer la création de mot de passe à la première connexion (athlète ou coach invité)
  if (needsPassword) {
    if (!pathname.startsWith('/definir-mot-de-passe')) {
      return NextResponse.redirect(new URL('/definir-mot-de-passe', request.url))
    }
    return response
  }

  // Si c'est un compte client (pas le coach), le cantonner à son espace
  if (athleteToken && !pathname.startsWith(`/s/${athleteToken}`)) {
    return NextResponse.redirect(new URL(`/s/${athleteToken}`, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon.svg|.*\\.png$).*)'],
}
