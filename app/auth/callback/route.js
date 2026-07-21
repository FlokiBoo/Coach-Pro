import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin as adminClient } from '@/lib/supabase-admin'
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

    if (data?.user) {
      const { data: coach } = await adminClient.from('coaches').select('id').eq('id', data.user.id).single()
      if (coach) {
        await adminClient.auth.admin.updateUserById(data.user.id, {
          app_metadata: { needs_password: true }
        })
        return NextResponse.redirect(`${origin}/definir-mot-de-passe`)
      }
    }

    // Le paramètre d'URL peut se perdre pendant la redirection Supabase : on retombe sur
    // user_metadata (fixé de façon fiable par inviteUserByEmail/generateLink) en secours.
    const effectiveAthleteId = athleteId || data?.user?.user_metadata?.athlete_id

    if (data?.user && effectiveAthleteId) {
      // Lier l'utilisateur à son athlete (via le client admin : à ce stade la ligne n'est pas
      // encore reliée à ce compte, donc les règles de sécurité bloqueraient le client normal)
      await adminClient.from('athletes').update({ auth_user_id: data.user.id }).eq('id', effectiveAthleteId)

      const { data: athlete } = await adminClient.from('athletes').select('token').eq('id', effectiveAthleteId).single()
      if (athlete?.token) {
        // Marquer ce compte comme client + forcer la création de mot de passe
        await adminClient.auth.admin.updateUserById(data.user.id, {
          app_metadata: { athlete_token: athlete.token, needs_password: true }
        })
        return NextResponse.redirect(`${origin}/definir-mot-de-passe`)
      }
    }

    if (data?.user) {
      const { data: athlete } = await supabase.from('athletes').select('token').eq('auth_user_id', data.user.id).single()
      if (athlete?.token) return NextResponse.redirect(`${origin}/s/${athlete.token}`)
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
