import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const { token } = await params
  const { sessionId, name, sets, reps, kg } = await request.json()
  if (!sessionId || !name?.trim()) return NextResponse.json({ error: 'sessionId et name requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, coach_id, auth_user_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

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
    const { data: coach } = await supabaseAdmin.from('coaches').select('id, is_admin').eq('id', user.id).single()
    isCoach = !!coach && (coach.is_admin || athlete.coach_id === user.id)
  }
  if (!isOwner && !isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // La séance doit appartenir à un programme "Séance libre" de ce sportif — pas d'ajout
  // d'exercice arbitraire sur une séance planifiée par le coach via cette route.
  const { data: sess } = await supabaseAdmin.from('program_sessions')
    .select('id, program_id, programs!inner(id, athlete_id, title)')
    .eq('id', sessionId).single()
  if (!sess || sess.programs.athlete_id !== athlete.id || !sess.programs.title?.startsWith('Séance libre')) {
    return NextResponse.json({ error: 'séance introuvable' }, { status: 404 })
  }

  const { data: existing } = await supabaseAdmin.from('program_exercises')
    .select('order_index').eq('program_session_id', sessionId).order('order_index', { ascending: false }).limit(1)
  const nextIndex = existing?.length ? existing[0].order_index + 1 : 0

  const { data: exo, error } = await supabaseAdmin.from('program_exercises').insert({
    program_session_id: sessionId,
    order_index: nextIndex,
    name: name.trim(),
    sets: sets ? parseInt(sets) : null,
    reps: reps || null,
    kg: kg !== '' && kg != null && !isNaN(parseFloat(kg)) ? parseFloat(kg) : null,
  }).select().single()
  if (!exo) return NextResponse.json({ error: error?.message || 'erreur création exercice' }, { status: 400 })

  return NextResponse.json({ exercise: exo })
}
