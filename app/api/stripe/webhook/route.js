import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

async function syncFromSubscription(subscription) {
  const athleteId = subscription.metadata?.athlete_id
  const tier = subscription.metadata?.tier || null
  if (!athleteId) return

  await supabaseAdmin.from('athletes').update({
    stripe_subscription_id: subscription.id,
    subscription_tier: tier,
    subscription_status: subscription.status,
  }).eq('id', athleteId)
}

export async function POST(request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json({ error: `Signature invalide : ${err.message}` }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.mode === 'subscription' && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        await syncFromSubscription(subscription)
      }
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      await syncFromSubscription(event.data.object)
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const athleteId = subscription.metadata?.athlete_id
      if (athleteId) {
        await supabaseAdmin.from('athletes').update({
          subscription_status: 'canceled', subscription_tier: null,
        }).eq('id', athleteId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
