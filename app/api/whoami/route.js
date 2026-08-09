import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ role: null })

  const { data: coach } = await supabaseAdmin.from('coaches').select('id').eq('id', user.id).single()
  if (coach) return NextResponse.json({ role: 'coach', coachId: coach.id })

  const { data: athlete } = await supabaseAdmin.from('athletes')
    .select('id, name, token').eq('auth_user_id', user.id).single()
  if (athlete) return NextResponse.json({ role: 'athlete', athleteId: athlete.id, athleteName: athlete.name, token: athlete.token })

  return NextResponse.json({ role: null })
}
