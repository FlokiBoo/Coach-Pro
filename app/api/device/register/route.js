import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const MAX_DEVICES = 2

export async function POST(request) {
  const { deviceId } = await request.json()
  if (!deviceId) return NextResponse.json({ error: 'deviceId requis' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, max_devices').eq('auth_user_id', user.id).single()
  if (!athlete) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Le code OTP vient d'être vérifié côté client (supabase.auth.verifyOtp) juste avant cet appel :
  // on considère cet appareil validé. On applique la limite (2 par défaut, ou athletes.max_devices
  // si un override a été défini pour ce sportif) en éjectant le plus ancien si besoin.
  const maxDevices = athlete.max_devices ?? MAX_DEVICES
  const { data: existing } = await supabaseAdmin.from('athlete_devices')
    .select('id, device_id, created_at').eq('athlete_id', athlete.id).order('created_at', { ascending: true })

  const already = (existing || []).find(d => d.device_id === deviceId)
  if (already) {
    await supabaseAdmin.from('athlete_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', already.id)
    return NextResponse.json({ ok: true })
  }

  const toEvict = (existing || []).slice(0, Math.max(0, (existing?.length || 0) - (maxDevices - 1)))
  if (toEvict.length) {
    await supabaseAdmin.from('athlete_devices').delete().in('id', toEvict.map(d => d.id))
  }

  const { error } = await supabaseAdmin.from('athlete_devices').insert({ athlete_id: athlete.id, device_id: deviceId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
