import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(request, { params }) {
  const { token } = await params

  const { data: athlete } = await supabaseAdmin.from('athletes').select('*').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (!athlete.stripe_customer_id) return NextResponse.json({ error: 'Aucun abonnement en cours' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { origin } = new URL(request.url)
  const session = await stripe.billingPortal.sessions.create({
    customer: athlete.stripe_customer_id,
    return_url: `${origin}/s/${token}`,
  })

  return NextResponse.json({ url: session.url })
}
