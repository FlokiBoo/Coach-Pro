function withPassifActif(names) {
  return names.flatMap(n => [`${n} (Passif)`, `${n} (Actif)`])
}

// Tests colonne : dissociation segmentaire qualitative (pas de goniomètre, pas de norme ADMP —
// aucune norme standardisée publiée pour la dissociation intersegmentaire vertébrale).
export const COLONNE_TESTS = [
  'Chat-Chameau',
  'Segmentation thoracique (bloc lombaire)',
  'Segmentation thoracique (bloc thoracique)',
  'Rotation thoracique segmentaire',
  'Jefferson Curls',
]

// Seul ce test se note par côté (D/G) ; les autres sont une évaluation globale (quality_d seul).
export function isBilateralQualitative(testName) {
  return testName === 'Rotation thoracique segmentaire'
}

export function isQualitativeJoint(joint) {
  return joint === 'Colonne'
}

export const QUALITY_LEVELS = [
  { key: 'complete', label: 'Dissociation complète', color: '#166534', bg: '#DCFCE7' },
  { key: 'leger', label: 'Compensation légère', color: '#92400E', bg: '#FEF3C7' },
  { key: 'bloque', label: 'Blocage ou compensation majeure', color: '#991B1B', bg: '#FEE2E2' },
]

export function qualityLevel(key) {
  return QUALITY_LEVELS.find(l => l.key === key) || null
}

// Équivalent 0-100 des niveaux qualitatifs, pour intégrer la Colonne (pas de degrés,
// donc pas de norme ADMP) au même score /100 que les autres articulations.
export const QUALITY_SCORES = { complete: 100, leger: 60, bloque: 20 }

export const JOINT_TESTS = [
  {
    joint: 'Épaule',
    tests: withPassifActif(['Rotation externe', 'Rotation interne', 'Flexion', 'Extension', 'Abduction', 'Adduction']),
  },
  {
    joint: 'Hanche',
    tests: withPassifActif(['Rotation externe', 'Rotation interne', 'Flexion (genou fléchi)', 'Flexion (genou tendu)', 'Extension', 'Abduction', 'Adduction']),
  },
  {
    joint: 'Genou',
    tests: withPassifActif(['Flexion', 'Extension']),
  },
  {
    joint: 'Cheville',
    tests: withPassifActif(['Dorsiflexion', 'Flexion plantaire']),
  },
  {
    joint: 'Pied',
    tests: withPassifActif(['Inversion', 'Éversion']),
  },
  {
    joint: 'Coude',
    tests: withPassifActif(['Flexion', 'Extension', 'Pronation', 'Supination']),
  },
  {
    joint: 'Poignet',
    tests: withPassifActif(['Flexion', 'Extension']),
  },
  {
    joint: 'Colonne',
    tests: COLONNE_TESTS,
    qualitative: true,
  },
]
