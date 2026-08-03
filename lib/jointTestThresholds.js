// OK / Modéré / Sévère — seuils en degrés, "OK" = valeur >= ok, "Modéré" = valeur >= moderate, sinon "Sévère"
export const JOINT_TEST_THRESHOLDS = {
  'Épaule': {
    'Rotation externe': { ok: 90, moderate: 70 },
    'Rotation interne': { ok: 60, moderate: 40 },
    'Flexion': { ok: 170, moderate: 150 },
    'Extension': { ok: 60, moderate: 40 },
    'Abduction': { ok: 170, moderate: 150 },
    'Adduction': { ok: 45, moderate: 30 },
  },
  'Hanche': {
    'Rotation externe': { ok: 45, moderate: 30 },
    'Rotation interne': { ok: 40, moderate: 25 },
    'Flexion (genou fléchi)': { ok: 120, moderate: 100 },
    'Flexion (genou tendu)': { ok: 80, moderate: 60 },
    'Extension': { ok: 20, moderate: 10 },
  },
  'Colonne': {
    'Flexion': { ok: 60, moderate: 40 },
    'Inclinaison latérale': { ok: 30, moderate: 20 },
    'Rotation': { ok: 45, moderate: 30 },
    // Cat-Cow et Jefferson Curl : évaluation qualitative, pas de seuil en degrés pour l'instant
  },
}

export function analyzeValue(joint, testName, value) {
  if (value == null) return null
  const t = JOINT_TEST_THRESHOLDS[joint]?.[testName]
  if (!t) return null
  if (value >= t.ok) return { label: 'OK', color: '#166534', bg: '#DCFCE7' }
  if (value >= t.moderate) return { label: 'Modéré', color: '#92400E', bg: '#FEF3C7' }
  return { label: 'Sévère', color: '#991B1B', bg: '#FEE2E2' }
}

export function analyzeEntry(joint, testName, entry) {
  if (!entry) return null
  const d = analyzeValue(joint, testName, entry.value_d)
  const g = analyzeValue(joint, testName, entry.value_g)
  const rank = { 'Sévère': 0, 'Modéré': 1, 'OK': 2 }
  if (d && g) return rank[d.label] <= rank[g.label] ? d : g
  return d || g || null
}
