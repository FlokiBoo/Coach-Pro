import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isRunMovement, is3030Movement, computePaceForBasePct, computeDistanceForBasePct, formatPace, formatDistance, buildKnownRaces } from '@/lib/raceEstimates'

export const dynamic = 'force-dynamic'

// Pour un leader de groupe : les allures/distances de tous les membres du groupe sur LA MÊME
// séance (reconnue via source_session_id, donc uniquement pour une séance venant d'un template
// partagé au groupe — voir group_program_templates). Chaque membre a sa propre VMA/Seuil, donc les
// mêmes %VMA donnent des valeurs différentes par personne.
export async function GET(request, { params }) {
  const { token } = await params
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('*').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const isOwner = athlete.auth_user_id === user.id
  const { data: coach } = await supabaseAdmin.from('coaches').select('id, is_admin').eq('id', user.id).single()
  const isCoach = !!coach && (coach.is_admin || athlete.coach_id === user.id)
  if (!isOwner && !isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: leaderRows } = await supabaseAdmin.from('group_members').select('group_id').eq('athlete_id', athlete.id).eq('is_leader', true)
  if (!leaderRows?.length) return NextResponse.json({ isLeader: false, members: [] })

  const { data: mySession } = await supabaseAdmin.from('program_sessions').select('id, source_session_id').eq('id', sessionId).single()
  if (!mySession?.source_session_id) return NextResponse.json({ isLeader: true, members: [] })

  const groupIds = leaderRows.map(r => r.group_id)
  const { data: memberRows } = await supabaseAdmin.from('group_members').select('athlete_id').in('group_id', groupIds)
  const memberIds = [...new Set((memberRows || []).map(m => m.athlete_id))]
  if (!memberIds.length) return NextResponse.json({ isLeader: true, members: [] })

  const [{ data: members }, { data: memberPrograms }, { data: allMovements }] = await Promise.all([
    supabaseAdmin.from('athletes').select('id, name').in('id', memberIds),
    supabaseAdmin.from('programs').select('id, athlete_id').in('athlete_id', memberIds),
    supabaseAdmin.from('tracked_movements').select('id, name, unit, tracked_movement_entries(value, athlete_id, date)'),
  ])

  const programToAthlete = {}
  ;(memberPrograms || []).forEach(p => { programToAthlete[p.id] = p.athlete_id })
  const programIds = Object.keys(programToAthlete)
  if (!programIds.length) return NextResponse.json({ isLeader: true, members: [] })

  const { data: memberSessions } = await supabaseAdmin
    .from('program_sessions')
    .select('id, program_id, program_exercises(name, pace_base, pct_low, pct_high)')
    .eq('source_session_id', mySession.source_session_id)
    .in('program_id', programIds)

  const nameById = {}
  ;(members || []).forEach(m => { nameById[m.id] = m.name })

  const result = (memberSessions || []).map(sess => {
    const athleteId = programToAthlete[sess.program_id]
    const athleteMovements = (allMovements || []).map(m => ({
      ...m,
      entries: (m.tracked_movement_entries || []).filter(e => e.athlete_id === athleteId),
    }))
    const known = buildKnownRaces(athleteMovements)

    const exercises = (sess.program_exercises || [])
      .filter(e => e.name && isRunMovement(e.name) && (e.pace_base || e.pct_low != null || e.pct_high != null))
      .map(e => {
        const is3030 = is3030Movement(e.name)
        const raw1 = is3030 ? computeDistanceForBasePct(e.pace_base, e.pct_low, known) : computePaceForBasePct(e.pace_base, e.pct_low, known)
        const raw2 = is3030 ? computeDistanceForBasePct(e.pace_base, e.pct_high, known) : computePaceForBasePct(e.pace_base, e.pct_high, known)
        return {
          name: e.name,
          label1: is3030 ? 'Distance 1 (30s)' : 'Allure 1',
          label2: is3030 ? 'Distance 2 (30s)' : 'Allure 2',
          val1: raw1 == null ? null : (is3030 ? formatDistance(raw1) : `${formatPace(raw1)}/km`),
          val2: raw2 == null ? null : (is3030 ? formatDistance(raw2) : `${formatPace(raw2)}/km`),
        }
      })

    return { athleteId, athleteName: nameById[athleteId] || '—', exercises }
  }).sort((a, b) => a.athleteName.localeCompare(b.athleteName))

  return NextResponse.json({ isLeader: true, members: result })
}
