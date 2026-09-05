import { supabaseAdmin } from '@/lib/supabase-admin'

const CLIENT_ID = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET

export function stravaAuthorizeUrl(redirectUri, state) {
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', 'activity:read_all')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeStravaCode(code) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code' }),
  })
  if (!res.ok) throw new Error(`Échange de code Strava échoué (${res.status})`)
  return res.json() // { access_token, refresh_token, expires_at, athlete: { id, ... } }
}

// Rafraîchit le token d'un athlète si besoin (expire toutes les 6h côté Strava) et met à jour
// la base — à appeler avant tout appel à l'API Strava pour cet athlète.
export async function getValidStravaToken(athlete) {
  if (!athlete.strava_refresh_token) return null
  const now = Math.floor(Date.now() / 1000)
  if (athlete.strava_access_token && athlete.strava_token_expires_at > now + 60) {
    return athlete.strava_access_token
  }
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token', refresh_token: athlete.strava_refresh_token,
    }),
  })
  if (!res.ok) return null
  const json = await res.json()
  await supabaseAdmin.from('athletes').update({
    strava_access_token: json.access_token,
    strava_refresh_token: json.refresh_token,
    strava_token_expires_at: json.expires_at,
  }).eq('id', athlete.id)
  return json.access_token
}

export async function fetchStravaActivity(accessToken, activityId) {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  return res.json()
}

// Correspondance entre le type d'activité Strava (fixe côté Strava) et le libellé activity_type
// libre utilisé côté coach (pas d'enum ici — "Running 🏃‍♀️", "Musculation 🏋️", "Crossfit 🏋️"...
// sont juste des conventions de texte). Le préfixe ILIKE retrouve un programme déjà de ce type ;
// à défaut de correspondance connue, on garde le type Strava tel quel comme libellé de secours
// plutôt que d'ignorer l'activité.
const STRAVA_TYPE_MAP = {
  Run: 'Running 🏃‍♀️',
  VirtualRun: 'Running 🏃‍♀️',
  Ride: 'Vélo 🚴',
  VirtualRide: 'Vélo 🚴',
  Swim: 'Natation 🏊',
  Walk: 'Marche 🥾',
  Hike: 'Marche 🥾',
  WeightTraining: 'Musculation 🏋️',
  Workout: 'Musculation 🏋️',
  Crossfit: 'Crossfit 🏋️',
  Yoga: 'Yoga 🧘',
  Rowing: 'Aviron 🚣',
}

export function stravaActivityLabel(stravaType) {
  return STRAVA_TYPE_MAP[stravaType] || stravaType
}

// Séance pas encore validée dans le programme actif du même type d'activité le plus ancien —
// à défaut, on log dans une "Séance libre" (même mécanisme que quand un client en crée une
// à la main), pour ne jamais perdre une activité même hors-programme.
export async function findOrCreateSessionForActivity(athleteId, activityTypeLabel) {
  const ilikePrefix = `${activityTypeLabel.split(' ')[0]}%`
  const { data: programs } = await supabaseAdmin.from('programs')
    .select('id, coach_id, program_sessions(id, order_index)')
    .eq('athlete_id', athleteId)
    .or('archived.is.null,archived.eq.false')
    .ilike('activity_type', ilikePrefix)
    .order('created_at', { ascending: true })

  const { data: completions } = await supabaseAdmin.from('program_completions')
    .select('program_session_id').eq('athlete_id', athleteId)
  const completedIds = new Set((completions || []).map(c => c.program_session_id))

  for (const prog of (programs || [])) {
    const sessions = [...(prog.program_sessions || [])].sort((a, b) => a.order_index - b.order_index)
    const next = sessions.find(s => !completedIds.has(s.id))
    if (next) return next.id
  }

  const { data: athlete } = await supabaseAdmin.from('athletes').select('coach_id').eq('id', athleteId).single()
  const dateLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const { data: freeProg } = await supabaseAdmin.from('programs')
    .insert({ athlete_id: athleteId, title: `Séance libre — ${dateLabel}`, coach_id: athlete?.coach_id, activity_type: activityTypeLabel })
    .select().single()
  if (!freeProg) return null
  const { data: freeSess } = await supabaseAdmin.from('program_sessions')
    .insert({ program_id: freeProg.id, order_index: 0, title: 'Séance libre' })
    .select().single()
  return freeSess?.id || null
}
