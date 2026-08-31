// Offres ponctuelles (paiement unique Stripe), indépendantes des abonnements récurrents
// (voir lib/subscriptionTiers.js). Vendues sur la page publique /offres à des prospects qui
// n'ont pas encore de compte athlète — le coach les onboarde manuellement après l'achat.
export const ONE_TIME_OFFERS = {
  programme_sur_mesure: {
    key: 'programme_sur_mesure',
    label: 'Programme sur-mesure',
    subtitle: "Le plan, sans l'accompagnement",
    amount: 300,
  },
  suivi_1to1: {
    key: 'suivi_1to1',
    label: 'Suivi 1:1',
    subtitle: "L'accompagnement complet — 3 mois",
    amount: 1500,
  },
}
