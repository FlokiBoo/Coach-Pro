import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const RACE_KEYS = ['10km', '21km', '42km']

// Allure cible du sportif pour une distance de course donnée, saisie librement à la fin d'une
// séance de course, pour référence dans les futures séances (ex: "allure marathon").
export async function POST(request, { params }) {
  const { token } = await params
  const { raceKey, pace } = await request.json()
  if (!RACE_KEYS.includes(raceKey)) return NextResponse.json({ error: 'raceKey invalide' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id, target_paces').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const targetPaces = { ...(athlete.target_paces || {}), [raceKey]: pace?.trim() || null }
  const { data, error } = await supabaseAdmin.from('athletes').update({ target_paces: targetPaces }).eq('id', athlete.id).select('target_paces').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ targetPaces: data.target_paces })
}
