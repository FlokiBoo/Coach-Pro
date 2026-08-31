import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/email'
import { ONE_TIME_OFFERS } from '@/lib/offers'

async function requireCoach() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: coach } = await supabaseAdmin.from('coaches').select('id, email').eq('id', user.id).single()
  return coach || null
}

// Génère la session de paiement Stripe pour une demande acceptée : paiement unique, ou abonnement
// à 3 mensualités égales qui s'auto-annule après la 3e charge (= "3x sans frais", pas de BNPL tiers).
async function createCheckoutForRequest(offer, reqRow, origin) {
  const commonMeta = { offer_key: reqRow.offer_key, request_id: reqRow.id, customer_name: reqRow.customer_name }

  if (reqRow.payment_plan === '3x') {
    // Stripe Checkout n'accepte pas subscription_data.cancel_at à la création — la date d'arrêt
    // (3e mensualité) est posée après coup sur l'abonnement réel, dans le webhook, une fois qu'il existe.
    return stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: reqRow.customer_email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `${offer.label} (3x sans frais)`, description: offer.subtitle },
          unit_amount: Math.round((offer.amount * 100) / 3),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: `${origin}/offres/merci`,
      cancel_url: `${origin}/offres`,
      metadata: commonMeta,
      subscription_data: { metadata: commonMeta },
    })
  }

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: reqRow.customer_email,
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: offer.label, description: offer.subtitle },
        unit_amount: offer.amount * 100,
      },
      quantity: 1,
    }],
    success_url: `${origin}/offres/merci`,
    cancel_url: `${origin}/offres`,
    metadata: commonMeta,
  })
}

export async function POST(request) {
  const coach = await requireCoach()
  if (!coach) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { requestId, action } = await request.json()
  if (!['accept', 'decline'].includes(action)) return NextResponse.json({ error: 'action invalide' }, { status: 400 })

  const { data: reqRow } = await supabaseAdmin.from('offer_requests').select('*').eq('id', requestId).single()
  if (!reqRow) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 400 })

  if (action === 'decline') {
    await supabaseAdmin.from('offer_requests').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', requestId)
    return NextResponse.json({ success: true })
  }

  const offer = ONE_TIME_OFFERS[reqRow.offer_key]
  if (!offer) return NextResponse.json({ error: 'Offre inconnue.' }, { status: 400 })

  const { origin } = new URL(request.url)
  const session = await createCheckoutForRequest(offer, reqRow, origin)

  await supabaseAdmin.from('offer_requests').update({
    status: 'accepted', checkout_url: session.url, decided_at: new Date().toISOString(),
  }).eq('id', requestId)

  await sendEmail({
    to: reqRow.customer_email,
    subject: `Ta demande « ${offer.label} » est acceptée`,
    html: `<p>Bonne nouvelle ${reqRow.customer_name}, ta demande pour « ${offer.label} » est acceptée !</p><p>Pour finaliser, règle ton ${reqRow.payment_plan === '3x' ? 'premier des 3 paiements' : 'paiement'} ici : <a href="${session.url}">${session.url}</a></p>`,
  })

  return NextResponse.json({ success: true, url: session.url })
}
