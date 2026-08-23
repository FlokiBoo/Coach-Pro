import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Seul le coach peut fixer le focus musculaire d'un mouvement (il vaut alors pour toutes
// ses utilisations, actuelles et futures) — le sportif ne peut que consulter.
export async function POST(request, { params }) {
  const { token } = await params
  const { exerciseId, movementName, zones } = await request.json()
  if (!exerciseId || !Array.isArray(zones)) return NextResponse.json({ error: 'paramètres invalides' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, coach_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: coach } = await supabaseAdmin.from('coaches').select('id, is_admin').eq('id', user.id).single()
  const isCoach = !!coach && (coach.is_admin || athlete.coach_id === user.id)
  if (!isCoach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const value = zones.length ? zones.join(',') : null
  const name = movementName?.trim()
  if (name) {
    const { error: movErr } = await supabaseAdmin.from('movements').upsert({ name, focus_groups: value }, { onConflict: 'name' })
    if (movErr) return NextResponse.json({ error: movErr.message }, { status: 400 })
  }
  await supabaseAdmin.from('program_exercises').update({ focus_muscles: null }).eq('id', exerciseId)

  return NextResponse.json({ ok: true, focusGroups: value })
}
