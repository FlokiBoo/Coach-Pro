// Estimation de temps de course (formule de Riegel) à partir des chronos déjà enregistrés
// dans les mouvements suivis (tracked_movements / tracked_movement_entries).

const RIEGEL_EXPONENT = 1.06

// Ordre d'affichage voulu dans Cardio > Running
export const RACE_TARGETS = [
  {
    key: '6min', label: '6 min (Demi Cooper)', kind: 'distance', fixedTimeSec: 360,
    match: (name) => /\b6\s?min/i.test(name),
  },
  {
    key: '20min', label: 'Test Seuil 20min', kind: 'distance', fixedTimeSec: 1200,
    match: (name) => /\b20\s?min/i.test(name),
  },
  {
    key: '400m', label: '400 m', kind: 'time', distanceM: 400,
    match: (name) => /(?<!\d)400\s?m\b/i.test(name),
  },
  {
    key: '800m', label: '800 m', kind: 'time', distanceM: 800,
    match: (name) => /(?<!\d)800\s?m\b/i.test(name),
  },
  {
    key: '5km', label: '5 km', kind: 'time', distanceM: 5000,
    match: (name) => /(?<!\d)5\s?km(?!\d)/i.test(name),
  },
  {
    key: '10km', label: '10 km', kind: 'time', distanceM: 10000,
    match: (name) => /(?<!\d)10\s?km(?!\d)/i.test(name),
  },
  {
    key: '21km', label: 'Semi-Marathon (21,1 km)', kind: 'time', distanceM: 21097,
    match: (name) => /(?<!\d)21([.,]1)?\s?km(?!\d)/i.test(name) || /semi[\s-]?marathon/i.test(name) || /half[\s-]?marathon/i.test(name),
  },
  {
    key: '42km', label: 'Marathon (42,195 km)', kind: 'time', distanceM: 42195,
    match: (name) => (/(?<!\d)42([.,]2)?\s?km(?!\d)/i.test(name) || /\bmarathon\b/i.test(name)) && !/semi/i.test(name),
  },
]

export function formatPace(kmh) {
  const secPerKm = Math.round(3600 / kmh)
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}'${String(sec).padStart(2, '0')}`
}

export function formatDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2).replace(/\.?0+$/, '')} km`
  return `${Math.round(m)} m`
}

// movements: [{ name, unit, entries: [{ value }] }] (entries déjà filtrées pour l'athlète)
export function buildKnownRaces(movements) {
  const known = {}
  movements.forEach(m => {
    const target = RACE_TARGETS.find(t => t.match(m.name))
    if (!target) return
    const entries = (m.entries || []).filter(e => e.value != null)
    if (!entries.length) return
    if (target.kind === 'time' && m.unit === 'time') {
      const best = Math.min(...entries.map(e => e.value))
      known[target.key] = { T: best, D: target.distanceM }
    } else if (target.kind === 'distance' && m.unit === 'distance_m') {
      const best = Math.max(...entries.map(e => e.value))
      known[target.key] = { T: target.fixedTimeSec, D: best }
    }
  })
  return known
}

function predictTimeForDistance(sourceT, sourceD, targetD) {
  return sourceT * Math.pow(targetD / sourceD, RIEGEL_EXPONENT)
}

function predictDistanceForTime(sourceT, sourceD, targetT) {
  return sourceD * Math.pow(targetT / sourceT, 1 / RIEGEL_EXPONENT)
}

// known: { [key]: { T, D } } — T en secondes, D en mètres, pour les cibles où une vraie mesure existe
export function computeRaceEstimates(known) {
  return RACE_TARGETS.map(target => {
    if (known[target.key]) {
      const { T, D } = known[target.key]
      return {
        ...target,
        measured: true,
        timeSec: target.kind === 'time' ? T : null,
        distanceM: target.kind === 'distance' ? D : null,
      }
    }

    const sourceKeys = Object.keys(known).filter(k => k !== target.key)
    if (!sourceKeys.length) return { ...target, measured: false, timeSec: null, distanceM: null, from: [] }

    if (target.kind === 'time') {
      const predictions = sourceKeys.map(k => predictTimeForDistance(known[k].T, known[k].D, target.distanceM))
      const avg = predictions.reduce((a, b) => a + b, 0) / predictions.length
      return { ...target, measured: false, timeSec: avg, distanceM: null, from: sourceKeys }
    }

    const predictions = sourceKeys.map(k => predictDistanceForTime(known[k].T, known[k].D, target.fixedTimeSec))
    const avg = predictions.reduce((a, b) => a + b, 0) / predictions.length
    return { ...target, measured: false, timeSec: null, distanceM: avg, from: sourceKeys }
  })
}

// Vitesse critique (CV) et seuil 60min à partir des tests 6min et 20min (distances en mètres)
// CV = (D20 − D6) / (20 − 6), converti en km/h, puis Seuil60 ≈ CV × 0,95 à 0,96
export function computeThreshold60(known) {
  const d6 = known['6min']?.D
  const d20 = known['20min']?.D
  if (d6 == null || d20 == null) return null
  const cvKmh = ((d20 - d6) / 14) * 60 / 1000
  return { cvKmh, lowKmh: cvKmh * 0.95, highKmh: cvKmh * 0.96 }
}

// VMA estimée (Demi-Cooper) : distance parcourue en 6 min (m) / 100 → km/h
export function computeVMA(known) {
  const d6 = known['6min']?.D
  if (d6 == null) return null
  return d6 / 100
}

// Δ = VMA − Seuil60 (milieu de la fourchette 0,95-0,96), et zones d'allure Seuil60 + %Δ
const ZONE_DEFS = [
  { key: 'longues', label: 'Longues / Seuil', lowPct: 0, highPct: 0.20 },
  { key: 'resistance', label: 'Résistance dure', lowPct: 0.50, highPct: 0.80 },
  { key: 'vo2max', label: 'VO2max', lowPct: 0.80, highPct: 1.10 },
]

export function computeDeltaZones(known) {
  const vma = computeVMA(known)
  const threshold = computeThreshold60(known)
  if (vma == null || !threshold) return null
  const seuil60 = (threshold.lowKmh + threshold.highKmh) / 2
  const delta = vma - seuil60
  const zones = ZONE_DEFS.map(z => ({
    ...z,
    lowKmh: seuil60 + delta * z.lowPct,
    highKmh: seuil60 + delta * z.highPct,
  }))
  return { vma, seuil60, delta, zones }
}
