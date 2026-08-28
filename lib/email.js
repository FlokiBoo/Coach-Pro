import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'OSTRYK <onboarding@resend.dev>'

// Ne fait jamais échouer le flux appelant : un envoi de mail raté (quota, domaine non
// vérifié côté Resend, etc.) ne doit pas empêcher une inscription ou une attribution.
export async function sendEmail({ to, subject, html }) {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) console.error('Resend error:', error)
  } catch (err) {
    console.error('Email send failed:', err)
  }
}
