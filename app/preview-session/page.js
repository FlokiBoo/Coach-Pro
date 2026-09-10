'use client'

// Clone visuel fidèle de la capture Kswiss/Azeoo — aucune charte Ostryk, aucune donnée réelle.
// Sert uniquement de référence pixel pour la refonte prévue au TODO (voir backlog).

import { useState, useRef } from 'react'
import {
  X, TextB, TextItalic, LinkSimple, ListBullets, TextTSlash,
  CaretDown, CaretLeft, CaretRight, ArrowsDownUp, Plus, FileText, Flame, Snowflake, Barbell,
  DotsThreeVertical, PencilSimple, Info, MagnifyingGlass, Star, Check, Timer, DotsSixVertical,
  ArrowsClockwise, Heartbeat,
} from '@phosphor-icons/react'
import { SortableGroup, SortableItem } from '@/app/components/SortableItem'

// Métadonnées par type de bloc — l'ordre réel des blocs dans le tableau `blocks` obéit à une règle
// fixe (voir addWarmupBlock/addCooldownBlock/addExerciseBlock) : le warm-up est toujours en tête,
// le cool-down toujours en queue, quel que soit le nombre de blocs d'exercice ajoutés entre les deux.
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
  // Pour le moment identique au bloc "exercise" (même fenêtre de sélection) — à différencier plus tard.
  circuit: {
    title: 'CIRCUIT', badgeLabel: 'CIRCUIT', icon: ArrowsClockwise,
    namePlaceholder: 'Enter a name (e.g. push day)',
    descriptionPlaceholder: 'Write the detailed description of this exercise block',
  },
  // Pour le moment identique au bloc "exercise" — à différencier plus tard (temps/distance plutôt
  // que sets/reps classiques).
  cardio: {
    title: 'CARDIO', badgeLabel: 'CARDIO', icon: Heartbeat,
    namePlaceholder: 'Enter a name (e.g. push day)',
    descriptionPlaceholder: 'Write the detailed description of this exercise block',
  },
}

// Choix rapides du temps de récup, alignés sur la référence Kswiss/Azeoo (deux rangées de 4).
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

// Séparateur REST entre deux sets (ou après le dernier), affiché avec le temps de récup choisi
// lors de la config de l'exercice — partagé par tous les exercices du superset le cas échéant.
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

// Bibliothèque mock partagée entre la modale "Exercises" (Create from library) et l'autocomplétion
// # dans la description — dans le vrai produit, les deux tirent du même catalogue de mouvements.
// Les mouvements "cardio" (Run/Row/Ski Erg — Run reprend les noms de RUN_MOVEMENT_NAMES dans
// lib/raceEstimates.js, Row/Ski Erg n'existent pas encore côté vrai produit) affichent base/%1/%2
// à la place de rep/kg dans chaque set — voir isPaceBasedExercise plus bas.
const MOCK_EXERCISES = [
  { name: 'Squat', muscle: 'Quads', equipment: 'No equipment', category: 'strength' },
  { name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell', category: 'strength' },
  { name: 'Deadlift', muscle: 'Lower Back', equipment: 'Barbell', category: 'strength' },
  { name: 'Push-up', muscle: 'Chest', equipment: 'No equipment', category: 'strength' },
  { name: 'Jumping Jacks', muscle: 'Abs', equipment: 'No equipment', category: 'strength' },
  { name: 'Plank', muscle: 'Abs', equipment: 'No equipment', category: 'strength' },
  { name: 'Lunges', muscle: 'Quads', equipment: 'No equipment', category: 'strength' },
  { name: 'Burpees', muscle: 'Abs', equipment: 'No equipment', category: 'strength' },
  { name: 'Mountain Climbers', muscle: 'Abs', equipment: 'No equipment', category: 'strength' },
  { name: 'High Knees', muscle: 'Quads', equipment: 'No equipment', category: 'strength' },
  { name: 'Bicep Curl', muscle: 'Biceps', equipment: 'Dumbbell', category: 'strength' },
  { name: 'Tricep Dip', muscle: 'Triceps', equipment: 'No equipment', category: 'strength' },
  { name: 'Shoulder Press', muscle: 'Shoulders', equipment: 'Dumbbell', category: 'strength' },
  { name: 'Pull-up', muscle: 'Lats', equipment: 'Pull-up bar', category: 'strength' },
  { name: 'Shrug', muscle: 'Traps', equipment: 'Dumbbell', category: 'strength' },
  { name: 'Calf Raise', muscle: 'Calves', equipment: 'No equipment', category: 'strength' },
  { name: 'Hip Thrust', muscle: 'Glutes', equipment: 'Barbell', category: 'strength' },
  { name: 'Hamstring Curl', muscle: 'Hamstrings', equipment: 'Machine', category: 'strength' },
  { name: 'Wrist Curl', muscle: 'Forearm', equipment: 'Dumbbell', category: 'strength' },
  { name: 'Sit-up', muscle: 'Abs', equipment: 'No equipment', category: 'strength' },
  { name: 'Run Interval', muscle: null, equipment: 'No equipment', category: 'cardio' },
  { name: 'Run Threshold', muscle: null, equipment: 'No equipment', category: 'cardio' },
  { name: 'Run EF', muscle: null, equipment: 'No equipment', category: 'cardio' },
  { name: 'Run 30/30', muscle: null, equipment: 'No equipment', category: 'cardio' },
  { name: 'Row Interval', muscle: null, equipment: 'Rowing machine', category: 'cardio' },
  { name: 'Row Threshold', muscle: null, equipment: 'Rowing machine', category: 'cardio' },
  { name: 'Row EF', muscle: null, equipment: 'Rowing machine', category: 'cardio' },
  { name: 'Row 30/30', muscle: null, equipment: 'Rowing machine', category: 'cardio' },
  { name: 'Ski Erg Interval', muscle: null, equipment: 'Ski erg', category: 'cardio' },
  { name: 'Ski Erg Threshold', muscle: null, equipment: 'Ski erg', category: 'cardio' },
  { name: 'Ski Erg EF', muscle: null, equipment: 'Ski erg', category: 'cardio' },
  { name: 'Ski Erg 30/30', muscle: null, equipment: 'Ski erg', category: 'cardio' },
  // Tests de performance (mêmes intitulés que RACE_TARGETS dans lib/raceEstimates.js) — servent à
  // mesurer VMA/Seuil plutôt qu'à s'entraîner dessus, donc pas de base/%1/%2 (voir isPaceBasedExercise).
  { name: '6 min (Demi Cooper)', muscle: null, equipment: 'No equipment', category: 'performance' },
  { name: 'Test Seuil 20min', muscle: null, equipment: 'No equipment', category: 'performance' },
  { name: '400 m', muscle: null, equipment: 'No equipment', category: 'performance' },
  { name: '800 m', muscle: null, equipment: 'No equipment', category: 'performance' },
  { name: '5 km', muscle: null, equipment: 'No equipment', category: 'performance' },
  { name: '10 km', muscle: null, equipment: 'No equipment', category: 'performance' },
  { name: 'Semi-Marathon (21,1 km)', muscle: null, equipment: 'No equipment', category: 'performance' },
  { name: 'Marathon (42,195 km)', muscle: null, equipment: 'No equipment', category: 'performance' },
]

const isPaceBasedExercise = (ex) => ex?.category === 'cardio'
// Un bloc cardio propose les mouvements d'entraînement ET les tests de performance (l'un sert à
// mesurer ce que l'autre prescrit en %) — voir isPaceBasedExercise pour ne montrer base/%1/%2
// que sur les mouvements d'entraînement.
const isCardioLibraryExercise = (ex) => ['cardio', 'performance'].includes(ex?.category)

// Mêmes bases que PACE_BASES dans lib/raceEstimates.js (VMA / Seuil 60 / Δ) — le client verra le
// résultat sous forme d'Allure 1 / Allure 2, calculé à partir de ces % côté vraie intégration.
const PACE_BASES = [
  { key: 'VMA', label: 'VMA' },
  { key: 'SEUIL60', label: 'Seuil 60' },
  { key: 'DELTA', label: 'Δ (Seuil60→VMA)' },
]

const MUSCLE_GROUPS = [
  { label: 'Chest / Abs', muscles: ['Chest', 'Abs'] },
  { label: 'Shoulders / Arms', muscles: ['Shoulders', 'Biceps', 'Triceps', 'Forearm'] },
  { label: 'Back', muscles: ['Traps', 'Lats', 'Lower Back'] },
  { label: 'Legs', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] },
]

const MOCK_MOVEMENTS = MOCK_EXERCISES.map(e => e.name)

const MOVEMENT_MENTION_PATTERN = new RegExp(
  `#(${MOCK_MOVEMENTS.map(m => m.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`,
  'g'
)

// Rendu en surimpression : les mouvements liés (#Squat…) apparaissent en bleu souligné, comme dans
// la référence Kswiss/Azeoo — un <textarea> ne permet pas de styler une partie du texte, donc le
// texte réel reste transparent et c'est ce calque qui donne le rendu visuel (voir la zone Description).
function renderHighlightedDescription(text) {
  const parts = []
  let lastIndex = 0
  let match
  const regex = new RegExp(MOVEMENT_MENTION_PATTERN.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(
      <span key={match.index} style={{ color: c.blue, textDecoration: 'underline', fontWeight: 600 }}>
        {match[0]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

// Charte graphique OSTRYK (app/globals.css) — plus la palette empruntée à la référence Kswiss/Azeoo.
// `blue` reste le nom du token en interne (repris partout dans ce fichier pour l'accent
// primaire/état sélectionné) mais résout vers --green, le vrai accent de la charte.
const c = {
  bg: 'var(--bg)',
  border: 'var(--border)',
  borderDashed: 'var(--border2)',
  text: 'var(--text)',
  textMuted: 'var(--text2)',
  textFaint: 'var(--text3)',
  blue: 'var(--green)',
  blueBorder: 'var(--green-light)',
  disabled: 'var(--text3)',
  disabledBg: 'var(--bg2)',
  title: 'var(--title)',
}

const heading = { fontFamily: 'var(--font-title)', color: c.title, fontWeight: 700 }
const label = { fontSize: 13, color: c.text, marginBottom: 6, display: 'block' }
const input = {
  boxSizing: 'border-box', width: '100%', padding: '9px 12px', border: `1px solid var(--border2)`,
  borderRadius: 'var(--r)', fontSize: 14, color: c.text, outline: 'none', background: c.bg, fontFamily: 'inherit',
}

export default function PreviewSessionPage() {
  const [description, setDescription] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(true)
  const [blocks, setBlocks] = useState([])
  const [exercisesModalOpen, setExercisesModalOpen] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [selectedMuscles, setSelectedMuscles] = useState([])
  // Filtre de la liste déroulante "All Exercises" du picker — pour l'instant seule "Performance"
  // (tests VMA/Seuil) existe comme sous-catégorie à part de la bibliothèque générale.
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState('all')
  // Mouvements créés à la volée depuis la recherche quand rien ne correspond — s'ajoutent à la
  // bibliothèque le temps de la session (mock local, pas de vraie table "movements" ici).
  const [customExercises, setCustomExercises] = useState([])
  // Après avoir choisi un exercice dans la bibliothèque : deux petites étapes de config avant de
  // l'insérer réellement dans le bloc — nombre de séries puis temps de récup (voir captures).
  const [configStep, setConfigStep] = useState(null) // null | 'sets' | 'rest'
  const [pendingExercise, setPendingExercise] = useState(null)
  const [pendingSets, setPendingSets] = useState(3)
  const [pendingRest, setPendingRest] = useState(60)
  // "Follow with another exercise" ajoute directement au superset existant (les séries/récup sont
  // déjà réglées) — sans repasser par les modales Number of sets / Rest time.
  const [addingSecondaryExercise, setAddingSecondaryExercise] = useState(false)
  // Sélection en attente pour un bloc circuit : on peut cocher plusieurs exercices avant de valider
  // d'un coup (bouton à côté de Search) — voir toggleCircuitPending/confirmCircuitSelection.
  const [pendingCircuitExercises, setPendingCircuitExercises] = useState([])
  const [activeBlockIndex, setActiveBlockIndex] = useState(0)
  const [descModalOpen, setDescModalOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionRange, setMentionRange] = useState(null)
  // Note par (set, exercice) dans un bloc exercice — voir openSetNotesModal/confirmSetNotesModal.
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [draftSetNote, setDraftSetNote] = useState('')
  const [applyNoteToNextSets, setApplyNoteToNextSets] = useState(false)
  const [activeNoteContext, setActiveNoteContext] = useState(null) // { setId, exerciseId }
  const descriptionRef = useRef(null)
  const descriptionBackdropRef = useRef(null)
  const blockIdCounter = useRef(0)

  const nextBlockId = () => {
    blockIdCounter.current += 1
    return `block-${blockIdCounter.current}`
  }

  const addWarmupBlock = () => {
    const existingIndex = blocks.findIndex(b => b.type === 'warmup')
    if (existingIndex !== -1) {
      setActiveBlockIndex(existingIndex)
    } else {
      // Toujours en tête, quel que soit ce qui existe déjà.
      setBlocks([{ id: nextBlockId(), type: 'warmup', name: '', description: '', note: '' }, ...blocks])
      setActiveBlockIndex(0)
    }
    setAddMenuOpen(false)
  }

  const addCooldownBlock = () => {
    const existingIndex = blocks.findIndex(b => b.type === 'cooldown')
    if (existingIndex !== -1) {
      setActiveBlockIndex(existingIndex)
    } else {
      // Toujours en queue, quel que soit ce qui existe déjà.
      const newBlocks = [...blocks, { id: nextBlockId(), type: 'cooldown', name: '', description: '', note: '' }]
      setBlocks(newBlocks)
      setActiveBlockIndex(newBlocks.length - 1)
    }
    setAddMenuOpen(false)
  }

  // Partagée par "Add exercise" et "Circuit" — pour le moment les deux créent le même type de bloc
  // (contenu structuré exercises/sets) et ouvrent la même fenêtre de sélection. À différencier plus
  // tard si le circuit a besoin d'un comportement propre.
  const addExerciseLikeBlock = (type) => {
    // Inséré juste avant le cool-down s'il existe, sinon en fin de liste — jamais avant le warm-up.
    const cooldownIndex = blocks.findIndex(b => b.type === 'cooldown')
    const insertAt = cooldownIndex === -1 ? blocks.length : cooldownIndex
    const newBlock = { id: nextBlockId(), type, name: '', description: '', note: '' }
    setBlocks([...blocks.slice(0, insertAt), newBlock, ...blocks.slice(insertAt)])
    setActiveBlockIndex(insertAt)
    setAddMenuOpen(false)
    // Doit ouvrir directement le picker (écran 1), pas la carte du bloc avec ses crayons
    // name/description/note (écran 2) — celle-ci reste accessible ensuite depuis la carte pour
    // renommer/annoter le bloc après coup.
    setAddingSecondaryExercise(false)
    setPendingCircuitExercises([])
    setExerciseCategoryFilter('all')
    setExercisesModalOpen(true)
  }

  const addExerciseBlock = () => addExerciseLikeBlock('exercise')
  const addCircuitBlock = () => addExerciseLikeBlock('circuit')
  const addCardioBlock = () => addExerciseLikeBlock('cardio')

  const removeBlock = (index) => {
    const newBlocks = blocks.filter((_, i) => i !== index)
    setBlocks(newBlocks)
    setActiveBlockIndex(Math.min(index, newBlocks.length - 1))
  }

  const activeBlock = blocks[activeBlockIndex] ?? null
  // Un bloc circuit sélectionne plusieurs exercices d'un coup (voir pendingCircuitExercises) avant
  // de les valider en une fois, contrairement à un bloc exercice qui passe par la config séries/récup
  // pour chaque exercice choisi individuellement.
  const isCircuitBlock = activeBlock?.type === 'circuit'
  // Un bloc cardio ne propose que les mouvements "cardio" (Run/Row/Ski Erg) — pas la bibliothèque complète.
  const isCardioBlock = activeBlock?.type === 'cardio'

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
    closeDescModal()
  }

  const toggleMuscle = (muscle) => {
    setSelectedMuscles(prev => prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle])
  }

  const toggleMuscleGroup = (muscles, select) => {
    setSelectedMuscles(prev => select
      ? Array.from(new Set([...prev, ...muscles]))
      : prev.filter(m => !muscles.includes(m)))
  }

  const openExercisePickerForBlock = () => {
    setAddingSecondaryExercise(false)
    setPendingCircuitExercises([])
    setExerciseCategoryFilter('all')
    setExercisesModalOpen(true)
  }

  // "Follow with another exercise (Superset / Triset / Circuit)" : ajoute un exercice de plus au
  // même groupe de sets, sans repasser par la config nombre de séries / récup (déjà réglée pour
  // le groupe lors de l'ajout du premier exercice).
  const openFollowExercisePicker = () => {
    setAddingSecondaryExercise(true)
    setPendingCircuitExercises([])
    setExerciseCategoryFilter('all')
    setExercisesModalOpen(true)
  }

  const closeExercisesModal = () => {
    setExercisesModalOpen(false)
    setPendingCircuitExercises([])
  }

  const addExerciseToActiveBlock = (ex) => {
    if (!activeBlock) return
    setBlocks(blocks.map((b, i) => (
      i === activeBlockIndex ? { ...b, exercises: [...(b.exercises || []), { id: nextBlockId(), name: ex.name, equipment: ex.equipment, category: ex.category }] } : b
    )))
    setExercisesModalOpen(false)
    setAddingSecondaryExercise(false)
  }

  const toggleCircuitPending = (ex) => {
    setPendingCircuitExercises(prev => (
      prev.some(p => p.name === ex.name) ? prev.filter(p => p.name !== ex.name) : [...prev, ex]
    ))
  }

  // Valide d'un coup tous les exercices sélectionnés pour le circuit — pas de config séries/récup
  // par exercice ici (contrairement au bloc exercice) : des valeurs par défaut sont utilisées pour
  // le nombre de séries/la récup si le bloc n'en a pas encore.
  const confirmCircuitSelection = () => {
    if (!activeBlock || pendingCircuitExercises.length === 0) return
    setBlocks(blocks.map((b, i) => {
      if (i !== activeBlockIndex) return b
      const newExercises = [
        ...(b.exercises || []),
        ...pendingCircuitExercises.map(ex => ({ id: nextBlockId(), name: ex.name, equipment: ex.equipment, category: ex.category })),
      ]
      const sets = b.sets?.length > 0 ? b.sets : Array.from({ length: 3 }, () => ({ id: nextBlockId() }))
      const restSeconds = b.restSeconds ?? 60
      return { ...b, exercises: newExercises, sets, restSeconds }
    }))
    setPendingCircuitExercises([])
    setExercisesModalOpen(false)
  }

  // Choisir un exercice dans la bibliothèque (premier de son groupe) ouvre d'abord la config
  // (séries puis récup) — voir confirmRestStep pour la création réelle du groupe exercices/sets
  // dans le bloc actif, une fois les deux étapes validées.
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
              exercises: [...(b.exercises || []), { id: nextBlockId(), name: pendingExercise.name, equipment: pendingExercise.equipment, category: pendingExercise.category }],
              sets: newSets,
              restSeconds: pendingRest,
            }
          : b
      )))
    }
    closeExerciseConfig()
  }

  const addSet = () => {
    if (!activeBlock) return
    setBlocks(blocks.map((b, i) => (
      i === activeBlockIndex ? { ...b, sets: [...(b.sets || []), { id: nextBlockId() }] } : b
    )))
  }

  const removeSet = (setId) => {
    if (!activeBlock) return
    setBlocks(blocks.map((b, i) => (
      i === activeBlockIndex ? { ...b, sets: (b.sets || []).filter(s => s.id !== setId) } : b
    )))
  }

  // Réordonne les exercices d'un bloc (glisser-déposer via les 6 points) — l'index déplacé est
  // toujours résolu à l'intérieur de l'updater, à partir de l'id, jamais d'un index capturé par
  // l'appelant : SortableGroup peut appeler ceci plusieurs fois de suite avant le prochain rendu.
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
  }

  const setNoteKey = (setId, exerciseId) => `${setId}:${exerciseId}`

  // Base (VMA/Seuil 60/Δ) + %1/%2 par set, pour un exercice "Running" — mêmes champs que
  // pace_base/pct_low/pct_high du vrai produit (lib/raceEstimates.js). Le client verra le résultat
  // sous forme d'Allure 1 / Allure 2, calculé à partir de ces % (pas encore branché ici : cette
  // page reste 100% visuelle, sans données d'allure réelles d'un athlète pour faire le calcul).
  const updatePaceValue = (setId, exerciseId, field, value) => {
    setBlocks(blocks.map((b, i) => {
      if (i !== activeBlockIndex) return b
      const key = setNoteKey(setId, exerciseId)
      const paceValues = { ...(b.paceValues || {}) }
      paceValues[key] = { ...(paceValues[key] || { base: '', pctLow: '', pctHigh: '' }), [field]: value }
      return { ...b, paceValues }
    }))
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
    }
    closeSetNotesModal()
  }

  const clearSetNotesModal = () => setDraftSetNote('')

  const filteredExercises = [...MOCK_EXERCISES, ...customExercises].filter(e => (
    (isCardioBlock ? isCardioLibraryExercise(e) : (selectedMuscles.length === 0 || selectedMuscles.includes(e.muscle))) &&
    (exerciseCategoryFilter === 'all' || e.category === exerciseCategoryFilter) &&
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  ))

  // Même logique que le bouton "+" d'une ligne existante — partagée avec "Create <name>" ci-dessous
  // pour qu'un mouvement tout juste créé suive exactement le même chemin qu'un mouvement existant.
  const handlePickExercise = (ex, alreadyInBlock) => {
    if (isCircuitBlock) {
      if (!alreadyInBlock) toggleCircuitPending(ex)
    } else if (addingSecondaryExercise) {
      addExerciseToActiveBlock(ex)
    } else {
      startExerciseConfig(ex)
    }
  }

  // "Create <name>" quand la recherche ne trouve rien : ajoute le mouvement à la bibliothèque
  // locale (catégorie cardio si on est dans un bloc Cardio, sinon strength) puis l'enchaîne
  // directement dans le même flux que s'il avait été choisi dans la liste.
  const createCustomExercise = () => {
    const name = exerciseSearch.trim()
    if (!name || !activeBlock) return
    const newEx = { name, muscle: null, equipment: 'No equipment', category: isCardioBlock ? 'cardio' : 'strength' }
    setCustomExercises(prev => [...prev, newEx])
    handlePickExercise(newEx, false)
  }

  const handleDescriptionChange = (e) => {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setDraftDescription(value)
    const uptoCursor = value.slice(0, cursor)
    const hashIndex = uptoCursor.lastIndexOf('#')
    // Les noms de mouvements peuvent contenir des espaces ("Mountain Climbers") : on ne coupe donc
    // pas la recherche au premier espace, mais dès que ce qui suit le # ne préfixe plus aucun mouvement.
    const query = hashIndex === -1 ? null : uptoCursor.slice(hashIndex + 1)
    const stillMatching = query !== null && !query.includes('\n') &&
      (query === '' || MOCK_MOVEMENTS.some(m => m.toLowerCase().startsWith(query.toLowerCase())))
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
    : MOCK_MOVEMENTS.filter(m => m.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)

  return (
    <div style={{ background: c.bg, minHeight: '100svh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
            <X size={22} />
          </button>
          <input
            placeholder='Workout name &quot;Standard&quot;'
            style={{ ...input, flex: 1, fontSize: 15, padding: '10px 14px' }}
          />
          <button style={{
            flexShrink: 0, background: c.blue, color: '#fff', border: 'none', borderRadius: 'var(--r)',
            padding: '10px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Save
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
            onChange={e => setDescription(e.target.value)}
            rows={5}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', color: c.text }}
          />
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
                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: c.text, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Flame size={12} weight="fill" />
                      <span style={{ fontSize: 5, fontWeight: 800, letterSpacing: '0.2px', lineHeight: 1 }}>WARM UP</span>
                    </span>
                    Add the warm-up part
                  </button>
                  <button onClick={addCooldownBlock} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, fontSize: 14, color: c.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: c.text, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                  <button onClick={addCardioBlock} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, fontSize: 14, color: c.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 6, border: `1.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Heartbeat size={14} />
                    </span>
                    Cardio
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

        {/* Navigation entre blocs — warm-up toujours en tête, cool-down toujours en queue */}
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
                  background: isActive ? c.text : c.disabledBg, color: isActive ? '#fff' : c.textMuted,
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
          <div style={{ marginTop: 16, border: `1px solid ${c.border}`, borderRadius: 'var(--rl)', overflow: 'hidden' }}>
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
                            width: 56, height: 56, flexShrink: 0, borderRadius: 6, background: c.text, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: 4, lineHeight: 1.2,
                          }}>
                            {ex.name}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: c.text, textDecoration: 'underline' }}>{ex.name}</div>
                            <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: c.textMuted, background: c.disabledBg, borderRadius: 5, padding: '2px 8px' }}>
                              {ex.equipment}
                            </span>
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
                  // Vue provisoire pour le circuit : pas encore de SET/rep/kg structurés, juste un
                  // champ libre — à remplacer plus tard par une vue dédiée au circuit.
                  <textarea
                    key={activeBlock.id}
                    defaultValue={activeBlock.circuitNote || ''}
                    onChange={e => {
                      const value = e.target.value
                      setBlocks(blocks.map((b, i) => (i === activeBlockIndex ? { ...b, circuitNote: value } : b)))
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
                ) : (
                  <>
                    {activeBlock.sets.map((s, i) => (
                      <div key={s.id}>
                        <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', background: c.text, color: '#fff', padding: '4px 10px', borderRadius: 4 }}>
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
                                    border: `1px solid ${hasNote ? c.blue : c.border}`, background: hasNote ? c.blueBorder : c.bg, color: hasNote ? c.blue : c.text,
                                  }}
                                >
                                  <FileText size={14} /> Notes
                                </button>
                                {isPaceBasedExercise(ex) ? (() => {
                                  const pace = activeBlock.paceValues?.[setNoteKey(s.id, ex.id)] || { base: '', pctLow: '', pctHigh: '' }
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <select
                                        value={pace.base}
                                        onChange={e => updatePaceValue(s.id, ex.id, 'base', e.target.value)}
                                        style={{ width: 96, boxSizing: 'border-box', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', color: pace.base ? c.text : c.textFaint, background: c.bg }}
                                      >
                                        <option value="">Base</option>
                                        {PACE_BASES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                                      </select>
                                      <input
                                        type="number"
                                        placeholder="%1"
                                        value={pace.pctLow}
                                        onChange={e => updatePaceValue(s.id, ex.id, 'pctLow', e.target.value)}
                                        style={{ width: 52, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 4px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                                      />
                                      <input
                                        type="number"
                                        placeholder="%2"
                                        value={pace.pctHigh}
                                        onChange={e => updatePaceValue(s.id, ex.id, 'pctHigh', e.target.value)}
                                        style={{ width: 52, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 4px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                                      />
                                    </div>
                                  )
                                })() : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input placeholder="" style={{ width: 60, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 6px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                    <span style={{ fontSize: 13, color: c.textMuted }}>rep</span>
                                    <input placeholder="" style={{ width: 60, boxSizing: 'border-box', textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 6px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                                    <span style={{ fontSize: 13, color: c.textMuted }}>kg</span>
                                  </div>
                                )}
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

            {/* Name / description / note du bloc — uniquement pour warm-up et cool-down, pas pour
                un bloc exercice (dont le contenu est structuré via exercises/sets ci-dessus). */}
            {!['exercise', 'circuit', 'cardio'].includes(activeBlock.type) && (
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
            <div onClick={closeDescModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 201,
              width: 640, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto',
              background: c.bg, borderRadius: 'var(--rl)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ ...heading, fontSize: 19 }}>Description</span>
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
                      {/* Calque visuel : affiche le texte avec les mouvements liés en bleu souligné */}
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
                                color: c.text, background: i === 0 ? c.blueBorder : 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
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
            <div onClick={closeExercisesModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 201,
              width: 1100, maxWidth: 'calc(100vw - 32px)', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column',
              background: c.bg, borderRadius: 'var(--rl)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ ...heading, fontSize: 19 }}>Exercises</span>
                <button onClick={closeExercisesModal} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: c.text }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 24px', borderBottom: `1px solid ${c.border}`, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 24 }}>
                  {['Explore', 'Favorites', 'My exercises'].map((tab, i) => (
                    <span key={tab} style={{
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                      color: i === 0 ? c.text : c.textFaint, paddingBottom: 10,
                      borderBottom: i === 0 ? `2px solid ${c.text}` : '2px solid transparent', cursor: 'pointer',
                    }}>
                      {tab}
                    </span>
                  ))}
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
                  <button style={{
                    background: c.text, color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                    Search
                  </button>
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
                {/* Filtres muscles — icônes simplifiées (initiales), pas de vrai schéma anatomique */}
                <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${c.border}`, overflowY: 'auto', padding: 20 }}>
                  {isCircuitBlock && pendingCircuitExercises.length > 0 && (
                    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: c.textMuted }}>
                        SELECTED ({pendingCircuitExercises.length})
                      </div>
                      {pendingCircuitExercises.map(ex => (
                        <div key={ex.name} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          background: c.blueBorder, border: `1px solid ${c.blueBorder}`, borderRadius: 6, padding: '6px 10px',
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
                  <select value={exerciseCategoryFilter} onChange={e => setExerciseCategoryFilter(e.target.value)} style={{ ...input, marginBottom: 20 }}>
                    <option value="all">All Exercises</option>
                    <option value="performance">Performance</option>
                  </select>
                  {!isCardioBlock && (
                    <>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: c.textMuted, marginBottom: 14 }}>MUSCLES</div>
                  {MUSCLE_GROUPS.map(group => (
                    <div key={group.label} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{group.label}</span>
                        <span style={{ fontSize: 11, color: c.blue }}>
                          <button onClick={() => toggleMuscleGroup(group.muscles, true)} style={{ border: 'none', background: 'none', color: c.blue, cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600 }}>ALL</button>
                          {' / '}
                          <button onClick={() => toggleMuscleGroup(group.muscles, false)} style={{ border: 'none', background: 'none', color: c.blue, cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600 }}>NONE</button>
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {group.muscles.map(muscle => {
                          const active = selectedMuscles.includes(muscle)
                          return (
                            <button key={muscle} onClick={() => toggleMuscle(muscle)} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            }}>
                              <span style={{
                                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, background: active ? c.blue : c.disabledBg, color: active ? '#fff' : c.textMuted,
                              }}>
                                {muscle.slice(0, 2).toUpperCase()}
                              </span>
                              <span style={{ fontSize: 10, color: c.textMuted, textAlign: 'center' }}>{muscle}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                    </>
                  )}
                </div>

                {/* Liste des exercices */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
                  {filteredExercises.map(ex => {
                    const alreadyInBlock = activeBlock?.exercises?.some(e => e.name === ex.name)
                    const isPending = pendingCircuitExercises.some(p => p.name === ex.name)
                    const added = alreadyInBlock || (isCircuitBlock && isPending)
                    return (
                      <div key={ex.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: `1px solid ${c.border}` }}>
                        <div style={{
                          width: 64, height: 64, flexShrink: 0, borderRadius: 6, background: c.text, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: 4, lineHeight: 1.2,
                        }}>
                          {ex.name}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: c.text, textDecoration: 'underline' }}>{ex.name}</div>
                          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: c.textMuted, background: c.disabledBg, borderRadius: 5, padding: '2px 8px' }}>
                            {ex.equipment}
                          </span>
                        </div>
                        <button style={{ display: 'flex', background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: c.textFaint, flexShrink: 0 }}>
                          <Star size={20} />
                        </button>
                        <button
                          onClick={() => handlePickExercise(ex, alreadyInBlock)}
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
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, color: c.textMuted, marginBottom: exerciseSearch.trim() ? 16 : 0 }}>No exercise matches your filters.</div>
                      {exerciseSearch.trim() && (
                        <button
                          onClick={createCustomExercise}
                          disabled={!activeBlock}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, border: `1.5px solid ${c.blue}`, color: c.blue,
                            fontWeight: 700, fontSize: 14, borderRadius: 'var(--r)', padding: '10px 18px', background: c.bg,
                            cursor: activeBlock ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <Plus size={15} weight="bold" /> Create &quot;{exerciseSearch.trim()}&quot;
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modales de config après choix d'un exercice : nombre de séries puis temps de récup */}
        {configStep === 'sets' && (
          <>
            <div onClick={closeExerciseConfig} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 210 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 211,
              width: 520, maxWidth: 'calc(100vw - 32px)', background: c.bg, borderRadius: 'var(--rl)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ ...heading, fontSize: 19 }}>Number of sets</span>
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
            <div onClick={closeExerciseConfig} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 210 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 211,
              width: 520, maxWidth: 'calc(100vw - 32px)', background: c.bg, borderRadius: 'var(--rl)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ ...heading, fontSize: 19 }}>Rest time</span>
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
            <div onClick={closeSetNotesModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 220 }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 221,
              width: 560, maxWidth: 'calc(100vw - 32px)', background: c.bg, borderRadius: 'var(--rl)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
                <span style={{ ...heading, fontSize: 19 }}>Notes</span>
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
