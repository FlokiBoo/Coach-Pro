// Données des formules d'abonnement, sans dépendance au SDK Stripe (utilisable côté client).
export const SUBSCRIPTION_TIERS = {
  A: { key: 'A', label: 'Accès Site', description: 'Accès complet au site : programmes, metrics, timer…', priceEnv: 'STRIPE_PRICE_A', amount: 19.99 },
  B: { key: 'B', label: 'Accès Site + 1 échange/semaine', description: 'Tout le site + un échange hebdomadaire (vidéo ou question) avec le coach', priceEnv: 'STRIPE_PRICE_B', amount: 49.99 },
}
