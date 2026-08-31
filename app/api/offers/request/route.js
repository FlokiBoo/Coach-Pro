import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { ONE_TIME_OFFERS } from '@/lib/offers'

// Route publique : un prospect demande une offre depuis /offres. On n'envoie PAS vers Stripe ici —
// le coach valide manuellement la demande (page /demandes) avant qu'un lien de paiement soit généré.
export async function POST(request) {
  const { offerKey, name, email, paymentPlan } = await request.json()
  const offer = ONE_TIME_OFFERS[offerKey]
  if (!offer) return NextResponse.json({ error: 'Offre invalide.' }, { status: 400 })
  if (!name?.trim() || !email?.trim()) return NextResponse.json({ error: 'Nom et email requis.' }, { status: 400 })
  const plan = paymentPlan === '3x' ? '3x' : 'full'

  const { error } = await supabaseAdmin.from('offer_requests').insert({
    offer_key: offerKey,
    customer_name: name.trim(),
    customer_email: email.trim().toLowerCase(),
    payment_plan: plan,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: coach } = await supabaseAdmin.from('coaches').select('id, email').eq('is_admin', true).limit(1).maybeSingle()
  if (coach) {
    await supabaseAdmin.from('notifications').insert({
      coach_id: coach.id,
      type: 'offer_request',
      title: `Nouvelle demande : ${offer.label}`,
      body: `${name.trim()} — ${offer.amount}€ (${plan === '3x' ? '3x sans frais' : 'en 1 fois'})`,
      link: '/demandes',
    })
    if (coach.email) {
      await sendEmail({
        to: coach.email,
        subject: `Nouvelle demande : ${offer.label}`,
        html: `<p><strong>${name.trim()}</strong> (${email.trim()}) souhaite « ${offer.label} » (${offer.amount}€, ${plan === '3x' ? '3x sans frais' : 'paiement en 1 fois'}).</p><p>Rends-toi sur /demandes pour accepter ou refuser.</p>`,
      })
    }
  }

  return NextResponse.json({ success: true })
}
