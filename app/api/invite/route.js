import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, athleteId, athleteName, redirectTo } = await request.json()

  if (!email || !athleteId) {
    return NextResponse.json({ error: 'email et athleteId requis' }, { status: 400 })
  }

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
