import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe, createCouponAndPromoCode } from '@/lib/stripe'

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: coach } = await supabaseAdmin.from('coaches').select('is_admin').eq('id', user.id).single()
  return coach?.is_admin ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const codes = []
  for await (const pc of stripe.promotionCodes.list({ limit: 100, expand: ['data.coupon'] })) {
    // Un code "supprimé" (coupon supprimé, cf. retirePromoCode) n'est jamais vraiment effacé côté
    // Stripe — on le masque juste de la liste, pour ne pas la polluer indéfiniment.
    if (pc.coupon?.valid === false) continue
    codes.push(pc)
  }
  codes.sort((a, b) => b.created - a.created)

  return NextResponse.json({ codes })
}

export async function POST(request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { code, type, value, duration, durationInMonths, maxRedemptions, expiresAt } = await request.json()
  if (!code?.trim()) return NextResponse.json({ error: 'Code requis' }, { status: 400 })
  if (!value || value <= 0) return NextResponse.json({ error: 'Valeur de réduction requise' }, { status: 400 })

  try {
    const promotionCode = await createCouponAndPromoCode({ code, type, value, duration, durationInMonths, maxRedemptions, expiresAt })
    return NextResponse.json({ promotionCode })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
