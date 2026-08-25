// Répartition des badges de force/cardio par groupe musculaire, pour le radar "Force par muscle"
// dans Profil. Ensemble de groupes volontairement plus large que la liste anatomique complète
// (MuscleAnatomyDiagram) — un radar à 19 axes serait illisible ; ici on vise ~8 axes.

export const RADAR_GROUPS = [
  'Quadriceps', 'Fessiers', 'Ischio-jambiers', 'Dos', 'Pectoraux', 'Épaules', 'Bras', 'Gainage',
]

// Un mouvement = un groupe musculaire principal (simplification volontaire : la plupart des
// mouvements de force sollicitent plusieurs muscles, on retient celui qui domine l'effort).
export const MOVEMENT_MUSCLE_GROUP = {
  'Back Squat': 'Quadriceps',
  'Front Squat': 'Quadriceps',
  'Deadlift': 'Ischio-jambiers',
  'Romanian Deadlift': 'Ischio-jambiers',
  'Bench Press': 'Pectoraux',
  'Shoulder Press': 'Épaules',
  'Barbell Row': 'Dos',
  'Pull Ups - Weighted': 'Dos',
  'Weighted Dip': 'Pectoraux',
  'Sandbag Carry': 'Gainage',
  'Farmers Carry': 'Gainage',
  'Yoke Carry': 'Gainage',
  'Power Clean': 'Fessiers',
  'Power Snatch': 'Fessiers',
  'Pull-ups Strict': 'Dos',
  'Push-ups': 'Pectoraux',
  'Dips': 'Bras',
  '500m Row': 'Dos',
  '2000m Row': 'Dos',
  '5Km Run': 'Ischio-jambiers',
}

const TIER_POINTS = { bronze: 20, argent: 40, or: 60, rubis: 80, emeraude: 100 }

// Reprend la formule du coach : score = points du palier atteint + progression vers le palier
// suivant × 20 (chaque palier vaut 20 points, sur une échelle 0-100). Plafonné à 100 (Émeraude).
export function movementScore(card) {
  if (!card.current) return (card.progress / 100) * 20
  if (card.current.key === 'emeraude') return 100
  return TIER_POINTS[card.current.key] + (card.progress / 100) * 20
}

// cards : liste de badges (force + cardio) déjà calculés par BadgesBlock, avec {name, current, progress}.
// Renvoie { groupe: score|null } — null si aucun mouvement testé dans ce groupe.
export function computeMuscleScores(cards) {
  const byGroup = {}
  RADAR_GROUPS.forEach(g => { byGroup[g] = [] })
  cards.forEach(card => {
    if (card.missing || card.noData) return
    const group = MOVEMENT_MUSCLE_GROUP[card.name]
    if (!group) return
    byGroup[group].push(movementScore(card))
  })
  const scores = {}
  RADAR_GROUPS.forEach(g => {
    scores[g] = byGroup[g].length ? byGroup[g].reduce((a, b) => a + b, 0) / byGroup[g].length : null
  })
  return scores
}
