import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { sendPushToAthlete } from '@/lib/push'

// Push (pas email) envoyé aux athlètes que le coach vient de marquer présents à une séance de
// groupe — sendPushToAthlete est un no-op silencieux pour qui n'a pas l'app installée/de token
// enregistré, donc rien à filtrer ici en amont.
export async function POST(request) {
  const { athleteIds, sessionTitle } = await request.json()

  if (!Array.isArray(athleteIds) || !athleteIds.length) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 })
  }

  const { data: athletes } = await supabaseAdmin.from('athletes').select('id, token').in('id', athleteIds)

  await Promise.all((athletes || []).map(a => sendPushToAthlete(a.id, {
    title: 'Séance de groupe à compléter',
    body: sessionTitle || 'Une séance de groupe',
    link: '/s/' + a.token,
  })))

  return NextResponse.json({ success: true })
}
