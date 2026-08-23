// Recherche : base d'aliments courants (locale, instantanée) + Open Food Facts (produits de marque),
// avec cache localStorage. Open Food Facts est une base de produits scannés (code-barres) : beaucoup
// d'aliments bruts (tofu, riz, poulet…) n'y sont pas bien référencés ou renvoient des fiches
// incomplètes — la base locale garantit que les aliments de base sont toujours trouvés, sans
// dépendre de l'API externe (qui rate-limite vite en cas de recherches rapprochées).
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const COMMON_FOODS = [
  { id: 'local-poulet-blanc', name: 'Poulet (blanc, cru)', protein: 31, fat: 3.6, carbs: 0 },
  { id: 'local-poulet-cuisse', name: 'Poulet (cuisse, cru)', protein: 18, fat: 8, carbs: 0 },
  { id: 'local-dinde-blanc', name: 'Dinde (blanc, cru)', protein: 29, fat: 1, carbs: 0 },
  { id: 'local-boeuf-5', name: 'Boeuf haché 5%', protein: 21, fat: 5, carbs: 0 },
  { id: 'local-boeuf-15', name: 'Boeuf haché 15%', protein: 19, fat: 15, carbs: 0 },
  { id: 'local-saumon', name: 'Saumon (cru)', protein: 20, fat: 13, carbs: 0 },
  { id: 'local-thon', name: 'Thon au naturel (boîte)', protein: 25, fat: 1, carbs: 0 },
  { id: 'local-cabillaud', name: 'Cabillaud (cru)', protein: 18, fat: 0.7, carbs: 0 },
  { id: 'local-oeuf', name: 'Oeuf entier', protein: 13, fat: 11, carbs: 1.1 },
  { id: 'local-blanc-oeuf', name: "Blanc d'oeuf", protein: 11, fat: 0.2, carbs: 0.7 },
  { id: 'local-tofu-ferme', name: 'Tofu ferme (nature)', protein: 8, fat: 4.5, carbs: 3 },
  { id: 'local-tofu-soyeux', name: 'Tofu soyeux', protein: 5, fat: 3, carbs: 2 },
  { id: 'local-tofu-fume', name: 'Tofu fumé', protein: 15, fat: 8, carbs: 2 },
  { id: 'local-tempeh', name: 'Tempeh', protein: 19, fat: 11, carbs: 9 },
  { id: 'local-seitan', name: 'Seitan', protein: 25, fat: 1.9, carbs: 4 },
  { id: 'local-lentilles', name: 'Lentilles (cuites)', protein: 8, fat: 0.4, carbs: 20 },
  { id: 'local-pois-chiches', name: 'Pois chiches (cuits)', protein: 8.9, fat: 2.6, carbs: 27 },
  { id: 'local-haricots-rouges', name: 'Haricots rouges (cuits)', protein: 8.7, fat: 0.5, carbs: 22.8 },
  { id: 'local-riz-blanc', name: 'Riz blanc (cuit)', protein: 2.7, fat: 0.3, carbs: 28 },
  { id: 'local-riz-complet', name: 'Riz complet (cuit)', protein: 2.6, fat: 1, carbs: 23 },
  { id: 'local-pates', name: 'Pâtes (cuites)', protein: 5.8, fat: 0.9, carbs: 30 },
  { id: 'local-quinoa', name: 'Quinoa (cuit)', protein: 4.4, fat: 1.9, carbs: 21 },
  { id: 'local-avoine', name: "Flocons d'avoine (crus)", protein: 13.5, fat: 7, carbs: 58 },
  { id: 'local-pain-complet', name: 'Pain complet', protein: 8, fat: 3.5, carbs: 41 },
  { id: 'local-patate-douce', name: 'Patate douce (cuite)', protein: 1.6, fat: 0.1, carbs: 20 },
  { id: 'local-pomme-de-terre', name: 'Pomme de terre (cuite)', protein: 2, fat: 0.1, carbs: 17 },
  { id: 'local-fromage-blanc', name: 'Fromage blanc 0%', protein: 8, fat: 0.2, carbs: 4 },
  { id: 'local-yaourt-grec', name: 'Yaourt grec nature', protein: 9, fat: 5, carbs: 4 },
  { id: 'local-skyr', name: 'Skyr nature', protein: 11, fat: 0.2, carbs: 4 },
  { id: 'local-amandes', name: 'Amandes', protein: 21, fat: 49, carbs: 22 },
  { id: 'local-noix', name: 'Noix', protein: 15, fat: 65, carbs: 14 },
  { id: 'local-beurre-cacahuete', name: 'Beurre de cacahuète', protein: 25, fat: 50, carbs: 20 },
  { id: 'local-avocat', name: 'Avocat', protein: 2, fat: 15, carbs: 9 },
  { id: 'local-brocoli', name: 'Brocoli (cuit)', protein: 2.8, fat: 0.4, carbs: 7 },
  { id: 'local-epinards', name: 'Épinards (crus)', protein: 2.9, fat: 0.4, carbs: 3.6 },
  { id: 'local-banane', name: 'Banane', protein: 1.1, fat: 0.3, carbs: 23 },
]

function searchCommonFoods(query) {
  const q = norm(query)
  return COMMON_FOODS.filter(f => norm(f.name).includes(q))
}

export async function searchFood(query) {
  const q = query.trim()
  if (!q) return []

  const local = searchCommonFoods(q)

  const cacheKey = `coachpro_food_search_${q.toLowerCase()}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) return dedupeFoods([...local, ...JSON.parse(cached)])

  // CIQUAL (table officielle ANSES, ~3500 aliments génériques, servie depuis notre propre base
  // donc jamais de rate limit) en priorité, complétée par Open Food Facts pour les produits de
  // marque précis. Une source qui échoue (réseau, rate limit OFF…) ne doit jamais bloquer l'autre.
  const [ciqualResults, offResults] = await Promise.all([
    fetchExternal(`/api/ciqual/search?query=${encodeURIComponent(q)}`),
    fetchExternal(`/api/off/search?query=${encodeURIComponent(q)}`),
  ])
  const external = [...ciqualResults, ...offResults]

  if (external.length === 0 && local.length === 0) {
    throw new Error('Aucun aliment trouvé, essaie un autre terme.')
  }
  if (external.length > 0) localStorage.setItem(cacheKey, JSON.stringify(external))

  return dedupeFoods([...local, ...external])
}

async function fetchExternal(url) {
  try {
    const res = await fetch(url)
    const json = await res.json()
    return json.error ? [] : (json.results || [])
  } catch {
    return []
  }
}

function dedupeFoods(list) {
  const seen = new Set()
  const out = []
  for (const f of list) {
    const key = norm(f.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out.slice(0, 12)
}

export const OLIVE_OIL = { id: 'olive-oil-default', name: "Huile d'olive", protein: 0, fat: 100, carbs: 0 }

export const ACTIVITY_LEVELS = [
  { key: 'sedentaire', label: 'Sédentaire (peu ou pas de sport)', factor: 1.2 },
  { key: 'leger', label: 'Légèrement actif (1 à 3x/semaine)', factor: 1.375 },
  { key: 'modere', label: 'Modérément actif (3 à 5x/semaine)', factor: 1.55 },
  { key: 'tres', label: 'Très actif (6 à 7x/semaine)', factor: 1.725 },
  { key: 'extreme', label: 'Extrêmement actif (sport intense quotidien)', factor: 1.9 },
]

export const GOALS = [
  { key: 'perdre', label: 'Perdre du poids', adjustment: -0.2 },
  { key: 'maintenir', label: 'Maintenir son poids', adjustment: 0 },
  { key: 'prendre', label: 'Prendre du poids', adjustment: 0.1 },
]

// Mifflin-St Jeor : la formule la plus validée pour estimer le métabolisme de base en population générale.
export function computeBMR(sex, weightKg, heightCm, age) {
  const base = 10 * Number(weightKg) + 6.25 * Number(heightCm) - 5 * Number(age)
  return sex === 'F' ? base - 161 : base + 5
}

export function computeCalorieTarget({ sex, weight, height, age, activityKey, goalKey }) {
  const bmr = computeBMR(sex, weight, height, age)
  const activity = ACTIVITY_LEVELS.find(a => a.key === activityKey) || ACTIVITY_LEVELS[0]
  const goal = GOALS.find(g => g.key === goalKey) || GOALS[1]
  const tdee = bmr * activity.factor
  const target = tdee * (1 + goal.adjustment)
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target: Math.round(target) }
}

// Répartit les macros/calories du jour à parts égales entre tous les repas (principaux + collations)
export function computeMealTarget(profile, totalSlots) {
  if (totalSlots <= 0) return { protein: 0, fat: 0, carbs: 0 }
  const calories = Number(profile.calories) || 0
  const dailyProtein = calories * (Number(profile.pctProtein) || 0) / 100 / 4
  const dailyFat = calories * (Number(profile.pctFat) || 0) / 100 / 9
  const dailyCarbs = calories * (Number(profile.pctCarbs) || 0) / 100 / 4
  return {
    protein: dailyProtein / totalSlots,
    fat: dailyFat / totalSlots,
    carbs: dailyCarbs / totalSlots,
  }
}

const ROLES = [
  { key: 'protein', macroField: 'protein', targetField: 'protein', label: 'protéines' },
  { key: 'fat', macroField: 'fat', targetField: 'fat', label: 'lipides' },
  { key: 'carb', macroField: 'carbs', targetField: 'carbs', label: 'glucides' },
]

function gramsForShare(food, macroField, share) {
  const ratio = (food?.[macroField] || 0) / 100
  return ratio > 0 ? share / ratio : 0
}

// Chaque rôle (protéine/lipide/glucide) a un aliment dédié. On calcule d'abord la quantité
// qui couvre sa cible seule, puis on rééquilibre en cascade : si les 2 autres aliments
// apportent déjà plus de 5% de la cible d'un rôle, on réduit l'aliment de ce rôle (jamais
// sous 0) ; si ça ne suffit pas (le dépassement vient d'un aliment déjà fixé sur un autre
// rôle), on réduit en dernier recours l'aliment source du dépassement.
export function calcMealQuantities(target, proteinFood, fatFood, carbFood) {
  const warnings = []
  const foodByRole = { protein: proteinFood, fat: fatFood, carb: carbFood }
  const qty = { protein: 0, fat: 0, carb: 0 }

  ROLES.forEach(({ key, macroField, targetField }) => {
    const food = foodByRole[key]
    if (!food) return
    qty[key] = gramsForShare(food, macroField, target[targetField])
  })

  const contributionOf = (roleKey, macroField) => {
    const food = foodByRole[roleKey]
    if (!food) return 0
    return qty[roleKey] * (food[macroField] || 0) / 100
  }

  const passiveOf = (macroField, excludeRole) =>
    ROLES.reduce((sum, r) => (r.key === excludeRole ? sum : sum + contributionOf(r.key, macroField)), 0)

  ROLES.forEach(({ key, macroField, targetField, label }) => {
    const food = foodByRole[key]
    const t = target[targetField]

    let passive = passiveOf(macroField, key)
    if (food && passive > t * 0.05) {
      const remaining = Math.max(0, t - passive)
      qty[key] = gramsForShare(food, macroField, remaining)
      if (remaining <= 0) warnings.push(`${label} : objectif déjà atteint par les autres aliments`)
    }

    passive = passiveOf(macroField, key)
    if (passive > t * 0.05) {
      let excess = passive - t
      ROLES.filter(r => r.key !== key && foodByRole[r.key])
        .map(r => ({ key: r.key, contribution: contributionOf(r.key, macroField) }))
        .filter(o => o.contribution > 0)
        .sort((a, b) => b.contribution - a.contribution)
        .forEach(o => {
          if (excess <= 0) return
          const reduceBy = Math.min(o.contribution, excess)
          qty[o.key] = gramsForShare(foodByRole[o.key], macroField, o.contribution - reduceBy)
          warnings.push(`${ROLES.find(r => r.key === o.key).label} réduit(es) pour ne pas trop dépasser les ${label}`)
          excess -= reduceBy
        })
    }
  })

  if (qty.protein > 500) warnings.push('Quantité de protéine aberrante (>500g)')
  if (qty.fat > 500) warnings.push('Quantité de lipide aberrante (>500g)')
  if (qty.carb > 500) warnings.push('Quantité de glucide aberrante (>500g)')

  return {
    protein: { food: proteinFood, qty: Math.round(qty.protein) },
    fat: { food: fatFood, qty: Math.round(qty.fat) },
    carb: { food: carbFood, qty: Math.round(qty.carb) },
    warnings,
  }
}

function pickRandom(arr) {
  if (!arr?.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

// Tire au sort un aliment par rôle dans le pool partagé (3 protéines/lipides/légumes/glucides),
// commun à tous les repas. `forcedProtein` permet au petit déj d'utiliser une protéine dédiée
// (4e choix) au lieu de piocher dans les 3 protéines communes.
function buildMeal(label, pools, target, fixedPortion, forcedProtein) {
  const protein = forcedProtein || pickRandom(pools.proteins)
  const carb = pickRandom(pools.carbs)
  const fat = pickRandom(pools.fats)
  const veg = pickRandom(pools.vegetables)
  const { protein: p, fat: f, carb: c, warnings } = calcMealQuantities(target, protein, fat, carb)
  return {
    label,
    protein: p, fat: f, carb: c,
    fruitOrVeg: veg ? { food: veg, qty: fixedPortion, label: 'Légume' } : null,
    warnings,
  }
}

export function generatePlan(profile, structure, pools) {
  const totalSlots = ['petitDej', 'dejeuner', 'diner'].filter(k => structure.mealsEnabled[k]).length + structure.snacksPerDay
  const target = computeMealTarget(profile, totalSlots)
  const fixedPortion = Number(structure.fixedPortion) || 150

  const days = []
  const totalDays = (Number(structure.weeks) || 1) * 7

  for (let d = 0; d < totalDays; d++) {
    const meals = []
    if (structure.mealsEnabled.petitDej) meals.push(buildMeal('Petit déjeuner', pools, target, fixedPortion, pools.breakfastProtein))
    if (structure.mealsEnabled.dejeuner) meals.push(buildMeal('Déjeuner', pools, target, fixedPortion))
    if (structure.mealsEnabled.diner) meals.push(buildMeal('Dîner', pools, target, fixedPortion))
    for (let s = 0; s < structure.snacksPerDay; s++) {
      meals.push(buildMeal(`Collation${structure.snacksPerDay > 1 ? ` ${s + 1}` : ''}`, pools, target, fixedPortion))
    }
    days.push({ day: d + 1, week: Math.floor(d / 7) + 1, dayOfWeek: (d % 7) + 1, meals })
  }

  return { target, totalSlots, days }
}
