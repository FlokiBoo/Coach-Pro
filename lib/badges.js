// Système de badges de force par mouvement, en % du poids de corps (PDC), spécifique au sexe.
// Seuils fournis par le coach (grille "Badges_Force_PDC_Systeme2").

export const TIER_ORDER = ['bronze', 'argent', 'or', 'rubis', 'emeraude']

export const TIER_STYLES = {
  bronze:   { label: 'Bronze',   emoji: '🥉', color: '#8A5A2B', bg: '#F1E2D0' },
  argent:   { label: 'Argent',   emoji: '🥈', color: '#5B6472',   bg: '#E4E7EB' },
  or:       { label: 'Or',       emoji: '🥇', color: '#9A6A0C', bg: '#FBEBC7' },
  rubis:    { label: 'Rubis',    emoji: '🔴', color: '#B91C1C', bg: '#FCE2E2' },
  emeraude: { label: 'Émeraude', emoji: '🟢', color: '#0D6B4F', bg: '#DDF3EA' },
}

export const BADGE_MOVEMENTS = [
  {
    name: 'Back Squat',
    thresholds: {
      bronze:   { H: 50,  F: 40 },
      argent:   { H: 100, F: 80 },
      or:       { H: 150, F: 120 },
      rubis:    { H: 200, F: 160 },
      emeraude: { H: 250, F: 200 },
    },
  },
  {
    name: 'Bench Press',
    thresholds: {
      bronze:   { H: 30, F: 21 },
      argent:   { H: 60, F: 41 },
      or:       { H: 90, F: 62 },
      rubis:    { H: 120, F: 83 },
      emeraude: { H: 150, F: 104 },
    },
  },
]

// pct: performance actuelle en % du poids de corps. sex: 'H' | 'F' (défaut 'H' si non renseigné).
export function computeBadge(pct, thresholds, sex) {
  const s = sex === 'F' ? 'F' : 'H'
  const points = TIER_ORDER.map(key => ({ key, pct: thresholds[key][s] }))

  let currentIdx = -1
  for (let i = 0; i < points.length; i++) {
    if (pct >= points[i].pct) currentIdx = i
  }
  const current = currentIdx >= 0 ? points[currentIdx] : null
  const next = currentIdx + 1 < points.length ? points[currentIdx + 1] : null
  const lowerPct = current ? current.pct : 0
  const progress = next ? Math.max(0, Math.min(100, ((pct - lowerPct) / (next.pct - lowerPct)) * 100)) : 100

  return { current, next, progress }
}
