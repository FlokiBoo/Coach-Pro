import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const { token } = await params
  const { programSessionId, circuitId, mode, temps, tours, reps, note } = await request.json()
  if (!programSessionId || !circuitId || !mode) return NextResponse.json({ error: 'champs requis manquants' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: log, error } = await supabaseAdmin.from('circuit_logs').upsert({
    athlete_id: athlete.id,
    program_session_id: programSessionId,
    circuit_id: String(circuitId),
    mode,
    temps: temps || null,
    tours: tours !== '' && tours != null && !isNaN(parseInt(tours)) ? parseInt(tours) : null,
    reps: reps || null,
    note: note || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'athlete_id,program_session_id,circuit_id' }).select().single()
  if (!log) return NextResponse.json({ error: error?.message || 'erreur enregistrement' }, { status: 400 })

  return NextResponse.json({ log })
}
