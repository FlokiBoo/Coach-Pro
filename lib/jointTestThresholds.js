import { QUALITY_SCORES } from './jointTests'

function stripActif(testName) {
  return testName.replace(/ \(Actif\)$/, '')
}

// Clé composite articulation+test : plusieurs articulations partagent des noms de test
// identiques (ex. "Rotation externe (Actif)" existe pour Épaule ET Hanche), donc une clé
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
    // 'Flexion (genou tendu)' : limitée par les ischio-jambiers, pas de norme ADMP fixe
  },
  'Cheville': {
    'Dorsiflexion': 20,
  },
  'Épaule': {
    'Rotation interne': 70,
    'Rotation externe': 40, // bas de fourchette AAOS (60-90° à 90° d'abduction) — position de mesure à préciser
    'Flexion': 180,
  },
}

// Toutes les fonctions ci-dessous acceptent un objet `norms` optionnel (même forme que
// ADMP_NORMS) pour comparer aux standards d'une discipline plutôt qu'à la population générale.
export function isADMPJoint(joint, norms = ADMP_NORMS) {
  return !!norms[joint]
}

export function admpNorm(joint, testName, norms = ADMP_NORMS) {
  return norms[joint]?.[stripActif(testName)] ?? null
}

// Risque de restriction : la valeur atteinte n'atteint pas la norme de l'articulation.
export function analyzeADMPRisk(joint, testName, value, norms = ADMP_NORMS) {
  const admp = admpNorm(joint, testName, norms)
  if (admp == null || value == null) return null
  const deficit = Math.round((admp - value) * 10) / 10
  return { admp, deficit, atRisk: deficit > 0 }
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
