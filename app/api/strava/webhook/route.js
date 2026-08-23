import { supabaseAdmin } from '@/lib/supabase-admin'
import { getValidStravaToken, fetchStravaActivity, findOrCreateRunningSession } from '@/lib/strava'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Poignée de main de validation de l'abonnement webhook (faite une seule fois à la création).
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

// Événement d'activité Strava. On répond vite (Strava exige <2s) : seules les activités de
// course fraîchement créées déclenchent un traitement, tout le reste est ignoré immédiatement.
export async function POST(request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  if (body.object_type !== 'activity' || body.aspect_type !== 'create') {
    return NextResponse.json({ ok: true })
  }

  const { data: athlete } = await supabaseAdmin.from('athletes')
    .select('id, strava_access_token, strava_refresh_token, strava_token_expires_at')
    .eq('strava_athlete_id', body.owner_id).maybeSingle()
  if (!athlete) return NextResponse.json({ ok: true })

  const accessToken = await getValidStravaToken(athlete)
  if (!accessToken) return NextResponse.json({ ok: true })

  const activity = await fetchStravaActivity(accessToken, body.object_id)
  if (!activity || activity.type !== 'Run') return NextResponse.json({ ok: true })

  const sessionId = await findOrCreateRunningSession(athlete.id)
  if (!sessionId) return NextResponse.json({ ok: true })

  // Upsert sur (athlete_id, program_session_id) : si le client a déjà validé la séance à la
  // main, ça complète juste les chiffres sans toucher à son ressenti/difficulté/commentaire —
  // si Strava arrive en premier, le client peut ensuite ajouter son ressenti par-dessus.
  const { data: existing } = await supabaseAdmin.from('program_completions')
    .select('id').eq('athlete_id', athlete.id).eq('program_session_id', sessionId).maybeSingle()

  const stravaFields = {
    distance_km: Math.round((activity.distance / 1000) * 100) / 100,
    duration_minutes: Math.round(activity.moving_time / 60),
  }

  if (existing) {
    await supabaseAdmin.from('program_completions').update(stravaFields).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('program_completions').insert({
      athlete_id: athlete.id, program_session_id: sessionId, completed_at: activity.start_date, ...stravaFields,
    })
  }

  return NextResponse.json({ ok: true })
}
