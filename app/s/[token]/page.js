'use client'

import { useState, useEffect, useRef, use, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import WellnessBlock from '@/app/components/WellnessBlock'
import ActivityBlock, { DurationHMSInput } from '@/app/components/ActivityBlock'
import WeeklyStatsBlock from '@/app/components/WeeklyStatsBlock'
import ProgressBlock from '@/app/components/ProgressBlock'
import CelebrationModal, { parseMusclesFromText } from '@/app/components/CelebrationModal'
import MuscleAnatomyDiagram, { MUSCLE_GROUPS } from '@/app/components/MuscleAnatomyDiagram'
import FocusBodyDiagram from '@/app/components/FocusBodyDiagram'
import ObjectivesBlock from '@/app/components/ObjectivesBlock'
import MobilityRadarBlock from '@/app/components/MobilityRadarBlock'
import Toast from '@/app/components/Toast'
import AthleteSidePanel from '@/app/components/AthleteSidePanel'
import WeeklyPlannerBlock from '@/app/components/WeeklyPlannerBlock'
import { UNITS, unitOf, formatPerformance } from '@/app/components/TrackedMovementsBlock'
import TimerModal from '@/app/components/TimerModal'
import { annotatePaceReferences, formatPace, isRunMovement, PACE_BASES, computePaceForBasePct, RACE_TARGETS, parsePaceInput } from '@/lib/raceEstimates'

function computeLabels(exercises) {
  const labels = {}
  let letterIdx = 0, i = 0
  while (i < exercises.length) {
    const g = exercises[i].superset_group
    if (!g) {
      labels[exercises[i].id] = String.fromCharCode(65 + letterIdx)
      letterIdx++; i++
    } else {
      let j = i
      while (j < exercises.length && exercises[j].superset_group === g) j++
      const letter = String.fromCharCode(65 + letterIdx)
      for (let k = i; k < j; k++) labels[exercises[k].id] = `${letter}${k - i + 1}`
      letterIdx++; i = j
    }
  }
  return labels
}

function getSupersetFlow(exos, ei, labels) {
  const exo = exos[ei]
  if (!exo.superset_group) return null
  if (ei > 0 && exos[ei - 1].superset_group === exo.superset_group) return null
  const group = []
  for (let j = ei; j < exos.length && exos[j].superset_group === exo.superset_group; j++) group.push(exos[j])
  const parts = []
  group.forEach(e => {
    parts.push(labels[e.id] || '?')
    if (e.rest) parts.push(e.rest)
  })
  return parts.join(' → ')
}

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function isFinishedFreeSession(p, completions) {
  return p.title?.startsWith('Séance libre') && p.sessions.length > 0 && p.sessions.every(s => completions.has(s.id))
}

export default function AthleteViewWrapper({ params }) {
  return (
    <Suspense>
      <AthleteView params={params} />
    </Suspense>
  )
}

function ensureDeviceCookie() {
  const match = document.cookie.match(/(?:^|; )cp_device=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  const id = crypto.randomUUID()
  document.cookie = `cp_device=${id}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; SameSite=Lax`
  return id
}

function offsetDate(date, days) {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}

function formatDateFr(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function AthleteView({ params }) {
  const { token } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCoachView = searchParams.get('coach') === '1'
  const [isCoach, setIsCoach] = useState(false)
  const targetSessionId = searchParams.get('session')
  const focusMode = searchParams.get('focus') === '1'
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([])
  const [completions, setCompletions] = useState(new Set())
  const [openSessionId, setOpenSessionId] = useState(null)
  const [validating, setValidating] = useState(false)
  const [exerciseLogs, setExerciseLogs] = useState({})
  const [exerciseSets, setExerciseSets] = useState({})
  const [viewDate, setViewDate] = useState(today())
  const [celebration, setCelebration] = useState(null)
  const [completionFeedback, setCompletionFeedback] = useState({})
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [objectives, setObjectives] = useState([])
  const [noteBlocks, setNoteBlocks] = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [toast, setToast] = useState(null)
  const [sessionRecords, setSessionRecords] = useState([])
  const [trackedMovements, setTrackedMovements] = useState([])
  const [raceKnown, setRaceKnown] = useState({})

  const queueKey = `coachpro_offline_queue_${token}`
  const loadQueue = () => { try { return JSON.parse(localStorage.getItem(queueKey) || '[]') } catch { return [] } }
  const enqueue = (op) => { const q = loadQueue(); q.push(op); localStorage.setItem(queueKey, JSON.stringify(q)) }

  const isTempSetId = id => typeof id === 'string' && id.startsWith('local-')
  const makeTempSetId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const reloadExerciseSets = async () => {
    if (!athlete) return
    const { data } = await supabase.from('program_exercise_sets').select('*')
      .eq('athlete_id', athlete.id).order('set_index')
    const grouped = {}
    ;(data || []).forEach(s => { (grouped[s.program_exercise_id] ||= []).push(s) })
    setExerciseSets(grouped)
  }

  const flushQueue = async () => {
    const q = loadQueue()
    if (!q.length) return
    const tempIdMap = {} // tempId -> id réel une fois créé en base
    const resolveSetId = id => (isTempSetId(id) && tempIdMap[id]) ? tempIdMap[id] : id
    let hasExerciseSetOps = false

    for (const op of q) {
      if (op.type === 'exercise_log') {
        await supabase.from('program_exercise_logs').upsert(
          { athlete_id: op.athleteId, program_exercise_id: op.exerciseId, ...op.updated },
          { onConflict: 'athlete_id,program_exercise_id' }
        )
        if (op.updated.kg_done || op.updated.reps_done || op.updated.sets_done || op.updated.note) {
          await supabase.from('exercise_performance_history').insert({
            athlete_id: op.athleteId,
            program_exercise_id: op.exerciseId,
            kg_done: op.updated.kg_done ? parseFloat(op.updated.kg_done) : null,
            reps_done: op.updated.reps_done || null,
            sets_done: op.updated.sets_done || null,
            note: op.updated.note || null,
          })
        }
      } else if (op.type === 'validate') {
        await supabase.from('program_completions').upsert(
          { athlete_id: op.athleteId, program_session_id: op.sessId, ...op.feedback },
          { onConflict: 'athlete_id,program_session_id' }
        )
      } else if (op.type === 'add_exercise_set') {
        hasExerciseSetOps = true
        const { data, error } = await supabase.from('program_exercise_sets')
          .insert({ athlete_id: op.athleteId, program_exercise_id: op.exerciseId, set_index: op.setIndex })
          .select().single()
        if (!error && data) tempIdMap[op.tempId] = data.id
      } else if (op.type === 'exercise_set_field') {
        hasExerciseSetOps = true
        const realId = resolveSetId(op.setId)
        if (isTempSetId(realId)) continue // la création a échoué, rien à mettre à jour
        await supabase.from('program_exercise_sets').update({ [op.field]: op.value }).eq('id', realId)
      } else if (op.type === 'delete_exercise_set') {
        hasExerciseSetOps = true
        const realId = resolveSetId(op.setId)
        if (isTempSetId(realId)) continue
        await supabase.from('program_exercise_sets').delete().eq('id', realId)
      }
    }
    localStorage.removeItem(queueKey)
    setToast('Synchronisé ✓')
    if (hasExerciseSetOps) reloadExerciseSets()
  }

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => { setIsOffline(false); flushQueue() }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    if (typeof navigator !== 'undefined' && navigator.onLine) Promise.resolve().then(flushQueue)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  const requireOnline = () => {
    if (isOffline) { alert('Tu es hors ligne. Cette action nécessite une connexion internet — réessaie une fois reconnecté.'); return false }
    return true
  }

  useEffect(() => {
    async function load() {
      ensureDeviceCookie()
      const res = await fetch(`/api/athlete-view/${token}`, { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}))
        router.push(body.error === 'device_unverified' ? `/verify-device?token=${token}` : '/login')
        return
      }
      if (!res.ok) return
      const { athlete: ath, programs: progs, completions: comps, exerciseLogs: logs, movieMap, musclesMap, objectives: objs, noteBlocks: blocks, exerciseSets: exoSets, raceKnown: rk, trackedMovements: tms, isCoach: coachFlag } = await res.json()
      setAthlete(ath)
      setObjectives(objs || [])
      setNoteBlocks(blocks || [])
      setRaceKnown(rk || {})
      setTrackedMovements(tms || [])
      setIsCoach(!!coachFlag)

      const logsMap = {}
      ;(logs || []).forEach(l => { logsMap[l.program_exercise_id] = l })
      setExerciseLogs(logsMap)

      const setsMap = {}
      ;(exoSets || []).forEach(s => {
        if (!setsMap[s.program_exercise_id]) setsMap[s.program_exercise_id] = []
        setsMap[s.program_exercise_id].push(s)
      })
      setExerciseSets(setsMap)
      const completionSet = new Set((comps || []).map(c => c.program_session_id))
      setCompletions(completionSet)
      const feedbackMap = {}
      ;(comps || []).forEach(c => { feedbackMap[c.program_session_id] = c })
      setCompletionFeedback(feedbackMap)

      const progList = (progs || []).map(p => ({
        ...p,
        sessions: [...(p.program_sessions || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map(s => ({
            ...s,
            exercises: [...(s.program_exercises || [])].sort((a, b) => a.order_index - b.order_index)
              .map(e => ({ ...e, video_url: (movieMap || {})[e.name] ?? e.video_url, movement_muscles: (musclesMap || {})[e.name?.trim().toLowerCase()] || null }))
          }))
      }))
      setPrograms(progList)

      // Séance ciblée via l'URL (ex: lancée depuis l'espace coach) prioritaire sur l'auto-ouverture
      const allSessionIds = new Set(progList.flatMap(p => p.sessions.map(s => s.id)))
      if (targetSessionId && allSessionIds.has(targetSessionId)) {
        setOpenSessionId(targetSessionId)
        return
      }

      // Auto-ouvrir la première séance à faire du premier programme
      for (const prog of progList) {
        const next = prog.sessions.find(s => !completionSet.has(s.id))
        if (next) { setOpenSessionId(next.id); break }
      }
    }
    load()
  }, [token])

  // Synchronise un résultat de séance (allure + distance) vers le mouvement Metrics correspondant
  // (ex: exercice nommé "6 min (Demi Cooper)" ou "5km Run") pour que VMA/Seuil60/Δ se recalculent.
  const syncRaceMetric = async (exerciseName, distanceKm, avgPaceStr) => {
    if (!athlete) return
    const target = RACE_TARGETS.find(t => t.match(exerciseName))
    if (!target) return
    const tm = trackedMovements.find(m => RACE_TARGETS.find(t => t.match(m.name)) === target)
    if (!tm) return

    const paceSec = parsePaceInput(avgPaceStr)
    let value = null
    if (tm.unit === 'distance_m') value = distanceKm ? Math.round(distanceKm * 1000) : null
    else if (tm.unit === 'time') value = (distanceKm && paceSec) ? Math.round(distanceKm * paceSec) : null
    if (value == null) return

    const date = today()
    const payload = {
      athlete_id: athlete.id, tracked_movement_id: tm.id, date, value,
      avg_pace: avgPaceStr?.trim() || null, distance_km: distanceKm || null,
    }
    const { data: existing } = await supabase.from('tracked_movement_entries').select('id')
      .eq('athlete_id', athlete.id).eq('tracked_movement_id', tm.id).eq('date', date).maybeSingle()
    if (existing) await supabase.from('tracked_movement_entries').update(payload).eq('id', existing.id)
    else await supabase.from('tracked_movement_entries').insert(payload)

    // Met à jour raceKnown localement (pas de re-fetch : évite les soucis de synchro de session)
    setRaceKnown(prev => {
      const cur = prev[target.key]
      if (target.kind === 'distance') {
        const D = cur ? Math.max(cur.D, value) : value
        return { ...prev, [target.key]: { T: target.fixedTimeSec, D } }
      }
      const T = cur ? Math.min(cur.T, value) : value
      return { ...prev, [target.key]: { T, D: target.distanceM } }
    })
  }

  // Détecte automatiquement un nouveau record (1 à 6 reps) sur un mouvement suivi en kg
  const checkAutoRecord = async (exerciseName, updated) => {
    if (!athlete || !exerciseName) return
    const reps = parseInt(updated.reps_done)
    const kg = parseFloat(updated.kg_done)
    if (!reps || reps < 1 || reps > 6 || !kg) return

    const match = trackedMovements.find(m =>
      m.name.trim().toLowerCase() === exerciseName.trim().toLowerCase() && (m.unit === 'kg' || !m.unit)
    )
    if (!match) return

    const rmField = `rm${reps}`
    const { data: entries } = await supabase.from('tracked_movement_entries')
      .select(rmField).eq('tracked_movement_id', match.id).eq('athlete_id', athlete.id)
    const best = (entries || []).reduce((max, e) => (e[rmField] != null && e[rmField] > max) ? e[rmField] : max, 0)

    if (kg > best) {
      const { error } = await supabase.from('tracked_movement_entries').insert({
        tracked_movement_id: match.id, athlete_id: athlete.id, date: today(), [rmField]: kg,
      })
      if (!error) {
        setToast(`🏆 Nouveau record ${reps}RM : ${kg}kg !`)
        setSessionRecords(prev => [...prev, { name: match.name, label: `${reps}RM : ${kg}kg` }])
      }
    }
  }

  // Enregistre un résultat pour un mouvement suivi non-kg (temps, distance, calories...) dans Metrics,
  // et détecte au passage si c'est un nouveau record.
  const saveMetricResult = async (movement, value) => {
    if (!athlete || value == null || isNaN(value)) return
    const cfg = UNITS[movement.unit] || UNITS.kg
    const date = today()
    const { data: entries } = await supabase.from('tracked_movement_entries')
      .select('id, value, date').eq('tracked_movement_id', movement.id).eq('athlete_id', athlete.id)
    const vals = (entries || []).map(e => e.value).filter(v => v != null)
    const currentBest = vals.length ? (cfg.betterIsHigher ? Math.max(...vals) : Math.min(...vals)) : null
    const isNewRecord = currentBest == null || (cfg.betterIsHigher ? value > currentBest : value < currentBest)

    const existingToday = (entries || []).find(e => e.date === date)
    const payload = { tracked_movement_id: movement.id, athlete_id: athlete.id, date, value }
    const { error } = existingToday
      ? await supabase.from('tracked_movement_entries').update(payload).eq('id', existingToday.id)
      : await supabase.from('tracked_movement_entries').insert(payload)
    if (error) return

    if (isNewRecord) {
      setToast(`🏆 Nouveau record : ${formatPerformance(movement, value)} !`)
      setSessionRecords(prev => [...prev, { name: movement.name, label: formatPerformance(movement, value) }])
    } else {
      setToast(`Résultat enregistré : ${formatPerformance(movement, value)}`)
    }
  }

  const unvalidate = async (sessId, progSessions) => {
    if (!athlete) return
    if (!requireOnline()) return
    setValidating(true)
    await supabase.from('program_completions')
      .delete()
      .eq('athlete_id', athlete.id)
      .eq('program_session_id', sessId)
    const newSet = new Set([...completions])
    newSet.delete(sessId)
    setCompletions(newSet)
    setOpenSessionId(sessId)
    setValidating(false)
  }

  const validate = async (sessId, progSessions, feedback = {}, opts = {}) => {
    if (!athlete) return
    const isUpdate = !!opts.isUpdate
    setValidating(true)

    if (isOffline) {
      enqueue({ type: 'validate', athleteId: athlete.id, sessId, feedback })
      const newSet = new Set([...completions, sessId])
      setCompletions(newSet)
      setCompletionFeedback(prev => ({ ...prev, [sessId]: { program_session_id: sessId, ...feedback } }))
      if (!isUpdate) {
        const next = progSessions.find(s => !newSet.has(s.id))
        setOpenSessionId(next?.id || null)
      }
      setValidating(false)
      setToast('Validation enregistrée localement (hors ligne)')
      return
    }

    await supabase.from('program_completions').upsert(
      { athlete_id: athlete.id, program_session_id: sessId, ...feedback },
      { onConflict: 'athlete_id,program_session_id' }
    )
    const newSet = new Set([...completions, sessId])
    setCompletions(newSet)
    setCompletionFeedback(prev => ({ ...prev, [sessId]: { program_session_id: sessId, ...feedback } }))
    if (!isUpdate) {
      const next = progSessions.find(s => !newSet.has(s.id))
      setOpenSessionId(next?.id || null)
    }
    setValidating(false)
    setToast(isUpdate ? 'Bilan mis à jour' : 'Séance validée')

    if (isUpdate) return

    // Popup de félicitation avec tonnage + muscles
    const allSessions = programs.flatMap(p => p.sessions)
    const sess = allSessions.find(s => s.id === sessId)
    if (sess) {
      const exos = sess.exercises.filter(e => e.name)
      let tonnage = 0
      exos.forEach(e => {
        const log = exerciseLogs[e.id]
        if (log?.kg_done && log?.sets_done && log?.reps_done) {
          tonnage += (parseFloat(log.kg_done) || 0) * (parseInt(log.sets_done) || 0) * (parseInt(log.reps_done) || 0)
        }
      })
      const exerciseNames = [...new Set(exos.map(e => e.name.trim()).filter(Boolean))]
      let muscles = []
      if (exerciseNames.length > 0) {
        const { data: movData } = await supabase.from('movements').select('name, muscles').in('name', exerciseNames)
        const allText = (movData || []).map(m => m.muscles || '').join(', ')
        muscles = parseMusclesFromText(allText)
      }
      // Cible manuellement choisie sur un exercice (picker "Focus") : toujours reprise dans le résumé,
      // même si le texte de la bibliothèque de mouvements ne mentionne pas ce muscle.
      const manualMuscles = exos.flatMap(e => e.focus_muscles ? e.focus_muscles.split(',') : [])
      muscles = [...new Set([...muscles, ...manualMuscles])]
      setCelebration({ tonnage: Math.round(tonnage), muscles, records: sessionRecords })
      setSessionRecords([])
    }
  }

  const saveExerciseLog = async (exerciseId, exerciseName, field, value) => {
    if (!athlete) return
    const existing = exerciseLogs[exerciseId] || {}
    const updated = { ...existing, [field]: value }
    setExerciseLogs(prev => ({ ...prev, [exerciseId]: updated }))

    if (isOffline) {
      enqueue({ type: 'exercise_log', athleteId: athlete.id, exerciseId, updated })
      setToast('Enregistré localement (hors ligne)')
      return
    }

    const { error: logErr } = await supabase.from('program_exercise_logs').upsert(
      { athlete_id: athlete.id, program_exercise_id: exerciseId, ...updated },
      { onConflict: 'athlete_id,program_exercise_id' }
    )
    if (logErr) { alert('Erreur log : ' + logErr.message); return }
    // Snapshot dans l'historique à chaque champ enregistré (charge, reps, séries ou note)
    if (updated.kg_done || updated.reps_done || updated.sets_done || updated.note) {
      const { error: histErr } = await supabase.from('exercise_performance_history').insert({
        athlete_id: athlete.id,
        program_exercise_id: exerciseId,
        kg_done: updated.kg_done ? parseFloat(updated.kg_done) : null,
        reps_done: updated.reps_done || null,
        sets_done: updated.sets_done || null,
        note: updated.note || null,
      })
      if (histErr) alert('Erreur historique : ' + histErr.message)
    }

    if (field === 'kg_done' || field === 'reps_done') {
      checkAutoRecord(exerciseName, updated)
    }
  }

  const addExerciseSet = async (exerciseId) => {
    if (!athlete) return
    const current = exerciseSets[exerciseId] || []
    const nextIndex = current.length ? Math.max(...current.map(s => s.set_index)) + 1 : 1
    if (isOffline) {
      const tempId = makeTempSetId()
      setExerciseSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), { id: tempId, athlete_id: athlete.id, program_exercise_id: exerciseId, set_index: nextIndex }] }))
      enqueue({ type: 'add_exercise_set', tempId, athleteId: athlete.id, exerciseId, setIndex: nextIndex })
      return
    }
    const { data, error } = await supabase.from('program_exercise_sets')
      .insert({ athlete_id: athlete.id, program_exercise_id: exerciseId, set_index: nextIndex })
      .select().single()
    if (error) { alert('Erreur : ' + error.message); return }
    setExerciseSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), data] }))
  }

  const ensureExerciseSets = async (exerciseId, count) => {
    if (!athlete) return
    const current = exerciseSets[exerciseId] || []
    const missing = count - current.length
    if (missing <= 0) return
    const startIndex = current.length ? Math.max(...current.map(s => s.set_index)) + 1 : 1
    if (isOffline) {
      const newRows = []
      for (let i = 0; i < missing; i++) {
        const tempId = makeTempSetId()
        const setIndex = startIndex + i
        newRows.push({ id: tempId, athlete_id: athlete.id, program_exercise_id: exerciseId, set_index: setIndex })
        enqueue({ type: 'add_exercise_set', tempId, athleteId: athlete.id, exerciseId, setIndex })
      }
      setExerciseSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), ...newRows] }))
      return
    }
    const rows = Array.from({ length: missing }, (_, i) => ({
      athlete_id: athlete.id, program_exercise_id: exerciseId, set_index: startIndex + i,
    }))
    const { data, error } = await supabase.from('program_exercise_sets').insert(rows).select()
    if (error) { alert('Erreur : ' + error.message); return }
    setExerciseSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), ...data] }))
  }

  const saveExerciseSet = async (exerciseId, setId, field, value) => {
    const parsedValue = field === 'kg_done' ? (value === '' ? null : parseFloat(value)) : (value || null)
    setExerciseSets(prev => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] || []).map(s => s.id === setId ? { ...s, [field]: parsedValue } : s),
    }))
    if (isOffline || isTempSetId(setId)) {
      enqueue({ type: 'exercise_set_field', setId, field, value: parsedValue })
      return
    }
    const { error } = await supabase.from('program_exercise_sets').update({ [field]: parsedValue }).eq('id', setId)
    if (error) alert('Erreur : ' + error.message)
  }

  const deleteExerciseSet = async (exerciseId, setId) => {
    setExerciseSets(prev => ({ ...prev, [exerciseId]: (prev[exerciseId] || []).filter(s => s.id !== setId) }))
    if (isTempSetId(setId)) {
      // Jamais persistée : on retire juste les opérations en attente qui la concernaient.
      const q = loadQueue().filter(op => op.tempId !== setId && op.setId !== setId)
      localStorage.setItem(queueKey, JSON.stringify(q))
      return
    }
    if (isOffline) {
      enqueue({ type: 'delete_exercise_set', setId })
      return
    }
    await supabase.from('program_exercise_sets').delete().eq('id', setId)
  }

  // Crée une séance libre vide et ouvre directement la vue plein écran (comme "▶ Lancer"),
  // où les exercices sont ajoutés un par un via FreeExerciseAdder.
  const startFreeSession = async () => {
    if (!athlete) return
    if (!requireOnline()) return
    const res = await fetch(`/api/athlete-view/${token}/free-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises: [] }),
    })
    const json = await res.json()
    if (!res.ok) { alert('Erreur : ' + (json?.error || 'impossible de créer la séance')); return }

    const newProg = { ...json.program, sessions: [{ ...json.session, exercises: [] }] }
    setPrograms(prev => [newProg, ...prev])
    router.push(`/s/${token}?session=${json.session.id}&focus=1${isCoachView ? '&coach=1' : ''}`)
  }

  const addFreeExercise = async (sessionId, { name, sets, reps, kg }) => {
    if (!requireOnline()) return
    const res = await fetch(`/api/athlete-view/${token}/free-session/exercise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, name, sets, reps, kg }),
    })
    const json = await res.json()
    if (!res.ok) { alert('Erreur : ' + (json?.error || 'impossible d\'ajouter l\'exercice')); return }
    setPrograms(prev => prev.map(p => ({
      ...p,
      sessions: p.sessions.map(s => s.id === sessionId ? { ...s, exercises: [...s.exercises, json.exercise] } : s),
    })))
  }

  const toggleFreeSuperset = async (sessionId, exoA, exoB) => {
    if (!requireOnline()) return
    const group = (exoA.superset_group && exoA.superset_group === exoB.superset_group) ? null : (exoA.superset_group || exoB.superset_group || Math.random().toString(36).slice(2, 8))
    await Promise.all([
      supabase.from('program_exercises').update({ superset_group: group }).eq('id', exoA.id),
      supabase.from('program_exercises').update({ superset_group: group }).eq('id', exoB.id),
    ])
    setPrograms(prev => prev.map(p => ({
      ...p,
      sessions: p.sessions.map(s => s.id === sessionId
        ? { ...s, exercises: s.exercises.map(e => (e.id === exoA.id || e.id === exoB.id) ? { ...e, superset_group: group } : e) }
        : s),
    })))
  }

  if (!athlete) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
  )

  if (focusMode && targetSessionId) {
    let focusSession = null, focusProgSessions = [], focusActivityType = null, focusIsFreeSession = false
    for (const p of programs) {
      const idx = p.sessions.findIndex(s => s.id === targetSessionId)
      if (idx !== -1) { focusSession = p.sessions[idx]; focusProgSessions = p.sessions; focusActivityType = p.activity_type; focusIsFreeSession = !!p.title?.startsWith('Séance libre'); break }
    }
    const isDone = focusSession ? completions.has(focusSession.id) : false
    const backHref = `/s/${token}${isCoachView ? '?coach=1' : ''}`

    return (
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)', paddingBottom: 60 }}>
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={() => router.push(backHref)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{focusSession?.title || 'Séance'}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{athlete.name}</div>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <WellnessBlock athleteId={athlete.id} date={viewDate} mode="athlete" />

          {focusSession ? (
            <SessionCard
              session={focusSession}
              idx={0}
              isOpen={true}
              isCompleted={isDone}
              onToggle={() => {}}
              onValidate={(fb) => validate(focusSession.id, focusProgSessions, fb, { isUpdate: isDone })}
              onUnvalidate={isDone ? () => unvalidate(focusSession.id, focusProgSessions) : null}
              initialFeedback={completionFeedback[focusSession.id]}
              validating={validating}
              exerciseLogs={exerciseLogs}
              onSaveLog={saveExerciseLog}
              athleteId={athlete.id}
              activityType={focusActivityType}
              trackedMovements={trackedMovements}
              onSaveMetricResult={saveMetricResult}
              exerciseSets={exerciseSets}
              onAddExerciseSet={addExerciseSet}
              onEnsureExerciseSets={ensureExerciseSets}
              onSaveExerciseSet={saveExerciseSet}
              onDeleteExerciseSet={deleteExerciseSet}
              isCoachView={isCoachView}
              isCoach={isCoach}
              raceKnown={raceKnown}
              onSyncRaceMetric={syncRaceMetric}
              isFreeSession={focusIsFreeSession}
              onAddExercise={addFreeExercise}
              onToggleSuperset={toggleFreeSuperset}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px' }}>Séance introuvable</div>
          )}
        </div>

        {celebration && (
          <CelebrationModal tonnage={celebration.tonnage} muscles={celebration.muscles} records={celebration.records} onClose={() => setCelebration(null)} />
        )}
        <Toast message={toast} show={!!toast} onDone={() => setToast(null)} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>{athlete.name}</div>
        </div>
        {isCoachView && (
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', fontWeight: 600 }}>
            ← Vue coach
          </Link>
        )}
      </div>

      {isOffline && (
        <div style={{ background: '#FEF3C7', borderBottom: '1px solid #FDE68A', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>📴</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>Hors ligne — tu vois les dernières données chargées. Les actions (valider, enregistrer) reprendront une fois reconnecté.</span>
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {athlete?.id && <ObjectivesBlock athleteId={athlete.id} objectives={objectives} setObjectives={setObjectives} isCoach={isCoachView} />}

        {athlete?.id && <MobilityRadarBlock athleteId={athlete.id} />}


        {noteBlocks.map(b => (
          <div key={b.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            {b.title && (
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{b.title}</span>
              </div>
            )}
            {b.content && (
              <div style={{ padding: 14, fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{b.content}</div>
            )}
          </div>
        ))}

        <WeeklyStatsBlock athleteId={athlete.id} />
        <WeeklyPlannerBlock athleteId={athlete.id} />
        <ProgressBlock athleteId={athlete.id} />

        {/* Navigation date bien-être / activité */}
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', border: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setViewDate(d => offsetDate(d, -1))}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)', padding: '2px 6px', borderRadius: 6, lineHeight: 1 }}
          >←</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'capitalize', color: 'var(--text)' }}>
              {viewDate === today() ? "Aujourd'hui" : formatDateFr(viewDate)}
            </div>
            {viewDate !== today() && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                {new Date(viewDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
          <button
            onClick={() => setViewDate(d => offsetDate(d, 1))}
            disabled={viewDate >= today()}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: viewDate >= today() ? 'default' : 'pointer', color: viewDate >= today() ? 'var(--border2)' : 'var(--text2)', padding: '2px 6px', borderRadius: 6, lineHeight: 1 }}
          >→</button>
        </div>

        <WellnessBlock athleteId={athlete.id} date={viewDate} mode="athlete" />
        <ActivityBlock athleteId={athlete.id} date={viewDate} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={startFreeSession} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 20, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ⚡ Séance libre
          </button>
        </div>

        {programs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600 }}>Aucun programme actif</div>
          </div>
        )}

        {(() => {
          const boardPrograms = programs.filter(p => p.pinned_board !== false && !p.archived && !isFinishedFreeSession(p, completions))
          const allTypes = [...new Set(boardPrograms.map(p => p.activity_type || 'Musculation 🏋️'))]
          const commonProps = {
            completions, completionFeedback, validating, exerciseLogs,
            athleteId: athlete.id, validate, unvalidate, saveExerciseLog, router, token, isCoachView, isCoach,
            trackedMovements, onSaveMetricResult: saveMetricResult,
            exerciseSets, onAddExerciseSet: addExerciseSet, onEnsureExerciseSets: ensureExerciseSets, onSaveExerciseSet: saveExerciseSet, onDeleteExerciseSet: deleteExerciseSet,
            raceKnown, onSyncRaceMetric: syncRaceMetric,
          }

          if (boardPrograms.length === 0) {
            return programs.length > 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px', fontSize: 13 }}>
                Aucun programme épinglé au tableau de bord
              </div>
            ) : null
          }

          if (allTypes.length <= 1) {
            return boardPrograms.map(prog => <ProgramSessionsBlock key={prog.id} prog={prog} {...commonProps} />)
          }

          // Type sélectionné par défaut : le premier avec une séance restante, sinon le premier tout court.
          const effectiveType = (selectedType && allTypes.includes(selectedType)) ? selectedType
            : ((boardPrograms.find(p => p.sessions.some(s => !completions.has(s.id))) || boardPrograms[0]).activity_type || 'Musculation 🏋️')

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allTypes.length}, minmax(100px, 1fr))`, gap: 8, overflowX: 'auto' }}>
                {allTypes.map(t => {
                  const typePrograms = boardPrograms.filter(p => (p.activity_type || 'Musculation 🏋️') === t)
                  const total = typePrograms.reduce((n, p) => n + p.sessions.length, 0)
                  const done = typePrograms.reduce((n, p) => n + p.sessions.filter(s => completions.has(s.id)).length, 0)
                  const nextProg = typePrograms.find(p => p.sessions.some(s => !completions.has(s.id)))
                  const nextSess = nextProg?.sessions.find(s => !completions.has(s.id))
                  const isSelected = effectiveType === t
                  return (
                    <button
                      key={t}
                      onClick={() => setSelectedType(t)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', minWidth: 0,
                        background: isSelected ? 'var(--green-light)' : 'var(--bg)',
                        border: isSelected ? '1.5px solid var(--green)' : '1px solid var(--border)',
                        borderRadius: 'var(--rl)', padding: '10px 8px', cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? 'var(--green)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nextSess ? (nextSess.title || 'Séance') : total ? '✓ Tout fait' : '—'}
                      </div>
                      {total > 0 && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>{done}/{total}</div>
                      )}
                    </button>
                  )
                })}
              </div>

              {boardPrograms
                .filter(p => (p.activity_type || 'Musculation 🏋️') === effectiveType)
                .map(prog => <ProgramSessionsBlock key={prog.id} prog={prog} {...commonProps} />)}
            </>
          )
        })()}
      </div>

      {celebration && (
        <CelebrationModal
          tonnage={celebration.tonnage}
          muscles={celebration.muscles}
          records={celebration.records}
          onClose={() => setCelebration(null)}
        />
      )}

      <AthleteSidePanel athlete={athlete} token={token} onWeightUpdate={w => setAthlete(a => ({ ...a, weight: w }))} />
      <Toast message={toast} show={!!toast} onDone={() => setToast(null)} />
    </div>
  )
}

const logInputStyle = {
  width: '100%', padding: '7px 9px', border: '1px solid var(--border2)',
  borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, outline: 'none',
  background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box'
}

function RunResultLogger({ exo, exerciseLogs, onSaveLog, onSyncRaceMetric }) {
  const log = exerciseLogs[exo.id] || {}
  const [intervals, setIntervals] = useState(log.intervals_done || [])

  const syncFromLog = (field, value) => {
    if (!onSyncRaceMetric) return
    const current = exerciseLogs[exo.id] || {}
    const distanceKm = field === 'distance_done' ? value : current.distance_done
    const avgPace = field === 'avg_pace_done' ? value : current.avg_pace_done
    onSyncRaceMetric(exo.name, distanceKm, avgPace)
  }

  const addInterval = () => {
    const next = [...intervals, { distance: '', pace: '' }]
    setIntervals(next)
  }
  const updateInterval = (i, field, val) => {
    setIntervals(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }
  const commitIntervals = () => onSaveLog(exo.id, exo.name, 'intervals_done', intervals)
  const removeInterval = (i) => {
    const next = intervals.filter((_, idx) => idx !== i)
    setIntervals(next)
    onSaveLog(exo.id, exo.name, 'intervals_done', next)
  }

  const target = RACE_TARGETS.find(t => t.match(exo.name))
  const distanceOnly = target?.kind === 'distance'

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ma séance</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!distanceOnly && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Allure moyenne (min/km)</div>
            <input type="text" placeholder="ex: 5'30" defaultValue={log.avg_pace_done || ''}
              onBlur={e => { onSaveLog(exo.id, exo.name, 'avg_pace_done', e.target.value); syncFromLog('avg_pace_done', e.target.value) }}
              style={logInputStyle} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Distance parcourue (km)</div>
          <input type="number" step="0.01" min="0" placeholder="ex: 6.5" defaultValue={log.distance_done ?? ''}
            onBlur={e => { const v = e.target.value ? parseFloat(e.target.value) : null; onSaveLog(exo.id, exo.name, 'distance_done', v); syncFromLog('distance_done', v) }}
            style={logInputStyle} />
        </div>
      </div>

      {!distanceOnly && intervals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {intervals.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" step="0.01" min="0" placeholder="Distance (km)" value={it.distance}
                onChange={e => updateInterval(i, 'distance', e.target.value)}
                onBlur={commitIntervals}
                style={{ ...logInputStyle, fontSize: 12 }} />
              <input type="text" placeholder="Allure (min/km)" value={it.pace}
                onChange={e => updateInterval(i, 'pace', e.target.value)}
                onBlur={commitIntervals}
                style={{ ...logInputStyle, fontSize: 12 }} />
              <button onClick={() => removeInterval(i)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {!distanceOnly && (
        <button onClick={addInterval} style={{ background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '7px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
          + Ajouter un intervalle
        </button>
      )}
    </div>
  )
}

function ProgramSessionsBlock({ prog, completions, completionFeedback, validating, exerciseLogs, athleteId, validate, unvalidate, saveExerciseLog, router, token, isCoachView, isCoach, trackedMovements, onSaveMetricResult, exerciseSets, onAddExerciseSet, onEnsureExerciseSets, onSaveExerciseSet, onDeleteExerciseSet, raceKnown, onSyncRaceMetric }) {
  const total = prog.sessions.length
  const done = prog.sessions.filter(s => completions.has(s.id)).length
  const allDone = done === total && total > 0
  const firstIncompleteIdx = prog.sessions.findIndex(s => !completions.has(s.id))

  const [selectedIdx, setSelectedIdx] = useState(firstIncompleteIdx !== -1 ? firstIncompleteIdx : 0)
  const [showValidated, setShowValidated] = useState(false)
  const [isOpen, setIsOpen] = useState(true)

  if (total === 0) return null
  const session = prog.sessions[selectedIdx]
  const isCompleted = completions.has(session.id)
  const validatedSessions = prog.sessions
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => completions.has(s.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* En-tête programme + barre de progression */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', flex: 1 }}>{prog.title}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: allDone ? '#166534' : 'var(--text3)' }}>
          {done}/{total}
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 2 }}>
        <div style={{ height: '100%', background: 'var(--green)', borderRadius: 10, width: `${total ? Math.round((done / total) * 100) : 0}%`, transition: 'width .4s' }} />
      </div>

      {/* Pager séance précédente / suivante */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => { setSelectedIdx(i => Math.max(0, i - 1)); setIsOpen(true) }}
          disabled={selectedIdx === 0}
          style={{ background: 'none', border: 'none', fontSize: 22, color: selectedIdx === 0 ? 'var(--border2)' : 'var(--text2)', cursor: selectedIdx === 0 ? 'default' : 'pointer', padding: '2px 6px', flexShrink: 0, lineHeight: 1 }}
        >‹</button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title || `Séance ${selectedIdx + 1}`}
          </div>
        </div>
        <button
          onClick={() => { setSelectedIdx(i => Math.min(total - 1, i + 1)); setIsOpen(true) }}
          disabled={selectedIdx === total - 1}
          style={{ background: 'none', border: 'none', fontSize: 22, color: selectedIdx === total - 1 ? 'var(--border2)' : 'var(--text2)', cursor: selectedIdx === total - 1 ? 'default' : 'pointer', padding: '2px 6px', flexShrink: 0, lineHeight: 1 }}
        >›</button>
        <button
          onClick={() => router.push(`/s/${token}?session=${session.id}&focus=1${isCoachView ? '&coach=1' : ''}`)}
          style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >▶ Lancer</button>
      </div>

      <SessionCard
        session={session}
        idx={selectedIdx}
        isOpen={isOpen}
        isCompleted={isCompleted}
        onToggle={() => setIsOpen(v => !v)}
        onValidate={(fb) => validate(session.id, prog.sessions, fb, { isUpdate: isCompleted })}
        onUnvalidate={isCompleted ? () => unvalidate(session.id, prog.sessions) : null}
        initialFeedback={completionFeedback[session.id]}
        validating={validating}
        exerciseLogs={exerciseLogs}
        onSaveLog={saveExerciseLog}
        athleteId={athleteId}
        activityType={prog.activity_type}
        trackedMovements={trackedMovements}
        onSaveMetricResult={onSaveMetricResult}
        exerciseSets={exerciseSets}
        onAddExerciseSet={onAddExerciseSet}
        onEnsureExerciseSets={onEnsureExerciseSets}
        onSaveExerciseSet={onSaveExerciseSet}
        onDeleteExerciseSet={onDeleteExerciseSet}
        isCoachView={isCoachView}
        isCoach={isCoach}
        raceKnown={raceKnown}
        onSyncRaceMetric={onSyncRaceMetric}
      />

      {/* Programme terminé */}
      {allDone && (
        <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 'var(--rl)', padding: '12px 14px', textAlign: 'center', color: '#166534', fontWeight: 700, fontSize: 14 }}>
          ✓ Programme terminé !
        </div>
      )}

      {/* Séances validées : liste repliable */}
      {validatedSessions.length > 0 && (
        <div>
          <button
            onClick={() => setShowValidated(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {showValidated ? '▲' : '▼'} Séances validées ({validatedSessions.length})
          </button>
          {showValidated && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
              {validatedSessions.map(({ s, i }) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedIdx(i); setShowValidated(false); setIsOpen(true) }}
                  style={{ background: 'none', border: 'none', color: i === selectedIdx ? 'var(--green)' : 'var(--text2)', fontWeight: i === selectedIdx ? 700 : 600, fontSize: 12, textAlign: 'left', cursor: 'pointer', padding: '3px 0' }}
                >
                  ✓ {s.title || `Séance ${i + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const ENDURANCE_TYPES = ['Natation 🏊', 'Running 🏃‍♀️', 'Cyclisme 🚴']

function SessionCard({ session, idx, isOpen, isCompleted, onToggle, onValidate, onUnvalidate, initialFeedback, validating, exerciseLogs = {}, onSaveLog, athleteId, activityType, trackedMovements = [], onSaveMetricResult, exerciseSets = {}, onAddExerciseSet, onEnsureExerciseSets, onSaveExerciseSet, onDeleteExerciseSet, isCoachView, isCoach, raceKnown = {}, onSyncRaceMetric, isFreeSession = false, onAddExercise, onToggleSuperset }) {
  const paceRefs = annotatePaceReferences(session.coach_notes, raceKnown)
  const [focusPicker, setFocusPicker] = useState(null) // exercise id being edited
  const [viewingFocus, setViewingFocus] = useState(null) // zones array being viewed
  const [focusOverrides, setFocusOverrides] = useState({})
  const [showTimer, setShowTimer] = useState(false)
  const provisionedSetsRef = useRef(new Set())

  const saveFocusMuscles = async (exerciseId, zones) => {
    const value = zones.length ? zones.join(',') : null
    await supabase.from('program_exercises').update({ focus_muscles: value }).eq('id', exerciseId)
    setFocusOverrides(prev => ({ ...prev, [exerciseId]: value }))
    setFocusPicker(null)
  }
  const exos = session.exercises.filter(e => e.name)
  const labels = computeLabels(session.exercises)
  const [savedIds, setSavedIds] = useState({})

  // À l'ouverture, pré-remplit une ligne de série par série prescrite par le coach
  // (ex. "3 séries" -> 3 lignes Reps/Charge), au lieu d'attendre que le sportif clique "+ Ajouter".
  useEffect(() => {
    if (!isOpen || !onEnsureExerciseSets) return
    exos.forEach(exo => {
      const wanted = parseInt(exo.sets, 10)
      if (!wanted || wanted < 1) return
      if (provisionedSetsRef.current.has(exo.id)) return
      provisionedSetsRef.current.add(exo.id)
      if ((exerciseSets[exo.id] || []).length === 0) onEnsureExerciseSets(exo.id, wanted)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleValidateExercise = (exo) => {
    const setsEl = document.getElementById(`log-sets-${exo.id}`)
    const repsEl = document.getElementById(`log-reps-${exo.id}`)
    const kgEl = document.getElementById(`log-kg-${exo.id}`)
    const noteEl = document.getElementById(`log-note-${exo.id}`)
    if (setsEl) onSaveLog(exo.id, exo.name, 'sets_done', setsEl.value)
    if (repsEl) onSaveLog(exo.id, exo.name, 'reps_done', repsEl.value)
    if (kgEl) onSaveLog(exo.id, exo.name, 'kg_done', kgEl.value)
    if (noteEl) onSaveLog(exo.id, exo.name, 'note', noteEl.value)
    ;(exerciseSets[exo.id] || []).forEach(s => {
      const repsSetEl = document.getElementById(`log-set-reps-${s.id}`)
      const kgSetEl = document.getElementById(`log-set-kg-${s.id}`)
      if (repsSetEl) onSaveExerciseSet(exo.id, s.id, 'reps_done', repsSetEl.value)
      if (kgSetEl) onSaveExerciseSet(exo.id, s.id, 'kg_done', kgSetEl.value)
    })
    setSavedIds(p => ({ ...p, [exo.id]: true }))
  }

  return (
    <div style={{ background: 'var(--bg)', border: `1.5px solid ${isOpen ? (isCompleted ? 'var(--border2)' : 'var(--green)') : 'var(--border)'}`, borderRadius: 'var(--rl)', overflow: 'hidden', opacity: isCompleted ? 0.85 : 1 }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: isCompleted ? '#DCFCE7' : (isOpen ? 'var(--green)' : 'var(--green-light)'),
          color: isCompleted ? '#166534' : (isOpen ? '#fff' : 'var(--green)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800
        }}>
          {isCompleted ? '✓' : idx + 1}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {session.locked && <span>🔒</span>}
            {session.title || `Séance ${idx + 1}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {session.locked ? 'Réservé aux abonnés' : `${exos.length} exercice${exos.length !== 1 ? 's' : ''}${isCompleted ? ' · déjà validée' : ''}`}
          </div>
        </div>
        {isOpen && !isCompleted && !session.locked && onValidate && (
          <button onClick={e => { e.stopPropagation(); onValidate() }} disabled={validating}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            ✓ Validé
          </button>
        )}
        <span style={{ fontSize: 18, color: 'var(--text3)' }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && session.locked && (
        <div style={{ padding: '20px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 32 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Cette séance fait partie d&apos;une formule payante</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 320 }}>
            L&apos;accès gratuit couvre les premières séances du programme. Passe à une formule payante pour continuer.
          </div>
        </div>
      )}

      {isOpen && !session.locked && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(session.activation || (session.activation_videos?.length > 0)) && (
            <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>⚡ Activation</div>
              {session.activation && (
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: session.activation_videos?.length > 0 ? 8 : 0 }}>{session.activation}</div>
              )}
              {session.activation_videos?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {session.activation_videos.map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1, color: 'var(--text)' }}>{v.name}</span>
                      {v.video_url && (
                        <VideoButton url={v.video_url} label="▶ Voir"
                          style={{ background: 'var(--green)', color: '#fff', borderRadius: 'var(--r)', padding: '4px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0 }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {session.coach_notes && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.6, borderLeft: '3px solid var(--green)' }}>
              {session.coach_notes}
            </div>
          )}
          {paceRefs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {paceRefs.map((r, i) => (
                <div key={i} style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 20, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{r.raw}</span>
                  <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 800 }}>
                    {r.pace.lowKmh.toFixed(1) === r.pace.highKmh.toFixed(1)
                      ? `${formatPace(r.pace.lowKmh)}/km`
                      : `${formatPace(r.pace.highKmh)}–${formatPace(r.pace.lowKmh)}/km`}
                  </span>
                </div>
              ))}
            </div>
          )}
          {(session.circuits || []).map(c => (
            <div key={c.id} style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>🔁 Circuit</div>
              {c.text && (
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: c.videos?.length > 0 ? 8 : 0 }}>{c.text}</div>
              )}
              {c.videos?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.videos.map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1, color: 'var(--text)' }}>{v.name}</span>
                      {v.video_url && (
                        <VideoButton url={v.video_url} label="▶ Voir"
                          style={{ background: '#4338CA', color: '#fff', borderRadius: 'var(--r)', padding: '4px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0 }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {exos.map((exo, ei) => (
            <div key={exo.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (exo.sets || exo.reps || exo.kg || exo.note) ? 8 : 0 }}>
                <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, padding: '0 4px', flexShrink: 0 }}>
                  {labels[exo.id] || String.fromCharCode(65 + ei)}
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{exo.name}</span>
                <TipsButton />
                <ExerciseHistoryButton athleteId={athleteId} exerciseName={exo.name} />
                {exo.video_url && (
                  <VideoButton url={exo.video_url} label="▶"
                    style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, fontWeight: 700, flexShrink: 0 }} />
                )}
                <button onClick={() => setShowTimer(true)}
                  style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}>
                  ⏱
                </button>
              </div>

              {(() => {
                const focusValue = focusOverrides[exo.id] !== undefined ? focusOverrides[exo.id] : exo.focus_muscles
                const manualZones = focusValue ? focusValue.split(',').filter(Boolean) : []
                const isAuto = manualZones.length === 0
                const zones = isAuto ? parseMusclesFromText(exo.movement_muscles || '') : manualZones
                if (zones.length === 0 && !isCoach) return null
                return (
                  <div style={{ marginBottom: 8 }}>
                    {zones.length > 0 ? (
                      <button onClick={() => setViewingFocus(zones)} style={{
                        background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 20,
                        padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        🎯 FOCUS · {MUSCLE_GROUPS.filter(z => zones.includes(z.key)).map(z => z.label).join(', ')}
                        {isAuto && <span style={{ fontWeight: 500, opacity: 0.75 }}>(auto)</span>}
                        {isCoach && (
                          <span onClick={e => { e.stopPropagation(); setFocusPicker(exo.id) }} style={{ marginLeft: 2 }}>✏️</span>
                        )}
                      </button>
                    ) : (
                      <button onClick={() => setFocusPicker(exo.id)} style={{
                        background: 'none', border: '1px dashed var(--border2)', borderRadius: 20,
                        padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)',
                      }}>
                        + FOCUS
                      </button>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const flow = getSupersetFlow(exos, ei, labels)
                return flow ? (
                  <div style={{ fontSize: 11, color: '#6366f1', background: '#EEF2FF', borderRadius: 6, padding: '4px 10px', marginBottom: 6, fontWeight: 700, letterSpacing: '0.2px' }}>
                    {flow}
                  </div>
                ) : null
              })()}
              {isRunMovement(exo.name) && (exo.pace_base || exo.pct_low != null || exo.pct_high != null) && (() => {
                const pace1 = computePaceForBasePct(exo.pace_base, exo.pct_low, raceKnown)
                const pace2 = computePaceForBasePct(exo.pace_base, exo.pct_high, raceKnown)
                const baseLabel = PACE_BASES.find(b => b.key === exo.pace_base)?.label || exo.pace_base
                return (
                  <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '8px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
                      {baseLabel} {exo.pct_low}{exo.pct_high != null && exo.pct_high !== exo.pct_low ? `-${exo.pct_high}` : ''}%
                    </span>
                    {pace1 || pace2 ? (
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>
                        {pace1 && pace2 && pace1.toFixed(1) !== pace2.toFixed(1)
                          ? `${formatPace(pace2)}–${formatPace(pace1)}/km`
                          : `${formatPace(pace1 || pace2)}/km`}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Tests VMA/Seuil requis</span>
                    )}
                  </div>
                )
              })()}
              {isRunMovement(exo.name) ? (
                (exo.sets || exo.rest) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: exo.note ? 6 : 0 }}>
                    {exo.sets && <Pill value={exo.sets} label="action" />}
                    {exo.rest && <Pill value={exo.rest} label={exo.sets ? 'repos' : 'temps de séance'} color="#EFF6FF" textColor="#1D4ED8" />}
                  </div>
                )
              ) : (exo.sets || exo.reps || exo.kg || exo.rest) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: exo.note ? 6 : 0 }}>
                  {exo.sets && <Pill value={exo.sets} label="séries" />}
                  {exo.reps && <Pill value={exo.reps} label="reps" />}
                  {exo.kg && <Pill value={`${exo.kg} kg`} />}
                  {exo.rest && <Pill value={exo.rest} label="récup" color="#EFF6FF" textColor="#1D4ED8" />}
                </div>
              )}
              {exo.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>{exo.note}</div>}

              {/* Log client */}
              {onSaveLog && isRunMovement(exo.name) && (
                <RunResultLogger key={exo.id} exo={exo} exerciseLogs={exerciseLogs} onSaveLog={onSaveLog} onSyncRaceMetric={onSyncRaceMetric} />
              )}
              {onSaveLog && !isRunMovement(exo.name) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ma séance</div>
                  {onAddExerciseSet && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(exerciseSets[exo.id] || []).map((s, sIdx) => {
                        const prev = sIdx > 0 ? (exerciseSets[exo.id] || [])[sIdx - 1] : null
                        const copyPrevious = () => {
                          if (!prev) return
                          const repsEl = document.getElementById(`log-set-reps-${s.id}`)
                          const kgEl = document.getElementById(`log-set-kg-${s.id}`)
                          const prevReps = document.getElementById(`log-set-reps-${prev.id}`)?.value ?? (prev.reps_done || '')
                          const prevKg = document.getElementById(`log-set-kg-${prev.id}`)?.value ?? (prev.kg_done ?? '')
                          if (repsEl) repsEl.value = prevReps
                          if (kgEl) kgEl.value = prevKg
                          onSaveExerciseSet(exo.id, s.id, 'reps_done', prevReps)
                          onSaveExerciseSet(exo.id, s.id, 'kg_done', prevKg)
                          setSavedIds(p => ({ ...p, [exo.id]: false }))
                        }
                        return (
                        <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', width: 56, flexShrink: 0, paddingBottom: 8 }}>
                            Série {s.set_index}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Reps</div>
                            <input id={`log-set-reps-${s.id}`} type="text" placeholder={exo.reps || ''} defaultValue={s.reps_done || ''}
                              onChange={() => setSavedIds(p => ({ ...p, [exo.id]: false }))}
                              onBlur={e => onSaveExerciseSet(exo.id, s.id, 'reps_done', e.target.value)}
                              style={logInputStyle} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Charge (kg)</div>
                            <input id={`log-set-kg-${s.id}`} type="text" placeholder={exo.kg ? `${exo.kg} kg` : ''} defaultValue={s.kg_done ?? ''}
                              onChange={() => setSavedIds(p => ({ ...p, [exo.id]: false }))}
                              onBlur={e => onSaveExerciseSet(exo.id, s.id, 'kg_done', e.target.value)}
                              style={logInputStyle} />
                          </div>
                          {prev && (
                            <button type="button" onClick={copyPrevious} title="Copier la série précédente"
                              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--text3)', cursor: 'pointer', padding: '8px 9px', flexShrink: 0 }}>⧉</button>
                          )}
                          <button onClick={() => onDeleteExerciseSet(exo.id, s.id)}
                            style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--text3)', cursor: 'pointer', padding: '0 2px 8px' }}>×</button>
                        </div>
                        )
                      })}
                      <button onClick={() => onAddExerciseSet(exo.id)}
                        style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer' }}>
                        + Ajouter une série
                      </button>
                    </div>
                  )}
                  {(() => {
                    const match = trackedMovements.find(m =>
                      m.name.trim().toLowerCase() === exo.name.trim().toLowerCase() && m.unit && m.unit !== 'kg'
                    )
                    if (!match || !onSaveMetricResult) return null
                    return <MetricResultField movement={match} onSave={val => onSaveMetricResult(match, val)} />
                  })()}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Note</div>
                    <textarea id={`log-note-${exo.id}`} placeholder="Comment c'était ?"
                      defaultValue={exerciseLogs[exo.id]?.note || ''}
                      onChange={() => setSavedIds(p => ({ ...p, [exo.id]: false }))}
                      onBlur={e => onSaveLog(exo.id, exo.name, 'note', e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                  <button onClick={() => handleValidateExercise(exo)} style={{
                    background: savedIds[exo.id] ? '#DCFCE7' : 'var(--green)',
                    color: savedIds[exo.id] ? '#166534' : '#fff',
                    border: 'none', borderRadius: 20, padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%',
                    transition: 'all .15s',
                  }}>
                    {savedIds[exo.id] ? '✓ Enregistré' : '✓ Valider cet exercice'}
                  </button>
                </div>
              )}
            </div>
          ))}

          {isFreeSession && (
            <FreeExerciseAdder sessionId={session.id} exos={exos} onAdd={onAddExercise} onToggleSuperset={onToggleSuperset} />
          )}

          {onValidate && session.session_type === 'explication' && (
            <button
              onClick={() => onValidate({})}
              disabled={validating}
              style={{
                marginTop: 8, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
                padding: '15px', fontSize: 15, fontWeight: 700, cursor: validating ? 'default' : 'pointer', width: '100%',
              }}
            >
              {validating ? (isCompleted ? 'Mise à jour…' : 'Validation…') : (isCompleted ? '✓ Mettre à jour' : '✓ Valider la séance')}
            </button>
          )}
          {onValidate && session.session_type !== 'explication' && (
            <SessionFeedback onValidate={onValidate} validating={validating} isUpdate={isCompleted} initial={initialFeedback} isEndurance={ENDURANCE_TYPES.includes(activityType)} />
          )}
          {isCompleted && onUnvalidate && (
            <button onClick={onUnvalidate} disabled={validating}
              style={{ background: 'var(--bg2)', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 'var(--rl)', padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 4 }}>
              {validating ? '…' : '↩ Annuler la validation'}
            </button>
          )}
        </div>
      )}

      {focusPicker && (
        <FocusPicker
          initial={(() => {
            const exo = session.exercises.find(e => e.id === focusPicker)
            const val = focusOverrides[focusPicker] !== undefined ? focusOverrides[focusPicker] : exo?.focus_muscles
            return val ? val.split(',').filter(Boolean) : []
          })()}
          onCancel={() => setFocusPicker(null)}
          onSave={zones => saveFocusMuscles(focusPicker, zones)}
        />
      )}

      {viewingFocus && (
        <FocusBodyDiagram groups={viewingFocus} onClose={() => setViewingFocus(null)} />
      )}

      {showTimer && <TimerModal onClose={() => setShowTimer(false)} />}
    </div>
  )
}

function FocusPicker({ initial, onCancel, onSave }) {
  const [selected, setSelected] = useState(initial)

  const toggle = (key) => setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 20, padding: 20, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '90svh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🎯 Focus</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Choisis le ou les muscles à ressentir</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {MUSCLE_GROUPS.map(g => (
            <button key={g.key} onClick={() => toggle(g.key)} style={{
              background: selected.includes(g.key) ? '#FEF2F2' : 'var(--bg2)',
              border: `1px solid ${selected.includes(g.key) ? '#FCA5A5' : 'var(--border2)'}`,
              color: selected.includes(g.key) ? '#B91C1C' : 'var(--text2)',
              borderRadius: 20, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {g.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => onSave(selected)} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

function RatingRow({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
            style={{
              flex: 1, padding: '9px 0', border: '1px solid',
              borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              borderColor: value === n ? 'transparent' : 'var(--border2)',
              background: value === n ? (n >= 8 ? '#ef4444' : n >= 5 ? '#f59e0b' : '#22c55e') : 'var(--bg2)',
              color: value === n ? '#fff' : 'var(--text2)',
            }}
          >{n}</button>
        ))}
      </div>
    </div>
  )
}

function SessionFeedback({ onValidate, validating, isUpdate = false, initial = null, isEndurance = false }) {
  const [pleasure, setPleasure] = useState(initial?.pleasure ?? null)
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? null)
  const [duration, setDuration] = useState(initial?.duration_minutes ?? null)
  const [distanceKm, setDistanceKm] = useState(initial?.distance_km != null ? String(initial.distance_km) : '')
  const [comment, setComment] = useState(initial?.comment || '')

  const canSubmit = pleasure !== null && difficulty !== null

  return (
    <div style={{ marginTop: 8, background: 'var(--bg2)', borderRadius: 'var(--rl)', border: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Bilan de séance</div>

      {isEndurance && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Distance (km)</div>
          <input
            type="number" min="0" step="0.1" placeholder="ex: 10"
            value={distanceKm}
            onChange={e => setDistanceKm(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 15, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          />
        </div>
      )}

      <RatingRow label="Plaisir" value={pleasure} onChange={setPleasure} />
      <RatingRow label="Difficulté de la séance" value={difficulty} onChange={setDifficulty} />

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Commentaire (optionnel)</div>
        <textarea
          value={comment} onChange={e => setComment(e.target.value)} rows={2}
          placeholder="Comment s'est passée la séance ?"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Durée</div>
        <DurationHMSInput
          initialMinutes={duration}
          onSave={setDuration}
          inputStyle={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 15, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
        />
      </div>

      <button
        onClick={() => onValidate({
          pleasure, difficulty,
          duration_minutes: duration || null,
          comment: comment.trim() || null,
          ...(isEndurance ? { distance_km: distanceKm ? parseFloat(distanceKm) : null } : {}),
        })}
        disabled={validating || !canSubmit}
        style={{
          background: canSubmit ? 'var(--green)' : 'var(--border2)',
          color: '#fff', border: 'none', borderRadius: 'var(--rl)',
          padding: '15px', fontSize: 15, fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'default', width: '100%',
        }}
      >
        {validating ? (isUpdate ? 'Mise à jour…' : 'Validation…') : canSubmit ? (isUpdate ? '✓ Mettre à jour' : '✓ Valider la séance') : 'Note le plaisir et la difficulté'}
      </button>
    </div>
  )
}

function Pill({ value, label, color, textColor }) {
  return (
    <div style={{ background: color || 'var(--green-light)', color: textColor || 'var(--green)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>
      {value}{label ? ` ${label}` : ''}
    </div>
  )
}

function TipsButton() {
  const [open, setOpen] = useState(false)
  const [tips, setTips] = useState(null)
  const [selected, setSelected] = useState(null)

  const openModal = async (e) => {
    e.stopPropagation()
    setOpen(true)
    setSelected(null)
    const [{ data }, { data: hidden }] = await Promise.all([
      supabase.from('tips').select('*').order('order_index'),
      supabase.from('coach_hidden_content').select('content_id').eq('content_type', 'tip'),
    ])
    const hiddenIds = new Set((hidden || []).map(h => h.content_id))
    setTips((data || []).filter(t => !hiddenIds.has(t.id)))
  }

  return (
    <>
      <button onClick={openModal} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        💡
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', borderRadius: 'var(--rl)', width: '100%', maxWidth: 480,
            maxHeight: '75vh', overflowY: 'auto', padding: 18
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              {selected && (
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>←</button>
              )}
              <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>💡 {selected ? selected.title : 'Tips'}</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>×</button>
            </div>

            {!tips ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chargement…</div>
            ) : selected ? (
              <div>
                {(selected.content || !selected.diagram) && (
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: selected.diagram ? 14 : 0 }}>
                    {selected.content || 'Pas encore d\'explication pour ce tip.'}
                  </div>
                )}
                {selected.diagram === 'muscle_anatomy' && <MuscleAnatomyDiagram />}
              </div>
            ) : tips.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Aucun tip pour le moment.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tips.map(t => (
                  <button key={t.id} onClick={() => setSelected(t)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
                    padding: '12px 14px', fontSize: 14, fontWeight: 700, color: 'var(--text)', cursor: 'pointer'
                  }}>
                    <span style={{ flex: 1 }}>{t.title}</span>
                    <span style={{ color: 'var(--text3)' }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function extractYouTubeId(url) {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function VideoButton({ url, label, style }) {
  const [open, setOpen] = useState(false)
  const videoId = extractYouTubeId(url)

  if (!videoId) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', ...style }}>{label}</a>
    )
  }

  const isVertical = url.includes('/shorts/')

  return (
    <>
      <button onClick={e => { e.stopPropagation(); setOpen(true) }} style={{ border: 'none', cursor: 'pointer', ...style }}>
        {label}
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: isVertical ? 340 : 560, background: '#000',
            borderRadius: 'var(--rl)', overflow: 'hidden', position: 'relative',
          }}>
            <button onClick={() => setOpen(false)} style={{
              position: 'absolute', top: 8, right: 8, zIndex: 2, background: 'rgba(0,0,0,.6)',
              color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32,
              fontSize: 18, cursor: 'pointer', lineHeight: 1,
            }}>×</button>
            <div style={{ position: 'relative', paddingTop: isVertical ? '177.78%' : '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MetricResultField({ movement, onSave }) {
  const isTime = movement.unit === 'time'
  const cfg = unitOf(movement)
  const [h, setH] = useState('')
  const [m, setM] = useState('')
  const [s, setS] = useState('')
  const [val, setVal] = useState('')
  const [saved, setSaved] = useState(false)

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const submitTime = () => {
    const total = (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0)
    if (!total) return
    onSave(total)
    flash()
  }

  const submitValue = () => {
    if (!val) return
    onSave(parseFloat(val))
    flash()
  }

  return (
    <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>📊 Résultat ({cfg.label})</span>
        {saved && <span>✓ Enregistré</span>}
      </div>
      {isTime ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" min="0" placeholder="h" value={h} onChange={e => setH(e.target.value)} onBlur={submitTime} style={logInputStyle} />
          <input type="number" min="0" placeholder="min" value={m} onChange={e => setM(e.target.value)} onBlur={submitTime} style={logInputStyle} />
          <input type="number" min="0" placeholder="sec" value={s} onChange={e => setS(e.target.value)} onBlur={submitTime} style={logInputStyle} />
        </div>
      ) : (
        <input type="number" step="0.1" min="0" placeholder={`ex: 10 ${cfg.suffix}`} value={val} onChange={e => setVal(e.target.value)} onBlur={submitValue} style={logInputStyle} />
      )}
    </div>
  )
}

function ExerciseHistoryButton({ athleteId, exerciseName }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState(null)

  const openModal = async (e) => {
    e.stopPropagation()
    setOpen(true)
    setEntries(null)
    const { data } = await supabase.from('exercise_performance_history')
      .select('kg_done, reps_done, sets_done, note, logged_at, program_exercises(name)')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
    setEntries((data || []).filter(l => l.program_exercises?.name === exerciseName))
  }

  return (
    <>
      <button onClick={openModal} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        📈
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', borderRadius: 'var(--rl)', width: '100%', maxWidth: 480,
            maxHeight: '75vh', overflowY: 'auto', padding: 18
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>📈 {exerciseName}</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>×</button>
            </div>

            {entries === null ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chargement…</div>
            ) : entries.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Aucune charge enregistrée pour cet exercice.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(() => {
                  // Une seule carte par jour : garde la plus récente (entries déjà triées desc, valeurs déjà cumulées)
                  const seenDays = new Set()
                  const perDay = entries.filter(e => {
                    const day = e.logged_at.slice(0, 10)
                    if (seenDays.has(day)) return false
                    seenDays.add(day)
                    return true
                  })
                  return perDay
                })().map((e, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 90, flexShrink: 0 }}>
                        {new Date(e.logged_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {e.kg_done != null && `${e.kg_done} kg`}
                        {(e.sets_done || e.reps_done) && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginLeft: e.kg_done != null ? 8 : 0 }}>
                            {[e.sets_done && `${e.sets_done} séries`, e.reps_done].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {e.note && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', paddingLeft: 100 }}>« {e.note} »</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// Ajout d'exercices en direct dans une séance libre : nom (bibliothèque ou texte libre, non
// sauvegardé dans la bibliothèque si inexistant), puis choix explicite entre un objectif à faire
// plus tard (séries/reps/charge cibles) ou une saisie en direct (séries réelles juste en dessous,
// via l'UI standard "+ Ajouter une série"). Supersérie possible avec l'exercice précédent.
function FreeExerciseAdder({ sessionId, exos, onAdd, onToggleSuperset }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState('live') // 'live' | 'later'
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [kg, setKg] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [togglingSuperset, setTogglingSuperset] = useState(false)

  const searchMovements = async (val) => {
    if (val.trim().length < 2) { setSuggestions([]); return }
    const { data } = await supabase.from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions((data || []).map(m => m.name))
  }

  const reset = () => { setName(''); setMode('live'); setSets(''); setReps(''); setKg(''); setSuggestions([]); setOpen(false) }

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onAdd(sessionId, mode === 'later' ? { name, sets, reps, kg } : { name })
    setSaving(false)
    reset()
  }

  const last = exos[exos.length - 1]
  const prevLast = exos[exos.length - 2]
  const lastPairGrouped = last && prevLast && last.superset_group && last.superset_group === prevLast.superset_group

  const toggleSuperset = async () => {
    setTogglingSuperset(true)
    await onToggleSuperset(sessionId, prevLast, last)
    setTogglingSuperset(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {exos.length >= 2 && (
        <button onClick={toggleSuperset} disabled={togglingSuperset} style={{
          alignSelf: 'flex-start', background: lastPairGrouped ? '#EEF2FF' : 'none', color: '#6366f1',
          border: '1px solid #C7D2FE', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          {togglingSuperset ? '…' : lastPairGrouped ? '✕ Retirer la supersérie' : '🔗 Supersérie avec le précédent'}
        </button>
      )}

      {!open ? (
        <button onClick={() => setOpen(true)} style={{ background: 'none', border: '2px dashed var(--border2)', borderRadius: 'var(--r)', padding: 10, fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
          + Ajouter un exercice
        </button>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Nom du mouvement"
              value={name}
              autoFocus
              onChange={e => { setName(e.target.value); searchMovements(e.target.value) }}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 600, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                {suggestions.map((sug, si) => (
                  <button key={si} onMouseDown={() => { setName(sug); setSuggestions([]) }}
                    style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: si < suggestions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setMode('live')} style={{
              flex: 1, background: mode === 'live' ? 'var(--green)' : 'var(--bg)', color: mode === 'live' ? '#fff' : 'var(--text2)',
              border: '1px solid ' + (mode === 'live' ? 'var(--green)' : 'var(--border2)'), borderRadius: 20, padding: '7px 4px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              🔴 En direct
            </button>
            <button onClick={() => setMode('later')} style={{
              flex: 1, background: mode === 'later' ? 'var(--green)' : 'var(--bg)', color: mode === 'later' ? '#fff' : 'var(--text2)',
              border: '1px solid ' + (mode === 'later' ? 'var(--green)' : 'var(--border2)'), borderRadius: 20, padding: '7px 4px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              🕓 Objectif, plus tard
            </button>
          </div>

          {mode === 'live' ? (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Les séries (reps + charge) s&apos;ajoutent juste en dessous une fois l&apos;exercice créé.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder="Séries" value={sets} onChange={e => setSets(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
              <input placeholder="Reps" value={reps} onChange={e => setReps(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
              <input placeholder="Kg" value={kg} onChange={e => setKg(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={reset} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={add} disabled={!name.trim() || saving} style={{
              flex: 1, background: name.trim() ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none',
              borderRadius: 20, padding: '9px', fontSize: 13, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default',
            }}>
              {saving ? '…' : '+ Ajouter'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
