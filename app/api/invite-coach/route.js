import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, name, redirectTo } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'email requis' }, { status: 400 })
  }

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
