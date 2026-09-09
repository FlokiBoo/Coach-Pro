import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

async function authenticate(token) {
  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id').eq('token', token).single()
  if (!athlete) return { error: NextResponse.json({ error: 'introuvable' }, { status: 404 }) }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  return { athlete }
}

// Compte, pour chaque séance récurrente du sportif, le nombre de passages du jour — un enregistrement
// par passage (pas d'upsert comme program_completions), donc le compteur repart naturellement à zéro
// le lendemain sans job de reset : on ne regarde que les lignes datées d'aujourd'hui.
export async function GET(request, { params }) {
  const { token } = await params
  const { searchParams } = new URL(request.url)
  const { athlete, error } = await authenticate(token)
  if (error) return error

  // Le serveur (UTC) et l'appareil (heure locale) peuvent désigner des "aujourd'hui" différents près
  // de minuit — on privilégie la date fournie par le client, comme pour leader-groups.
  const date = searchParams.get('date') || today()
  const { data: logs } = await supabaseAdmin.from('recurring_session_logs')
    .select('program_session_id, completed_at')
    .eq('athlete_id', athlete.id)
    .gte('completed_at', `${date}T00:00:00`)
    .lt('completed_at', `${date}T23:59:59.999`)

  const counts = {}
  ;(logs || []).forEach(l => { counts[l.program_session_id] = (counts[l.program_session_id] || 0) + 1 })
  return NextResponse.json({ counts })
}

// Enregistre un passage ("+1") sur une séance récurrente — pas de formulaire de ressenti, juste un
// compteur rapide (une séance récurrente peut se faire plusieurs fois par jour).
export async function POST(request, { params }) {
  const { token } = await params
  const { athlete, error } = await authenticate(token)
  if (error) return error

  const { sessionId } = await request.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId manquant' }, { status: 400 })

  const { data: session } = await supabaseAdmin.from('program_sessions')
    .select('id, program_id, programs!inner(athlete_id)').eq('id', sessionId).single()
  if (!session || session.programs?.athlete_id !== athlete.id) {
    return NextResponse.json({ error: 'séance introuvable' }, { status: 404 })
  }

  const { error: insertErr } = await supabaseAdmin.from('recurring_session_logs')
    .insert({ athlete_id: athlete.id, program_session_id: sessionId })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
