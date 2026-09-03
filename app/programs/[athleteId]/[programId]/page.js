'use client'

import { useState, useEffect, useRef, use, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import ObjectivesBlock from '@/app/components/ObjectivesBlock'
import { MUSCLE_GROUPS } from '@/app/components/MuscleAnatomyDiagram'
import { parseMusclesFromText } from '@/app/components/CelebrationModal'
import { isRunMovement, is3030Movement, PACE_BASES, computePaceForBasePct, computeDistanceForBasePct, buildKnownRaces, formatPace, formatDistance } from '@/lib/raceEstimates'
import { CIRCUIT_MODES } from '@/lib/circuitModes'
import { WEEK_DAYS } from '@/lib/weekDays'
import { setUnsavedChanges, guardNavigation } from '@/lib/unsavedChanges'
import { SortableGroup, SortableItem, DragHandle } from '@/app/components/SortableItem'
import { getCoachId } from '@/lib/coach'
import ActivityTypeSelect from '@/app/components/ActivityTypeSelect'
import { notifyAssigned } from '@/lib/notify'
import TimerConfigEditor, { defaultTimerConfig } from '@/app/components/TimerConfigEditor'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function formatDuration(min) {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

// Auto-agrandit une textarea pour montrer tout son contenu, sans scroll interne ni redimension
// manuelle — passé en ref (fonction inline recréée à chaque render pour se redéclencher à
// chaque frappe, cf. usages ci-dessous).
function autoGrow(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function scoreColor(val, inverse) {
  const s = inverse ? (11 - val) : val
  if (s >= 7) return '#22c55e'
  if (s >= 4) return '#f59e0b'
  return '#ef4444'
}

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function emptyExo(order) {
  return { _key: Date.now() + Math.random(), order_index: order, name: '', sets: '', reps: '', kg: '', rest: '', note: '', video_url: '', focus_muscles: '', pace_base: null, pct_low: '', pct_high: '' }
}

function computeLabels(exercises) {
  const labels = {}
  let li = 0, i = 0
  while (i < exercises.length) {
    const g = exercises[i].superset_group
    if (!g) {
      labels[exercises[i]._key || exercises[i].id] = String.fromCharCode(65 + li)
      li++; i++
    } else {
      let j = i
      while (j < exercises.length && exercises[j].superset_group === g) j++
      const l = String.fromCharCode(65 + li)
      for (let k = i; k < j; k++) labels[exercises[k]._key || exercises[k].id] = `${l}${k - i + 1}`
      li++; i = j
    }
  }
  return labels
}

function torqueColor(label) {
  const l = label.toLowerCase()
  if (l.includes('intern')) return '#2563EB'
  if (l.includes('extern')) return '#f59e0b'
  return '#8B5CF6'
}

function SessionSummaryBlock({ exercises }) {
  const [summary, setSummary] = useState(null)
  const [pinned, setPinned] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const names = exercises.map(e => e.name.trim()).filter(Boolean)
  const namesLower = new Set(names.map(n => n.toLowerCase()))
  // Inclut les séries dans la clé de dépendance : changer le nombre de séries d'un exercice sans
  // toucher son nom doit quand même recalculer le volume par muscle.
  const summaryKey = exercises.map(e => `${e.name.trim().toLowerCase()}:${e.sets || 0}`).join('|')

  useEffect(() => {
    if (names.length === 0) { setSummary(null); return }
    // Bibliothèque récupérée en entier plutôt que filtrée par .in('name', …), sensible à la casse
    // côté Postgres — sinon un nom mal accordé (ex. casse différente) est raté silencieusement.
    supabase.from('movements').select('name, muscles, torque').then(({ data: allMovs }) => {
      const movs = (allMovs || []).filter(m => namesLower.has(m.name.trim().toLowerCase()))
      if (!movs?.length) { setSummary(null); return }

      const movMuscles = {}
      movs.forEach(m => { movMuscles[m.name.trim().toLowerCase()] = (m.muscles || '').split(',').map(s => s.trim()).filter(Boolean) })

      const seen = new Set()
      const muscles = []
      const torqueCounts = {}
      const setsByMuscle = {}

      movs.forEach(m => {
        if (m.muscles) {
          m.muscles.split(',').map(s => s.trim()).filter(Boolean).forEach(muscle => {
            if (!seen.has(muscle)) { seen.add(muscle); muscles.push(muscle) }
          })
        }
        if (m.torque) {
          const t = m.torque.trim()
          torqueCounts[t] = (torqueCounts[t] || 0) + 1
        }
      })

      // Séries par muscle : parcourt chaque exercice de la séance (pas juste les mouvements
      // distincts) pour cumuler les séries de chaque occurrence sur les muscles qu'il sollicite.
      exercises.forEach(e => {
        const musclesForExo = movMuscles[e.name.trim().toLowerCase()]
        if (!musclesForExo?.length || !e.sets) return
        musclesForExo.forEach(muscle => {
          setsByMuscle[muscle] = (setsByMuscle[muscle] || 0) + Number(e.sets)
        })
      })

      if (muscles.length === 0 && Object.keys(torqueCounts).length === 0 && Object.keys(setsByMuscle).length === 0) { setSummary(null); return }
      setSummary({ muscles, torqueCounts, setsByMuscle })
    })
  }, [summaryKey])

  if (!summary) return null
  const totalTorque = Object.values(summary.torqueCounts).reduce((a, b) => a + b, 0)
  const muscleEntries = Object.entries(summary.setsByMuscle).sort((a, b) => b[1] - a[1])

  const detail = (
    <>
      {muscleEntries.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Séries par muscle</div>
          {muscleEntries.map(([muscle, count]) => (
            <div key={muscle} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{muscle}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>{count} série{count > 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      )}

      {totalTorque > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Répartition torque <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({totalTorque} ex. renseignés)</span></div>
          {Object.entries(summary.torqueCounts).map(([label, count]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: torqueColor(label), flexShrink: 0 }}>{Math.round((count / totalTorque) * 100)}%</div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      ...(pinned ? { position: 'sticky', top: 90, zIndex: 30, boxShadow: '0 4px 16px rgba(0,0,0,.12)' } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Résumé de séance</div>
        <button onClick={() => setPinned(v => !v)} title={pinned ? 'Désépingler' : 'Épingler en haut pendant le scroll'}
          style={{ background: pinned ? 'var(--green-light)' : 'none', border: pinned ? '1px solid #B8EAD8' : '1px solid var(--border2)', borderRadius: 20, padding: '2px 7px', fontSize: 12, cursor: 'pointer', color: pinned ? 'var(--green)' : 'var(--text3)', lineHeight: 1 }}>
          📌
        </button>
        <button onClick={() => setShowModal(true)} title="Voir le détail (séries par muscle)"
          style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '2px 7px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>
          ⤢
        </button>
      </div>

      {summary.muscles.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }}>Muscles sollicités</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {summary.muscles.map((m, i) => (
              <span key={i} style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 400, maxHeight: '80svh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17 }}>📊 Résumé de séance</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>×</button>
            </div>

            {summary.muscles.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }}>Muscles sollicités</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {summary.muscles.map((m, i) => (
                    <span key={i} style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{m}</span>
                  ))}
                </div>
              </div>
            )}

            {detail}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProgramEditorPageWrapper({ params }) {
  return <Suspense><ProgramEditorPage params={params} /></Suspense>
}

function ProgramEditorPage({ params }) {
  const { athleteId, programId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const openFromUrl = searchParams.get('open')
  const [athlete, setAthlete] = useState(null)
  const [program, setProgram] = useState(null)
  const [sessions, setSessions] = useState([])
  const [movementMusclesMap, setMovementMusclesMap] = useState({})
  const [movementFocusGroupsMap, setMovementFocusGroupsMap] = useState({})
  const [openId, setOpenId] = useState(openFromUrl)
  const [suggestions, setSuggestions] = useState({})
  const [videoInputKey, setVideoInputKey] = useState(null)
  const [videoInputVal, setVideoInputVal] = useState('')
  const [videoPreviewKey, setVideoPreviewKey] = useState(null)
  const [focusPickerKey, setFocusPickerKey] = useState(null)
  const [actVideoSearch, setActVideoSearch] = useState({})
  const [actVideoSuggs, setActVideoSuggs] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedIds, setSavedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [layoutCols, setLayoutCols] = useState(1)
  const [historyExo, setHistoryExo] = useState(null)
  const [selectedSessions, setSelectedSessions] = useState(new Set())
  const [hiddenSessions, setHiddenSessions] = useState(new Set())
  const [pinnedSessions, setPinnedSessions] = useState(new Set())
  const [duplicatingSelected, setDuplicatingSelected] = useState(false)
  const [titleSaving, setTitleSaving] = useState(false)
  const [actPresetSearch, setActPresetSearch] = useState({})
  const [actPresetSuggs, setActPresetSuggs] = useState({})
  const [dirtySessionIds, setDirtySessionIds] = useState(new Set())
  const [timerEditor, setTimerEditor] = useState(null) // { sessId, kind: 'exercise'|'circuit', targetKey, config }
  const markDirty = (sessId) => setDirtySessionIds(prev => new Set(prev).add(sessId))

  // Les modifications de séance/exercice ne sont écrites en base qu'au clic sur "Sauvegarder
  // la séance" (saveSession) — ce garde-fou évite de perdre silencieusement des éditions en
  // quittant la page (navigation interne ou fermeture/rechargement de l'onglet).
  useEffect(() => {
    setUnsavedChanges(dirtySessionIds.size > 0)
  }, [dirtySessionIds])

  useEffect(() => {
    return () => setUnsavedChanges(false)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (dirtySessionIds.size === 0) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtySessionIds])
  const [completionsMap, setCompletionsMap] = useState({})
  const [logsMap, setLogsMap] = useState({})
  const [objectives, setObjectives] = useState([])
  const [noteBlocks, setNoteBlocks] = useState([])
  const [raceKnown, setRaceKnown] = useState({})
  const [participants, setParticipants] = useState([])
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [otherAthletes, setOtherAthletes] = useState([])
  const [addingParticipantId, setAddingParticipantId] = useState(null)
  const [removingParticipantId, setRemovingParticipantId] = useState(null)

  const isTemplate = athleteId === 'templates'

  useEffect(() => {
    // Masquage propre au coach : stocké côté serveur (comme les mouvements/tips masqués) plutôt
    // qu'en localStorage, pour que ça survive à un changement d'appareil ou un nettoyage du
    // navigateur, tout en restant strictement privé (jamais vu par les clients).
    supabase.from('coach_hidden_content').select('content_id').eq('content_type', 'program_session')
      .then(({ data }) => setHiddenSessions(new Set((data || []).map(r => r.content_id))))
    const rawPinned = localStorage.getItem(`coachpro_pinned_sessions_${programId}`)
    if (rawPinned) setPinnedSessions(new Set(JSON.parse(rawPinned)))
  }, [programId])

  const toggleHiddenSession = async (id) => {
    const isHidden = hiddenSessions.has(id)
    if (isHidden) {
      await supabase.from('coach_hidden_content').delete().eq('content_type', 'program_session').eq('content_id', id)
      setHiddenSessions(prev => { const next = new Set(prev); next.delete(id); return next })
    } else {
      const coachId = await getCoachId()
      await supabase.from('coach_hidden_content').insert({ coach_id: coachId, content_type: 'program_session', content_id: id })
      setHiddenSessions(prev => new Set(prev).add(id))
    }
  }

  const togglePinnedSession = (id) => {
    setPinnedSessions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(`coachpro_pinned_sessions_${programId}`, JSON.stringify([...next]))
      return next
    })
  }

  useEffect(() => {
    if (isTemplate || !athleteId) return
    supabase.from('tracked_movements').select('id, name, unit, tracked_movement_entries(value, athlete_id, date)')
      .then(({ data }) => {
        const movements = (data || []).map(m => ({
          ...m,
          entries: (m.tracked_movement_entries || []).filter(e => e.athlete_id === athleteId),
        }))
        setRaceKnown(buildKnownRaces(movements))
      })
  }, [athleteId, isTemplate])

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: prog }, { data: sess }] = await Promise.all([
        isTemplate ? Promise.resolve({ data: null }) : supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('programs').select('*').eq('id', programId).single(),
        supabase.from('program_sessions')
          .select('*, program_exercises(*)')
          .eq('program_id', programId)
          .order('order_index')
      ])
      setAthlete(a)
      setProgram(prog)

      if (!isTemplate && prog?.group_batch_id) {
        const { data: parts } = await supabase.from('programs')
          .select('id, athlete_id, athletes(name)')
          .eq('group_batch_id', prog.group_batch_id)
          .order('created_at')
        setParticipants(parts || [])
      }

      const hasExercises = (sess || []).some(s => (s.program_exercises || []).some(e => e.name))
      let movieMap = {}
      if (hasExercises) {
        // Bibliothèque récupérée en entier (petit volume) plutôt que filtrée par .in('name', …), qui
        // est sensible à la casse côté Postgres et raterait silencieusement un nom mal accordé.
        const { data: movs } = await supabase.from('movements').select('name, youtube_url, muscles, focus_groups')
        ;(movs || []).forEach(m => { movieMap[m.name.trim().toLowerCase()] = m.youtube_url })
        const musclesMap = {}
        ;(movs || []).forEach(m => { if (m.muscles) musclesMap[m.name.trim().toLowerCase()] = m.muscles })
        setMovementMusclesMap(musclesMap)
        const focusMap = {}
        ;(movs || []).forEach(m => { if (m.focus_groups) focusMap[m.name.trim().toLowerCase()] = m.focus_groups })
        setMovementFocusGroupsMap(focusMap)
      }

      const loaded = (sess || []).map(s => ({
        ...s,
        exercises: [...(s.program_exercises || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map(e => ({ ...e, _key: e.id, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '', rest: e.rest ?? '', note: e.note ?? '', video_url: (movieMap[e.name?.trim().toLowerCase()] ?? e.video_url) || '', superset_group: e.superset_group || null, pct_low: e.pct_low ?? '', pct_high: e.pct_high ?? '' })),
        activation_videos: s.activation_videos || [],
        circuits: s.circuits || [],
      }))
      setSessions(loaded)
      if (loaded.length === 1) setOpenId(loaded[0].id)

      if (!isTemplate && a) {
        const sessionIds = (sess || []).map(s => s.id)
        const exerciseIds = (sess || []).flatMap(s => (s.program_exercises || []).map(e => e.id))
        if (sessionIds.length) {
          const { data: comps } = await supabase.from('program_completions')
            .select('*').eq('athlete_id', a.id).in('program_session_id', sessionIds)
          const cMap = {}
          ;(comps || []).forEach(c => { cMap[c.program_session_id] = c })
          setCompletionsMap(cMap)
        }
        if (exerciseIds.length) {
          const { data: logs } = await supabase.from('program_exercise_logs')
            .select('*').eq('athlete_id', a.id).in('program_exercise_id', exerciseIds)
          const lMap = {}
          ;(logs || []).forEach(l => { lMap[l.program_exercise_id] = l })
          setLogsMap(lMap)
        }

        const [{ data: objs }, { data: blocks }] = await Promise.all([
          supabase.from('athlete_objectives').select('*').eq('athlete_id', a.id).order('created_at'),
          supabase.from('athlete_note_blocks').select('*').eq('athlete_id', a.id).order('order_index'),
        ])
        setObjectives(objs || [])
        setNoteBlocks(blocks || [])
      }

      setLoading(false)
    }
    load()
  }, [athleteId, programId])

  // Helpers pour modifier une session
  const updateSession = (id, field, value) => {
    markDirty(id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const updateExo = (sessId, key, field, val) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, exercises: s.exercises.map(e => e._key === key ? { ...e, [field]: val } : e)
    }))
  }

  const addExo = (sessId) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, exercises: [...s.exercises, emptyExo(s.exercises.length)]
    }))
  }

  const removeExo = (sessId, key) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, exercises: s.exercises.filter(e => e._key !== key).length
        ? s.exercises.filter(e => e._key !== key)
        : [emptyExo(0)]
    }))
  }

  const moveExo = (sessId, key, dir) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => {
      if (s.id !== sessId) return s
      const exos = [...s.exercises]
      const idx = exos.findIndex(e => e._key === key)
      const to = idx + dir
      if (to < 0 || to >= exos.length) return s
      ;[exos[idx], exos[to]] = [exos[to], exos[idx]]
      return { ...s, exercises: exos }
    }))
  }

  const searchMovements = async (key, val) => {
    if (val.trim().length < 2) { setSuggestions(prev => ({ ...prev, [key]: [] })); return }
    const { data } = await supabase.from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions(prev => ({ ...prev, [key]: (data || []).map(m => m.name) }))
  }

  const pickSuggestion = async (sessId, key, name) => {
    updateExo(sessId, key, 'name', name)
    setSuggestions(prev => ({ ...prev, [key]: [] }))
    const { data: mov } = await supabase.from('movements').select('youtube_url').eq('name', name).single()
    if (mov?.youtube_url) updateExo(sessId, key, 'video_url', mov.youtube_url)
  }

  const searchActPreset = async (sessId, val) => {
    setActPresetSearch(prev => ({ ...prev, [sessId]: val }))
    if (val.trim().length < 1) { setActPresetSuggs(prev => ({ ...prev, [sessId]: [] })); return }
    const { data } = await supabase.from('activation_presets').select('*').ilike('name', `%${val.trim()}%`).limit(8)
    setActPresetSuggs(prev => ({ ...prev, [sessId]: data || [] }))
  }

  const applyActPreset = (sessId, preset) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, activation: preset.text || '', activation_videos: preset.videos || [],
    }))
    setActPresetSearch(prev => ({ ...prev, [sessId]: '' }))
    setActPresetSuggs(prev => ({ ...prev, [sessId]: [] }))
  }

  const searchActVideo = async (sessId, val) => {
    setActVideoSearch(prev => ({ ...prev, [sessId]: val }))
    if (val.trim().length < 2) { setActVideoSuggs(prev => ({ ...prev, [sessId]: [] })); return }
    const { data } = await supabase.from('movements').select('name, youtube_url').ilike('name', `%${val.trim()}%`).limit(8)
    setActVideoSuggs(prev => ({ ...prev, [sessId]: data || [] }))
  }

  const addActVideo = (sessId, mov) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, activation_videos: [...(s.activation_videos || []), { name: mov.name, video_url: mov.youtube_url || '' }]
    }))
    setActVideoSearch(prev => ({ ...prev, [sessId]: '' }))
    setActVideoSuggs(prev => ({ ...prev, [sessId]: [] }))
  }

  const createActVideo = async (sessId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    await supabase.from('movements').upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true })
    addActVideo(sessId, { name: trimmed, youtube_url: '' })
  }

  const removeActVideo = (sessId, idx) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, activation_videos: (s.activation_videos || []).filter((_, i) => i !== idx)
    }))
  }

  const updateActVideoUrl = async (sessId, idx, url) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, activation_videos: (s.activation_videos || []).map((v, i) => i === idx ? { ...v, video_url: url } : v)
    }))
    if (!url) return
    const sess = sessions.find(s => s.id === sessId)
    const name = sess?.activation_videos?.[idx]?.name
    if (name) await supabase.from('movements').update({ youtube_url: url }).eq('name', name)
  }

  // Séances "Explication" : une seule vidéo simple (pas de recherche de mouvement), stockée dans
  // le même champ activation_videos pour ne pas ajouter de colonne dédiée.
  const setExplicationVideo = (sessId, url) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, activation_videos: url ? [{ name: 'Vidéo', video_url: url }] : []
    }))
  }

  const addCircuit = (sessId) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: [...(s.circuits || []), { id: Date.now() + Math.random(), text: '', videos: [], afterExerciseIndex: s.exercises.length }]
    }))
  }

  // Déplace un circuit avant/après l'exercice voisin — afterExerciseIndex vaut de 0 (avant le
  // premier exercice) à exercises.length (après le dernier), pour permettre "A, B, C, Circuit, D…".
  const moveCircuit = (sessId, circuitId, dir) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => {
      if (s.id !== sessId) return s
      const maxIdx = s.exercises.length
      return {
        ...s,
        circuits: (s.circuits || []).map(c => c.id !== circuitId ? c : {
          ...c, afterExerciseIndex: Math.max(0, Math.min(maxIdx, (c.afterExerciseIndex ?? 0) + dir))
        })
      }
    }))
  }

  const removeCircuit = (sessId, circuitId) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).filter(c => c.id !== circuitId)
    }))
  }

  const updateCircuitText = (sessId, circuitId, text) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).map(c => c.id === circuitId ? { ...c, text } : c)
    }))
  }

  const updateCircuitName = (sessId, circuitId, name) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).map(c => c.id === circuitId ? { ...c, name } : c)
    }))
  }

  const updateCircuitTimer = (sessId, circuitId, timer) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).map(c => c.id === circuitId ? { ...c, timer } : c)
    }))
  }

  // result_mode fixe le type de résultat que le client devra remplir (Temps/Tours/Reps/Tours&Reps) ;
  // null = libre, le client choisit lui-même (comportement historique, toujours utilisé pour les
  // circuits créés par le client dans ses séances libres).
  const updateCircuitResultMode = (sessId, circuitId, resultMode) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).map(c => c.id === circuitId ? { ...c, result_mode: resultMode || null } : c)
    }))
  }

  // Un exercice porte le timer du bloc dont il est le premier — solo (label "A") ou tête de
  // superset (label "A1") — jamais un exercice A2/A3 qui appartient déjà au bloc A.
  const isGroupStart = (exos, ei) => !exos[ei].superset_group || ei === 0 || exos[ei - 1].superset_group !== exos[ei].superset_group

  const openExerciseTimer = (sessId, exo) => {
    setTimerEditor({ sessId, kind: 'exercise', targetKey: exo._key, config: exo.timer_config || defaultTimerConfig() })
  }
  const openCircuitTimer = (sessId, circuit) => {
    setTimerEditor({ sessId, kind: 'circuit', targetKey: circuit.id, config: circuit.timer || defaultTimerConfig() })
  }
  const saveTimerEditor = () => {
    if (!timerEditor) return
    if (timerEditor.kind === 'exercise') updateExo(timerEditor.sessId, timerEditor.targetKey, 'timer_config', timerEditor.config)
    else updateCircuitTimer(timerEditor.sessId, timerEditor.targetKey, timerEditor.config)
    setTimerEditor(null)
  }
  const removeTimerEditor = () => {
    if (!timerEditor) return
    if (timerEditor.kind === 'exercise') updateExo(timerEditor.sessId, timerEditor.targetKey, 'timer_config', null)
    else updateCircuitTimer(timerEditor.sessId, timerEditor.targetKey, null)
    setTimerEditor(null)
  }

  const searchCircuitVideo = async (key, val) => {
    setActVideoSearch(prev => ({ ...prev, [key]: val }))
    if (val.trim().length < 2) { setActVideoSuggs(prev => ({ ...prev, [key]: [] })); return }
    const { data } = await supabase.from('movements').select('name, youtube_url').ilike('name', `%${val.trim()}%`).limit(8)
    setActVideoSuggs(prev => ({ ...prev, [key]: data || [] }))
  }

  const addCircuitVideo = (sessId, circuitId, key, mov) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).map(c => c.id !== circuitId ? c : {
        ...c, videos: [...(c.videos || []), { name: mov.name, video_url: mov.youtube_url || '' }]
      })
    }))
    setActVideoSearch(prev => ({ ...prev, [key]: '' }))
    setActVideoSuggs(prev => ({ ...prev, [key]: [] }))
  }

  const createCircuitVideo = async (sessId, circuitId, key, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    await supabase.from('movements').upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true })
    addCircuitVideo(sessId, circuitId, key, { name: trimmed, youtube_url: '' })
  }

  const removeCircuitVideo = (sessId, circuitId, idx) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).map(c => c.id !== circuitId ? c : {
        ...c, videos: (c.videos || []).filter((_, i) => i !== idx)
      })
    }))
  }

  const updateCircuitVideoUrl = async (sessId, circuitId, idx, url) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, circuits: (s.circuits || []).map(c => c.id !== circuitId ? c : {
        ...c, videos: (c.videos || []).map((v, i) => i === idx ? { ...v, video_url: url } : v)
      })
    }))
    if (!url) return
    const sess = sessions.find(s => s.id === sessId)
    const circuit = sess?.circuits?.find(c => c.id === circuitId)
    const name = circuit?.videos?.[idx]?.name
    if (name) await supabase.from('movements').update({ youtube_url: url }).eq('name', name)
  }

  const toggleSuperset = (sessId, ei) => {
    markDirty(sessId)
    setSessions(prev => prev.map(s => {
      if (s.id !== sessId) return s
      const exos = [...s.exercises]
      const a = exos[ei], b = exos[ei + 1]
      if (!a || !b) return s
      if (a.superset_group && a.superset_group === b.superset_group) {
        return { ...s, exercises: exos.map((e, i) => i === ei || i === ei + 1 ? { ...e, superset_group: null } : e) }
      } else {
        const group = a.superset_group || b.superset_group || Math.random().toString(36).slice(2, 8)
        return { ...s, exercises: exos.map((e, i) => i === ei || i === ei + 1 ? { ...e, superset_group: group } : e) }
      }
    }))
  }

  const saveMovementVideo = async (sessId, exoKey, exoName, url) => {
    const trimmed = url.trim()
    if (!trimmed) { setVideoInputKey(null); return }
    await supabase.from('movements').update({ youtube_url: trimmed }).eq('name', exoName)
    updateExo(sessId, exoKey, 'video_url', trimmed)
    setVideoInputKey(null)
    setVideoInputVal('')
  }

  const propagateSessionToClients = async (sessId, sessOrderIndex, fields, exos) => {
    const { data: clientPrograms } = await supabase.from('programs').select('id, athlete_id').eq('source_program_id', programId)
    if (!clientPrograms?.length) return

    for (const cp of clientPrograms) {
      let { data: clientSess } = await supabase.from('program_sessions')
        .select('id').eq('program_id', cp.id).eq('source_session_id', sessId).maybeSingle()

      if (!clientSess) {
        // Nouvelle séance côté template, jamais vue par ce client : on la crée
        const { data: created } = await supabase.from('program_sessions')
          .insert({ program_id: cp.id, order_index: sessOrderIndex, title: fields.title, source_session_id: sessId, session_type: fields.session_type || null, materiel: fields.materiel || null, day_of_week: fields.day_of_week ?? null, hidden_until_run: !!fields.hidden_until_run })
          .select().single()
        clientSess = created
        if (!clientSess) continue
      } else {
        // Séance déjà validée par ce sportif : on ne touche à rien (contenu + historique intacts)
        const { data: completion } = await supabase.from('program_completions')
          .select('program_session_id').eq('program_session_id', clientSess.id).maybeSingle()
        if (completion) continue

        await supabase.from('program_sessions').update({
          title: fields.title, activation: fields.activation,
          coach_notes: fields.coach_notes, activation_videos: fields.activation_videos,
          circuits: fields.circuits, session_type: fields.session_type || null,
          materiel: fields.materiel || null, day_of_week: fields.day_of_week ?? null, hidden_until_run: !!fields.hidden_until_run,
        }).eq('id', clientSess.id)
      }

      // Met à jour les exercices EN PLACE (par position) pour ne pas casser l'historique
      // lié à l'id de chaque exercice (program_exercise_logs, exercise_performance_history)
      const { data: existingExos } = await supabase.from('program_exercises')
        .select('id').eq('program_session_id', clientSess.id).order('order_index')
      const existing = existingExos || []
      const maxLen = Math.max(existing.length, exos.length)

      for (let j = 0; j < maxLen; j++) {
        const e = exos[j]
        if (e && existing[j]) {
          await supabase.from('program_exercises').update({
            order_index: j, name: e.name, sets: e.sets, reps: e.reps, kg: e.kg,
            rest: e.rest, note: e.note, video_url: e.video_url, superset_group: e.superset_group,
            focus_muscles: e.focus_muscles || null, timer_config: e.timer_config || null,
          }).eq('id', existing[j].id)
        } else if (e && !existing[j]) {
          await supabase.from('program_exercises').insert({
            program_session_id: clientSess.id, order_index: j, name: e.name,
            sets: e.sets, reps: e.reps, kg: e.kg, rest: e.rest, note: e.note,
            video_url: e.video_url, superset_group: e.superset_group,
            focus_muscles: e.focus_muscles || null, timer_config: e.timer_config || null,
          })
        } else if (!e && existing[j]) {
          await supabase.from('program_exercises').delete().eq('id', existing[j].id)
        }
      }
    }
  }

  const saveSession = async (sessId) => {
    setSaving(true)
    const s = sessions.find(sess => sess.id === sessId)
    if (!s) { setSaving(false); return }

    const sessFields = {
      title: s.title || '', activation: s.activation || null,
      coach_notes: s.coach_notes || null, activation_videos: s.activation_videos || [],
      circuits: s.circuits || [], session_type: s.session_type || null,
      materiel: s.materiel || null, day_of_week: s.day_of_week ?? null, hidden_until_run: !!s.hidden_until_run,
    }
    const { error: sessErr } = await supabase.from('program_sessions').update(sessFields).eq('id', s.id)
    if (sessErr) { alert('Erreur sauvegarde séance : ' + sessErr.message); setSaving(false); return }

    // Met à jour les exercices EN PLACE (par position) pour ne pas casser l'historique
    // lié à l'id de chaque exercice (program_exercise_logs, exercise_performance_history)
    const toKeep = s.exercises.filter(e => e.name.trim())
    const fields = (e, j) => ({
      order_index: j, name: e.name.trim(),
      sets: e.sets !== '' ? parseInt(e.sets) : null,
      reps: e.reps || null,
      kg: e.kg !== '' && !isNaN(parseFloat(e.kg)) ? parseFloat(e.kg) : null,
      rest: e.rest || null,
      note: e.note || null,
      video_url: e.video_url || null,
      superset_group: e.superset_group || null,
      focus_muscles: e.focus_muscles || null,
      pace_base: e.pace_base || null,
      pct_low: e.pct_low !== '' && e.pct_low != null ? parseFloat(e.pct_low) : null,
      pct_high: e.pct_high !== '' && e.pct_high != null ? parseFloat(e.pct_high) : null,
      timer_config: e.timer_config || null,
    })

    const { data: existingExos } = await supabase.from('program_exercises')
      .select('id').eq('program_session_id', s.id).order('order_index')
    const existing = existingExos || []
    const maxLen = Math.max(existing.length, toKeep.length)
    const results = []

    for (let j = 0; j < maxLen; j++) {
      const e = toKeep[j]
      if (e && existing[j]) {
        const { error } = await supabase.from('program_exercises').update(fields(e, j)).eq('id', existing[j].id)
        if (error) { alert('Erreur mise à jour exercices : ' + error.message); setSaving(false); return }
        results[j] = { id: existing[j].id }
      } else if (e && !existing[j]) {
        const { data: created, error } = await supabase.from('program_exercises')
          .insert({ program_session_id: s.id, ...fields(e, j) }).select().single()
        if (error) { alert('Erreur insertion exercices : ' + error.message); setSaving(false); return }
        results[j] = created
      } else if (!e && existing[j]) {
        const { error } = await supabase.from('program_exercises').delete().eq('id', existing[j].id)
        if (error) {
          alert(error.code === '23503'
            ? 'Impossible de supprimer cet exercice : un sportif a déjà enregistré une performance dessus.'
            : 'Erreur suppression exercices : ' + error.message)
          setSaving(false); return
        }
      }
    }

    const toInsert = toKeep.map((e, j) => fields(e, j))
    if (toInsert.length) {
      setSessions(prev => prev.map(sess => sess.id !== sessId ? sess : {
        ...sess,
        exercises: toKeep.map((e, j) => ({
          ...e, _key: results[j]?.id || e._key, id: results[j]?.id || e.id
        }))
      }))
      await supabase.from('movements').upsert(toInsert.map(e => ({ name: e.name })), { onConflict: 'name', ignoreDuplicates: true })
    }

    await propagateSessionToClients(sessId, s.order_index ?? 0, sessFields, toInsert)

    setDirtySessionIds(prev => { const next = new Set(prev); next.delete(sessId); return next })
    setSavedIds(prev => new Set(prev).add(sessId))
    setTimeout(() => setSavedIds(prev => { const next = new Set(prev); next.delete(sessId); return next }), 2000)
  }

  // Sauvegarde la séance cliquée et, avec elle, toutes les autres séances qui ont des
  // modifications en attente — un seul clic sur "Sauvegarder" suffit pour tout enregistrer.
  const saveAllDirtySessions = async (primarySessId) => {
    setSaving(true)
    const idsToSave = [primarySessId, ...dirtySessionIds].filter((id, i, arr) => arr.indexOf(id) === i)
    for (const id of idsToSave) {
      await saveSession(id)
    }
    setSaving(false)
  }

  const addSession = async () => {
    const { data: s } = await supabase.from('program_sessions')
      .insert({ program_id: programId, order_index: sessions.length, title: '' })
      .select().single()
    if (s) {
      const newS = { ...s, exercises: [emptyExo(0)] }
      setSessions(prev => [...prev, newS])
      setOpenId(s.id)
    }
  }

  const duplicateSession = async (id, forcedIdx = null, opts = {}) => {
    const s = sessions.find(sess => sess.id === id)
    if (!s) return

    const { data: newSession, error: sessErr } = await supabase.from('program_sessions')
      .insert({
        program_id: programId, order_index: forcedIdx !== null ? forcedIdx : sessions.length,
        title: s.title ? `${s.title} (copie)` : '',
        activation: s.activation || null, coach_notes: s.coach_notes || null,
        activation_videos: s.activation_videos || [], session_type: s.session_type || null,
        materiel: s.materiel || null,
      })
      .select().single()
    if (sessErr || !newSession) { alert('Erreur duplication : ' + sessErr?.message); return }

    const toInsert = s.exercises.filter(e => e.name.trim()).map((e, j) => ({
      program_session_id: newSession.id, order_index: j, name: e.name.trim(),
      sets: e.sets !== '' ? parseInt(e.sets) : null,
      reps: e.reps || null,
      kg: e.kg !== '' && !isNaN(parseFloat(e.kg)) ? parseFloat(e.kg) : null,
      rest: e.rest || null,
      note: e.note || null,
      video_url: e.video_url || null,
      superset_group: e.superset_group || null,
      focus_muscles: e.focus_muscles || null,
      pace_base: e.pace_base || null,
      pct_low: e.pct_low !== '' && e.pct_low != null ? parseFloat(e.pct_low) : null,
      pct_high: e.pct_high !== '' && e.pct_high != null ? parseFloat(e.pct_high) : null,
      timer_config: e.timer_config || null,
    }))

    let insertedExos = []
    if (toInsert.length) {
      const { data: inserted, error: insErr } = await supabase.from('program_exercises').insert(toInsert).select()
      if (insErr) { alert('Erreur duplication des exercices : ' + insErr.message); return }
      insertedExos = inserted || []
    }

    const newS = {
      ...newSession,
      exercises: insertedExos.length
        ? insertedExos.map(e => ({ ...e, _key: e.id }))
        : [emptyExo(0)],
    }
    setSessions(prev => [...prev, newS])
    if (!opts.skipOpen) setOpenId(newSession.id)
  }

  const toggleSessionSelected = (id) => {
    setSelectedSessions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const duplicateSelectedSessions = async () => {
    const toDuplicate = sessions.filter(s => selectedSessions.has(s.id))
    if (!toDuplicate.length) return
    setDuplicatingSelected(true)
    let nextIdx = sessions.length
    for (const s of toDuplicate) {
      await duplicateSession(s.id, nextIdx, { skipOpen: true })
      nextIdx++
    }
    setSelectedSessions(new Set())
    setDuplicatingSelected(false)
  }

  const saveTitle = async () => {
    if (!program) return
    setTitleSaving(true)
    await supabase.from('programs').update({ title: program.title }).eq('id', programId)
    setTitleSaving(false)
  }

  const saveActivityType = async (value) => {
    setProgram(p => ({ ...p, activity_type: value }))
    const { error } = await supabase.from('programs').update({ activity_type: value }).eq('id', programId)
    if (error) alert('Erreur lors de l\'enregistrement de l\'activité : ' + error.message)
  }

  // Alternative aux jours fixés séance par séance : le coach conseille juste un rythme
  // (ex: 2 séances/semaine, 48h d'écart mini), et c'est l'athlète qui choisit ses jours dans
  // son espace — utile pour les templates existants qu'on ne veut pas réorganiser séance par séance.
  const saveScheduleHint = async (field, value) => {
    setProgram(p => ({ ...p, [field]: value }))
    await supabase.from('programs').update({ [field]: value }).eq('id', programId)
  }

  const deleteSession = async (id) => {
    if (!confirm('Supprimer cette séance ? Elle sera aussi supprimée chez les clients à qui ce programme est lié (sauf s\'ils l\'ont déjà validée).')) return

    const { data: linked } = await supabase.from('program_sessions').select('id').eq('source_session_id', id)
    for (const l of (linked || [])) {
      const { data: completion } = await supabase.from('program_completions')
        .select('program_session_id').eq('program_session_id', l.id).maybeSingle()
      if (!completion) await supabase.from('program_sessions').delete().eq('id', l.id)
    }

    await supabase.from('program_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (openId === id) setOpenId(null)
  }

  const deleteWholeProgram = async () => {
    if (!confirm('Supprimer ce programme et toutes ses séances ? Cette action est définitive.')) return

    const sessionIds = sessions.map(s => s.id)
    if (sessionIds.length) {
      const { data: exos } = await supabase.from('program_exercises').select('id').in('program_session_id', sessionIds)
      const exoIds = (exos || []).map(e => e.id)
      if (exoIds.length) {
        await supabase.from('exercise_performance_history').delete().in('program_exercise_id', exoIds)
        await supabase.from('program_exercise_logs').delete().in('program_exercise_id', exoIds)
        await supabase.from('program_exercises').delete().in('id', exoIds)
      }
      await supabase.from('program_completions').delete().in('program_session_id', sessionIds)
      await supabase.from('program_sessions').delete().in('id', sessionIds)
    }

    const { error } = await supabase.from('programs').delete().eq('id', programId)
    if (error) { alert('Erreur : ' + error.message); return }
    router.push(isTemplate ? '/programs' : `/programs/${athleteId}`)
  }

  const openAddParticipant = async () => {
    setShowAddParticipant(true)
    const { data } = await supabase.from('athletes').select('id, name').neq('archived', true).order('name')
    const participantIds = new Set(participants.map(p => p.athlete_id))
    setOtherAthletes((data || []).filter(a => !participantIds.has(a.id)))
  }

  const addParticipant = async (targetId) => {
    if (!program?.group_batch_id) return
    setAddingParticipantId(targetId)
    const coachId = await getCoachId()

    const { data: sourceSessions } = await supabase
      .from('program_sessions')
      .select('*, program_exercises(*)')
      .eq('program_id', programId)
      .order('order_index')

    const { data: newProg } = await supabase.from('programs')
      .insert({
        athlete_id: targetId, title: program.title, coach_id: coachId,
        source_program_id: programId, activity_type: program.activity_type,
        group_id: program.group_id, group_batch_id: program.group_batch_id,
      })
      .select().single()

    if (newProg) {
      for (const sess of (sourceSessions || [])) {
        const { data: newSess } = await supabase.from('program_sessions')
          .insert({
            program_id: newProg.id, order_index: sess.order_index, title: sess.title || '', source_session_id: sess.id,
            activation: sess.activation || null, coach_notes: sess.coach_notes || null,
            activation_videos: sess.activation_videos || [], circuits: sess.circuits || [],
            session_type: sess.session_type || null, week_number: sess.week_number, day_of_week: sess.day_of_week ?? null, hidden_until_run: !!sess.hidden_until_run,
          })
          .select().single()
        if (!newSess) continue

        const exos = (sess.program_exercises || []).sort((a, b) => a.order_index - b.order_index)
        if (exos.length > 0) {
          await supabase.from('program_exercises').insert(
            exos.map(e => ({
              program_session_id: newSess.id, order_index: e.order_index, name: e.name,
              sets: e.sets, reps: e.reps, kg: e.kg, rest: e.rest, note: e.note, video_url: e.video_url,
              superset_group: e.superset_group, focus_muscles: e.focus_muscles || null,
              pace_base: e.pace_base || null, pct_low: e.pct_low, pct_high: e.pct_high, source_exercise_id: e.id,
              timer_config: e.timer_config || null,
            }))
          )
        }
      }
      setParticipants(prev => [...prev, { id: newProg.id, athlete_id: targetId, athletes: { name: otherAthletes.find(a => a.id === targetId)?.name } }])
      setOtherAthletes(prev => prev.filter(a => a.id !== targetId))
      notifyAssigned({ athleteIds: [targetId], kind: 'program', title: program.title })
    }
    setAddingParticipantId(null)
  }

  const removeParticipant = async (participant) => {
    if (!confirm(`Retirer ${participant.athletes?.name || 'ce client'} de cette séance ? Sa copie et ses résultats seront supprimés.`)) return
    setRemovingParticipantId(participant.id)

    const { data: sess } = await supabase.from('program_sessions').select('id').eq('program_id', participant.id)
    const sessionIds = (sess || []).map(s => s.id)
    if (sessionIds.length) {
      const { data: exos } = await supabase.from('program_exercises').select('id').in('program_session_id', sessionIds)
      const exoIds = (exos || []).map(e => e.id)
      if (exoIds.length) {
        await supabase.from('exercise_performance_history').delete().in('program_exercise_id', exoIds)
        await supabase.from('program_exercise_logs').delete().in('program_exercise_id', exoIds)
        await supabase.from('program_exercises').delete().in('id', exoIds)
      }
      await supabase.from('program_completions').delete().in('program_session_id', sessionIds)
      await supabase.from('program_sessions').delete().in('id', sessionIds)
    }
    await supabase.from('programs').delete().eq('id', participant.id)
    setParticipants(prev => prev.filter(p => p.id !== participant.id))
    setRemovingParticipantId(null)
  }

  // Retrouve l'index courant depuis `prev` (pas depuis un `idx`/`sessions` figé par l'appelant) :
  // un glisser-déposer sur plusieurs crans appelle cette fonction plusieurs fois d'affilée avant
  // le prochain rendu, donc tout index calculé en dehors de ce setState reste périmé aux appels
  // suivants — la séance revenait alors à sa position de départ sur les déplacements de plusieurs
  // rangs (nombre pair de crans = les échanges s'annulaient deux à deux).
  const reorderSaveTimer = useRef(null)
  const moveSession = (id, dir) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === id)
      if (idx === -1) return prev
      const next = [...prev]
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      // Un glisser-déposer sur plusieurs crans déclenche cette fonction en rafale : sauvegarder
      // uniquement la paire échangée à chaque cran envoie des requêtes concurrentes qui peuvent
      // s'entremêler et corrompre l'ordre en base. On attend donc la fin de la rafale (debounce)
      // pour sauvegarder l'ordre complet final en une seule passe, cohérente par construction.
      clearTimeout(reorderSaveTimer.current)
      reorderSaveTimer.current = setTimeout(() => {
        next.forEach((s, i) => {
          supabase.from('program_sessions').update({ order_index: i }).eq('id', s.id).then(() => {})
        })
      }, 300)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    if (program) {
      await supabase.from('programs').update({ title: program.title, description: program.description }).eq('id', programId)
    }
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]
      await supabase.from('program_sessions').update({
        order_index: i, title: s.title || '', activation: s.activation || null, coach_notes: s.coach_notes || null,
        activation_videos: s.activation_videos || [], session_type: s.session_type || null,
        materiel: s.materiel || null,
      }).eq('id', s.id)
      await supabase.from('program_exercises').delete().eq('program_session_id', s.id)
      const toInsert = s.exercises.filter(e => e.name.trim()).map((e, j) => ({
        program_session_id: s.id, order_index: j, name: e.name.trim(),
        sets: e.sets !== '' ? parseInt(e.sets) : null,
        reps: e.reps || null,
        kg: e.kg !== '' ? parseFloat(e.kg) : null,
        rest: e.rest || null,
        note: e.note || null,
        video_url: e.video_url || null,
        superset_group: e.superset_group || null,
        pace_base: e.pace_base || null,
        pct_low: e.pct_low !== '' && e.pct_low != null ? parseFloat(e.pct_low) : null,
        pct_high: e.pct_high !== '' && e.pct_high != null ? parseFloat(e.pct_high) : null,
        timer_config: e.timer_config || null,
      }))
      if (toInsert.length) {
        await supabase.from('program_exercises').insert(toInsert)
        await supabase.from('movements').upsert(toInsert.map(e => ({ name: e.name })), { onConflict: 'name', ignoreDuplicates: true })
      }
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp = { border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', width: '100%' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={athleteId} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 60 }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href={isTemplate ? '/programs' : `/programs/${athleteId}`} onClick={guardNavigation} style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={program?.title || ''}
                onChange={e => setProgram(p => ({ ...p, title: e.target.value }))}
                onBlur={saveTitle}
                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 17, border: 'none', outline: 'none', background: 'transparent', width: '100%', color: 'var(--title)' }}
                placeholder="Nom du programme"
              />
              {titleSaving && <div style={{ fontSize: 10, color: 'var(--text3)' }}>Enregistrement…</div>}
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {isTemplate ? '📋 Template' : athlete?.name} · {sessions.length} séance{sessions.length !== 1 ? 's' : ''}
              </div>
              <ActivityTypeSelect
                value={program?.activity_type || 'Musculation 🏋️'}
                onChange={saveActivityType}
                style={{ marginTop: 4 }}
                inputStyle={{ fontSize: 12, fontWeight: 600, borderRadius: 20, color: 'var(--text2)', padding: '4px 10px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                <span>📅 Rythme conseillé (si l&apos;athlète choisit ses jours) :</span>
                <input type="number" min="1" max="7" placeholder="X" value={program?.recommended_sessions_per_week ?? ''}
                  onChange={e => saveScheduleHint('recommended_sessions_per_week', e.target.value ? parseInt(e.target.value) : null)}
                  style={{ width: 44, boxSizing: 'border-box', padding: '2px 4px', border: '1px solid var(--border2)', borderRadius: 4, fontSize: 11, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center' }} />
                <span>séances/sem., mini</span>
                <input type="number" min="0" placeholder="48" value={program?.min_hours_between_sessions ?? ''}
                  onChange={e => saveScheduleHint('min_hours_between_sessions', e.target.value ? parseInt(e.target.value) : null)}
                  style={{ width: 44, boxSizing: 'border-box', padding: '2px 4px', border: '1px solid var(--border2)', borderRadius: 4, fontSize: 11, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center' }} />
                <span>h d&apos;écart</span>
              </div>
            </div>
            <button onClick={deleteWholeProgram} title="Supprimer le programme"
              style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#DC2626', cursor: 'pointer', flexShrink: 0 }}>
              🗑 Supprimer
            </button>
            {sessions.length > 1 && (
              <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 2, flexShrink: 0 }}>
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setLayoutCols(n)}
                    style={{
                      background: layoutCols === n ? 'var(--green)' : 'transparent',
                      color: layoutCols === n ? '#fff' : 'var(--text3)',
                      border: 'none', borderRadius: 4, padding: '5px 9px',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                    title={n === 1 ? '1 séance' : `${n} séances côte à côte`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!isTemplate && program?.group_batch_id && (
          <div style={{ margin: '12px 16px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1 }}>
                👥 Participants ({participants.length})
              </div>
              <button onClick={openAddParticipant} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                + Ajouter un client
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {participants.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: p.athlete_id === athleteId ? 'var(--green-light)' : 'var(--bg2)',
                  border: '1px solid ' + (p.athlete_id === athleteId ? 'var(--green)' : 'var(--border2)'), borderRadius: 20, padding: '5px 6px 5px 12px',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.athlete_id === athleteId ? 'var(--green)' : 'var(--text2)' }}>{p.athletes?.name || '—'}</span>
                  {p.athlete_id !== athleteId && (
                    <button onClick={() => removeParticipant(p)} disabled={removingParticipantId === p.id}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 15, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
                      {removingParticipantId === p.id ? '…' : '×'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {showAddParticipant && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {otherAthletes.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Tous les clients participent déjà</div>
                ) : otherAthletes.map(a => (
                  <button key={a.id} onClick={() => addParticipant(a.id)} disabled={addingParticipantId === a.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                    {a.name}
                    <span style={{ color: 'var(--green)', fontSize: 12 }}>{addingParticipantId === a.id ? '…' : '+ Ajouter'}</span>
                  </button>
                ))}
                <button onClick={() => setShowAddParticipant(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}>
                  Fermer
                </button>
              </div>
            )}
          </div>
        )}

        {!isTemplate && athlete && (objectives.length > 0 || noteBlocks.length > 0) && (
          <div style={{ margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {objectives.length > 0 && (
              <ObjectivesBlock athleteId={athlete.id} objectives={objectives} setObjectives={setObjectives} />
            )}
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
          </div>
        )}

        {selectedSessions.size > 0 && (
          <div style={{ margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--rl)', background: 'var(--green-light)' }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
              {selectedSessions.size} sélectionnée(s)
            </span>
            <button
              onClick={duplicateSelectedSessions}
              disabled={duplicatingSelected}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {duplicatingSelected ? '…' : '⧉ Dupliquer'}
            </button>
            <button
              onClick={() => setSelectedSessions(new Set())}
              style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        )}

        {hiddenSessions.size > 0 && (
          <div style={{ margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--rl)', background: 'var(--bg2)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>🙈 Masquées :</span>
            {sessions.filter(s => hiddenSessions.has(s.id)).map(s => (
              <button key={s.id} onClick={() => toggleHiddenSession(s.id)}
                title="Réafficher cette séance"
                style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>
                {s.title || `Séance ${sessions.indexOf(s) + 1}`} 👁
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: 16, display: layoutCols > 1 ? 'grid' : 'flex', flexDirection: layoutCols > 1 ? undefined : 'column', gridTemplateColumns: layoutCols > 1 ? `repeat(${layoutCols}, minmax(280px, 1fr))` : undefined, overflowX: layoutCols > 1 ? 'auto' : undefined, gap: 8, alignItems: 'start' }}>

          <SortableGroup ids={sessions.map(s => s.id)} onReorder={(id, dir) => moveSession(id, dir)}>
          {sessions.map((s, idx) => {
            if (hiddenSessions.has(s.id)) return null
            const isOpen = layoutCols > 1 ? true : openId === s.id
            const labels = computeLabels(s.exercises)
            const completion = completionsMap[s.id]
            const isPinned = pinnedSessions.has(s.id)
            const maxCircuitSlot = s.exercises.length
            // Un exercice supprimé après qu'un circuit ait été placé après lui referme la fourchette :
            // on ramène la position au dernier emplacement valide plutôt que de faire disparaître le circuit.
            const circuitSlot = (c) => Math.max(0, Math.min(c.afterExerciseIndex ?? 0, maxCircuitSlot))
            const renderCircuit = (c, ci) => (
              <div key={c.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'visible' }}>
                <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                    <button onClick={() => moveCircuit(s.id, c.id, -1)} disabled={circuitSlot(c) === 0}
                      style={{ background: 'none', border: 'none', color: circuitSlot(c) === 0 ? 'var(--border2)' : 'var(--text3)', fontSize: 10, cursor: circuitSlot(c) === 0 ? 'default' : 'pointer', padding: 0, lineHeight: 1 }}>▲</button>
                    <button onClick={() => moveCircuit(s.id, c.id, 1)} disabled={circuitSlot(c) === maxCircuitSlot}
                      style={{ background: 'none', border: 'none', color: circuitSlot(c) === maxCircuitSlot ? 'var(--border2)' : 'var(--text3)', fontSize: 10, cursor: circuitSlot(c) === maxCircuitSlot ? 'default' : 'pointer', padding: 0, lineHeight: 1 }}>▼</button>
                  </div>
                  <span style={{ fontSize: 10, flexShrink: 0 }}>🔁</span>
                  <input
                    value={c.name || ''}
                    onChange={e => updateCircuitName(s.id, c.id, e.target.value)}
                    placeholder={`Circuit ${ci + 1}`}
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  />
                  <button onClick={() => openCircuitTimer(s.id, c)} title={c.timer ? 'Modifier le timer lié' : 'Lier un timer'}
                    style={{ flexShrink: 0, background: c.timer ? 'var(--green-light)' : 'none', border: '1px solid ' + (c.timer ? 'var(--green)' : 'var(--border2)'), color: c.timer ? 'var(--green)' : 'var(--text3)', borderRadius: 6, width: 20, height: 20, fontSize: 11, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                    ⏱
                  </button>
                  <button onClick={() => removeCircuit(s.id, c.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 15, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                </div>
                <textarea placeholder="A1: Squat x10, A2: Fentes x10, A3: Row x10…" value={c.text || ''}
                  onChange={e => updateCircuitText(s.id, c.id, e.target.value)}
                  ref={el => autoGrow(el)}
                  rows={3} style={{ width: '100%', border: 'none', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none', overflow: 'hidden', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)', boxSizing: 'border-box' }} />

                <div style={{ padding: '0 10px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>Résultat client</span>
                  <select value={c.result_mode || ''} onChange={e => updateCircuitResultMode(s.id, c.id, e.target.value)}
                    style={{ flex: 1, minWidth: 0, border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 6px', fontSize: 11, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}>
                    <option value="">Libre (le client choisit)</option>
                    {CIRCUIT_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>

                <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(c.videos || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(c.videos || []).map((v, vi) => (
                        v.video_url ? (
                          <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 20, padding: '4px 6px 4px 10px' }}>
                            <a href={v.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: 'none', flexShrink: 0 }} title="Voir la vidéo">🎥</a>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{v.name}</span>
                            <button onClick={() => removeCircuitVideo(s.id, c.id, vi)}
                              style={{ background: 'none', border: 'none', color: '#4338CA', fontSize: 14, cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1, opacity: 0.6 }}>×</button>
                          </div>
                        ) : (
                          <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, padding: '4px 6px 4px 10px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{v.name}</span>
                            <input
                              placeholder="Coller URL…"
                              defaultValue=""
                              onBlur={e => updateCircuitVideoUrl(s.id, c.id, vi, e.target.value.trim())}
                              style={{ border: '1px solid var(--border2)', borderRadius: 12, padding: '2px 8px', fontSize: 11, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', width: 110 }}
                            />
                            <button onClick={() => removeCircuitVideo(s.id, c.id, vi)}
                              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>×</button>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  <div style={{ position: 'relative' }}>
                    <input
                      placeholder="Rechercher un mouvement pour ajouter sa vidéo…"
                      value={actVideoSearch[`${s.id}:circuit:${c.id}`] || ''}
                      onChange={e => searchCircuitVideo(`${s.id}:circuit:${c.id}`, e.target.value)}
                      onBlur={() => setTimeout(() => setActVideoSuggs(p => ({ ...p, [`${s.id}:circuit:${c.id}`]: [] })), 150)}
                      style={{ ...inp, fontSize: 12 }}
                    />
                    {(actVideoSearch[`${s.id}:circuit:${c.id}`] || '').trim().length >= 2 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                        {(actVideoSuggs[`${s.id}:circuit:${c.id}`] || []).map((mov, mi) => (
                          <button key={mi} onMouseDown={() => addCircuitVideo(s.id, c.id, `${s.id}:circuit:${c.id}`, mov)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                            <span style={{ flex: 1 }}>{mov.name}</span>
                            <span style={{ fontSize: 12 }}>{mov.youtube_url ? '🎥' : <span style={{ color: 'var(--text3)', fontSize: 11 }}>pas de vidéo</span>}</span>
                          </button>
                        ))}
                        {!(actVideoSuggs[`${s.id}:circuit:${c.id}`] || []).some(m => m.name.toLowerCase() === (actVideoSearch[`${s.id}:circuit:${c.id}`] || '').trim().toLowerCase()) && (
                          <button onMouseDown={() => createCircuitVideo(s.id, c.id, `${s.id}:circuit:${c.id}`, actVideoSearch[`${s.id}:circuit:${c.id}`])}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', textAlign: 'left', background: 'var(--bg2)', border: 'none', fontSize: 13, fontWeight: 700, color: 'var(--green)', cursor: 'pointer' }}>
                            <span>🎥</span>
                            <span>Créer « {actVideoSearch[`${s.id}:circuit:${c.id}`]} » et lier une vidéo</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
            return (
              <SortableItem key={s.id} id={s.id}>{(dragProps) => (
              <div style={{
                background: 'var(--bg)', border: isPinned ? '1px solid var(--green)' : '1px solid var(--border)', borderRadius: 'var(--rl)',
                // 'hidden' sur un seul axe force l'autre à se calculer en 'auto' (règle CSS), ce qui
                // bloque quand même le position:sticky du résumé de séance épinglé (toute valeur
                // scrollable sur un ancêtre — hidden OU auto — casse l'accroche au viewport). Les
                // deux axes doivent être 'visible' pour que ça marche ; sans incidence ici puisque
                // le contenu n'existe que quand isOpen, donc rien ne "déborde" à masquer quand fermé.
                overflowX: isPinned ? 'hidden' : 'visible',
                overflowY: isPinned ? 'auto' : 'visible',
                ...(isPinned ? { position: 'sticky', top: 12, maxHeight: 'calc(100svh - 24px)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' } : {}),
              }}>

                {/* En-tête séance */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => setOpenId(isOpen ? null : s.id)}>
                  <input
                    type="checkbox"
                    checked={selectedSessions.has(s.id)}
                    onChange={() => toggleSessionSelected(s.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: 'var(--green)', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <input
                    value={s.title || ''}
                    onChange={e => { e.stopPropagation(); updateSession(s.id, 'title', e.target.value) }}
                    onClick={e => e.stopPropagation()}
                    placeholder={`Séance ${idx + 1}`}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, color: 'var(--text)', cursor: 'text' }}
                  />
                  <button
                    onClick={e => { e.stopPropagation(); updateSession(s.id, 'session_type', s.session_type === 'explication' ? null : 'explication') }}
                    title="Séance de type explication : validation simple, sans plaisir/difficulté/distance"
                    style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 9px', cursor: 'pointer',
                      border: s.session_type === 'explication' ? '1px solid #93C5FD' : '1px solid var(--border2)',
                      background: s.session_type === 'explication' ? '#EFF6FF' : 'none',
                      color: s.session_type === 'explication' ? '#1D4ED8' : 'var(--text3)',
                    }}
                  >
                    💡 Explication
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); updateSession(s.id, 'session_type', s.session_type === 'warmup' ? null : 'warmup') }}
                    title="Séance de type Warm-Up : bilan de fin de séance adapté (efficacité, facilité de mise en place)"
                    style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 9px', cursor: 'pointer',
                      border: s.session_type === 'warmup' ? '1px solid #FDBA74' : '1px solid var(--border2)',
                      background: s.session_type === 'warmup' ? '#FFF7ED' : 'none',
                      color: s.session_type === 'warmup' ? '#C2410C' : 'var(--text3)',
                    }}
                  >
                    🔥 Warm-Up
                  </button>
                  <select
                    value={s.day_of_week ?? ''}
                    onChange={e => { updateSession(s.id, 'day_of_week', e.target.value === '' ? null : parseInt(e.target.value)) }}
                    onClick={e => e.stopPropagation()}
                    title="Jour de la semaine (pour la vue chronologique de l'athlète, si plusieurs programmes sont actifs)"
                    style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 6px', cursor: 'pointer',
                      border: s.day_of_week != null ? '1px solid var(--green)' : '1px solid var(--border2)',
                      background: s.day_of_week != null ? 'var(--green-light)' : 'none',
                      color: s.day_of_week != null ? 'var(--green)' : 'var(--text3)',
                    }}
                  >
                    <option value="">📅 Jour</option>
                    {WEEK_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                  {program?.group_id && (
                    <button
                      onClick={e => { e.stopPropagation(); updateSession(s.id, 'hidden_until_run', !s.hidden_until_run) }}
                      title="Contenu caché pour les clients tant que tu n'as pas validé la séance (présence + bilan) depuis l'espace groupe"
                      style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 9px', cursor: 'pointer',
                        border: s.hidden_until_run ? '1px solid #A78BFA' : '1px solid var(--border2)',
                        background: s.hidden_until_run ? '#F5F3FF' : 'none',
                        color: s.hidden_until_run ? '#6D28D9' : 'var(--text3)',
                      }}
                    >
                      {s.hidden_until_run ? '🙈 Caché' : '👁 Visible'}
                    </button>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {s.exercises.filter(e => e.name.trim()).length} ex.
                  </span>
                  {completion && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
                      ✓ Effectuée
                    </span>
                  )}
                  <span onClick={e => e.stopPropagation()}><DragHandle dragProps={dragProps} /></span>
                  {idx > 0 && (
                    <button onClick={e => { e.stopPropagation(); moveSession(s.id, -1) }}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>↑</button>
                  )}
                  {idx < sessions.length - 1 && (
                    <button onClick={e => { e.stopPropagation(); moveSession(s.id, 1) }}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>↓</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); duplicateSession(s.id) }}
                    title="Dupliquer la séance"
                    style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>⧉</button>
                  <button onClick={e => { e.stopPropagation(); togglePinnedSession(s.id) }}
                    title={isPinned ? 'Détacher cette séance' : 'Figer cette séance à l’écran pendant que tu fais défiler les autres'}
                    style={{
                      background: isPinned ? 'var(--green-light)' : 'none',
                      border: isPinned ? '1px solid var(--green)' : '1px solid var(--border2)',
                      borderRadius: 4, padding: '2px 6px', fontSize: 11,
                      color: isPinned ? 'var(--green)' : 'var(--text3)', cursor: 'pointer',
                    }}>📌</button>
                  <button onClick={e => { e.stopPropagation(); toggleHiddenSession(s.id) }}
                    title="Masquer cette séance (n'affecte pas son ordre)"
                    style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>🙈</button>
                  <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                    style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 18, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>×</button>
                  <span style={{ fontSize: 14, color: 'var(--text3)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Contenu de la séance */}
                {isOpen && (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {s.session_type !== 'explication' && <SessionSummaryBlock exercises={s.exercises} />}

                    {/* Retours du client si la séance a déjà été effectuée */}
                    {completion && (
                      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--r)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          ✓ Effectuée {completion.completed_at ? `le ${new Date(completion.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}
                        </div>
                        {(completion.pleasure != null || completion.difficulty != null || completion.duration_minutes) && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {completion.pleasure != null && (
                              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '5px 10px' }}>
                                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Plaisir</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor(completion.pleasure, false) }}>{completion.pleasure}/10</div>
                              </div>
                            )}
                            {completion.difficulty != null && (
                              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '5px 10px' }}>
                                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Difficulté</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor(completion.difficulty, true) }}>{completion.difficulty}/10</div>
                              </div>
                            )}
                            {completion.duration_minutes && (
                              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '5px 10px' }}>
                                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Durée</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{formatDuration(completion.duration_minutes)}</div>
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Note du sportif</div>
                          <div style={{ fontSize: 13, color: completion.comment ? 'var(--text)' : 'var(--text3)', fontStyle: completion.comment ? 'normal' : 'italic', marginTop: 2 }}>
                            {completion.comment || 'Vide'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {s.exercises.filter(e => e.name.trim()).map(e => {
                            const log = logsMap[e.id]
                            if (!log) return null
                            const prescribed = [e.sets && `${e.sets} séries`, e.reps && `${e.reps} reps`, e.kg && `${e.kg} kg`].filter(Boolean).join(' · ')
                            const done = [log.sets_done && `${log.sets_done} séries`, log.reps_done && `${log.reps_done} reps`, log.kg_done && `${log.kg_done} kg`].filter(Boolean).join(' · ')
                            return (
                              <div key={e.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</div>
                                {prescribed && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Prescrit : {prescribed}</div>}
                                {done && <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginTop: 2 }}>Réalisé : {done}</div>}
                                {log.note && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, fontStyle: 'italic' }}>« {log.note} »</div>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {s.session_type === 'explication' ? (
                      <>
                        {/* Séance "Explication" : juste une note libre + une vidéo, pas d'activation ni d'exercices */}
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Explication</span>
                          </div>
                          <textarea placeholder="Explique le programme au sportif…" value={s.coach_notes || ''}
                            onChange={e => updateSession(s.id, 'coach_notes', e.target.value)}
                            ref={el => autoGrow(el)}
                            rows={6} style={{ width: '100%', border: 'none', padding: '10px', fontSize: 13, outline: 'none', resize: 'none', overflow: 'hidden', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎥 Vidéo</span>
                          </div>
                          <input
                            placeholder="Lien vidéo (YouTube, etc.)"
                            defaultValue={s.activation_videos?.[0]?.video_url || ''}
                            onBlur={e => setExplicationVideo(s.id, e.target.value.trim())}
                            style={{ width: '100%', border: 'none', padding: '10px', fontSize: 13, outline: 'none', background: 'transparent', color: 'var(--text)', boxSizing: 'border-box' }}
                          />
                        </div>
                      </>
                    ) : (
                    <>
                    {/* Activation */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'visible' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Activation</span>
                      </div>
                      <div style={{ position: 'relative', padding: '8px 10px 0' }}>
                        <input
                          placeholder="Insérer une activation pré-créée…"
                          value={actPresetSearch[s.id] || ''}
                          onChange={e => searchActPreset(s.id, e.target.value)}
                          onFocus={e => searchActPreset(s.id, e.target.value)}
                          onBlur={() => setTimeout(() => setActPresetSuggs(p => ({ ...p, [s.id]: [] })), 150)}
                          style={{ ...inp, fontSize: 12 }}
                        />
                        {(actPresetSuggs[s.id] || []).length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 10, right: 10, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                            {actPresetSuggs[s.id].map((preset, pi) => (
                              <button key={preset.id} onMouseDown={() => applyActPreset(s.id, preset)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: pi < actPresetSuggs[s.id].length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                                <span style={{ flex: 1 }}>{preset.name}</span>
                                {preset.videos?.length > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{preset.videos.length} 🎥</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <textarea placeholder="Échauffement, mobilité…" value={s.activation || ''}
                        onChange={e => updateSession(s.id, 'activation', e.target.value)}
                        ref={el => autoGrow(el)}
                        rows={2} style={{ width: '100%', border: 'none', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none', overflow: 'hidden', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)', boxSizing: 'border-box' }} />
                    </div>

                    {/* Vidéos d'activation */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'visible' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎥 Vidéos d'activation</span>
                      </div>
                      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                        {/* Chips des vidéos ajoutées */}
                        {(s.activation_videos || []).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(s.activation_videos || []).map((v, vi) => (
                              v.video_url ? (
                                <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 20, padding: '4px 6px 4px 10px' }}>
                                  <a href={v.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: 'none', flexShrink: 0 }} title="Voir la vidéo">🎥</a>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{v.name}</span>
                                  <button onClick={() => removeActVideo(s.id, vi)}
                                    style={{ background: 'none', border: 'none', color: '#4338CA', fontSize: 14, cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1, opacity: 0.6 }}>×</button>
                                </div>
                              ) : (
                                <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, padding: '4px 6px 4px 10px' }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{v.name}</span>
                                  <input
                                    placeholder="Coller URL…"
                                    defaultValue=""
                                    onBlur={e => updateActVideoUrl(s.id, vi, e.target.value.trim())}
                                    style={{ border: '1px solid var(--border2)', borderRadius: 12, padding: '2px 8px', fontSize: 11, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', width: 110 }}
                                  />
                                  <button onClick={() => removeActVideo(s.id, vi)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>×</button>
                                </div>
                              )
                            ))}
                          </div>
                        )}

                        {/* Recherche */}
                        <div style={{ position: 'relative' }}>
                          <input
                            placeholder="Rechercher un mouvement…"
                            value={actVideoSearch[s.id] || ''}
                            onChange={e => searchActVideo(s.id, e.target.value)}
                            onBlur={() => setTimeout(() => setActVideoSuggs(p => ({ ...p, [s.id]: [] })), 150)}
                            style={{ ...inp, fontSize: 12 }}
                          />
                          {(actVideoSearch[s.id] || '').trim().length >= 2 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                              {(actVideoSuggs[s.id] || []).map((mov, mi) => (
                                <button key={mi} onMouseDown={() => addActVideo(s.id, mov)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                                  <span style={{ flex: 1 }}>{mov.name}</span>
                                  <span style={{ fontSize: 12 }}>{mov.youtube_url ? '🎥' : <span style={{ color: 'var(--text3)', fontSize: 11 }}>pas de vidéo</span>}</span>
                                </button>
                              ))}
                              {!(actVideoSuggs[s.id] || []).some(m => m.name.toLowerCase() === (actVideoSearch[s.id] || '').trim().toLowerCase()) && (
                                <button onMouseDown={() => createActVideo(s.id, actVideoSearch[s.id])}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', textAlign: 'left', background: 'var(--bg2)', border: 'none', fontSize: 13, fontWeight: 700, color: 'var(--green)', cursor: 'pointer' }}>
                                  <span>🎥</span>
                                  <span>Créer « {actVideoSearch[s.id]} » et lier une vidéo</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Circuits placés avant le premier exercice (afterExerciseIndex 0, valeur par défaut
                        des circuits déjà existants avant l'ajout du positionnement interleavé) */}
                    {(s.circuits || []).filter(c => circuitSlot(c) === 0).map(c => renderCircuit(c, (s.circuits || []).indexOf(c)))}

                    {/* Note */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Note</span>
                      </div>
                      <textarea placeholder="Consignes pour le sportif…" value={s.coach_notes || ''}
                        onChange={e => updateSession(s.id, 'coach_notes', e.target.value)}
                        ref={el => autoGrow(el)}
                        rows={2} style={{ width: '100%', border: 'none', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none', overflow: 'hidden', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)' }} />
                    </div>

                    {/* Exercices */}
                    <SortableGroup ids={s.exercises.map(e => e._key)} onReorder={(id, dir) => moveExo(s.id, id, dir)}>
                    {s.exercises.map((exo, ei) => {
                      const label = labels[exo._key] || String.fromCharCode(65 + ei)
                      return (
                        <SortableItem key={exo._key} id={exo._key}>{(dragProps) => (
                        <div>
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 7 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: videoInputKey === exo._key ? 3 : 5 }}>
                            {/* Flèches de déplacement */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                              <DragHandle dragProps={dragProps} />
                              <button onClick={() => moveExo(s.id, exo._key, -1)} disabled={ei === 0}
                                style={{ background: 'none', border: 'none', cursor: ei === 0 ? 'default' : 'pointer', padding: '0 2px', fontSize: 9, color: ei === 0 ? 'var(--border2)' : 'var(--text3)', lineHeight: 1 }}>▲</button>
                              <button onClick={() => moveExo(s.id, exo._key, 1)} disabled={ei === s.exercises.length - 1}
                                style={{ background: 'none', border: 'none', cursor: ei === s.exercises.length - 1 ? 'default' : 'pointer', padding: '0 2px', fontSize: 9, color: ei === s.exercises.length - 1 ? 'var(--border2)' : 'var(--text3)', lineHeight: 1 }}>▼</button>
                            </div>
                            <div style={{ minWidth: 19, height: 19, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0, padding: '0 3px' }}>{label}</div>
                            {isGroupStart(s.exercises, ei) && (
                              <button onClick={() => openExerciseTimer(s.id, exo)} title={exo.timer_config ? 'Modifier le timer lié' : 'Lier un timer'}
                                style={{ flexShrink: 0, background: exo.timer_config ? 'var(--green-light)' : 'none', border: '1px solid ' + (exo.timer_config ? 'var(--green)' : 'var(--border2)'), color: exo.timer_config ? 'var(--green)' : 'var(--text3)', borderRadius: 6, width: 20, height: 20, fontSize: 11, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                ⏱
                              </button>
                            )}
                            <div style={{ position: 'relative', flex: 1 }}>
                              <input placeholder="Nom du mouvement" value={exo.name}
                                onChange={e => { updateExo(s.id, exo._key, 'name', e.target.value); searchMovements(exo._key, e.target.value) }}
                                onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, [exo._key]: [] })), 150)}
                                style={{ ...inp, fontWeight: 600, padding: '6px 8px', fontSize: 12 }} />
                              {suggestions[exo._key]?.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                                  {suggestions[exo._key].map((sug, si) => (
                                    <button key={si} onMouseDown={() => pickSuggestion(s.id, exo._key, sug)}
                                      style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: si < suggestions[exo._key].length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                                      {sug}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {exo.name.trim() && (
                              exo.video_url ? (
                                <button onClick={() => setVideoPreviewKey(videoPreviewKey === exo._key ? null : exo._key)}
                                  style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1 }}
                                  title="Voir la vidéo">🎥</button>
                              ) : (
                                <button onClick={() => { setVideoInputKey(exo._key); setVideoInputVal(''); setVideoPreviewKey(null) }}
                                  style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1, opacity: 0.25, filter: 'grayscale(1)' }}
                                  title="Ajouter une vidéo">🎥</button>
                              )
                            )}
                            {exo.name.trim() && (() => {
                              const movementFocus = movementFocusGroupsMap[exo.name.trim().toLowerCase()]
                              const autoGroups = movementFocus ? movementFocus.split(',').filter(Boolean) : parseMusclesFromText(movementMusclesMap[exo.name.trim().toLowerCase()] || '')
                              const hasFocus = exo.focus_muscles || autoGroups.length > 0
                              return (
                                <button onClick={() => setFocusPickerKey(focusPickerKey === exo._key ? null : exo._key)}
                                  style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1, opacity: hasFocus ? 1 : 0.3 }}
                                  title="Focus muscles">🎯</button>
                              )
                            })()}
                            {!isTemplate && exo.name.trim() && (
                              <button onClick={() => setHistoryExo({ name: exo.name.trim() })}
                                style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1 }}
                                title="Historique de l'exercice">📈</button>
                            )}
                            <button onClick={() => removeExo(s.id, exo._key)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, padding: '0 2px', cursor: 'pointer', flexShrink: 0 }}>×</button>
                          </div>
                          {videoInputKey === exo._key && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <input
                                autoFocus
                                placeholder="Lien YouTube…"
                                value={videoInputVal}
                                onChange={e => setVideoInputVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveMovementVideo(s.id, exo._key, exo.name, videoInputVal)
                                  if (e.key === 'Escape') setVideoInputKey(null)
                                }}
                                style={{ ...inp, flex: 1, fontSize: 12 }}
                              />
                              <button onClick={() => saveMovementVideo(s.id, exo._key, exo.name, videoInputVal)}
                                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                              <button onClick={() => setVideoInputKey(null)}
                                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 8px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
                            </div>
                          )}
                          {videoPreviewKey === exo._key && exo.video_url && (() => {
                            const ytId = getYouTubeId(exo.video_url)
                            return (
                              <div style={{ marginBottom: 8, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border2)', background: 'var(--bg2)' }}>
                                {ytId ? (
                                  <img
                                    src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                    alt="miniature"
                                    style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>Pas de miniature disponible</div>
                                )}
                                <div style={{ display: 'flex', gap: 6, padding: 8 }}>
                                  <a href={exo.video_url} target="_blank" rel="noreferrer"
                                    style={{ flex: 1, background: 'var(--green)', color: '#fff', borderRadius: 'var(--r)', padding: '8px', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                                    ▶ Ouvrir
                                  </a>
                                  <button onClick={() => {
                                    updateExo(s.id, exo._key, 'video_url', '')
                                    supabase.from('movements').update({ youtube_url: null }).eq('name', exo.name)
                                    setVideoPreviewKey(null)
                                  }}
                                    style={{ flex: 1, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '8px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                    🗑 Supprimer
                                  </button>
                                </div>
                              </div>
                            )
                          })()}
                          {(() => {
                            if (focusPickerKey === exo._key) return null
                            const manualGroups = exo.focus_muscles ? exo.focus_muscles.split(',') : []
                            const isAuto = manualGroups.length === 0
                            const movementFocus = movementFocusGroupsMap[exo.name.trim().toLowerCase()]
                            const autoGroups = movementFocus ? movementFocus.split(',').filter(Boolean) : parseMusclesFromText(movementMusclesMap[exo.name.trim().toLowerCase()] || '')
                            const groups = isAuto ? autoGroups : manualGroups
                            if (groups.length === 0) return null
                            return (
                              <div style={{ marginBottom: 6, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 20, padding: '4px 10px', display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#B91C1C' }}>
                                🎯 {MUSCLE_GROUPS.filter(g => groups.includes(g.key)).map(g => g.label).join(', ')}
                                {isAuto && <span style={{ fontWeight: 500, opacity: 0.75 }}> (auto)</span>}
                              </div>
                            )
                          })()}
                          {focusPickerKey === exo._key && (
                            <div style={{ marginBottom: 8, border: '1px solid var(--border2)', borderRadius: 'var(--r)', background: 'var(--bg2)', padding: 8 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                                🎯 Focus — muscles à ressentir
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {MUSCLE_GROUPS.map(g => {
                                  const movementFocus = movementFocusGroupsMap[exo.name.trim().toLowerCase()]
                                  const current = exo.focus_muscles
                                    ? exo.focus_muscles.split(',').filter(Boolean)
                                    : (movementFocus ? movementFocus.split(',').filter(Boolean) : parseMusclesFromText(movementMusclesMap[exo.name.trim().toLowerCase()] || ''))
                                  const active = current.includes(g.key)
                                  return (
                                    <button key={g.key} onClick={() => {
                                      const next = active ? current.filter(k => k !== g.key) : [...current, g.key]
                                      const name = exo.name.trim()
                                      const value = next.length ? next.join(',') : null
                                      if (name) {
                                        supabase.from('movements').upsert({ name, focus_groups: value }, { onConflict: 'name' })
                                        setMovementFocusGroupsMap(prev => ({ ...prev, [name.toLowerCase()]: value }))
                                      }
                                      // Le focus vit désormais sur le mouvement (vaut pour toutes ses utilisations) :
                                      // on efface l'éventuel focus posé uniquement sur cet exercice.
                                      updateExo(s.id, exo._key, 'focus_muscles', '')
                                    }}
                                      style={{
                                        background: active ? '#FEF2F2' : 'var(--bg)', border: `1px solid ${active ? '#FCA5A5' : 'var(--border2)'}`,
                                        color: active ? '#B91C1C' : 'var(--text2)', borderRadius: 16, padding: '4px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                      }}>
                                      {g.label}
                                    </button>
                                  )
                                })}
                              </div>
                              <button onClick={() => setFocusPickerKey(null)} style={{ marginTop: 8, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                OK
                              </button>
                            </div>
                          )}
                          {isRunMovement(exo.name) ? (() => {
                            const is3030 = is3030Movement(exo.name)
                            const pace1 = is3030 ? computeDistanceForBasePct(exo.pace_base, parseFloat(exo.pct_low), raceKnown) : computePaceForBasePct(exo.pace_base, parseFloat(exo.pct_low), raceKnown)
                            const pace2 = is3030 ? computeDistanceForBasePct(exo.pace_base, parseFloat(exo.pct_high), raceKnown) : computePaceForBasePct(exo.pace_base, parseFloat(exo.pct_high), raceKnown)
                            const isIntervalOrThreshold = ['run interval', 'run threshold'].includes(exo.name.trim().toLowerCase())
                            return (
                              <>
                              {isIntervalOrThreshold ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
                                  <div>
                                    <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>ACTION (TEMPS/DISTANCE)</div>
                                    <input type="text" placeholder="ex: 3min ou 400m" value={exo.sets}
                                      onChange={e => updateExo(s.id, exo._key, 'sets', e.target.value)}
                                      style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 12 }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>REPOS (TEMPS/DISTANCE)</div>
                                    <input type="text" placeholder="ex: 90s" value={exo.rest}
                                      onChange={e => updateExo(s.id, exo._key, 'rest', e.target.value)}
                                      style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 12 }} />
                                  </div>
                                </div>
                              ) : (
                                <div style={{ marginBottom: 5 }}>
                                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>TEMPS DE SÉANCE</div>
                                  <input type="text" placeholder="ex: 45min" value={exo.rest}
                                    onChange={e => updateExo(s.id, exo._key, 'rest', e.target.value)}
                                    style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 12 }} />
                                </div>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr', gap: 5, marginBottom: 4 }}>
                                <div>
                                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>BASE</div>
                                  <select value={exo.pace_base || ''} onChange={e => updateExo(s.id, exo._key, 'pace_base', e.target.value || null)}
                                    style={{ ...inp, textAlign: 'center', padding: '5px 2px', fontSize: 11 }}>
                                    <option value="">—</option>
                                    {PACE_BASES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>%1</div>
                                  <input type="number" placeholder="60" value={exo.pct_low}
                                    onChange={e => updateExo(s.id, exo._key, 'pct_low', e.target.value)}
                                    style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 12 }} min="0" step="1" />
                                </div>
                                <div>
                                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>%2</div>
                                  <input type="number" placeholder="80" value={exo.pct_high}
                                    onChange={e => updateExo(s.id, exo._key, 'pct_high', e.target.value)}
                                    style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 12 }} min="0" step="1" />
                                </div>
                                <div>
                                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>{is3030 ? 'DISTANCE 1 (30S)' : 'ALLURE 1'}</div>
                                  <div style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 11, fontWeight: 700, color: pace1 ? 'var(--green)' : 'var(--text3)', background: 'var(--bg2)' }}>
                                    {pace1 ? (is3030 ? formatDistance(pace1) : `${formatPace(pace1)}/km`) : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>{is3030 ? 'DISTANCE 2 (30S)' : 'ALLURE 2'}</div>
                                  <div style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 11, fontWeight: 700, color: pace2 ? 'var(--green)' : 'var(--text3)', background: 'var(--bg2)' }}>
                                    {pace2 ? (is3030 ? formatDistance(pace2) : `${formatPace(pace2)}/km`) : '—'}
                                  </div>
                                </div>
                              </div>
                              </>
                            )
                          })() : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 4 }}>
                              {[{ f: 'sets', l: 'Séries', t: 'number', ph: '—' }, { f: 'reps', l: 'Reps', t: 'text', ph: '8-12' }, { f: 'kg', l: 'Kg', t: 'number', ph: '—' }, { f: 'rest', l: 'Récup', t: 'text', ph: '90s' }].map(({ f, l, t, ph }) => (
                                <div key={f}>
                                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text3)', marginBottom: 1, textAlign: 'center' }}>{l.toUpperCase()}</div>
                                  <input type={t} placeholder={ph} value={exo[f]}
                                    onChange={e => updateExo(s.id, exo._key, f, e.target.value)}
                                    style={{ ...inp, textAlign: 'center', padding: '5px 3px', fontSize: 12 }} min="0" step={f === 'kg' ? '0.5' : '1'} />
                                </div>
                              ))}
                            </div>
                          )}
                          <textarea placeholder="Consignes (tempo, récup…)" value={exo.note}
                            onChange={e => updateExo(s.id, exo._key, 'note', e.target.value)}
                            ref={el => autoGrow(el)}
                            rows={2}
                            style={{ ...inp, fontSize: 12, color: 'var(--text2)', resize: 'none', overflow: 'hidden', lineHeight: 1.5 }} />
                        </div>

                        {/* Bouton supersérie */}
                        {ei < s.exercises.length - 1 && (() => {
                          const next = s.exercises[ei + 1]
                          const isSS = exo.superset_group && exo.superset_group === next?.superset_group
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
                              <div style={{ flex: 1, height: 1, background: isSS ? 'var(--green)' : 'var(--border)' }} />
                              <button onClick={() => toggleSuperset(s.id, ei)} style={{
                                background: isSS ? 'var(--green)' : 'var(--bg2)',
                                color: isSS ? '#fff' : 'var(--text3)',
                                border: `1px solid ${isSS ? 'var(--green)' : 'var(--border2)'}`,
                                borderRadius: 20, padding: '2px 10px',
                                fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                letterSpacing: '0.3px', whiteSpace: 'nowrap',
                              }}>
                                {isSS ? '✕ Supersérie' : '+ Supersérie'}
                              </button>
                              <div style={{ flex: 1, height: 1, background: isSS ? 'var(--green)' : 'var(--border)' }} />
                            </div>
                          )
                        })()}
                        {(s.circuits || []).filter(c => circuitSlot(c) === ei + 1).map(c => renderCircuit(c, (s.circuits || []).indexOf(c)))}
                        </div>
                        )}</SortableItem>
                      )
                    })}
                    </SortableGroup>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => addExo(s.id)} style={{ flex: 1, background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '8px', fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
                        + Exercice
                      </button>
                      <button onClick={() => addCircuit(s.id)} style={{ flex: 1, background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '8px', fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
                        + Circuit
                      </button>
                    </div>

                    {/* Matériel */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎒 Matériel</span>
                      </div>
                      <textarea placeholder="Matériel à avoir pour cette séance…" value={s.materiel || ''}
                        onChange={e => updateSession(s.id, 'materiel', e.target.value)}
                        ref={el => autoGrow(el)}
                        rows={2} style={{ width: '100%', border: 'none', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none', overflow: 'hidden', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)' }} />
                    </div>
                    </>
                    )}

                    {/* Bouton sauvegarder la séance — sauvegarde aussi les autres séances modifiées en attente */}
                    {(() => {
                      const otherDirtyCount = [...dirtySessionIds].filter(id => id !== s.id).length
                      return (
                        <button
                          onClick={() => saveAllDirtySessions(s.id)}
                          disabled={saving}
                          style={{
                            background: savedIds.has(s.id) ? '#DCFCE7' : 'var(--green)',
                            color: savedIds.has(s.id) ? '#166534' : '#fff',
                            border: savedIds.has(s.id) ? '1px solid #BBF7D0' : 'none',
                            borderRadius: 'var(--r)', padding: '12px', fontSize: 14,
                            fontWeight: 700, cursor: saving ? 'default' : 'pointer', width: '100%',
                            transition: 'all .2s',
                          }}
                        >
                          {saving && !savedIds.has(s.id)
                            ? '…'
                            : savedIds.has(s.id)
                              ? '✓ Séance sauvegardée'
                              : otherDirtyCount > 0
                                ? `💾 Tout sauvegarder (${otherDirtyCount + 1} séances)`
                                : '💾 Sauvegarder la séance'}
                        </button>
                      )
                    })()}
                  </div>
                )}
              </div>
              )}</SortableItem>
            )
          })}
          </SortableGroup>

          <button onClick={addSession} style={{ background: 'var(--bg)', border: '2px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 14, fontSize: 14, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', width: '100%' }}>
            + Ajouter une séance
          </button>
        </div>
      </div>
      {historyExo && (
        <ExerciseHistoryModal athleteId={athleteId} exerciseName={historyExo.name} onClose={() => setHistoryExo(null)} />
      )}
      {timerEditor && (
        <div onClick={() => setTimerEditor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 400, maxHeight: '85svh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17 }}>
                ⏱ Timer lié {timerEditor.kind === 'exercise' ? "à l'exercice" : 'au circuit'}
              </div>
              <button onClick={() => setTimerEditor(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>×</button>
            </div>
            <TimerConfigEditor value={timerEditor.config} onChange={cfg => setTimerEditor(prev => ({ ...prev, config: cfg }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={removeTimerEditor} style={{ background: 'none', border: '1px solid #F1B8B8', borderRadius: 'var(--r)', padding: '11px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#991B1B' }}>
                Retirer
              </button>
              <button onClick={saveTimerEditor} style={{ flex: 1, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '11px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ExerciseHistoryModal({ athleteId, exerciseName, onClose }) {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    supabase.from('exercise_performance_history')
      .select('kg_done, reps_done, sets_done, note, logged_at, program_exercises(name)')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .then(({ data }) => {
        setEntries((data || []).filter(e => e.program_exercises?.name === exerciseName))
      })
  }, [athleteId, exerciseName])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480,
        maxHeight: '80svh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17 }}>📈 Historique</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{exerciseName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>✕</button>
        </div>

        {entries === null ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Chargement…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '30px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)' }}>
            <div style={{ fontSize: 13 }}>Aucune charge enregistrée pour cet exercice.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map((e, i) => (
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
  )
}
