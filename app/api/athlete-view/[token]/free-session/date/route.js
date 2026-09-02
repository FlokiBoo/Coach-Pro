import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Change la date d'une séance libre existante (déterminée à la création, modifiable ensuite).
export async function POST(request, { params }) {
  const { token } = await params
  const { sessionId, date } = await request.json()
  if (!sessionId || !date) return NextResponse.json({ error: 'paramètres invalides' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, coach_id, auth_user_id').eq('token', token).single()
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
  let isCoach = false
  if (!isOwner) {
    const { data: coach } = await supabaseAdmin.from('coaches').select('id, is_admin').eq('id', user.id).single()
    isCoach = !!coach && (coach.is_admin || athlete.coach_id === user.id)
  }
  if (!isOwner && !isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: target } = await supabaseAdmin.from('program_sessions').select('id, program_id').eq('id', sessionId).single()
  if (!target) return NextResponse.json({ error: 'séance introuvable' }, { status: 404 })

  const { data: program } = await supabaseAdmin.from('programs').select('id, athlete_id').eq('id', target.program_id).single()
  if (!program || program.athlete_id !== athlete.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('program_sessions').update({ date }).eq('id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
