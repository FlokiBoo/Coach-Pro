import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
})

export { SUBSCRIPTION_TIERS } from './subscriptionTiers'

// Crée un coupon + un code promo Stripe (1 coupon dédié par code, jamais partagé). Utilisé à la
// création comme à la modification (dans ce dernier cas, l'ancien code est désactivé et son
// coupon supprimé séparément — un coupon supprimé n'affecte pas les abonnements qui l'ont déjà
// appliqué, seuls les futures utilisations du code sont bloquées).
export async function createCouponAndPromoCode({ code, type, value, duration, durationInMonths, maxRedemptions, expiresAt }) {
  const couponParams = {
    duration: duration || 'once',
    name: code.trim().toUpperCase(),
  }
  if (type === 'percent') {
    couponParams.percent_off = value
  } else {
    couponParams.amount_off = Math.round(value * 100)
    couponParams.currency = 'eur'
  }
  if (duration === 'repeating') couponParams.duration_in_months = durationInMonths || 1

  const coupon = await stripe.coupons.create(couponParams)

  const promoParams = {
    coupon: coupon.id,
    code: code.trim().toUpperCase(),
  }
  if (maxRedemptions) promoParams.max_redemptions = parseInt(maxRedemptions)
  if (expiresAt) promoParams.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000)

  return stripe.promotionCodes.create(promoParams)
}

// Désactive un code promo et supprime son coupon dédié — les abonnements qui l'ont déjà
// appliqué gardent leur réduction, seules les futures utilisations sont bloquées.
export async function retirePromoCode(promotionCodeId) {
  const promo = await stripe.promotionCodes.update(promotionCodeId, { active: false })
  const couponId = typeof promo.coupon === 'string' ? promo.coupon : promo.coupon?.id
  if (couponId) {
    try { await stripe.coupons.del(couponId) } catch { /* déjà supprimé ou réutilisé ailleurs — non bloquant */ }
  }
}
