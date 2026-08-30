import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request, { params }) {
  const { token } = await params
  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, name, coach_id, auth_user_id').eq('token', token).single()
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
  const isCoach = athlete.coach_id === user.id
  if (!isOwner && !isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  return NextResponse.json({ athleteId: athlete.id, athleteName: athlete.name })
}
