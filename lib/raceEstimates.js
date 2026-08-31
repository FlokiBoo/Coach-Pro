// Estimation de temps de course (formule de Riegel) à partir des chronos déjà enregistrés
// dans les mouvements suivis (tracked_movements / tracked_movement_entries).

const RIEGEL_EXPONENT = 1.06

// Mouvements "Run" dont l'allure se règle en % VMA/Seuil60/Δ plutôt qu'en séries/reps/kg/récup.
export const RUN_MOVEMENT_NAMES = ['Run Interval', 'Run Threshold', 'Run EF', 'Run 30/30']
export const PACE_BASES = [
  { key: 'VMA', label: 'VMA' },
  { key: 'SEUIL60', label: 'Seuil 60' },
  { key: 'DELTA', label: 'Δ (Seuil60→VMA)' },
]

export function isRunMovement(name) {
  const n = (name || '').trim().toLowerCase()
  if (RUN_MOVEMENT_NAMES.some(m => m.toLowerCase() === n)) return true
  return RACE_TARGETS.some(t => t.match(name || ''))
}

// Format 30/30 : au lieu d'une allure (Allure 1/2), le coach fixe des % base et l'athlète voit une
// DISTANCE à parcourir en 30s (repères visuels/plots sur piste) — même champs pace_base/pct_low/
// pct_high que les autres mouvements "Run", juste une présentation différente.
export function is3030Movement(name) {
  return (name || '').trim().toLowerCase() === 'run 30/30'
}

// Calcule l'allure (km/h) pour une base (VMA/SEUIL60/DELTA) + un % donné, pour un athlète (known = buildKnownRaces()).
export function computePaceForBasePct(base, pct, known) {
  if (pct == null || pct === '') return null
  const seuil60 = computeSeuil60Scalar(known)
  const vma = computeVMA(known)
  if (base === 'VMA') return vma == null ? null : vma * pct / 100
  if (base === 'SEUIL60') return seuil60 == null ? null : seuil60 * pct / 100
  if (base === 'DELTA') {
    if (seuil60 == null || vma == null) return null
    return seuil60 + (vma - seuil60) * pct / 100
  }
  return null
}

// Distance (m) parcourue en `seconds` (30 par défaut, format 30/30) à la vitesse d'une base+% donnée.
export function computeDistanceForBasePct(base, pct, known, seconds = 30) {
  const kmh = computePaceForBasePct(base, pct, known)
  if (kmh == null) return null
  return Math.round(kmh * 1000 / 3600 * seconds)
}

// Ordre d'affichage voulu dans Cardio > Running
export const RACE_TARGETS = [
  {
    // "cooper" requis en plus de "6 min" pour ne pas capturer d'autres mouvements chronométrés
    // à 6 minutes sans rapport avec la course (ex: "6 min Echo Bike").
    key: '6min', label: '6 min (Demi Cooper)', kind: 'distance', fixedTimeSec: 360, useLatest: true,
    match: (name) => /\b6\s?min/i.test(name) && /cooper/i.test(name),
  },
  {
    key: '20min', label: 'Test Seuil 20min', kind: 'distance', fixedTimeSec: 1200, useLatest: true,
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

// Parse une allure saisie en texte libre ("5'30", "5:30", "5.5") → secondes par km
export function parsePaceInput(str) {
  if (!str) return null
  const s = String(str).trim()
  const m = s.match(/^(\d+)[:'](\d{1,2})$/)
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2])
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : Math.round(n * 60)
}

// A l'inverse : secondes par km → "M'SS" (identique à formatPace mais à partir d'un temps, pas d'une vitesse)
export function formatPaceFromSecPerKm(secPerKm) {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}'${String(sec).padStart(2, '0')}`
}

export function formatDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2).replace(/\.?0+$/, '')} km`
  return `${Math.round(m)} m`
}

// movements: [{ name, unit, entries: [{ value, date }] }] (entries déjà filtrées pour l'athlète ;
// `date` est requis pour les cibles useLatest comme 6min/20min)
export function buildKnownRaces(movements) {
  const known = {}
  movements.forEach(m => {
    const target = RACE_TARGETS.find(t => t.match(m.name))
    if (!target) return
    const entries = (m.entries || []).filter(e => e.value != null)
    if (!entries.length) return
    if (target.useLatest) {
      const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]
      if (target.kind === 'time' && m.unit === 'time') known[target.key] = { T: latest.value, D: target.distanceM }
      else if (target.kind === 'distance' && m.unit === 'distance_m') known[target.key] = { T: target.fixedTimeSec, D: latest.value }
      return
    }
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

export function computeSeuil60Scalar(known) {
  const threshold = computeThreshold60(known)
  if (!threshold) return null
  return (threshold.lowKmh + threshold.highKmh) / 2
}

export function computeDeltaZones(known) {
  const vma = computeVMA(known)
  const seuil60 = computeSeuil60Scalar(known)
  if (vma == null || seuil60 == null) return null
  const delta = vma - seuil60
  const zones = ZONE_DEFS.map(z => ({
    ...z,
    lowKmh: seuil60 + delta * z.lowPct,
    highKmh: seuil60 + delta * z.highPct,
  }))
  return { vma, seuil60, delta, zones }
}

// Repère des références d'allure écrites en texte libre par le coach : "Seuil60+60%Δ", "80-110%Δ",
// "100-105%VMA", "Seuil60" seul, "VMA" seule.
const PACE_REF_REGEX = /Seuil\s?60\s*\+\s*(\d+)(?:-(\d+))?%\s?Δ|(\d+)(?:-(\d+))?%\s?Δ|(\d+)(?:-(\d+))?%\s?VMA|\bSeuil\s?60\b|\bVMA\b/gi

export function parsePaceReferences(text) {
  if (!text) return []
  const matches = []
  let m
  PACE_REF_REGEX.lastIndex = 0
  while ((m = PACE_REF_REGEX.exec(text))) {
    if (m[1] !== undefined) matches.push({ raw: m[0], kind: 'seuil60_delta', low: +m[1], high: m[2] ? +m[2] : +m[1] })
    else if (m[3] !== undefined) matches.push({ raw: m[0], kind: 'seuil60_delta', low: +m[3], high: m[4] ? +m[4] : +m[3] })
    else if (m[5] !== undefined) matches.push({ raw: m[0], kind: 'vma_pct', low: +m[5], high: m[6] ? +m[6] : +m[5] })
    else if (/seuil/i.test(m[0])) matches.push({ raw: m[0], kind: 'seuil60' })
    else matches.push({ raw: m[0], kind: 'vma' })
  }
  return matches
}

// Calcule l'allure (km/h) correspondant à une référence détectée, pour un athlète donné (known = buildKnownRaces()).
export function computePaceForReference(ref, known) {
  const seuil60 = computeSeuil60Scalar(known)
  const vma = computeVMA(known)
  if (ref.kind === 'seuil60') {
    if (seuil60 == null) return null
    return { lowKmh: seuil60, highKmh: seuil60 }
  }
  if (ref.kind === 'vma') {
    if (vma == null) return null
    return { lowKmh: vma, highKmh: vma }
  }
  if (ref.kind === 'vma_pct') {
    if (vma == null) return null
    return { lowKmh: vma * ref.low / 100, highKmh: vma * ref.high / 100 }
  }
  if (ref.kind === 'seuil60_delta') {
    if (seuil60 == null || vma == null) return null
    const delta = vma - seuil60
    return { lowKmh: seuil60 + delta * ref.low / 100, highKmh: seuil60 + delta * ref.high / 100 }
  }
  return null
}

// Repère toutes les références d'allure d'un texte et calcule leur allure pour l'athlète (known).
// Retourne uniquement celles calculables (données suffisantes).
export function annotatePaceReferences(text, known) {
  return parsePaceReferences(text)
    .map(ref => ({ ...ref, pace: computePaceForReference(ref, known) }))
    .filter(r => r.pace)
}
