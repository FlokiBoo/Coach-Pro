import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  const { athleteId } = await params
  if (!athleteId) return NextResponse.json({ error: 'athleteId requis' }, { status: 400 })

  // Auth obligatoire : coach uniquement
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: coach } = await supabaseAdmin.from('coaches').select('id').eq('id', user.id).single()
  if (!coach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id').eq('id', athleteId).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  // Programmes (nouveau système) : exercise_performance_history -> program_exercise_logs -> program_exercises -> program_completions -> program_sessions -> programs
  const { data: programs } = await supabaseAdmin.from('programs').select('id').eq('athlete_id', athleteId)
  const programIds = (programs || []).map(p => p.id)

  if (programIds.length) {
    const { data: sessions } = await supabaseAdmin.from('program_sessions').select('id').in('program_id', programIds)
    const sessionIds = (sessions || []).map(s => s.id)

    if (sessionIds.length) {
      const { data: exos } = await supabaseAdmin.from('program_exercises').select('id').in('program_session_id', sessionIds)
      const exoIds = (exos || []).map(e => e.id)
      if (exoIds.length) {
        await supabaseAdmin.from('exercise_performance_history').delete().in('program_exercise_id', exoIds)
        await supabaseAdmin.from('program_exercise_logs').delete().in('program_exercise_id', exoIds)
        await supabaseAdmin.from('program_exercises').delete().in('id', exoIds)
      }
      await supabaseAdmin.from('program_completions').delete().in('program_session_id', sessionIds)
      await supabaseAdmin.from('program_sessions').delete().in('id', sessionIds)
    }
    await supabaseAdmin.from('programs').delete().in('id', programIds)
  }
  // Filet de sécurité : au cas où des lignes referenceraient encore directement l'athlète
  await supabaseAdmin.from('exercise_performance_history').delete().eq('athlete_id', athleteId)
  await supabaseAdmin.from('program_exercise_logs').delete().eq('athlete_id', athleteId)
  await supabaseAdmin.from('program_completions').delete().eq('athlete_id', athleteId)

  // Séances legacy : athlete_logs -> exercises -> sessions
  const { data: legacySessions } = await supabaseAdmin.from('sessions').select('id').eq('athlete_id', athleteId)
  const legacySessionIds = (legacySessions || []).map(s => s.id)
  if (legacySessionIds.length) {
    const { data: legacyExos } = await supabaseAdmin.from('exercises').select('id').in('session_id', legacySessionIds)
    const legacyExoIds = (legacyExos || []).map(e => e.id)
    if (legacyExoIds.length) {
      await supabaseAdmin.from('athlete_logs').delete().in('exercise_id', legacyExoIds)
      await supabaseAdmin.from('exercises').delete().in('id', legacyExoIds)
    }
    await supabaseAdmin.from('sessions').delete().in('id', legacySessionIds)
  }

  // Reste des données liées à l'athlète
  await supabaseAdmin.from('wellness').delete().eq('athlete_id', athleteId)
  await supabaseAdmin.from('activity_logs').delete().eq('athlete_id', athleteId)
  await supabaseAdmin.from('tracked_movement_entries').delete().eq('athlete_id', athleteId)
  await supabaseAdmin.from('athlete_objectives').delete().eq('athlete_id', athleteId)
  await supabaseAdmin.from('athlete_note_blocks').delete().eq('athlete_id', athleteId)

  const { error: delErr } = await supabaseAdmin.from('athletes').delete().eq('id', athleteId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
