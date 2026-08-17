// Recherche Open Food Facts + cache localStorage, et algorithme de calcul des quantités par repas.

export async function searchFood(query) {
  const q = query.trim()
  if (!q) return []
  const cacheKey = `coachpro_off_search_${q.toLowerCase()}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) return JSON.parse(cached)

  const res = await fetch(`/api/off/search?query=${encodeURIComponent(q)}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)

  const results = json.results || []

  localStorage.setItem(cacheKey, JSON.stringify(results))
  return results
}

export const OLIVE_OIL = { id: 'olive-oil-default', name: "Huile d'olive", protein: 0, fat: 100, carbs: 0 }

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

function buildFixedMeal(label, comp, target, fixedPortion) {
  const { protein, fat, carb, warnings } = calcMealQuantities(target, comp.protein, comp.fat, comp.carb)
  return {
    label,
    protein, fat, carb,
    fruitOrVeg: comp.fruit ? { food: comp.fruit, qty: fixedPortion, label: 'Fruit' } : null,
    warnings,
  }
}

function buildRandomMeal(label, pool, target, fixedPortion) {
  const protein = pickRandom(pool.proteins)
  const carb = pickRandom(pool.carbs)
  const fat = pickRandom(pool.fats)
  const veg = pickRandom(pool.vegetables)
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
  let snackCounter = 0
  const totalDays = (Number(structure.weeks) || 1) * 7

  for (let d = 0; d < totalDays; d++) {
    const meals = []
    if (structure.mealsEnabled.petitDej) meals.push(buildFixedMeal('Petit déjeuner', pools.breakfast, target, fixedPortion))
    if (structure.mealsEnabled.dejeuner) meals.push(buildRandomMeal('Déjeuner', pools.lunchDinner, target, fixedPortion))
    if (structure.mealsEnabled.diner) meals.push(buildRandomMeal('Dîner', pools.lunchDinner, target, fixedPortion))
    for (let s = 0; s < structure.snacksPerDay; s++) {
      const variant = pools.snackVariants[snackCounter % Math.max(pools.snackVariants.length, 1)]
      snackCounter++
      if (variant) meals.push(buildFixedMeal(`Collation${structure.snacksPerDay > 1 ? ` ${s + 1}` : ''}`, variant, target, fixedPortion))
    }
    days.push({ day: d + 1, week: Math.floor(d / 7) + 1, dayOfWeek: (d % 7) + 1, meals })
  }

  return { target, totalSlots, days }
}
