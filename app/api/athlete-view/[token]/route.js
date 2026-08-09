import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { buildKnownRaces } from '@/lib/raceEstimates'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request, { params }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('*').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  // Auth obligatoire : soit le sportif lui-même, soit un coach
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const isOwner = athlete.auth_user_id === user.id
  const { data: coach } = await supabaseAdmin.from('coaches').select('id').eq('id', user.id).single()
  const isCoach = !!coach
  if (!isOwner && !isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [{ data: progs }, { data: comps }, { data: logs }, { data: objectives }, { data: noteBlocks }, { data: exoSets }, { data: trackedMovs }] = await Promise.all([
    supabaseAdmin.from('programs')
      .select('*, program_sessions(*, program_exercises(*))')
      .eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('program_completions')
      .select('program_session_id, pleasure, difficulty, duration_minutes')
      .eq('athlete_id', athlete.id),
    supabaseAdmin.from('program_exercise_logs').select('*').eq('athlete_id', athlete.id),
    supabaseAdmin.from('athlete_objectives').select('*').eq('athlete_id', athlete.id).order('created_at'),
    supabaseAdmin.from('athlete_note_blocks').select('*').eq('athlete_id', athlete.id).order('order_index'),
    supabaseAdmin.from('program_exercise_sets').select('*').eq('athlete_id', athlete.id).order('set_index'),
    supabaseAdmin.from('tracked_movements').select('id, name, unit, tracked_movement_entries(value, athlete_id)'),
  ])

  const raceMovements = (trackedMovs || []).map(m => ({
    ...m,
    entries: (m.tracked_movement_entries || []).filter(e => e.athlete_id === athlete.id),
  }))
  const raceKnown = buildKnownRaces(raceMovements)
  const trackedMovements = (trackedMovs || []).map(({ id, name, unit }) => ({ id, name, unit }))

  // Gratuit (pas d'abonnement actif) : les programmes copiés depuis le catalogue en libre-service
  // sont limités aux N premières séances (free_sessions_count) pour donner envie de passer payant.
  // Chacun avance à son rythme, pas de notion de semaine.
  const shouldGateFreeTier = !isCoach && athlete.subscription_status !== 'active'
  const gatedProgs = shouldGateFreeTier
    ? (progs || []).map(p => {
        if (p.free_sessions_count == null) return p
        const sorted = [...(p.program_sessions || [])].sort((a, b) => a.order_index - b.order_index)
        const lockedIds = new Set(sorted.slice(p.free_sessions_count).map(s => s.id))
        return {
          ...p,
          program_sessions: (p.program_sessions || []).map(s =>
            lockedIds.has(s.id)
              ? { ...s, locked: true, program_exercises: [], activation: null, coach_notes: null, circuits: [], activation_videos: [] }
              : s
          ),
        }
      })
    : (progs || [])

  const exerciseNames = [...new Set(
    (gatedProgs || []).flatMap(p => (p.program_sessions || []).flatMap(s => (s.program_exercises || []).map(e => e.name).filter(Boolean)))
  )]
  let movieMap = {}, musclesMap = {}
  if (exerciseNames.length) {
    const { data: movs } = await supabaseAdmin.from('movements').select('name, youtube_url, muscles').in('name', exerciseNames)
    ;(movs || []).forEach(m => {
      movieMap[m.name] = m.youtube_url
      if (m.muscles) musclesMap[m.name.trim().toLowerCase()] = m.muscles
    })
  }

  return NextResponse.json(
    {
      athlete, programs: gatedProgs, completions: comps || [], exerciseLogs: logs || [], movieMap, musclesMap,
      objectives: objectives || [], noteBlocks: noteBlocks || [], exerciseSets: exoSets || [],
      raceKnown, trackedMovements, isCoach,
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
