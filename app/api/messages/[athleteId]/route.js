import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function authenticate(athleteId) {
  const { data: athlete } = await supabaseAdmin.from('athletes').select('*').eq('id', athleteId).single()
  if (!athlete) return { error: NextResponse.json({ error: 'introuvable' }, { status: 404 }) }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const isOwner = athlete.auth_user_id === user.id
  const isCoach = athlete.coach_id === user.id
  if (!isOwner && !isCoach) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }

  return { athlete, user, role: isCoach ? 'coach' : 'athlete' }
}

export async function GET(request, { params }) {
  const { athleteId } = await params
  const { error, role } = await authenticate(athleteId)
  if (error) return error

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at')

  return NextResponse.json({ messages: messages || [], role }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
}

export async function POST(request, { params }) {
  const { athleteId } = await params
  const { error, user, role } = await authenticate(athleteId)
  if (error) return error

  const { body, attachment_url, attachment_type } = await request.json()
  const trimmedBody = body?.trim() || null
  if (!trimmedBody && !attachment_url) return NextResponse.json({ error: 'message vide' }, { status: 400 })

  const { data: message, error: insertErr } = await supabaseAdmin.from('messages')
    .insert({
      athlete_id: athleteId, sender_role: role, sender_id: user.id, body: trimmedBody,
      attachment_url: attachment_url || null, attachment_type: attachment_type || null,
    })
    .select().single()
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })

  return NextResponse.json({ message })
}

export async function PATCH(request, { params }) {
  const { athleteId } = await params
  const { error, role } = await authenticate(athleteId)
  if (error) return error

  const field = role === 'coach' ? 'read_by_coach_at' : 'read_by_athlete_at'
  await supabaseAdmin.from('messages')
    .update({ [field]: new Date().toISOString() })
    .eq('athlete_id', athleteId)

  return NextResponse.json({ success: true })
}
