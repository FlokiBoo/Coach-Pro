import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { supabaseAdmin } from '@/lib/supabase-admin'

let firebaseApp = null

// Initialisé paresseusement : tant que FIREBASE_SERVICE_ACCOUNT_JSON n'est pas configuré
// (ex: en dev local sans clé Firebase), l'envoi est un no-op silencieux plutôt qu'une erreur.
function getFirebaseApp() {
  if (firebaseApp) return firebaseApp
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return null
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  firebaseApp = getApps().length ? getApp() : initializeApp({ credential: cert(credentials) })
  return firebaseApp
}

// Envoie une notification push à tous les appareils enregistrés d'un athlète, et nettoie les
// tokens devenus invalides (désinstallation, appareil réinitialisé...) au passage.
export async function sendPushToAthlete(athleteId, { title, body, link }) {
  const app = getFirebaseApp()
  if (!app) return

  const { data: tokens } = await supabaseAdmin.from('push_tokens').select('id, token').eq('athlete_id', athleteId)
  if (!tokens?.length) return

  const messaging = getMessaging(app)
  const results = await Promise.allSettled(tokens.map(t => messaging.send({
    token: t.token,
    notification: { title, body },
    data: link ? { link } : {},
  })))

  const invalidIds = results
    .map((r, i) => ({ r, id: tokens[i].id }))
    .filter(({ r }) => r.status === 'rejected' && /registration-token-not-registered|invalid-argument/.test(r.reason?.errorInfo?.code || r.reason?.code || ''))
    .map(({ id }) => id)
  if (invalidIds.length) await supabaseAdmin.from('push_tokens').delete().in('id', invalidIds)
}
