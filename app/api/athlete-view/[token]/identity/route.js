import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Vérifie que la session active du navigateur correspond bien au sportif propriétaire du
// token — utilisé par /verify-device pour ne jamais envoyer un code à la mauvaise adresse
// si la session du navigateur a basculé entre-temps (ex. plusieurs comptes testés dans le
// même navigateur, rafraîchissement de session dans un autre onglet).
export async function GET(request, { params }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (athlete.auth_user_id !== user.id) return NextResponse.json({ error: 'mismatch' }, { status: 403 })

  return NextResponse.json({ ok: true, email: user.email })
}
