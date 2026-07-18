import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, name, redirectTo } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'email requis' }, { status: 400 })
  }

  // Auth obligatoire : coach admin uniquement
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: me } = await supabaseAdmin.from('coaches').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${redirectTo}/auth/callback`,
    data: { coach_name: name || '' }
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { error: insertErr } = await supabaseAdmin
    .from('coaches')
    .insert({ id: data.user.id, email, name: name || null, is_admin: false })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })

  return NextResponse.json({ success: true, coachId: data.user.id })
}
