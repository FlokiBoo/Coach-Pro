import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { pushPaymentToNotion } from '@/lib/notion'
import { SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers'

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

async function syncInvoiceToNotion(invoice, status) {
  if (!invoice.customer) return
  const { data: athlete } = await supabaseAdmin.from('athletes')
    .select('name, subscription_tier').eq('stripe_customer_id', invoice.customer).maybeSingle()
  if (!athlete) return

  await pushPaymentToNotion({
    athleteName: athlete.name,
    amount: (invoice.amount_paid || invoice.amount_due || 0) / 100,
    date: new Date(invoice.created * 1000).toISOString().slice(0, 10),
    status,
    tier: SUBSCRIPTION_TIERS[athlete.subscription_tier]?.label,
    invoiceId: invoice.id,
  })
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
    case 'invoice.paid': {
      await syncInvoiceToNotion(event.data.object, 'Payé')
      break
    }
    case 'invoice.payment_failed': {
      await syncInvoiceToNotion(event.data.object, 'Échoué')
      break
    }
  }

  return NextResponse.json({ received: true })
}
