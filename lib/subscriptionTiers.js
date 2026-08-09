// Données des formules d'abonnement, sans dépendance au SDK Stripe (utilisable côté client).
export const SUBSCRIPTION_TIERS = {
  A: { key: 'A', label: 'Accès Site', description: 'Accès complet au site : programmes, metrics, timer…', priceEnv: 'STRIPE_PRICE_A', amount: 19.00 },
  B: { key: 'B', label: 'Accès Site + 1 échange/semaine', description: 'Tout le site + un échange hebdomadaire (vidéo ou question) avec le coach', priceEnv: 'STRIPE_PRICE_B', amount: 50.00 },
  C: { key: 'C', label: 'Accès Site + Retours vidéo & messages', description: 'Tout le site + retours réguliers du coach par vidéo et message', priceEnv: 'STRIPE_PRICE_C', amount: 89.99 },
}
