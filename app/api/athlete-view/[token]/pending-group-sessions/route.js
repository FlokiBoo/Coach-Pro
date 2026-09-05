import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Séances de groupe où le coach a coché ce sportif présent, mais que ce dernier n'a pas encore
// complétées lui-même (charges, notes, difficulté, plaisir) — pour le pop-up "tu as participé".
export async function GET(request, { params }) {
  const { token } = await params
  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: attendance } = await supabaseAdmin.from('group_session_attendance')
    .select('run_id, group_session_runs(id, group_id, source_session_id, title, date)')
    .eq('athlete_id', athlete.id)
  if (!attendance?.length) return NextResponse.json({ pending: [] })

  const groupIds = [...new Set(attendance.map(a => a.group_session_runs?.group_id).filter(Boolean))]
  const { data: ownPrograms } = await supabaseAdmin.from('programs')
    .select('id, group_id').eq('athlete_id', athlete.id).in('group_id', groupIds)
  const ownProgramIds = ownPrograms.map(p => p.id)
  // Un athlète peut avoir PLUSIEURS copies personnelles pour le même groupe (un programme créé
  // directement dessus ET un template lié, par exemple) — garder toutes les candidates, pas
  // seulement la dernière, sinon les séances rattachées aux autres copies sont ignorées en silence.
  const ownProgramsByGroup = {}
  ownPrograms.forEach(p => { (ownProgramsByGroup[p.group_id] ||= []).push(p.id) })

  const sourceSessionIds = [...new Set(attendance.map(a => a.group_session_runs?.source_session_id).filter(Boolean))]
  const { data: ownSessions } = ownProgramIds.length
    ? await supabaseAdmin.from('program_sessions').select('id, program_id, source_session_id').in('program_id', ownProgramIds).in('source_session_id', sourceSessionIds)
    : { data: [] }
  const ownSessionByProgramAndSource = {}
  ownSessions.forEach(s => { ownSessionByProgramAndSource[`${s.program_id}::${s.source_session_id}`] = s.id })

  const ownSessionIds = ownSessions.map(s => s.id)
  const { data: completions } = ownSessionIds.length
    ? await supabaseAdmin.from('program_completions').select('program_session_id').in('program_session_id', ownSessionIds)
    : { data: [] }
  const completedSessionIds = new Set(completions.map(c => c.program_session_id))

  const pending = []
  for (const a of attendance) {
    const run = a.group_session_runs
    if (!run) continue
    const candidateProgramIds = ownProgramsByGroup[run.group_id] || []
    const ownSessionId = candidateProgramIds
      .map(pid => ownSessionByProgramAndSource[`${pid}::${run.source_session_id}`])
      .find(Boolean)
    if (!ownSessionId || completedSessionIds.has(ownSessionId)) continue
    pending.push({ runId: run.id, title: run.title, date: run.date, ownSessionId })
  }
  pending.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ pending })
}
