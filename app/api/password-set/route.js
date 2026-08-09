import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const profile = await request.json().catch(() => ({}))
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      needs_password: false
    }
  })

  // Lie le compte à son profil sportif si ce n'est pas déjà fait (cas : lien de récupération
  // utilisé à la place du lien d'invitation classique, qui fait normalement cette liaison).
  const athleteId = user.user_metadata?.athlete_id
  let athleteToken = null
  if (athleteId) {
    const { data: athlete } = await adminClient.from('athletes').select('id, token, auth_user_id').eq('id', athleteId).single()
    if (athlete) {
      const updates = {}
      if (!athlete.auth_user_id) updates.auth_user_id = user.id
      if (profile.name?.trim()) updates.name = profile.name.trim()
      if (profile.birth_date) updates.birth_date = profile.birth_date
      if (profile.height) updates.height = parseInt(profile.height)
      if (profile.weight) updates.weight = parseFloat(profile.weight)
      if (Object.keys(updates).length) await adminClient.from('athletes').update(updates).eq('id', athleteId)
    }
    athleteToken = athlete?.token || null
  }

  return NextResponse.json({ success: true, athleteToken })
}
