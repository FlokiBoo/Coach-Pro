import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe, createCouponAndPromoCode, retirePromoCode } from '@/lib/stripe'

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

// Supprime un code promo. Stripe ne permet pas de supprimer un code promo à proprement parler :
// on le désactive et on supprime son coupon dédié — les clients qui l'ont déjà appliqué gardent
// leur réduction, seules les futures utilisations sont bloquées.
export async function DELETE(request, { params }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  try {
    await retirePromoCode(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// Modifie un code promo : comme Stripe ne permet pas de changer le code ou la réduction d'un
// code promo existant, on retire l'ancien (désactivé + coupon supprimé, sans impact sur les
// clients qui l'ont déjà appliqué) et on en crée un nouveau avec les mêmes ou nouveaux paramètres.
export async function PUT(request, { params }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const { code, type, value, duration, durationInMonths, maxRedemptions, expiresAt } = await request.json()
  if (!code?.trim()) return NextResponse.json({ error: 'Code requis' }, { status: 400 })
  if (!value || value <= 0) return NextResponse.json({ error: 'Valeur de réduction requise' }, { status: 400 })

  try {
    await retirePromoCode(id)
    const promotionCode = await createCouponAndPromoCode({ code, type, value, duration, durationInMonths, maxRedemptions, expiresAt })
    return NextResponse.json({ promotionCode })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
