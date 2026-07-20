import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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
  let isCoach = false
  if (!isOwner) {
    const { data: coach } = await supabaseAdmin.from('coaches').select('id').eq('id', user.id).single()
    isCoach = !!coach
  }
  if (!isOwner && !isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [{ data: progs }, { data: comps }, { data: logs }, { data: objectives }, { data: noteBlocks }, { data: exoSets }] = await Promise.all([
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
  ])

  const exerciseNames = [...new Set(
    (progs || []).flatMap(p => (p.program_sessions || []).flatMap(s => (s.program_exercises || []).map(e => e.name).filter(Boolean)))
  )]
  let movieMap = {}
  if (exerciseNames.length) {
    const { data: movs } = await supabaseAdmin.from('movements').select('name, youtube_url').in('name', exerciseNames)
    ;(movs || []).forEach(m => { movieMap[m.name] = m.youtube_url })
  }

  return NextResponse.json(
    { athlete, programs: progs || [], completions: comps || [], exerciseLogs: logs || [], movieMap, objectives: objectives || [], noteBlocks: noteBlocks || [], exerciseSets: exoSets || [] },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
