import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

function invoiceLabel(invoice) {
  if (invoice.status === 'paid') return { status: 'paid', label: 'Payé' }
  if (invoice.status === 'open') return invoice.attempt_count > 0
    ? { status: 'failed', label: 'Paiement échoué' }
    : { status: 'pending', label: 'En attente' }
  if (invoice.status === 'uncollectible') return { status: 'failed', label: 'Impayé' }
  if (invoice.status === 'void') return { status: 'void', label: 'Annulée' }
  return { status: invoice.status, label: invoice.status }
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: coach } = await supabaseAdmin.from('coaches').select('is_admin').eq('id', user.id).single()
  if (!coach?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: athletes } = await supabaseAdmin.from('athletes')
    .select('id, name, subscription_status, subscription_tier, stripe_customer_id')
    .not('stripe_customer_id', 'is', null)

  const now = new Date()
  const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000
  const startOfQuarter = Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1) / 1000
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1) / 1000

  let revenueMonth = 0, revenueQuarter = 0, revenueYear = 0
  const lastInvoiceByCustomer = {}

  for await (const invoice of stripe.invoices.list({ created: { gte: startOfYear }, limit: 100 })) {
    if (invoice.status === 'paid') {
      revenueYear += invoice.amount_paid
      if (invoice.created >= startOfQuarter) revenueQuarter += invoice.amount_paid
      if (invoice.created >= startOfMonth) revenueMonth += invoice.amount_paid
    }
    if (invoice.customer && !lastInvoiceByCustomer[invoice.customer]) {
      lastInvoiceByCustomer[invoice.customer] = invoice
    }
  }

  const athletesWithBilling = (athletes || []).map(a => {
    const invoice = lastInvoiceByCustomer[a.stripe_customer_id]
    return {
      id: a.id,
      name: a.name,
      subscriptionStatus: a.subscription_status,
      tier: a.subscription_tier,
      lastPayment: invoice ? {
        date: new Date(invoice.created * 1000).toISOString(),
        amount: invoice.amount_paid || invoice.amount_due,
        ...invoiceLabel(invoice),
      } : null,
    }
  }).sort((a, b) => {
    const da = a.lastPayment?.date || ''
    const db = b.lastPayment?.date || ''
    return db.localeCompare(da)
  })

  return NextResponse.json({
    revenue: { month: revenueMonth / 100, quarter: revenueQuarter / 100, year: revenueYear / 100 },
    athletes: athletesWithBilling,
  })
}
