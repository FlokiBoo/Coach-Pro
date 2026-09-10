'use client'

// Éditeur de séance "blocks", branché sur les vraies données (program_sessions/program_exercises/
// movements/circuits) — prototypé dans app/preview-session/page.js. Partagé entre le coach
// (app/programs/[athleteId]/[programId]/session/[sessionId]/page.js) et l'athlète
// (app/s/[token]/session/[sessionId]/page.js, "Séance libre" → mode Standard/Cardio) : les deux
// wrappers ne font que fournir `sessionId` et `backHref`, RLS fait le reste (un athlète ne peut
// lire/écrire que ses propres program_sessions/program_exercises, voir supabase_schema policies).
// Périmètre volontairement réduit (pas de reps/kg par set, pas des types de séance avancés —
// ceux-ci restent gérés par l'ancien éditeur plein écran côté coach).

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setUnsavedChanges, hasUnsavedChanges } from '@/lib/unsavedChanges'
import { MUSCLE_GROUPS as REAL_MUSCLE_GROUPS } from '@/app/components/MuscleAnatomyDiagram'
import { isCardioMovementName, cardioMovementSortKey, PACE_BASES } from '@/lib/raceEstimates'
import {
  X, TextB, TextItalic, LinkSimple, ListBullets, TextTSlash,
  CaretLeft, CaretRight, ArrowsDownUp, Plus, FileText, Flame, Snowflake, Barbell,
  DotsThreeVertical, PencilSimple, Info, MagnifyingGlass, Check, Timer, DotsSixVertical,
  ArrowsClockwise, Heartbeat,
} from '@phosphor-icons/react'
import { SortableGroup, SortableItem } from '@/app/components/SortableItem'

const BLOCK_META = {
  warmup: {
    title: 'WARMUP', badgeLabel: 'WARM UP', icon: Flame,
    namePlaceholder: 'Enter a name (e.g. upper body warm-up)',
    descriptionPlaceholder: 'Write the detailed description of the warm-up part',
  },
  cooldown: {
    title: 'COOLDOWN', badgeLabel: 'COOL DOWN', icon: Snowflake,
    namePlaceholder: 'Enter a name (e.g. upper body stretch)',
    descriptionPlaceholder: 'Write the detailed description of the cool-down / stretching part',
  },
  exercise: {
    title: 'EXERCISE', badgeLabel: 'EXERCISE', icon: Barbell,
    namePlaceholder: 'Enter a name (e.g. push day)',
    descriptionPlaceholder: 'Write the detailed description of this exercise block',
  },
  circuit: {
    title: 'CIRCUIT', badgeLabel: 'CIRCUIT', icon: ArrowsClockwise,
    namePlaceholder: 'Enter a name (e.g. push day)',
    descriptionPlaceholder: 'Write the detailed description of this exercise block',
  },
}

const REST_PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '45s', seconds: 45 },
  { label: '1min', seconds: 60 },
  { label: '1min30', seconds: 90 },
  { label: '2min', seconds: 120 },
  { label: '3min', seconds: 180 },
  { label: '4min', seconds: 240 },
  { label: '5min', seconds: 300 },
]

const formatRestLabel = (seconds) => {
  const preset = REST_PRESETS.find(p => p.seconds === seconds)
  if (preset) return preset.label
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return s === 0 ? `${m}min` : `${m}min${s}`
}

// Le champ `rest` existant en base est du texte libre saisi par le coach depuis des années
// ("90s", "1min30", "2min"...) — parsing best-effort, avec 60s de repli si le format n'est pas
// reconnu (jamais d'erreur bloquante pour autant, juste une valeur par défaut).
function parseRestToSeconds(rest) {
  if (!rest) return 60
  const str = String(rest).trim().toLowerCase()
  const minSec = str.match(/^(\d+)\s*min\s*(\d+)?/)
  if (minSec) return parseInt(minSec[1], 10) * 60 + (parseInt(minSec[2], 10) || 0)
  const secOnly = str.match(/^(\d+)\s*s(ec)?\b/)
  if (secOnly) return parseInt(secOnly[1], 10)
  const num = parseFloat(str)
  return Number.isFinite(num) ? Math.round(num) : 60
}

function RestDivider({ seconds }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px', color: c.textMuted, fontSize: 13, fontWeight: 700 }}>
      <Timer size={16} />
      <span>REST</span>
      <span style={{ marginLeft: 'auto', background: c.disabledBg, borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, color: c.text }}>
        {formatRestLabel(seconds)}
      </span>
    </div>
  )
}

// --- Traduction DB -> blocks (lecture) --------------------------------------------------------

// Groupe les program_exercises consécutifs partageant le même superset_group (et block_type) en
// un seul bloc multi-exercices ; chaque ligne sans superset_group devient son propre bloc à 1
// exercice. Même logique de regroupement que la carte superset de l'ancien éditeur.
function groupExercisesIntoBlocks(rows) {
  const groups = []
  rows.forEach(row => {
    const last = groups[groups.length - 1]
    if (last && last.block_type === row.block_type && row.superset_group && last.superset_group === row.superset_group) {
      last.rows.push(row)
    } else {
      groups.push({ block_type: row.block_type, superset_group: row.superset_group, rows: [row] })
    }
  })
  return groups.map(g => {
    const firstId = g.rows[0].id
    const setCount = Math.max(1, parseInt(g.rows[0].sets, 10) || 1)
    const sets = Array.from({ length: setCount }, (_, i) => ({ id: `set-${firstId}-${i}` }))
    const setNotes = {}
    const paceValues = {}
    // La granularité par set est perdue côté ancien schéma (un seul `note` par exercice) : on la
    // réattache au premier set de chaque exercice (grille standard) ET sous une clé "note:<ex>"
    // dédiée (vue cardio, pas de grille de sets) pour ne pas la perdre silencieusement.
    g.rows.forEach(r => {
      const exId = `ex-${r.id}`
      if (r.note) {
        setNotes[`${sets[0].id}:${exId}`] = r.note
        setNotes[`note:${exId}`] = r.note
      }
      if (r.pace_base || r.pct_low != null || r.pct_high != null) {
        paceValues[exId] = { base: r.pace_base || '', pctLow: r.pct_low ?? '', pctHigh: r.pct_high ?? '' }
      }
    })
    return {
      id: `block-${firstId}`,
      type: g.block_type,
      name: '', description: '', note: '',
      exercises: g.rows.map(r => ({ id: `ex-${r.id}`, name: r.name, muscles: '' })),
      sets,
      restSeconds: parseRestToSeconds(g.rows[0].rest),
      setNotes,
      paceValues,
    }
  })
}

function toCircuitBlock(circuit) {
  return {
    id: `circuit-${circuit.id}`,
    dbCircuitId: circuit.id,
    type: 'circuit',
    name: circuit.name || '', description: '', note: '',
    exercises: [], sets: [], restSeconds: 60,
    circuitNote: circuit.text || '',
  }
}

// Réinsère les circuits (stockés à part dans program_sessions.circuits, positionnés par
// afterExerciseIndex sur la liste APLATIE des program_exercises) dans le tableau `blocks` déjà
// groupé — à la position du bloc juste après l'exercice visé.
function insertCircuits(exerciseBlocks, circuits) {
  if (!circuits?.length) return exerciseBlocks
  const boundaries = []
  let total = 0
  exerciseBlocks.forEach(b => { total += b.exercises.length; boundaries.push(total) })

  const byInsertIndex = new Map()
  circuits.forEach(circuit => {
    const after = circuit.afterExerciseIndex ?? 0
    let insertIndex = boundaries.findIndex(b => after <= b)
    insertIndex = insertIndex === -1 ? exerciseBlocks.length : insertIndex + 1
    if (after <= 0) insertIndex = 0
    byInsertIndex.set(insertIndex, [...(byInsertIndex.get(insertIndex) || []), toCircuitBlock(circuit)])
  })

  const result = [...(byInsertIndex.get(0) || [])]
  exerciseBlocks.forEach((b, i) => {
    result.push(b)
    const at = i + 1
    if (byInsertIndex.has(at)) result.push(...byInsertIndex.get(at))
  })
  return result
}

function buildBlocksFromDb(exerciseRows, circuits) {
  return insertCircuits(groupExercisesIntoBlocks(exerciseRows), circuits || [])
}

// --- Traduction blocks -> DB (écriture) -------------------------------------------------------

function flattenBlocksToExerciseRows(blocks, activityMode) {
  const rows = []
  const isCardio = activityMode === 'cardio'
  blocks.forEach(block => {
    if (block.type === 'circuit' || !block.exercises?.length) return
    const supersetToken = block.exercises.length > 1 ? Math.random().toString(36).slice(2, 8) : null
    block.exercises.forEach(ex => {
      if (isCardio) {
        // Pas de grille de sets en mode cardio (allure réglée en % VMA/Seuil/Δ, pas en séries) —
        // une seule note et un seul couple base/%low-%high par exercice, voir updatePaceValue.
        const pace = block.paceValues?.[ex.id] || {}
        rows.push({
          block_type: block.type,
          name: ex.name,
          sets: null,
          rest: null,
          note: block.setNotes?.[`note:${ex.id}`] || null,
          superset_group: supersetToken,
          pace_base: pace.base || null,
          pct_low: pace.pctLow !== '' && pace.pctLow != null ? parseFloat(pace.pctLow) : null,
          pct_high: pace.pctHigh !== '' && pace.pctHigh != null ? parseFloat(pace.pctHigh) : null,
        })
      } else {
        const notes = (block.sets || [])
          .map(s => block.setNotes?.[`${s.id}:${ex.id}`])
          .filter(Boolean)
        rows.push({
          block_type: block.type,
          name: ex.name,
          sets: block.sets?.length || 1,
          rest: formatRestLabel(block.restSeconds ?? 60),
          note: notes.length ? notes.join(' / ') : null,
          superset_group: supersetToken,
          pace_base: null,
          pct_low: null,
          pct_high: null,
        })
      }
    })
  })
  return rows
}

function flattenBlocksToCircuits(blocks) {
  const circuits = []
  let cursor = 0
  blocks.forEach(block => {
    if (block.type === 'circuit') {
      circuits.push({
        id: block.dbCircuitId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: block.name || '',
        text: block.circuitNote || '',
        videos: [],
        afterExerciseIndex: cursor,
      })
    } else {
      cursor += block.exercises?.length || 0
    }
  })
  return circuits
}

const c = {
  bg: '#FFFFFF',
  border: '#E3E4E8',
  borderDashed: '#C9CBD3',
  text: '#16181D',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  blue: '#3E63DD',
  blueBorder: '#B9C4F5',
  disabled: '#9CA3AF',
  disabledBg: '#F4F4F5',
}

const label = { fontSize: 13, color: c.text, marginBottom: 6, display: 'block' }
const input = {
  boxSizing: 'border-box', width: '100%', padding: '9px 12px', border: `1px solid ${c.border}`,
  borderRadius: 6, fontSize: 14, color: c.text, outline: 'none', background: c.bg, fontFamily: 'inherit',
}

export default function SessionBlockEditor({ sessionId, backHref, canManageCatalog = true }) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const [sessionTitle, setSessionTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sessionType, setSessionType] = useState(null)
  const [activityMode, setActivityMode] = useState('standard')
  const [recurringTarget, setRecurringTarget] = useState(1)
  const [movementsList, setMovementsList] = useState([]) // [{ id, name, muscles }]

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [blocks, setBlocks] = useState([])
  const [exercisesModalOpen, setExercisesModalOpen] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [selectedMuscles, setSelectedMuscles] = useState([])
  const [configStep, setConfigStep] = useState(null) // null | 'sets' | 'rest'
  const [pendingExercise, setPendingExercise] = useState(null)
  const [pendingSets, setPendingSets] = useState(3)
  const [pendingRest, setPendingRest] = useState(60)
  const [addingSecondaryExercise, setAddingSecondaryExercise] = useState(false)
  const [pendingCircuitExercises, setPendingCircuitExercises] = useState([])
  const [activeBlockIndex, setActiveBlockIndex] = useState(0)
  const [descModalOpen, setDescModalOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionRange, setMentionRange] = useState(null)
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [draftSetNote, setDraftSetNote] = useState('')
  const [applyNoteToNextSets, setApplyNoteToNextSets] = useState(false)
  const [activeNoteContext, setActiveNoteContext] = useState(null)
  const descriptionRef = useRef(null)
  const descriptionBackdropRef = useRef(null)
  const blockIdCounter = useRef(0)

  const nextBlockId = () => {
    blockIdCounter.current += 1
    return `new-${blockIdCounter.current}`
  }

  // Chargement initial : séance + exercices + circuits. Une seule fois au montage (l'édition
  // ensuite reste locale jusqu'au clic sur Save, comme l'ancien éditeur). La bibliothèque de
  // mouvements, elle, est cherchée à la demande (voir l'effet plus bas) — la table dépasse
  // largement une page fixe (400+ lignes chez ce coach), donc une recherche serveur en direct,
  // comme le fait déjà l'ancien éditeur, est nécessaire pour ne pas rendre certains mouvements
  // introuvables selon leur ordre alphabétique.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: sessionRow }, { data: exerciseRows }] = await Promise.all([
        supabase.from('program_sessions').select('id, title, coach_notes, circuits, session_type, recurring_daily_target, activity_mode').eq('id', sessionId).single(),
        supabase.from('program_exercises').select('id, order_index, name, sets, rest, note, superset_group, block_type, pace_base, pct_low, pct_high').eq('program_session_id', sessionId).order('order_index'),
      ])
      if (cancelled) return
      if (!sessionRow) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setSessionTitle(sessionRow.title || '')
      setDescription(sessionRow.coach_notes || '')
      setSessionType(sessionRow.session_type || null)
      setActivityMode(sessionRow.activity_mode || 'standard')
      setRecurringTarget(sessionRow.recurring_daily_target || 1)
      setBlocks(buildBlocksFromDb(exerciseRows || [], sessionRow.circuits || []))
      setAddMenuOpen((exerciseRows || []).length === 0 && !(sessionRow.circuits || []).length)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [sessionId])

  // Recherche de mouvements côté serveur (débounced), tant que la modale Exercises est ouverte —
  // pas de fetch fixe : la bibliothèque de mouvements peut dépasser largement une seule page.
  useEffect(() => {
    if (!exercisesModalOpen) return
    let cancelled = false
    const isCardio = activityMode === 'cardio'
    const timer = setTimeout(async () => {
      // En mode cardio, le filtre Run/Row/Ski Erg/Bike (voir isCardioMovementName) s'applique
      // après coup en JS : il faut donc charger toute la bibliothèque (400+ mouvements chez ce
      // coach) plutôt que les 100 premiers par ordre alphabétique, sous peine de couper avant
      // d'atteindre "Run EF" etc. si aucun texte de recherche ne réduit déjà la liste.
      let query = supabase.from('movements').select('id, name, muscles').order('name').limit(isCardio ? 2000 : 100)
      if (exerciseSearch.trim()) query = query.ilike('name', `%${exerciseSearch.trim()}%`)
      if (selectedMuscles.length > 0 && !isCardio) {
        query = query.or(selectedMuscles.map(m => `muscles.ilike.%${m}%`).join(','))
      }
      const { data } = await query
      if (cancelled) return
      let list = (data || []).map(m => ({ id: m.id, name: m.name, muscles: m.muscles || '' }))
      if (isCardio) {
        list = list.filter(m => isCardioMovementName(m.name))
          .sort((a, b) => cardioMovementSortKey(a.name) - cardioMovementSortKey(b.name))
          .slice(0, 100)
      }
      setMovementsList(list)
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [exercisesModalOpen, exerciseSearch, selectedMuscles, activityMode])

  useEffect(() => {
    const handler = (e) => {
      if (!hasUnsavedChanges()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  useEffect(() => () => setUnsavedChanges(false), [])

  const goBack = () => {
    if (hasUnsavedChanges() && !window.confirm('Tu as des modifications non sauvegardées sur cette page. Les quitter sans enregistrer ?')) return
    // replace, pas push : sinon la page séance reste dans l'historique et un clic sur "retour"
    // juste après y renvoie (push empile une entrée en plus au lieu de vraiment revenir en arrière).
    router.replace(backHref)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const rows = flattenBlocksToExerciseRows(blocks, activityMode)
      const { data: existingRows } = await supabase
        .from('program_exercises')
        .select('id')
        .eq('program_session_id', sessionId)
        .order('order_index')
      const existingIds = (existingRows || []).map(r => r.id)
      const maxLen = Math.max(existingIds.length, rows.length)
      for (let i = 0; i < maxLen; i++) {
        const row = rows[i]
        const existingId = existingIds[i]
        if (row && existingId) {
          await supabase.from('program_exercises').update({ ...row, order_index: i }).eq('id', existingId)
        } else if (row && !existingId) {
          await supabase.from('program_exercises').insert({ ...row, order_index: i, program_session_id: sessionId })
        } else if (!row && existingId) {
          await supabase.from('program_exercises').delete().eq('id', existingId)
        }
      }

      await supabase.from('program_sessions')
        .update({
          title: sessionTitle, coach_notes: description, circuits: flattenBlocksToCircuits(blocks),
          activity_mode: activityMode,
          session_type: sessionType, recurring_daily_target: sessionType === 'recurrent' ? recurringTarget : null,
          // Récurrente = hors calendrier : jamais de semaine/jour, même si la séance en avait un
          // avant (créée via une case du calendrier puis basculée en récurrente après coup).
          ...(sessionType === 'recurrent' ? { week_number: null, day_of_week: null } : {}),
        })
        .eq('id', sessionId)

      // Écriture dans le catalogue partagé réservée au coach (RLS) — un athlète ne choisit de
      // toute façon que parmi les mouvements déjà existants ici (pas de "Create <name>"), donc
      // cet upsert n'a rien à faire côté athlète et provoquerait juste un 403 RLS silencieux.
      const names = [...new Set(rows.map(r => r.name).filter(Boolean))]
      if (canManageCatalog && names.length) {
        await supabase.from('movements').upsert(names.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
      }

      setUnsavedChanges(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const addWarmupBlock = () => {
    const existingIndex = blocks.findIndex(b => b.type === 'warmup')
    if (existingIndex !== -1) {
      setActiveBlockIndex(existingIndex)
    } else {
      setBlocks([{ id: nextBlockId(), type: 'warmup', name: '', description: '', note: '' }, ...blocks])
      setActiveBlockIndex(0)
    }
    setUnsavedChanges(true)
    setAddMenuOpen(false)
  }

  const addCooldownBlock = () => {
    const existingIndex = blocks.findIndex(b => b.type === 'cooldown')
    if (existingIndex !== -1) {
      setActiveBlockIndex(existingIndex)
    } else {
      const newBlocks = [...blocks, { id: nextBlockId(), type: 'cooldown', name: '', description: '', note: '' }]
      setBlocks(newBlocks)
      setActiveBlockIndex(newBlocks.length - 1)
    }
    setUnsavedChanges(true)
    setAddMenuOpen(false)
  }

  const addExerciseLikeBlock = (type) => {
    const cooldownIndex = blocks.findIndex(b => b.type === 'cooldown')
    const insertAt = cooldownIndex === -1 ? blocks.length : cooldownIndex
    const newBlock = { id: nextBlockId(), type, name: '', description: '', note: '' }
    setBlocks([...blocks.slice(0, insertAt), newBlock, ...blocks.slice(insertAt)])
    setActiveBlockIndex(insertAt)
    setUnsavedChanges(true)
    setAddMenuOpen(false)
    setAddingSecondaryExercise(false)
    setPendingCircuitExercises([])
    setExercisesModalOpen(true)
  }

  const addExerciseBlock = () => addExerciseLikeBlock('exercise')
  const addCircuitBlock = () => addExerciseLikeBlock('circuit')

  const removeBlock = (index) => {
    const newBlocks = blocks.filter((_, i) => i !== index)
    setBlocks(newBlocks)
    setActiveBlockIndex(Math.min(index, newBlocks.length - 1))
    setUnsavedChanges(true)
  }

  const activeBlock = blocks[activeBlockIndex] ?? null
  const isCircuitBlock = activeBlock?.type === 'circuit'

  const openDescModal = () => {
    if (!activeBlock) return
    setDraftName(activeBlock.name)
    setDraftDescription(activeBlock.description)
    setDraftNote(activeBlock.note)
    setMentionQuery(null)
    setMentionRange(null)
    setDescModalOpen(true)
  }

  const closeDescModal = () => {
    setDescModalOpen(false)
    setMentionQuery(null)
    setMentionRange(null)
  }

  const confirmDescModal = () => {
    setBlocks(blocks.map((b, i) => (
      i === activeBlockIndex ? { ...b, name: draftName, description: draftDescription, note: draftNote } : b
    )))
    setUnsavedChanges(true)
    closeDescModal()
  }

  const toggleMuscle = (muscleKey) => {
    setSelectedMuscles(prev => prev.includes(muscleKey) ? prev.filter(m => m !== muscleKey) : [...prev, muscleKey])
  }

  const openExercisePickerForBlock = () => {
    setAddingSecondaryExercise(false)
    setPendingCircuitExercises([])
    setExercisesModalOpen(true)
  }

  const openFollowExercisePicker = () => {
    setAddingSecondaryExercise(true)
    setPendingCircuitExercises([])
    setExercisesModalOpen(true)
  }

  const closeExercisesModal = () => {
    setExercisesModalOpen(false)
    setPendingCircuitExercises([])
  }

  const addExerciseToActiveBlock = (ex) => {
    if (!activeBlock) return
    setBlocks(blocks.map((b, i) => (
      i === activeBlockIndex ? { ...b, exercises: [...(b.exercises || []), { id: nextBlockId(), name: ex.name, muscles: ex.muscles }] } : b
    )))
    setUnsavedChanges(true)
    setExercisesModalOpen(false)
    setAddingSecondaryExercise(false)
  }

  const toggleCircuitPending = (ex) => {
    setPendingCircuitExercises(prev => (
      prev.some(p => p.name === ex.name) ? prev.filter(p => p.name !== ex.name) : [...prev, ex]
    ))
  }

  const confirmCircuitSelection = () => {
    if (!activeBlock || pendingCircuitExercises.length === 0) return
    setBlocks(blocks.map((b, i) => {
      if (i !== activeBlockIndex) return b
      const newExercises = [
        ...(b.exercises || []),
        ...pendingCircuitExercises.map(ex => ({ id: nextBlockId(), name: ex.name, muscles: ex.muscles })),
      ]
      const sets = b.sets?.length > 0 ? b.sets : Array.from({ length: 3 }, () => ({ id: nextBlockId() }))
      const restSeconds = b.restSeconds ?? 60
      return { ...b, exercises: newExercises, sets, restSeconds }
    }))
    setUnsavedChanges(true)
    setPendingCircuitExercises([])
    setExercisesModalOpen(false)
  }

  const startExerciseConfig = (ex) => {
    setPendingExercise(ex)
    setPendingSets(3)
    setPendingRest(60)
    setConfigStep('sets')
    setExercisesModalOpen(false)
  }

  const closeExerciseConfig = () => {
    setConfigStep(null)
    setPendingExercise(null)
  }

  const confirmSetsStep = () => setConfigStep('rest')

  const confirmRestStep = () => {
    if (activeBlock && pendingExercise) {
      const newSets = Array.from({ length: pendingSets }, () => ({ id: nextBlockId() }))
      setBlocks(blocks.map((b, i) => (
        i === activeBlockIndex
          ? {
              ...b,
              exercises: [...(b.exercises || []), { id: nextBlockId(), name: pendingExercise.name, muscles: pendingExercise.muscles }],
              sets: newSets,
              restSeconds: pendingRest,
            }
          : b
      )))
      setUnsavedChanges(true)
    }
    closeExerciseConfig()
  }

  const addSet = () => {
    if (!activeBlock) return
    setBlocks(blocks.map((b, i) => (
      i === activeBlockIndex ? { ...b, sets: [...(b.sets || []), { id: nextBlockId() }] } : b
    )))
    setUnsavedChanges(true)
  }

  const removeSet = (setId) => {
    if (!activeBlock) return
    setBlocks(blocks.map((b, i) => (
      i === activeBlockIndex ? { ...b, sets: (b.sets || []).filter(s => s.id !== setId) } : b
    )))
    setUnsavedChanges(true)
  }

  const moveExercise = (exerciseId, dir) => {
    setBlocks(prev => prev.map((b, i) => {
      if (i !== activeBlockIndex) return b
      const list = b.exercises || []
      const idx = list.findIndex(e => e.id === exerciseId)
      const newIdx = idx + dir
      if (idx === -1 || newIdx < 0 || newIdx >= list.length) return b
      const newList = [...list]
      const [item] = newList.splice(idx, 1)
      newList.splice(newIdx, 0, item)
      return { ...b, exercises: newList }
    }))
    setUnsavedChanges(true)
  }

  const setNoteKey = (setId, exerciseId) => `${setId}:${exerciseId}`

  // Base (VMA/Seuil60/Δ) + %1/%2 par exercice — mode cardio uniquement, pas de grille de sets
  // (voir flattenBlocksToExerciseRows / groupExercisesIntoBlocks pour le mapping DB).
  const updatePaceValue = (exerciseId, field, value) => {
    setBlocks(blocks.map((b, i) => {
      if (i !== activeBlockIndex) return b
      const paceValues = { ...(b.paceValues || {}) }
      paceValues[exerciseId] = { ...(paceValues[exerciseId] || { base: '', pctLow: '', pctHigh: '' }), [field]: value }
      return { ...b, paceValues }
    }))
    setUnsavedChanges(true)
  }

  const openSetNotesModal = (setId, exerciseId) => {
    if (!activeBlock) return
    setActiveNoteContext({ setId, exerciseId })
    setDraftSetNote(activeBlock.setNotes?.[setNoteKey(setId, exerciseId)] || '')
    setApplyNoteToNextSets(false)
    setNotesModalOpen(true)
  }

  const closeSetNotesModal = () => {
    setNotesModalOpen(false)
    setActiveNoteContext(null)
  }

  const confirmSetNotesModal = () => {
    if (activeNoteContext) {
      const { setId, exerciseId } = activeNoteContext
      setBlocks(blocks.map((b, i) => {
        if (i !== activeBlockIndex) return b
        const setNotes = { ...(b.setNotes || {}) }
        setNotes[setNoteKey(setId, exerciseId)] = draftSetNote
        if (applyNoteToNextSets) {
          const setIndex = (b.sets || []).findIndex(s => s.id === setId)
          for (const s of (b.sets || []).slice(setIndex + 1)) {
            setNotes[setNoteKey(s.id, exerciseId)] = draftSetNote
          }
        }
        return { ...b, setNotes }
      }))
      setUnsavedChanges(true)
    }
    closeSetNotesModal()
  }

  const clearSetNotesModal = () => setDraftSetNote('')

  // Le filtrage (nom + muscles) est déjà appliqué côté serveur par l'effet de recherche ci-dessus.
  const filteredExercises = movementsList

  const movementNames = useMemo(() => movementsList.map(m => m.name), [movementsList])
  const mentionPattern = useMemo(() => (
    movementNames.length
      ? new RegExp(`#(${movementNames.map(m => m.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'g')
      : null
  ), [movementNames])

  function renderHighlightedDescription(text) {
    if (!mentionPattern) return text
    const parts = []
    let lastIndex = 0
    let match
    const regex = new RegExp(mentionPattern.source, 'g')
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
      parts.push(
        <span key={match.index} style={{ color: '#3E63DD', textDecoration: 'underline', fontWeight: 600 }}>
          {match[0]}
        </span>
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return parts
  }

  const handleDescriptionChange = (e) => {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setDraftDescription(value)
    setUnsavedChanges(true)
    const uptoCursor = value.slice(0, cursor)
    const hashIndex = uptoCursor.lastIndexOf('#')
    const query = hashIndex === -1 ? null : uptoCursor.slice(hashIndex + 1)
    const stillMatching = query !== null && !query.includes('\n') &&
      (query === '' || movementNames.some(m => m.toLowerCase().startsWith(query.toLowerCase())))
    if (stillMatching) {
      setMentionQuery(query)
      setMentionRange({ start: hashIndex, end: cursor })
    } else {
      setMentionQuery(null)
      setMentionRange(null)
    }
  }

  const openExercisePicker = () => {
    const cursor = descriptionRef.current?.selectionStart ?? draftDescription.length
    setMentionRange({ start: cursor, end: cursor })
    setMentionQuery('')
    descriptionRef.current?.focus()
  }

  const pickMovement = (name) => {
    if (!mentionRange) return
    const { start, end } = mentionRange
    const before = draftDescription.slice(0, start)
    const after = draftDescription.slice(end)
    const insertion = `#${name} `
    setDraftDescription(before + insertion + after)
    setMentionQuery(null)
    setMentionRange(null)
    requestAnimationFrame(() => {
      const ta = descriptionRef.current
      if (!ta) return
      ta.focus()
      const pos = before.length + insertion.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const mentionMatches = mentionQuery === null
    ? []
    : movementNames.filter(m => m.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)

  if (loading) {
    return (
      <div style={{ background: c.bg, minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        Chargement…
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ background: c.bg, minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: c.textMuted, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div>Séance introuvable.</div>
        <button onClick={() => router.push(backHref)} style={{ border: `1px solid ${c.border}`, borderRadius: 6, padding: '9px 20px', background: c.bg, cursor: 'pointer' }}>
          Retour au calendrier
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: c.bg, minHeight: '100svh', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={goBack} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
            <X size={22} />
          </button>
          <input
            value={sessionTitle}
            onChange={e => { setSessionTitle(e.target.value); setUnsavedChanges(true) }}
            placeholder='Workout name &quot;Standard&quot;'
            style={{ ...input, flex: 1, fontSize: 15, padding: '10px 14px' }}
          />
          {savedFlash && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Sauvegardé</span>}
          <button onClick={handleSave} disabled={saving} style={{
            flexShrink: 0, background: c.blue, color: '#fff', border: 'none', borderRadius: 6,
            padding: '10px 28px', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 24, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', borderBottom: `1px solid ${c.border}` }}>
            {[TextB, TextItalic, LinkSimple, ListBullets, TextTSlash].map((Icon, i) => (
              <button key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', background: 'none', borderRadius: 4, color: c.textMuted, cursor: 'pointer' }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
          <textarea
            placeholder="Description"
            value={description}
            onChange={e => { setDescription(e.target.value); setUnsavedChanges(true) }}
            rows={5}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', color: c.text }}
          />
        </div>

        {/* Récurrence : hors calendrier, proposée au sportif tous les jours plutôt qu'à une
            date précise — voir la note en tête de fichier sur le périmètre réduit de cette page,
            ce champ est l'exception portée ici car il n'a pas d'équivalent dans l'ancien éditeur
            plein écran une fois la séance créée depuis la grille Jour 1→N. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => { setActivityMode(m => m === 'cardio' ? 'standard' : 'cardio'); setUnsavedChanges(true) }}
            title="Limite la bibliothèque d'exercices aux mouvements Run/Row/Ski Erg/Bike et affiche une allure (base + %) au lieu de séries/reps/kg"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${activityMode === 'cardio' ? c.blue : c.border}`,
              background: activityMode === 'cardio' ? '#E8EEFC' : c.bg,
              color: activityMode === 'cardio' ? c.blue : c.textMuted,
            }}
          >
            <Heartbeat size={14} weight={activityMode === 'cardio' ? 'fill' : 'regular'} />
            {activityMode === 'cardio' ? 'Cardio' : 'Standard'}
          </button>
          <button onClick={() => { setSessionType(t => t === 'recurrent' ? null : 'recurrent'); setUnsavedChanges(true) }} style={{
            padding: '7px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${sessionType === 'recurrent' ? c.blue : c.border}`,
            background: sessionType === 'recurrent' ? '#E8EEFC' : c.bg,
            color: sessionType === 'recurrent' ? c.blue : c.textMuted,
          }}>
            {sessionType === 'recurrent' ? 'Recurring · every day' : 'Does not repeat'}
          </button>
          {sessionType === 'recurrent' && (
            <label title="Number of times per day to validate the session — resets daily"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: c.textMuted }}>
              <input type="number" min="1" value={recurringTarget}
                onChange={e => { setRecurringTarget(Math.max(1, parseInt(e.target.value) || 1)); setUnsavedChanges(true) }}
                style={{ width: 44, boxSizing: 'border-box', padding: '6px 8px', border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 13, textAlign: 'center', outline: 'none', background: c.bg, color: c.text }} />
              x/day
            </label>
          )}
        </div>

        {/* Add / Order */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAddMenuOpen(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: c.bg, border: `1px solid ${c.blue}`,
              borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: c.blue, cursor: 'pointer',
            }}>
              <Plus size={14} weight="bold" /> Add
            </button>
            {addMenuOpen && (
              <>
                <div onClick={() => setAddMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                <div style={{
                  position: 'absolute', left: 0, top: '100%', marginTop: 6, width: 320, background: c.bg,
                  border: `1px solid ${c.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 100, padding: 8, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <button onClick={addWarmupBlock} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, fontSize: 14, color: c.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#26272B', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Flame size={12} weight="fill" />
                      <span style={{ fontSize: 5, fontWeight: 800, letterSpacing: '0.2px', lineHeight: 1 }}>WARM UP</span>
                    </span>
                    Add the warm-up part
                  </button>
                  <button onClick={addCooldownBlock} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, fontSize: 14, color: c.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#26272B', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Snowflake size={12} weight="fill" />
                      <span style={{ fontSize: 5, fontWeight: 800, letterSpacing: '0.2px', lineHeight: 1 }}>COOL DOWN</span>
                    </span>
                    Add the cool-down / stretching part
                  </button>
                  <div style={{ height: 1, background: c.border, margin: '4px 0' }} />
                  <button onClick={addExerciseBlock} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, fontSize: 14, color: c.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 6, border: `1.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Plus size={14} />
                    </span>
                    Add exercise
                  </button>
                  <button onClick={addCircuitBlock} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, fontSize: 14, color: c.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 6, border: `1.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowsClockwise size={14} />
                    </span>
                    Circuit
                  </button>
                </div>
              </>
            )}
          </div>
          <button disabled style={{
            display: 'flex', alignItems: 'center', gap: 8, background: c.disabledBg, border: `1px solid ${c.border}`,
            borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: c.disabled, cursor: 'not-allowed',
          }}>
            <ArrowsDownUp size={14} /> Order
          </button>
        </div>

        {/* Navigation entre blocs */}
        {blocks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
            <button
              disabled={activeBlockIndex === 0}
              onClick={() => setActiveBlockIndex(i => Math.max(0, i - 1))}
              style={{ display: 'flex', background: 'none', border: 'none', padding: 4, cursor: activeBlockIndex === 0 ? 'default' : 'pointer', color: activeBlockIndex === 0 ? c.borderDashed : c.text }}
            >
              <CaretLeft size={18} weight="bold" />
            </button>

            {blocks.map((b, i) => {
              const meta = BLOCK_META[b.type]
              const Icon = meta.icon
              const isActive = i === activeBlockIndex
              return (
                <button key={b.id} onClick={() => setActiveBlockIndex(i)} style={{
                  position: 'relative', width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: isActive ? '#26272B' : c.disabledBg, color: isActive ? '#fff' : c.textMuted,
                  border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 1, cursor: 'pointer',
                }}>
                  <Icon size={14} weight="fill" />
                  <span style={{ fontSize: 6, fontWeight: 800, letterSpacing: '0.2px', lineHeight: 1, textAlign: 'center' }}>{meta.badgeLabel}</span>
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%',
                    background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i + 1}
                  </span>
                </button>
              )
            })}

            <button
              disabled={activeBlockIndex >= blocks.length - 1}
              onClick={() => setActiveBlockIndex(i => Math.min(blocks.length - 1, i + 1))}
              style={{ display: 'flex', background: 'none', border: 'none', padding: 4, cursor: activeBlockIndex >= blocks.length - 1 ? 'default' : 'pointer', color: activeBlockIndex >= blocks.length - 1 ? c.borderDashed : c.text }}
            >
              <CaretRight size={18} weight="bold" />
            </button>
          </div>
        )}

        {/* Carte du bloc actif */}
        {activeBlock && (
          <div style={{ marginTop: 16, border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${c.border}` }}>
              <span style={{ width: 20, flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.6px', color: c.textMuted }}>
                {BLOCK_META[activeBlock.type].title}
              </span>
              <button onClick={() => removeBlock(activeBlockIndex)} style={{ display: 'flex', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.textMuted }}>
                <DotsThreeVertical size={18} weight="bold" />
              </button>
            </div>

            {activeBlock.exercises?.length > 0 ? (
              <div style={{ padding: 16 }}>
                <SortableGroup ids={activeBlock.exercises.map(ex => ex.id)} onReorder={moveExercise}>
                  {activeBlock.exercises.map((ex, idx) => (
                    <SortableItem key={ex.id} id={ex.id}>
                      {({ attributes, listeners }) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: idx === activeBlock.exercises.length - 1 ? 14 : 10, background: c.bg }}>
                          <span {...attributes} {...listeners} style={{ display: 'flex', flexShrink: 0, cursor: 'grab', touchAction: 'none', color: c.textFaint }}>
                            <DotsSixVertical size={16} />
                          </span>
                          <div style={{
                            width: 56, height: 56, flexShrink: 0, borderRadius: 6, background: '#1A1B1F', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: 4, lineHeight: 1.2,
                          }}>
                            {ex.name}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: c.text, textDecoration: 'underline' }}>{ex.name}</div>
                            {ex.muscles && (
                              <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: c.textMuted, background: c.disabledBg, borderRadius: 5, padding: '2px 8px' }}>
                                {ex.muscles}
                              </span>
                            )}
                          </div>
                          <button style={{ display: 'flex', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.textMuted }}>
                            <DotsThreeVertical size={18} weight="bold" />
                          </button>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </SortableGroup>

                <button onClick={openFollowExercisePicker} style={{
                  display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none',
                  padding: '4px 0 20px', color: c.blue, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${c.blue}`, flexShrink: 0 }}>
                    <Plus size={11} weight="bold" />
                  </span>
                  Follow with another exercise (Superset / Triset / Circuit)
                </button>

                {isCircuitBlock ? (
                  <textarea
                    key={activeBlock.id}
                    defaultValue={activeBlock.circuitNote || ''}
                    onChange={e => {
                      const value = e.target.value
                      setBlocks(blocks.map((b, i) => (i === activeBlockIndex ? { ...b, circuitNote: value } : b)))
                      setUnsavedChanges(true)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    placeholder="Write the circuit"
                    rows={10}
                    style={{
                      width: '100%', boxSizing: 'border-box', border: `1px solid ${c.border}`, borderRadius: 8,
                      padding: '12px 14px', fontSize: 14, lineHeight: 1.5, outline: 'none', resize: 'none',
                      background: c.bg, fontFamily: 'inherit', color: c.text, overflow: 'hidden', minHeight: 220,
                    }}
                  />
                ) : activityMode === 'cardio' ? (
                  // Pas de grille SET en mode cardio : un seul réglage d'allure (base + %low/%high)
                  // par exercice — l'allure ne varie pas set par set (voir updatePaceValue).
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {activeBlock.exercises.map(ex => {
                      const pace = activeBlock.paceValues?.[ex.id] || { base: '', pctLow: '', pctHigh: '' }
                      const hasNote = Boolean(activeBlock.setNotes?.[setNoteKey('note', ex.id)])
                      return (
                        <div key={ex.id} style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: '14px 16px' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, textDecoration: 'underline', marginBottom: 10 }}>{ex.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <select
                              value={pace.base}
                              onChange={e => updatePaceValue(ex.id, 'base', e.target.value)}
                              style={{ width: 140, boxSizing: 'border-box', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 8px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: pace.base ? c.text : c.textFaint, background: c.bg }}
                            >
                              <option value="">Référence</option>
                              {PACE_BASES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                            </select>
                            <input
                              type="number"
                              placeholder="%1"
                              value={pace.pctLow}
                              onChange={e => updatePaceValue(ex.id, 'pctLow', e.target.value)}
                              style={{ width: 60, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 6px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                            />
                            <span style={{ color: c.textMuted, fontSize: 13 }}>–</span>
                            <input
                              type="number"
                              placeholder="%2"
                              value={pace.pctHigh}
                              onChange={e => updatePaceValue(ex.id, 'pctHigh', e.target.value)}
                              style={{ width: 60, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 6px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                            />
                            <span style={{ fontSize: 13, color: c.textMuted }}>%</span>
                          </div>
                          <button
                            onClick={() => openSetNotesModal('note', ex.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                              border: `1px solid ${hasNote ? c.blue : c.border}`, background: hasNote ? '#E8EEFC' : c.bg, color: hasNote ? c.blue : c.text,
                            }}
                          >
                            <FileText size={14} /> Notes
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    {activeBlock.sets.map((s, i) => (
                      <div key={s.id}>
                        <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', background: '#111', color: '#fff', padding: '4px 10px', borderRadius: 4 }}>
                              SET {i + 1}
                            </span>
                            {i > 0 && (
                              <button onClick={() => removeSet(s.id)} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.textMuted }}>
                                <X size={16} />
                              </button>
                            )}
                          </div>
                          {activeBlock.exercises.map(ex => {
                            const hasNote = Boolean(activeBlock.setNotes?.[setNoteKey(s.id, ex.id)])
                            return (
                              <div key={ex.id} style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: c.text, textDecoration: 'underline', marginBottom: 6 }}>{ex.name}</div>
                                <button style={{ display: 'block', border: 'none', background: 'none', padding: 0, marginBottom: 8, color: c.blue, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
                                  Advanced settings
                                </button>
                                <button
                                  onClick={() => openSetNotesModal(s.id, ex.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', marginBottom: 10,
                                    border: `1px solid ${hasNote ? c.blue : c.border}`, background: hasNote ? '#E8EEFC' : c.bg, color: hasNote ? c.blue : c.text,
                                  }}
                                >
                                  <FileText size={14} /> Notes
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input placeholder="" style={{ width: 60, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 6px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                  <span style={{ fontSize: 13, color: c.textMuted }}>rep</span>
                                  <input placeholder="" style={{ width: 60, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 6px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                  <span style={{ fontSize: 13, color: c.textMuted }}>kg</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {i < activeBlock.sets.length - 1 && <RestDivider seconds={activeBlock.restSeconds} />}
                      </div>
                    ))}

                    <button onClick={addSet} style={{
                      display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none',
                      padding: '14px 0 4px', color: c.blue, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${c.blue}`, flexShrink: 0 }}>
                        <Plus size={11} weight="bold" />
                      </span>
                      Add set
                    </button>
                    <RestDivider seconds={activeBlock.restSeconds} />
                  </>
                )}
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                <button onClick={openExercisePickerForBlock} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: `1.5px solid ${c.blue}`, color: c.blue, fontWeight: 700, fontSize: 14, borderRadius: 6,
                  padding: '10px', background: c.bg, cursor: 'pointer',
                }}>
                  <Plus size={15} weight="bold" /> Create from library
                </button>
              </div>
            )}

            {!['exercise', 'circuit'].includes(activeBlock.type) && (
              <>
                <button onClick={openDescModal} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '2px 16px 16px', width: '100%',
                  border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                  <span style={{ flex: 1, fontStyle: 'italic', fontSize: 14, color: activeBlock.name ? c.text : c.textFaint }}>
                    {activeBlock.name || BLOCK_META[activeBlock.type].namePlaceholder}
                  </span>
                  <PencilSimple size={16} style={{ color: c.textMuted, flexShrink: 0 }} />
                </button>

                <div style={{ padding: '0 16px 16px' }}>
                  <button onClick={openDescModal} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, background: c.disabledBg, borderRadius: 8,
                    padding: '12px 14px', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}>
                    <span style={{ flex: 1, fontStyle: 'italic', fontSize: 14, color: activeBlock.description ? c.text : c.textFaint }}>
                      {activeBlock.description || BLOCK_META[activeBlock.type].descriptionPlaceholder}
                    </span>
                    <PencilSimple size={16} style={{ color: c.textMuted, flexShrink: 0, marginTop: 2 }} />
                  </button>
                </div>

                <button onClick={openDescModal} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 18px', width: '100%',
                  border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                  <span style={{ flex: 1, fontStyle: 'italic', fontSize: 14, color: activeBlock.note ? c.text : c.textFaint }}>
                    {activeBlock.note || 'Write a note'}
                  </span>
                  <PencilSimple size={16} style={{ color: c.textMuted, flexShrink: 0 }} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Modal Description (nom + description + notes) */}
        {descModalOpen && (
          <>
            <div onClick={closeDescModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 201,
              width: 640, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto',
              background: c.bg, borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: c.text }}>Description</span>
                <button onClick={closeDescModal} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <input
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder="Name (optional)"
                    style={{ ...input, fontSize: 15, padding: '11px 14px' }}
                  />
                </div>

                <div>
                  <label style={{ ...label, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Description</label>
                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 6 }}>
                    <div style={{ position: 'relative' }}>
                      <div ref={descriptionBackdropRef} aria-hidden style={{
                        position: 'absolute', inset: 0, padding: '12px 14px', fontSize: 14, lineHeight: 1.5,
                        fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: c.text,
                        pointerEvents: 'none', overflow: 'hidden',
                      }}>
                        {renderHighlightedDescription(draftDescription)}
                      </div>
                      <textarea
                        ref={descriptionRef}
                        value={draftDescription}
                        onChange={handleDescriptionChange}
                        onScroll={e => { if (descriptionBackdropRef.current) descriptionBackdropRef.current.scrollTop = e.target.scrollTop }}
                        onBlur={() => setMentionQuery(null)}
                        placeholder={activeBlock ? BLOCK_META[activeBlock.type].descriptionPlaceholder : ''}
                        rows={3}
                        style={{
                          position: 'relative', width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: '6px 6px 0 0',
                          padding: '12px 14px', fontSize: 14, lineHeight: 1.5, outline: 'none', resize: 'none', background: 'transparent',
                          fontFamily: 'inherit', color: 'transparent', caretColor: c.text,
                        }}
                      />
                      {mentionQuery !== null && mentionMatches.length > 0 && (
                        <div style={{
                          position: 'absolute', left: 0, right: 0, top: '100%', background: c.bg,
                          border: `1px solid ${c.border}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                          zIndex: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 1,
                          maxHeight: 320, overflowY: 'auto',
                        }}>
                          {mentionMatches.map((m, i) => (
                            <button
                              key={m}
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => pickMovement(m)}
                              style={{
                                display: 'block', width: '100%', padding: '12px 14px', borderRadius: 6, fontSize: 15,
                                color: c.text, background: i === 0 ? '#E8EEFC' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                              }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: `1px solid ${c.border}`, borderRadius: '0 0 6px 6px', background: c.disabledBg }}>
                      <button onClick={openExercisePicker} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${c.blue}`, color: c.blue,
                        fontWeight: 700, fontSize: 13, borderRadius: 6, padding: '6px 12px', background: c.bg, cursor: 'pointer',
                      }}>
                        <Plus size={13} weight="bold" /> Exercises
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: c.textMuted }}>
                        <Info size={13} /> You can also use the # character to add an exercise
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ ...label, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Notes (optional)</label>
                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 10px', borderBottom: `1px solid ${c.border}` }}>
                      {[TextB, TextItalic, LinkSimple, ListBullets, TextTSlash].map((Icon, i) => (
                        <button key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', background: 'none', borderRadius: 4, color: c.textMuted, cursor: 'pointer' }}>
                          <Icon size={15} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={draftNote}
                      onChange={e => setDraftNote(e.target.value)}
                      placeholder="Write a note"
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', border: 'none', padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', color: c.text }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
                <button onClick={closeDescModal} style={{
                  border: `1px solid ${c.border}`, color: c.text, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Close
                </button>
                <button onClick={confirmDescModal} style={{
                  border: `1px solid ${c.blue}`, color: c.blue, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Ok
                </button>
              </div>
            </div>
          </>
        )}

        {/* Modale Exercises (Create from library) */}
        {exercisesModalOpen && (
          <>
            <div onClick={closeExercisesModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 201,
              width: 1100, maxWidth: 'calc(100vw - 32px)', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column',
              background: c.bg, borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: c.text }}>Exercises</span>
                <button onClick={closeExercisesModal} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 24px', borderBottom: `1px solid ${c.border}`, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 24 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                    color: c.text, paddingBottom: 10, borderBottom: `2px solid ${c.text}`,
                  }}>
                    Explore
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: c.textMuted }} />
                    <input
                      value={exerciseSearch}
                      onChange={e => setExerciseSearch(e.target.value)}
                      placeholder="Search"
                      style={{ ...input, width: 220, paddingLeft: 30 }}
                    />
                  </div>
                  {isCircuitBlock && (
                    <button
                      onClick={confirmCircuitSelection}
                      disabled={pendingCircuitExercises.length === 0}
                      style={{
                        background: pendingCircuitExercises.length === 0 ? c.disabledBg : c.blue,
                        color: pendingCircuitExercises.length === 0 ? c.disabled : '#fff',
                        border: 'none', borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 700,
                        cursor: pendingCircuitExercises.length === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Add ({pendingCircuitExercises.length})
                    </button>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${c.border}`, overflowY: 'auto', padding: 20 }}>
                  {isCircuitBlock && pendingCircuitExercises.length > 0 && (
                    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: c.textMuted }}>
                        SELECTED ({pendingCircuitExercises.length})
                      </div>
                      {pendingCircuitExercises.map(ex => (
                        <div key={ex.name} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          background: '#E8EEFC', border: `1px solid ${c.blueBorder}`, borderRadius: 6, padding: '6px 10px',
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: c.blue, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ex.name}
                          </span>
                          <button onClick={() => toggleCircuitPending(ex)} style={{ display: 'flex', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.blue }}>
                            <X size={13} weight="bold" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: c.text, marginBottom: 12 }}>{filteredExercises.length} exercise(s)</div>
                  {activityMode === 'cardio' ? (
                    <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5 }}>
                      Mode Cardio : seuls les mouvements Run / Row / Ski Erg / Bike sont proposés.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: c.textMuted }}>MUSCLES</span>
                        {selectedMuscles.length > 0 && (
                          <button onClick={() => setSelectedMuscles([])} style={{ border: 'none', background: 'none', color: c.blue, cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600 }}>
                            NONE
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {REAL_MUSCLE_GROUPS.map(group => {
                          const active = selectedMuscles.includes(group.key)
                          return (
                            <button key={group.key} onClick={() => toggleMuscle(group.key)} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            }}>
                              <span style={{
                                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, background: active ? c.blue : c.disabledBg, color: active ? '#fff' : c.textMuted,
                              }}>
                                {group.label.slice(0, 2).toUpperCase()}
                              </span>
                              <span style={{ fontSize: 10, color: c.textMuted, textAlign: 'center' }}>{group.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
                  {filteredExercises.map(ex => {
                    const alreadyInBlock = activeBlock?.exercises?.some(e => e.name === ex.name)
                    const isPending = pendingCircuitExercises.some(p => p.name === ex.name)
                    const added = alreadyInBlock || (isCircuitBlock && isPending)
                    return (
                      <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: `1px solid ${c.border}` }}>
                        <div style={{
                          width: 64, height: 64, flexShrink: 0, borderRadius: 6, background: '#1A1B1F', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: 4, lineHeight: 1.2,
                        }}>
                          {ex.name}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: c.text, textDecoration: 'underline' }}>{ex.name}</div>
                          {ex.muscles && (
                            <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: c.textMuted, background: c.disabledBg, borderRadius: 5, padding: '2px 8px' }}>
                              {ex.muscles}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (isCircuitBlock) {
                              if (!alreadyInBlock) toggleCircuitPending(ex)
                            } else if (addingSecondaryExercise || activityMode === 'cardio') {
                              // Pas de config séries/récup en mode cardio — l'allure se règle par
                              // exercice (base + %low/%high), voir la vue cardio ci-dessous.
                              addExerciseToActiveBlock(ex)
                            } else {
                              startExerciseConfig(ex)
                            }
                          }}
                          disabled={!activeBlock || alreadyInBlock}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%',
                            border: `1.5px solid ${added ? c.blue : c.border}`, background: added ? c.blue : c.bg,
                            color: added ? '#fff' : c.text, cursor: activeBlock && !alreadyInBlock ? 'pointer' : 'not-allowed', flexShrink: 0,
                          }}
                        >
                          {added ? <Check size={16} weight="bold" /> : <Plus size={16} />}
                        </button>
                      </div>
                    )
                  })}
                  {filteredExercises.length === 0 && (
                    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: c.textMuted }}>No exercise matches your filters.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modales de config après choix d'un exercice : nombre de séries puis temps de récup */}
        {configStep === 'sets' && (
          <>
            <div onClick={closeExerciseConfig} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 211,
              width: 520, maxWidth: 'calc(100vw - 32px)', background: c.bg, borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: c.text }}>Number of sets</span>
                <button onClick={closeExerciseConfig} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
                <input
                  type="number"
                  min={1}
                  value={pendingSets}
                  onChange={e => setPendingSets(Math.max(1, parseInt(e.target.value) || 1))}
                  autoFocus
                  style={{
                    width: 120, boxSizing: 'border-box', textAlign: 'center', fontSize: 20, fontWeight: 600,
                    padding: '10px 12px', border: `1.5px solid ${c.blueBorder}`, borderRadius: 8, outline: 'none',
                    color: c.text, fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
                <button onClick={closeExerciseConfig} style={{
                  border: `1px solid ${c.border}`, color: c.text, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Close
                </button>
                <button onClick={confirmSetsStep} style={{
                  border: `1px solid ${c.blue}`, color: c.blue, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {configStep === 'rest' && (
          <>
            <div onClick={closeExerciseConfig} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 211,
              width: 520, maxWidth: 'calc(100vw - 32px)', background: c.bg, borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: c.text }}>Rest time</span>
                <button onClick={closeExerciseConfig} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: '28px 24px 8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
                  {REST_PRESETS.map(preset => {
                    const active = pendingRest === preset.seconds
                    return (
                      <button key={preset.seconds} onClick={() => setPendingRest(preset.seconds)} style={{
                        padding: '9px 4px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${active ? c.blue : c.border}`, color: active ? c.blue : c.text,
                        background: c.bg,
                      }}>
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <input
                    type="number"
                    min={0}
                    value={Math.floor(pendingRest / 60)}
                    onChange={e => setPendingRest(Math.max(0, parseInt(e.target.value) || 0) * 60 + (pendingRest % 60))}
                    style={{
                      width: 70, boxSizing: 'border-box', textAlign: 'center', fontSize: 18, fontWeight: 600,
                      padding: '10px 12px', border: `1.5px solid ${c.blueBorder}`, borderRadius: 8, outline: 'none',
                      color: c.text, fontFamily: 'inherit',
                    }}
                  />
                  <span style={{ fontSize: 14, color: c.textMuted }}>min</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={pendingRest % 60}
                    onChange={e => {
                      const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                      setPendingRest(Math.floor(pendingRest / 60) * 60 + secs)
                    }}
                    style={{
                      width: 70, boxSizing: 'border-box', textAlign: 'center', fontSize: 18, fontWeight: 600,
                      padding: '10px 12px', border: `1.5px solid ${c.blueBorder}`, borderRadius: 8, outline: 'none',
                      color: c.text, fontFamily: 'inherit',
                    }}
                  />
                  <span style={{ fontSize: 14, color: c.textMuted }}>s</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
                <button onClick={closeExerciseConfig} style={{
                  border: `1px solid ${c.border}`, color: c.text, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Close
                </button>
                <button onClick={confirmRestStep} style={{
                  border: `1px solid ${c.blue}`, color: c.blue, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Add
                </button>
              </div>
            </div>
          </>
        )}

        {/* Modale Notes — attachée à un (set, exercice) précis d'un bloc exercice */}
        {notesModalOpen && (
          <>
            <div onClick={closeSetNotesModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 221,
              width: 560, maxWidth: 'calc(100vw - 32px)', background: c.bg, borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: c.text }}>Notes</span>
                <button onClick={closeSetNotesModal} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 10px', borderBottom: `1px solid ${c.border}` }}>
                    {[TextB, TextItalic, LinkSimple, ListBullets, TextTSlash].map((Icon, i) => (
                      <button key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', background: 'none', borderRadius: 4, color: c.textMuted, cursor: 'pointer' }}>
                        <Icon size={15} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={draftSetNote}
                    onChange={e => setDraftSetNote(e.target.value)}
                    placeholder="Write a note"
                    rows={4}
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', border: 'none', padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', color: c.text }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: c.text, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={applyNoteToNextSets}
                    onChange={e => setApplyNoteToNextSets(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: c.blue }}
                  />
                  Apply to the next sets
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
                <button onClick={closeSetNotesModal} style={{
                  border: `1px solid ${c.border}`, color: c.text, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Close
                </button>
                <button onClick={clearSetNotesModal} style={{
                  border: `1px solid ${c.border}`, color: c.text, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Clear
                </button>
                <button onClick={confirmSetNotesModal} style={{
                  border: `1px solid ${c.blue}`, color: c.blue, fontWeight: 600, fontSize: 14, borderRadius: 6,
                  padding: '9px 20px', background: c.bg, cursor: 'pointer',
                }}>
                  Ok
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
