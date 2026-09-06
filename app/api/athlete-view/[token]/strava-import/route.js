import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getValidStravaToken, processStravaActivity } from '@/lib/strava'

// Import rétroactif : le webhook ne rattrape que les nouvelles activités à partir du moment où
// il est branché — pour tout ce qui a eu lieu avant (ou pendant une panne du webhook, comme ça a
// été le cas), le client choisit une date de départ et on va chercher tout ce qu'il y a sur
// Strava depuis cette date. Réutilise processStravaActivity (idempotent sur l'id d'activité
// Strava) : relancer un import sur une plage qui se chevauche ne crée jamais de doublon.
export async function POST(request, { params }) {
  const { token } = await params
  const { startDate } = await request.json()
  if (!startDate) return NextResponse.json({ error: 'date de départ requise' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('*').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!athlete.strava_athlete_id) return NextResponse.json({ error: 'Strava non connecté' }, { status: 400 })

  const accessToken = await getValidStravaToken(athlete)
  if (!accessToken) return NextResponse.json({ error: 'Connexion Strava expirée, reconnecte-toi' }, { status: 400 })

  const afterEpoch = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)
  if (Number.isNaN(afterEpoch)) return NextResponse.json({ error: 'date invalide' }, { status: 400 })

  const activities = []
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) break
    const batch = await res.json()
    if (!Array.isArray(batch) || !batch.length) break
    activities.push(...batch)
    if (batch.length < 100) break
  }

  let imported = 0
  for (const activity of activities) {
    const result = await processStravaActivity(athlete, activity)
    if (result.imported) imported++
  }

  return NextResponse.json({ total: activities.length, imported, skipped: activities.length - imported })
}
