import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const athleteId = searchParams.get('athlete_id')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { data } = await supabase.auth.exchangeCodeForSession(code)

    if (data?.user && athleteId) {
      // Lier l'utilisateur à son athlete
      await supabase.from('athletes').update({ auth_user_id: data.user.id }).eq('id', athleteId)

      // Récupérer le token pour rediriger vers sa page
      const { data: athlete } = await supabase.from('athletes').select('token').eq('id', athleteId).single()
      if (athlete?.token) {
        return NextResponse.redirect(`${origin}/s/${athlete.token}`)
      }
    }

    if (data?.user) {
      // Chercher si déjà lié à un athlete
      const { data: athlete } = await supabase.from('athletes').select('token').eq('auth_user_id', data.user.id).single()
      if (athlete?.token) return NextResponse.redirect(`${origin}/s/${athlete.token}`)
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
