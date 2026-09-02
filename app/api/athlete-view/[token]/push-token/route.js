import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function authenticate(token) {
  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id').eq('token', token).single()
  if (!athlete) return { error: NextResponse.json({ error: 'introuvable' }, { status: 404 }) }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  return { athlete }
}

// Enregistre le token FCM de l'appareil courant pour recevoir les notifications push
// (nouveau message du coach). Un même token peut être ré-enregistré (upsert) — Capacitor
// renvoie parfois le même token à chaque démarrage de l'app.
export async function POST(request, { params }) {
  const { token } = await params
  const { error, athlete } = await authenticate(token)
  if (error) return error

  const { pushToken, platform } = await request.json()
  if (!pushToken) return NextResponse.json({ error: 'token manquant' }, { status: 400 })

  const { error: upsertErr } = await supabaseAdmin.from('push_tokens')
    .upsert({ athlete_id: athlete.id, token: pushToken, platform: platform || 'android' }, { onConflict: 'token' })
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
