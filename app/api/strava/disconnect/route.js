import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { token } = await request.json()
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id, coach_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: coach } = await supabaseAdmin.from('coaches').select('id, is_admin').eq('id', user.id).single()
  const isCoach = !!coach && (coach.is_admin || athlete.coach_id === user.id)
  if (athlete.auth_user_id !== user.id && !isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await supabaseAdmin.from('athletes').update({
    strava_athlete_id: null, strava_access_token: null, strava_refresh_token: null, strava_token_expires_at: null,
  }).eq('id', athlete.id)

  return NextResponse.json({ success: true })
}
