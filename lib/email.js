import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL || 'OSTRYK <onboarding@resend.dev>'

// Instancié à l'appel plutôt qu'au chargement du module : le SDK Resend lève une exception dès
// `new Resend(undefined)`, ce qui ferait planter TOUT le build (pas juste l'envoi de mail) si la
// clé n'est pas configurée dans l'environnement (ex: build Vercel sans RESEND_API_KEY).
let resend = null
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

// Ne fait jamais échouer le flux appelant : un envoi de mail raté (quota, domaine non
// vérifié côté Resend, etc.) ne doit pas empêcher une inscription ou une attribution.
export async function sendEmail({ to, subject, html }) {
  const client = getResend()
  if (!client) { console.error('sendEmail: RESEND_API_KEY manquante, mail non envoyé.'); return }
  try {
    const { error } = await client.emails.send({ from: FROM, to, subject, html })
    if (error) console.error('Resend error:', error)
  } catch (err) {
    console.error('Email send failed:', err)
  }
}
