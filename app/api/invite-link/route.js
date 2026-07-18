import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, athleteId, athleteName, redirectTo } = await request.json()

  if (!email || !athleteId) {
    return NextResponse.json({ error: 'email et athleteId requis' }, { status: 400 })
  }

  // Auth obligatoire : coach uniquement
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: me } = await supabaseAdmin.from('coaches').select('id').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Sauvegarder l'email sur l'athlete
  await supabaseAdmin.from('athletes').update({ email }).eq('id', athleteId)

  // Génère un lien d'invitation sans envoyer d'email — le coach le partage lui-même
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${redirectTo}/auth/callback?athlete_id=${athleteId}`,
      data: { athlete_id: athleteId, athlete_name: athleteName },
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ link: data.properties?.action_link })
}
