import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const { token } = await params
  const { exercises } = await request.json()
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, coach_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const dateLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const { data: prog, error: progErr } = await supabaseAdmin.from('programs')
    .insert({ athlete_id: athlete.id, coach_id: athlete.coach_id, title: `Séance libre — ${dateLabel}` })
    .select().single()
  if (!prog) return NextResponse.json({ error: progErr?.message || 'erreur création programme' }, { status: 400 })

  const { data: sess } = await supabaseAdmin.from('program_sessions')
    .insert({ program_id: prog.id, order_index: 0, title: 'Séance libre' })
    .select().single()
  if (!sess) return NextResponse.json({ error: 'erreur création séance' }, { status: 400 })

  const toInsert = (exercises || []).filter(e => e.name?.trim()).map((e, i) => ({
    program_session_id: sess.id, order_index: i, name: e.name.trim(),
    sets: e.sets ? parseInt(e.sets) : null,
    reps: e.reps || null,
    kg: e.kg !== '' && !isNaN(parseFloat(e.kg)) ? parseFloat(e.kg) : null,
  }))
  let insertedExos = []
  if (toInsert.length) {
    const { data: inserted } = await supabaseAdmin.from('program_exercises').insert(toInsert).select()
    insertedExos = inserted || []
  }

  return NextResponse.json({ program: prog, session: { ...sess, exercises: insertedExos } })
}
