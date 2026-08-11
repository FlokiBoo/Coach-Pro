import { QUALITY_SCORES } from './jointTests'

function stripPassifActif(testName) {
  return testName.replace(/ \((Passif|Actif)\)$/, '')
}

// Clé composite articulation+test : plusieurs articulations partagent des noms de test
// identiques (ex. "Rotation externe (Passif)" existe pour Épaule ET Hanche), donc une clé
// par nom seul mélangerait les données des deux.
export function jointTestKey(joint, testName) {
  return `${joint}::${testName}`
}

// ─────────────────────────────────────────────────────────────
// Normes ADMP (amplitude passive de référence — Norkin & White / AAOS).
// Rotation de hanche mesurée hanche à 0° de flexion.
// La Colonne n'a pas de norme ADMP (dissociation segmentaire qualitative — voir jointTests.js).
// ─────────────────────────────────────────────────────────────
export const ADMP_NORMS = {
  'Hanche': {
    'Rotation interne': 35,
    'Rotation externe': 45,
    'Flexion (genou fléchi)': 120,
    // 'Flexion (genou tendu)' : limitée par les ischio-jambiers, pas de norme ADMP fixe
    'Extension': 20,
    'Abduction': 45,
    'Adduction': 25,
  },
  'Genou': {
    'Flexion': 135,
    'Extension': 0,
  },
  'Cheville': {
    'Dorsiflexion': 20,
    'Flexion plantaire': 50,
  },
  'Pied': {
    'Inversion': 35,
    'Éversion': 15,
  },
  'Épaule': {
    'Rotation interne': 70,
    'Rotation externe': 40, // bas de fourchette AAOS (60-90° à 90° d'abduction) — position de mesure à préciser
    'Flexion': 180,
    'Extension': 50,
    'Abduction': 180,
    'Adduction': 40, // fourchette AAOS 30-50°, valeur médiane retenue
  },
  'Coude': {
    'Flexion': 145,
    'Extension': 0,
    'Pronation': 80,
    'Supination': 80,
  },
  'Poignet': {
    'Flexion': 80,
    'Extension': 70,
  },
}

// Écart Actif/Passif considéré à risque : % de la norme ADMP (pas un seuil fixe en degrés,
// un déficit de 15° ne pèse pas pareil sur 120° de flexion hanche que sur 20° de dorsiflexion cheville).
const ACTIVE_DEFICIT_RATIO = 0.15

// Toutes les fonctions ci-dessous acceptent un objet `norms` optionnel (même forme que
// ADMP_NORMS) pour comparer aux standards d'une discipline plutôt qu'à la population générale.
export function isADMPJoint(joint, norms = ADMP_NORMS) {
  return !!norms[joint]
}

export function admpNorm(joint, testName, norms = ADMP_NORMS) {
  return norms[joint]?.[stripPassifActif(testName)] ?? null
}

// Risque de restriction passive : la valeur (Passif idéalement) n'atteint pas la norme.
export function analyzeADMPRisk(joint, testName, value, norms = ADMP_NORMS) {
  const admp = admpNorm(joint, testName, norms)
  if (admp == null || value == null) return null
  const deficit = Math.round((admp - value) * 10) / 10
  return { admp, deficit, atRisk: deficit > 0 }
}

// Risque de déficit actif : écart Actif vs Passif > 15% de la norme de l'articulation.
export function analyzeActifPassifGap(joint, testName, passifValue, actifValue, norms = ADMP_NORMS) {
  const admp = admpNorm(joint, testName, norms)
  if (admp == null || passifValue == null || actifValue == null) return null
  const gap = Math.round((passifValue - actifValue) * 10) / 10
  const threshold = Math.round(admp * ACTIVE_DEFICIT_RATIO * 10) / 10
  return { gap, threshold, atRisk: gap > threshold }
}

// Score 0-100 : 100 = valeur atteint ou dépasse la norme de l'articulation.
export function scoreValue(joint, testName, value, norms = ADMP_NORMS) {
  if (value == null) return null
  const admp = admpNorm(joint, testName, norms)
  if (admp == null || admp === 0) return null
  return Math.max(0, Math.min(100, (value / admp) * 100))
}

// Score 0-100 pour une articulation entière, moyenne des tests ayant des données (D/G moyennés par test).
export function scoreJoint(joint, testNames, entriesByTestName, norms = ADMP_NORMS) {
  const scores = []
  testNames.forEach(testName => {
    const entry = entriesByTestName[jointTestKey(joint, testName)]
    if (!entry) return
    const sd = scoreValue(joint, testName, entry.value_d, norms)
    const sg = scoreValue(joint, testName, entry.value_g, norms)
    const vals = [sd, sg].filter(v => v != null)
    if (vals.length) scores.push(vals.reduce((a, b) => a + b, 0) / vals.length)
  })
  if (!scores.length) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

// Score 0-100 pour une articulation qualitative (Colonne) : pas de degrés, on convertit
// les niveaux de dissociation (Dissociation complète / Compensation légère / Blocage) en score.
export function scoreQualitativeJoint(joint, testNames, entriesByTestName) {
  const scores = []
  testNames.forEach(testName => {
    const entry = entriesByTestName[jointTestKey(joint, testName)]
    if (!entry) return
    const vals = [entry.quality_d, entry.quality_g]
      .map(k => (k != null ? QUALITY_SCORES[k] : null))
      .filter(v => v != null)
    if (vals.length) scores.push(vals.reduce((a, b) => a + b, 0) / vals.length)
  })
  if (!scores.length) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
