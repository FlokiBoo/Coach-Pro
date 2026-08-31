import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { ONE_TIME_OFFERS } from '@/lib/offers'

// Route publique (aucun compte requis) : un prospect achète une offre ponctuelle avant même
// d'avoir un compte athlète — le coach l'onboarde manuellement après réception du paiement
// (voir syncOfferPurchase dans le webhook Stripe).
export async function POST(request) {
  const { offerKey, name, email } = await request.json()
  const offer = ONE_TIME_OFFERS[offerKey]
  if (!offer) return NextResponse.json({ error: 'Offre invalide.' }, { status: 400 })
  if (!name?.trim() || !email?.trim()) return NextResponse.json({ error: 'Nom et email requis.' }, { status: 400 })

  const { origin } = new URL(request.url)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email.trim().toLowerCase(),
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
    metadata: { offer_key: offerKey, customer_name: name.trim() },
  })

  return NextResponse.json({ url: session.url })
}
