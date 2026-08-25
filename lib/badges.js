// Système de badges de force par mouvement, spécifique au sexe.
// Seuils fournis par le coach (grille "Badges_Force_PDC_Systeme2" + extension LIFT/GYM).
// mode 'pct' (défaut) : la valeur trackée (kg) est comparée en % du poids de corps.
// mode 'reps' : la valeur trackée (répétitions) est comparée telle quelle, sans normalisation.

export const TIER_ORDER = ['bronze', 'argent', 'or', 'rubis', 'emeraude']

export const TIER_STYLES = {
  bronze:   { label: 'Bronze',   emoji: '🥉', color: '#8A5A2B', bg: '#F1E2D0' },
  argent:   { label: 'Argent',   emoji: '🥈', color: '#5B6472',   bg: '#E4E7EB' },
  or:       { label: 'Or',       emoji: '🥇', color: '#9A6A0C', bg: '#FBEBC7' },
  rubis:    { label: 'Rubis',    emoji: '🔴', color: '#B91C1C', bg: '#FCE2E2' },
  emeraude: { label: 'Émeraude', emoji: '🟢', color: '#0D6B4F', bg: '#DDF3EA' },
}

// H/F : valeurs Bronze,Argent,Or,Rubis,Émeraude dans cet ordre.
function tiers(H, F) {
  const obj = {}
  TIER_ORDER.forEach((key, i) => { obj[key] = { H: H[i], F: F[i] } })
  return obj
}

export const BADGE_MOVEMENTS = [
  // --- LIFT (% du poids de corps, 1RM) ---
  { name: 'Back Squat',           thresholds: tiers([50, 100, 150, 200, 250], [40, 80, 120, 160, 200]) },
  { name: 'Front Squat',          thresholds: tiers([45, 85, 130, 170, 215], [36, 68, 104, 136, 172]) },
  { name: 'Deadlift',             thresholds: tiers([65, 125, 190, 250, 315], [53, 103, 156, 205, 258]) },
  { name: 'Romanian Deadlift',    thresholds: tiers([45, 85, 130, 170, 215], [36, 68, 104, 136, 172]) },
  { name: 'Bench Press',          thresholds: tiers([30, 60, 90, 120, 150], [21, 41, 62, 83, 104]) },
  { name: 'Shoulder Press',       thresholds: tiers([20, 40, 60, 80, 100], [14, 28, 41, 55, 69]) },
  { name: 'Barbell Row',          thresholds: tiers([33, 63, 95, 125, 158], [21, 41, 62, 81, 103]) },
  { name: 'Pull Ups - Weighted',  thresholds: tiers([0, 15, 35, 60, 90], [0, 10, 23, 39, 59]) },
  { name: 'Weighted Dip',         thresholds: tiers([0, 20, 45, 75, 110], [0, 13, 29, 49, 72]) },
  { name: 'Sandbag Carry',        thresholds: tiers([33, 63, 95, 125, 158], [26, 50, 76, 100, 126]) },
  { name: 'Farmers Carry',        thresholds: tiers([65, 125, 190, 250, 315], [52, 100, 152, 200, 252]) },
  { name: 'Yoke Carry',           thresholds: tiers([75, 150, 225, 300, 375], [60, 120, 180, 240, 300]) },
  { name: 'Power Clean',          thresholds: tiers([35, 65, 100, 130, 165], [28, 52, 80, 104, 132]) },
  { name: 'Power Snatch',         thresholds: tiers([26, 51, 77, 102, 128], [20, 41, 61, 82, 102]) },

  // --- GYM (répétitions absolues, sans normalisation par le poids) ---
  { name: 'Pull-ups Strict', mode: 'reps', thresholds: tiers([1, 8, 15, 20, 28], [1, 4, 8, 13, 18]) },
  { name: 'Push-ups',        mode: 'reps', thresholds: tiers([10, 20, 35, 50, 75], [5, 12, 20, 30, 45]) },
  { name: 'Dips',            mode: 'reps', thresholds: tiers([3, 15, 25, 35, 50], [1, 8, 15, 22, 30]) },
]

// Mouvements à badge binaire (acquis / pas encore) plutôt qu'à 5 paliers.
export const BINARY_BADGE_MOVEMENTS = [
  { name: 'HSPU Strict' },
]

// value: performance actuelle (déjà en % du poids de corps pour mode 'pct', en reps pour mode 'reps').
// sex: 'H' | 'F' (défaut 'H' si non renseigné).
export function computeBadge(value, thresholds, sex) {
  const s = sex === 'F' ? 'F' : 'H'
  const points = TIER_ORDER.map(key => ({ key, value: thresholds[key][s] }))

  let currentIdx = -1
  for (let i = 0; i < points.length; i++) {
    if (value >= points[i].value) currentIdx = i
  }
  const current = currentIdx >= 0 ? points[currentIdx] : null
  const next = currentIdx + 1 < points.length ? points[currentIdx + 1] : null
  const lower = current ? current.value : 0
  const progress = next ? Math.max(0, Math.min(100, ((value - lower) / (next.value - lower)) * 100)) : 100

  return { current, next, progress }
}
