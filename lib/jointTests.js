function withPassifActif(names) {
  return names.flatMap(n => [`${n} (Passif)`, `${n} (Actif)`])
}

// Batterie de tests réduite au strict nécessaire pour un auto-test rapide par le sportif seul
// (avant : ~50 tests, quasi impossible à faire sans un coach en face) — décision du 2026-09-06.
export const COLONNE_TESTS = ['Jefferson Curls']

// Aucun test qualitatif restant n'est bilatéral (Jefferson Curls est une évaluation globale,
// quality_d seul) — gardé comme fonction au cas où un futur test qualitatif bilatéral serait
// réintroduit, plutôt que de semer des `false` en dur dans le composant qui l'utilise.
export function isBilateralQualitative() {
  return false
}

export function isQualitativeJoint(joint) {
  return joint === 'Colonne'
}

// Niveaux de fluidité du Jefferson Curl (flexion vertébrale segment par segment) — formulés à la
// première personne, dans les mots du sportif, pas en jargon clinique.
export const QUALITY_LEVELS = [
  { key: 'fluide', label: 'Fluide', description: 'Je sens que chaque vertèbre bouge.' },
  { key: 'bloc', label: 'Par Bloc', description: "Je sens que ça manque de fluidité, comme si j'avais des blocs de vertèbres dans le dos qui bougent ensemble." },
  { key: 'un_bloc', label: '1 Bloc', description: 'Ma colonne refuse de se fléchir, j\'ai l\'impression que ma colonne vertébrale est 1 seul énorme bloc.' },
]

export function qualityLevel(key) {
  return QUALITY_LEVELS.find(l => l.key === key) || null
}

// Équivalent 0-100, pour intégrer la Colonne (pas de degrés, donc pas de norme ADMP) au même
// score /100 que les autres articulations.
export const QUALITY_SCORES = { fluide: 100, bloc: 60, un_bloc: 20 }

// Où les mains touchent le corps/sol en bas du Jefferson Curl — indicateur simple de l'amplitude,
// en complément du ressenti de fluidité.
export const HAND_POSITION_OPTIONS = [
  { key: 'sol', label: 'Au sol' },
  { key: 'cheville', label: 'Cheville' },
  { key: 'tibia', label: 'Tibia' },
  { key: 'genou', label: 'Genou' },
  { key: 'mi_cuisse', label: 'Mi-cuisse' },
]

export function handPositionLabel(key) {
  return HAND_POSITION_OPTIONS.find(o => o.key === key)?.label || null
}

export const JOINT_TESTS = [
  {
    joint: 'Épaule',
    tests: withPassifActif(['Rotation externe', 'Rotation interne', 'Flexion']),
  },
  {
    joint: 'Hanche',
    tests: withPassifActif(['Rotation externe', 'Rotation interne', 'Flexion (genou tendu)']),
  },
  {
    joint: 'Cheville',
    tests: withPassifActif(['Dorsiflexion']),
  },
  {
    joint: 'Colonne',
    tests: COLONNE_TESTS,
    qualitative: true,
  },
]
