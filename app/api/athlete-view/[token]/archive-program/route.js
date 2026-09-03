import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Permet à l'athlète d'arrêter lui-même un programme en cours (ex: pour en prendre un autre du
// même type — cumuler deux programmes de running n'a pas de sens). Simple archivage, pas de
// suppression : l'historique (complétions, logs) reste intact.
export async function POST(request, { params }) {
  const { token } = await params
  const { programId } = await request.json()
  if (!programId) return NextResponse.json({ error: 'programId requis' }, { status: 400 })

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

  const { data: program } = await supabaseAdmin.from('programs').select('id, athlete_id').eq('id', programId).single()
  if (!program || program.athlete_id !== athlete.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('programs').update({ archived: true }).eq('id', programId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
