import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, athleteId, athleteName, redirectTo } = await request.json()

  if (!email || !athleteId) {
    return NextResponse.json({ error: 'email et athleteId requis' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service role key non configurée' }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Sauvegarder l'email sur l'athlete
  await supabaseAdmin.from('athletes').update({ email }).eq('id', athleteId)

  // Envoyer l'invitation Supabase
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${redirectTo}/auth/callback?athlete_id=${athleteId}`,
    data: { athlete_id: athleteId, athlete_name: athleteName }
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, userId: data.user?.id })
}
