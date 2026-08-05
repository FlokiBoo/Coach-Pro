function stripPassifActif(testName) {
  return testName.replace(/ \((Passif|Actif)\)$/, '')
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

export function isADMPJoint(joint) {
  return !!ADMP_NORMS[joint]
}

export function admpNorm(joint, testName) {
  return ADMP_NORMS[joint]?.[stripPassifActif(testName)] ?? null
}

// Risque de restriction passive : la valeur (Passif idéalement) n'atteint pas la norme ADMP.
export function analyzeADMPRisk(joint, testName, value) {
  const admp = admpNorm(joint, testName)
  if (admp == null || value == null) return null
  const deficit = Math.round((admp - value) * 10) / 10
  return { admp, deficit, atRisk: deficit > 0 }
}

// Risque de déficit actif : écart Actif vs Passif > 15% de la norme ADMP de l'articulation.
export function analyzeActifPassifGap(joint, testName, passifValue, actifValue) {
  const admp = admpNorm(joint, testName)
  if (admp == null || passifValue == null || actifValue == null) return null
  const gap = Math.round((passifValue - actifValue) * 10) / 10
  const threshold = Math.round(admp * ACTIVE_DEFICIT_RATIO * 10) / 10
  return { gap, threshold, atRisk: gap > threshold }
}

// Score 0-100 : 100 = valeur atteint ou dépasse la norme ADMP de l'articulation.
export function scoreValue(joint, testName, value) {
  if (value == null) return null
  const admp = admpNorm(joint, testName)
  if (admp == null || admp === 0) return null
  return Math.max(0, Math.min(100, (value / admp) * 100))
}

// Score 0-100 pour une articulation entière, moyenne des tests ayant des données (D/G moyennés par test).
export function scoreJoint(joint, testNames, entriesByTestName) {
  const scores = []
  testNames.forEach(testName => {
    const entry = entriesByTestName[testName]
    if (!entry) return
    const sd = scoreValue(joint, testName, entry.value_d)
    const sg = scoreValue(joint, testName, entry.value_g)
    const vals = [sd, sg].filter(v => v != null)
    if (vals.length) scores.push(vals.reduce((a, b) => a + b, 0) / vals.length)
  })
  if (!scores.length) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
