import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: coach } = await supabaseAdmin.from('coaches').select('is_admin').eq('id', user.id).single()
  return coach?.is_admin ? user : null
}

export async function PATCH(request, { params }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const { active } = await request.json()

  try {
    const promotionCode = await stripe.promotionCodes.update(id, { active: !!active })
    return NextResponse.json({ promotionCode })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
