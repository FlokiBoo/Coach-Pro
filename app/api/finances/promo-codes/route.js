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

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const codes = []
  for await (const pc of stripe.promotionCodes.list({ limit: 100, expand: ['data.coupon'] })) {
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
    const couponParams = {
      duration: duration || 'once',
      name: code.trim().toUpperCase(),
    }
    if (type === 'percent') {
      couponParams.percent_off = value
    } else {
      couponParams.amount_off = Math.round(value * 100)
      couponParams.currency = 'eur'
    }
    if (duration === 'repeating') couponParams.duration_in_months = durationInMonths || 1

    const coupon = await stripe.coupons.create(couponParams)

    const promoParams = {
      coupon: coupon.id,
      code: code.trim().toUpperCase(),
    }
    if (maxRedemptions) promoParams.max_redemptions = parseInt(maxRedemptions)
    if (expiresAt) promoParams.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000)

    const promotionCode = await stripe.promotionCodes.create(promoParams)

    return NextResponse.json({ promotionCode })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
