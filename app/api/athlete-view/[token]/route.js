import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request, { params }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('*').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const [{ data: progs }, { data: comps }, { data: logs }] = await Promise.all([
    supabaseAdmin.from('programs')
      .select('*, program_sessions(*, program_exercises(*))')
      .eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('program_completions')
      .select('program_session_id, pleasure, difficulty, duration_minutes')
      .eq('athlete_id', athlete.id),
    supabaseAdmin.from('program_exercise_logs').select('*').eq('athlete_id', athlete.id),
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
    { athlete, programs: progs || [], completions: comps || [], exerciseLogs: logs || [], movieMap },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
