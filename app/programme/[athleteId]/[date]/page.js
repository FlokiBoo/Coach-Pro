'use client'

import React, { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import WellnessBlock from '@/app/components/WellnessBlock'
import ActivityBlock from '@/app/components/ActivityBlock'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}
function prevDay(d) {
  const dt = new Date(d + 'T12:00:00Z')
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}
function nextDay(d) {
  const dt = new Date(d + 'T12:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}
function emptyExercise(order) {
  return { _key: Date.now() + Math.random(), order_index: order, name: '', sets: '', reps: '', kg: '', note: '', video_url: '', superset_group: null }
}

function computeLabels(exercises) {
  const labels = {}
  let letterIdx = 0
  let i = 0
  while (i < exercises.length) {
    const g = exercises[i].superset_group
    if (!g) {
      labels[exercises[i]._key] = String.fromCharCode(65 + letterIdx)
      letterIdx++
      i++
    } else {
      let j = i
      while (j < exercises.length && exercises[j].superset_group === g) j++
      const letter = String.fromCharCode(65 + letterIdx)
      for (let k = i; k < j; k++) labels[exercises[k]._key] = `${letter}${k - i + 1}`
      letterIdx++
      i = j
    }
  }
  return labels
}

export default function ProgrammePage({ params }) {
  const { athleteId, date } = use(params)

  const [athlete, setAthlete] = useState(null)
  const [sessions, setSessions] = useState([])      // toutes les sessions du jour
  const [sessionIdx, setSessionIdx] = useState(0)   // index de la session active
  const [session, setSession] = useState(null)      // session active
  const [exercises, setExercises] = useState([emptyExercise(0)])
  const [title, setTitle] = useState('')
  const [coachNotes, setCoachNotes] = useState('')
  const [activation, setActivation] = useState('')
  const [activationLinks, setActivationLinks] = useState({}) // { mot: url }
  const [activationLinkEdit, setActivationLinkEdit] = useState(null) // mot en cours d'édition
  const [logs, setLogs] = useState({})
  const [athleteNote, setAthleteNote] = useState('')
  const [histories, setHistories] = useState({})
  const [suggestions, setSuggestions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [wellnessOpen, setWellnessOpen] = useState(false)
  const [wellnessHistory, setWellnessHistory] = useState(null)
  const [videoOpen, setVideoOpen] = useState({}) // { [_key]: bool }

  const loadSessionData = async (s) => {
    setSession(s)
    setTitle(s.title || '')
    setActivation(s.activation || '')
    setActivationLinks(s.activation_links || {})
    setActivationLinkEdit(null)
    setCoachNotes(s.coach_notes || '')
    setAthleteNote(s.athlete_note || '')
    const exos = [...(s.exercises || [])].sort((a, b) => a.order_index - b.order_index)
    // Récupérer les video_url depuis la bibliothèque movements
    let videoMap = {}
    if (exos.length) {
      const names = [...new Set(exos.map(e => e.name).filter(Boolean))]
      if (names.length) {
        const { data: movs } = await supabase.from('movements').select('name, video_url').in('name', names)
        videoMap = Object.fromEntries((movs || []).filter(m => m.video_url).map(m => [m.name, m.video_url]))
      }
    }
    const mapped = exos.length
      ? exos.map(e => ({ ...e, _key: e.id, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '', note: e.note ?? '', video_url: videoMap[e.name] || '' }))
      : [emptyExercise(0)]
    setExercises(mapped)
    setHistories({})
    if (exos.length) {
      const { data: existingLogs } = await supabase
        .from('athlete_logs').select('*').in('exercise_id', exos.map(e => e.id))
      const logsMap = {}
      ;(existingLogs || []).forEach(l => { logsMap[l.exercise_id] = l })
      setLogs(logsMap)
    } else {
      setLogs({})
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: a }, { data: ss }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('sessions').select('*, exercises(*)').eq('athlete_id', athleteId).eq('date', date).order('created_at')
      ])
      setAthlete(a)
      setSessions(ss || [])
      setSessionIdx(0)
      if (ss?.length) {
        await loadSessionData(ss[0])
      } else {
        setSession(null); setTitle(''); setActivation(''); setActivationLinks({}); setActivationLinkEdit(null); setCoachNotes(''); setAthleteNote('')
        setExercises([emptyExercise(0)]); setLogs({})
      }
      setLoading(false)
    }
    load()
  }, [athleteId, date])

  const switchSession = async (idx) => {
    setSessionIdx(idx)
    await loadSessionData(sessions[idx])
  }

  const addSession = async () => {
    const { data: s } = await supabase
      .from('sessions').insert({ athlete_id: athleteId, date, title: '', coach_notes: '' })
      .select('*, exercises(*)').single()
    if (s) {
      const newSessions = [...sessions, s]
      setSessions(newSessions)
      setSessionIdx(newSessions.length - 1)
      await loadSessionData(s)
    }
  }

  const deleteSession = async () => {
    if (!session?.id) return
    if (!confirm('Supprimer cette séance ?')) return
    await supabase.from('sessions').delete().eq('id', session.id)
    const newSessions = sessions.filter(s => s.id !== session.id)
    setSessions(newSessions)
    if (newSessions.length > 0) {
      const newIdx = Math.min(sessionIdx, newSessions.length - 1)
      setSessionIdx(newIdx)
      await loadSessionData(newSessions[newIdx])
    } else {
      setSession(null); setTitle(''); setActivation(''); setActivationLinks({}); setActivationLinkEdit(null); setCoachNotes(''); setAthleteNote('')
      setExercises([emptyExercise(0)]); setLogs({})
    }
  }

  const updateExo = (key, field, val) =>
    setExercises(prev => prev.map(e => e._key === key ? { ...e, [field]: val } : e))

  const searchMovements = async (key, val) => {
    if (val.trim().length < 2) { setSuggestions(prev => ({ ...prev, [key]: [] })); return }
    const { data } = await supabase
      .from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions(prev => ({ ...prev, [key]: (data || []).map(m => m.name) }))
  }

  const pickSuggestion = async (key, name) => {
    updateExo(key, 'name', name)
    setSuggestions(prev => ({ ...prev, [key]: [] }))
    // Auto-remplir le video_url depuis la bibliothèque
    const { data: mov } = await supabase.from('movements').select('video_url').eq('name', name).single()
    if (mov?.video_url) updateExo(key, 'video_url', mov.video_url)
  }
  const addExo = () =>
    setExercises(prev => [...prev, emptyExercise(prev.length)])

  const toggleLink = (idxA, idxB) => {
    setExercises(prev => {
      const next = [...prev]
      const a = next[idxA], b = next[idxB]
      if (a.superset_group && a.superset_group === b.superset_group) {
        // délier : séparer b dans son propre groupe
        next[idxB] = { ...b, superset_group: null }
      } else {
        const group = a.superset_group || b.superset_group || (Date.now() + Math.random())
        next[idxA] = { ...a, superset_group: group }
        next[idxB] = { ...b, superset_group: group }
      }
      return next
    })
  }

  const addToSuperset = (group, afterIdx) => {
    setExercises(prev => {
      const next = [...prev]
      next.splice(afterIdx + 1, 0, { ...emptyExercise(afterIdx + 1), superset_group: group })
      return next
    })
  }
  const removeExo = (key) =>
    setExercises(prev => { const n = prev.filter(e => e._key !== key); return n.length ? n : [emptyExercise(0)] })
  const moveUp = (idx) => {
    if (idx === 0) return
    setExercises(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })
  }

  const loadHistory = async (name) => {
    if (!name.trim()) return
    if (histories[name] === 'loading') return
    if (histories[name] !== undefined && histories[name] !== null) {
      setHistories(prev => ({ ...prev, [name]: null }))
      return
    }
    setHistories(prev => ({ ...prev, [name]: 'loading' }))
    const { data: sess } = await supabase
      .from('sessions').select('id, date')
      .eq('athlete_id', athleteId).neq('date', date)
      .order('date', { ascending: false })
    if (!sess?.length) { setHistories(prev => ({ ...prev, [name]: [] })); return }
    const { data: exos } = await supabase
      .from('exercises').select('id, sets, reps, kg, session_id')
      .in('session_id', sess.map(s => s.id)).ilike('name', name)
    if (!exos?.length) { setHistories(prev => ({ ...prev, [name]: [] })); return }
    const { data: alogs } = await supabase
      .from('athlete_logs').select('exercise_id, sets_done, reps_done, kg_done, note')
      .in('exercise_id', exos.map(e => e.id))
    const sessMap = Object.fromEntries(sess.map(s => [s.id, s.date]))
    const logMap = Object.fromEntries((alogs || []).map(l => [l.exercise_id, l]))
    const result = exos
      .map(e => ({ ...e, date: sessMap[e.session_id], log: logMap[e.id] || null }))
      .sort((a, b) => b.date.localeCompare(a.date))
    setHistories(prev => ({ ...prev, [name]: result }))
  }

  const save = async () => {
    setSaving(true)
    let sessionId = session?.id
    if (!sessionId) {
      const { data: s } = await supabase
        .from('sessions').insert({ athlete_id: athleteId, date, title, activation, activation_links: activationLinks, coach_notes: coachNotes })
        .select('*, exercises(*)').single()
      sessionId = s.id
      setSession(s)
      setSessions(prev => [...prev, s])
      setSessionIdx(prev => prev)
    } else {
      await supabase.from('sessions').update({ title, activation, activation_links: activationLinks, coach_notes: coachNotes }).eq('id', sessionId)
    }
    await supabase.from('exercises').delete().eq('session_id', sessionId)
    const toInsert = exercises
      .filter(e => e.name.trim())
      .map((e, i) => ({
        session_id: sessionId, order_index: i, name: e.name.trim(),
        sets: e.sets !== '' ? parseInt(e.sets) : null,
        reps: e.reps || null,
        kg: e.kg !== '' ? parseFloat(e.kg) : null,
        note: e.note || null,
        video_url: e.video_url || null,
        superset_group: e.superset_group || null,
      }))
    if (toInsert.length) {
      await supabase.from('exercises').insert(toInsert)
      // Enregistrer dans la bibliothèque (nouveaux noms)
      await supabase.from('movements')
        .upsert(toInsert.map(e => ({ name: e.name })), { onConflict: 'name', ignoreDuplicates: true })
      // Sauvegarder les video_url renseignés
      const withVideo = toInsert.filter(e => e.video_url)
      if (withVideo.length) {
        await supabase.from('movements')
          .upsert(withVideo.map(e => ({ name: e.name, video_url: e.video_url })), { onConflict: 'name' })
      }
    }
    const { data: freshExos } = await supabase
      .from('exercises').select('*').eq('session_id', sessionId).order('order_index')
    if (freshExos) {
      setExercises(freshExos.map(e => ({ ...e, _key: e.id, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '', note: e.note ?? '' })))
    }
    setHistories({})
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const openWellnessHistory = async () => {
    setWellnessOpen(true)
    if (wellnessHistory !== null) return
    const { data } = await supabase
      .from('wellness').select('*')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
    setWellnessHistory(data || [])
  }

  const inp = {
    border: '1px solid var(--border2)', borderRadius: 'var(--r)',
    padding: '9px 11px', fontSize: 14, outline: 'none',
    background: 'var(--bg2)', color: 'var(--text)', width: '100%',
  }
  const hasLogs = Object.keys(logs).length > 0

  // Calcul des labels (A, B, C... ou A1, A2... pour les superséries)
  const exoLabels = computeLabels(exercises)
  const exoCards = exercises.flatMap((exo, idx) => {
    const hist = histories[exo.name]
    const histOpen = hist && hist !== 'loading' && hist !== null
    const label = exoLabels[exo._key] || String.fromCharCode(65 + idx)
    const inSuperset = !!exo.superset_group
    const nextLinked = idx < exercises.length - 1 &&
      exo.superset_group && exo.superset_group === exercises[idx + 1]?.superset_group
    const isLastInGroup = inSuperset && !nextLinked
    const groupSize = inSuperset ? exercises.filter(e => e.superset_group === exo.superset_group).length : 0
    const elems = []

    elems.push(
      <div key={exo._key} style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderLeft: inSuperset ? '3px solid var(--green)' : '1px solid var(--border)',
        borderRadius: 'var(--rl)',
        padding: 12,
        marginBottom: nextLinked ? 2 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ minWidth: 26, height: 26, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, padding: '0 4px' }}>{label}</div>
          <div style={{ position: 'relative', flex: 1 }}>
            <input placeholder="Nom de l'exercice" value={exo.name}
              onChange={e => { updateExo(exo._key, 'name', e.target.value); searchMovements(exo._key, e.target.value) }}
              onBlur={() => setTimeout(() => setSuggestions(prev => ({ ...prev, [exo._key]: [] })), 150)}
              style={{ ...inp, fontWeight: 600, width: '100%' }} />
            {suggestions[exo._key]?.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                {suggestions[exo._key].map((s, i) => (
                  <button key={i} onMouseDown={() => pickSuggestion(exo._key, s)}
                    style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: i < suggestions[exo._key].length - 1 ? '1px solid var(--border)' : 'none', fontSize: 14, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setVideoOpen(prev => ({ ...prev, [exo._key]: !prev[exo._key] }))} title="Lien vidéo"
            style={{ background: exo.video_url ? 'var(--green-light)' : 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '4px 8px', fontSize: 13, color: exo.video_url ? 'var(--green)' : 'var(--text3)', cursor: 'pointer', flexShrink: 0 }}>🎬</button>
          {exo.id && (
            <button onClick={() => loadHistory(exo.name)} title="Voir l'historique"
              style={{ background: histOpen ? 'var(--green-light)' : 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '4px 8px', fontSize: 13, color: histOpen ? 'var(--green)' : 'var(--text3)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {hist === 'loading' ? '…' : '🕐'}
            </button>
          )}
          {idx > 0 && (
            <button onClick={() => moveUp(idx)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '4px 8px', fontSize: 13, color: 'var(--text3)', cursor: 'pointer' }}>↑</button>
          )}
          <button onClick={() => removeExo(exo._key)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, padding: '0 2px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          {[{ field: 'sets', label: 'Séries', type: 'number' }, { field: 'reps', label: 'Reps', type: 'text' }, { field: 'kg', label: 'Kg', type: 'number' }].map(({ field, label, type }) => (
            <div key={field}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 3, textAlign: 'center' }}>{label.toUpperCase()}</div>
              <input type={type} placeholder="—" value={exo[field]}
                onChange={e => updateExo(exo._key, field, e.target.value)}
                style={{ ...inp, textAlign: 'center', padding: '8px 6px' }}
                min="0" step={field === 'kg' ? '0.5' : '1'} />
            </div>
          ))}
        </div>

        <input placeholder="Consignes (tempo, récup…)" value={exo.note}
          onChange={e => updateExo(exo._key, 'note', e.target.value)}
          style={{ ...inp, fontSize: 13, color: 'var(--text2)' }} />

        {videoOpen[exo._key] && (
          <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input placeholder="URL YouTube ou autre (https://…)" value={exo.video_url || ''}
              onChange={e => updateExo(exo._key, 'video_url', e.target.value)}
              style={{ ...inp, fontSize: 12, flex: 1 }} />
            {exo.video_url && (
              <a href={exo.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none', flexShrink: 0 }}>▶ Voir</a>
            )}
          </div>
        )}

        {histOpen && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Historique — {exo.name}
            </div>
            {hist.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun historique pour ce sportif.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hist.map((h, i) => <HistoryRow key={i} entry={h} athleteName={athlete.name} />)}
              </div>
            )}
          </div>
        )}

        {logs[exo.id] && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--r)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>✓ Réalisé par {athlete.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: logs[exo.id].note ? 6 : 0 }}>
              {logs[exo.id].sets_done && <LogPill label="tours" value={logs[exo.id].sets_done} />}
              {logs[exo.id].reps_done && <LogPill label="reps" value={logs[exo.id].reps_done} />}
              {logs[exo.id].kg_done && <LogPill label="kg" value={logs[exo.id].kg_done} />}
            </div>
            {logs[exo.id].note && <div style={{ fontSize: 13, color: '#166534', fontStyle: 'italic' }}>"{logs[exo.id].note}"</div>}
          </div>
        )}
      </div>
    )

    if (isLastInGroup) {
      elems.push(
        <div key={`add-${exo._key}`} style={{ display: 'flex', paddingLeft: 6, marginTop: 2, marginBottom: 6 }}>
          <button onClick={() => addToSuperset(exo.superset_group, idx)} style={{
            background: 'var(--green-light)', border: '1px dashed #B8EAD8',
            borderRadius: 20, padding: '3px 12px',
            fontSize: 11, fontWeight: 700, color: 'var(--green)', cursor: 'pointer',
          }}>+ {label[0]}{groupSize + 1}</button>
        </div>
      )
    }

    if (idx < exercises.length - 1) {
      elems.push(
        <div key={`link-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 22, marginBottom: nextLinked ? 0 : 2 }}>
          <button onClick={() => toggleLink(idx, idx + 1)} style={{
            background: nextLinked ? 'var(--green-light)' : 'transparent',
            border: `1px solid ${nextLinked ? '#B8EAD8' : 'var(--border2)'}`,
            borderRadius: 20, padding: '1px 12px',
            fontSize: 10, fontWeight: 700,
            color: nextLinked ? 'var(--green)' : 'var(--text3)',
            cursor: 'pointer', letterSpacing: '0.3px',
          }}>{nextLinked ? '⊕ supersérie' : '+ supersérie'}</button>
        </div>
      )
    }

    return elems
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )
  if (!athlete) return (
    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Sportif introuvable.</div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
    <AthletesSidebar athleteId={athleteId} date={date} />
    <div className="coach-main" style={{ paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Link href="/" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
          <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{athlete.name}</div>
          <Link href={`/semaine/${athleteId}/${date}`} title="Vue semaine" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 9px', fontSize: 14, textDecoration: 'none', color: 'var(--text2)' }}>📅</Link>
          <button onClick={openWellnessHistory} title="Historique forme" style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 9px', fontSize: 16, cursor: 'pointer', color: 'var(--text2)' }}>⚡</button>
          {hasLogs && (
            <div style={{ fontSize: 12, fontWeight: 700, background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '4px 10px' }}>
              ✓ Séance faite
            </div>
          )}
          <button onClick={save} disabled={saving} style={{
            background: saved ? '#166534' : 'var(--green)', color: '#fff',
            border: 'none', borderRadius: 20, padding: '8px 18px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background .3s'
          }}>{saving ? '…' : saved ? '✓ Enregistré' : 'Enregistrer'}</button>
        </div>

        {/* Nav jour */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: sessions.length > 0 ? 10 : 0 }}>
          <Link href={`/programme/${athleteId}/${prevDay(date)}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 16, textDecoration: 'none', color: 'var(--text2)' }}>‹</Link>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize' }}>{formatDate(date)}</div>
          <Link href={`/programme/${athleteId}/${nextDay(date)}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 16, textDecoration: 'none', color: 'var(--text2)' }}>›</Link>
        </div>

        {/* Sélecteur séances */}
        {sessions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sessions.map((s, i) => (
              <button key={s.id} onClick={() => switchSession(i)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: '1px solid var(--border2)', cursor: 'pointer',
                background: i === sessionIdx ? 'var(--green)' : 'var(--bg2)',
                color: i === sessionIdx ? '#fff' : 'var(--text2)',
              }}>
                Séance {i + 1}{s.title ? ` — ${s.title}` : ''}
              </button>
            ))}
            <button onClick={addSession} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              border: '1px dashed var(--border2)', cursor: 'pointer',
              background: 'transparent', color: 'var(--text3)',
            }}>+ Séance</button>
            {sessions.length > 1 && session && (
              <button onClick={deleteSession} style={{
                padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: '1px solid #FCA5A5', cursor: 'pointer',
                background: 'transparent', color: '#DC2626',
              }}>Supprimer</button>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Lien sportif */}
        {athlete.token ? (
          <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#0D6B4F', flex: 1 }}>🔗 <strong>/s/{athlete.token}</strong></span>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/s/${athlete.token}`)}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Copier</button>
          </div>
        ) : (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>🔗 Aucun lien de partage</span>
            <button onClick={async () => {
              const token = crypto.randomUUID()
              const { data } = await supabase.from('athletes').update({ token }).eq('id', athleteId).select().single()
              if (data) setAthlete(data)
            }} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
              Générer le lien
            </button>
          </div>
        )}

        {/* Bien-être */}
        <WellnessBlock athleteId={athleteId} date={date} mode="coach" athleteName={athlete.name} />

        {/* Activité du jour */}
        <ActivityBlock athleteId={athleteId} date={date} isCoach={true} />

        {/* Titre */}
        <input placeholder="Titre de la séance (ex: Force — Bas du corps)" value={title}
          onChange={e => setTitle(e.target.value)} style={{ ...inp, fontWeight: 600, fontSize: 15 }} />

        {/* Activation */}
        {(() => {
          // Mots uniques extraits du texte d'activation (longueur ≥ 2, sans ponctuation seule)
          const words = [...new Set(
            activation.split(/\s+/)
              .map(w => w.replace(/^[^a-zA-ZÀ-ÿ0-9]+|[^a-zA-ZÀ-ÿ0-9]+$/g, ''))
              .filter(w => w.length >= 2)
          )]
          return (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Activation</span>
              </div>
              <textarea
                placeholder="Échauffement, mobilité, activation…"
                value={activation}
                onChange={e => { setActivation(e.target.value); setActivationLinkEdit(null) }}
                rows={2}
                style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border)', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)', minHeight: 56 }}
              />
              {/* Chips de mots linkables */}
              {words.length > 0 && (
                <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {words.map(w => {
                    const hasLink = !!activationLinks[w]
                    const isEditing = activationLinkEdit === w
                    return (
                      <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => setActivationLinkEdit(isEditing ? null : w)}
                          style={{
                            padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: hasLink ? 800 : 500,
                            border: `1px solid ${hasLink ? '#B8EAD8' : 'var(--border2)'}`,
                            background: hasLink ? 'var(--green-light)' : 'var(--bg2)',
                            color: hasLink ? 'var(--green)' : 'var(--text2)',
                            cursor: 'pointer',
                          }}
                        >
                          {hasLink ? '🎬 ' : ''}{w}
                        </button>
                        {isEditing && (
                          <input
                            autoFocus
                            placeholder="https://…"
                            value={activationLinks[w] || ''}
                            onChange={e => {
                              const url = e.target.value
                              setActivationLinks(prev => {
                                const next = { ...prev }
                                if (url) next[w] = url
                                else delete next[w]
                                return next
                              })
                            }}
                            style={{ ...inp, fontSize: 12, width: 200, padding: '4px 8px' }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {/* Note */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Note</span>
          </div>
          <textarea
            placeholder="Message pour le sportif…"
            value={coachNotes}
            onChange={e => setCoachNotes(e.target.value)}
            rows={2}
            style={{ width: '100%', border: 'none', padding: '8px 12px', fontSize: 12, outline: 'none', resize: 'vertical', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)', minHeight: 48, borderBottom: athleteNote ? '1px solid var(--border)' : 'none' }}
          />
          {athleteNote && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--bg2)', borderLeft: '3px solid var(--border2)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>Note du sportif</span>
              {athleteNote}
            </div>
          )}
        </div>

        {/* Exercices */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {exoCards}
        </div>

        <button onClick={addExo} style={{ background: 'var(--bg)', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 12, fontSize: 14, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', width: '100%', marginTop: 8 }}>
          + Ajouter un exercice
        </button>

        {/* Bouton créer séance si aucune séance */}
        {sessions.length === 0 && (
          <button onClick={addSession} style={{
            background: 'var(--green)', color: '#fff', border: 'none',
            borderRadius: 'var(--rl)', padding: 14, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', width: '100%'
          }}>+ Créer une séance pour ce jour</button>
        )}
      </div>

      {wellnessOpen && (
        <WellnessHistoryPanel
          athleteName={athlete.name}
          history={wellnessHistory}
          onClose={() => setWellnessOpen(false)}
        />
      )}
    </div>
    </div>
  )
}

function WellnessHistoryPanel({ athleteName, history, onClose }) {
  const METRICS = [
    { key: 'sommeil',     label: 'Sommeil',     emoji: '🌙', inverse: false },
    { key: 'stress',      label: 'Stress',      emoji: '😰', inverse: true  },
    { key: 'courbatures', label: 'Courbatures', emoji: '💪', inverse: true  },
    { key: 'forme',       label: 'Forme',       emoji: '⚡', inverse: false },
  ]
  function scoreColor(val, inverse) {
    if (!val) return 'var(--text3)'
    const s = inverse ? (11 - val) : val
    if (s >= 7) return '#22c55e'
    if (s >= 4) return '#f59e0b'
    return '#ef4444'
  }
  const avg = (key) => {
    if (!history?.length) return null
    const vals = history.map(r => r[key]).filter(v => v != null)
    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100 }} />
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--bg)', borderRadius: '16px 16px 0 0', zIndex: 101, maxHeight: '80svh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>⚡ Forme — {athleteName}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          {history === null ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Chargement…</div>
          ) : (
            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Moyenne depuis le début</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {METRICS.map(m => {
                  const a = avg(m.key)
                  return (
                    <div key={m.key} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{m.emoji} {m.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: a ? scoreColor(parseFloat(a), m.inverse) : 'var(--text3)' }}>{a ?? '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div style={{ height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ overflowY: 'auto', padding: '0 16px 24px', flex: 1 }}>
          {history === null ? null : history.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: 13, fontStyle: 'italic' }}>Aucune donnée enregistrée.</div>
          ) : history.map((row, i) => {
            const hasSome = METRICS.some(m => row[m.key] != null)
            if (!hasSome) return null
            return (
              <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, textTransform: 'capitalize' }}>
                  {new Date(row.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {METRICS.map(m => {
                    const v = row[m.key]
                    if (v == null) return null
                    return (
                      <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13 }}>{m.emoji}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: scoreColor(v, m.inverse) }}>{v}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function HistoryRow({ entry, athleteName }) {
  const prescribed = [
    entry.sets && `${entry.sets} séries`,
    entry.reps && `${entry.reps} reps`,
    entry.kg && `${entry.kg} kg`,
  ].filter(Boolean)
  const actual = entry.log ? [
    entry.log.sets_done && `${entry.log.sets_done} tours`,
    entry.log.reps_done && `${entry.log.reps_done} reps`,
    entry.log.kg_done && `${entry.log.kg_done} kg`,
  ].filter(Boolean) : []
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'capitalize' }}>
        {new Date(entry.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
      {prescribed.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: actual.length ? 5 : 0 }}>
          {prescribed.map((p, i) => (
            <span key={i} style={{ background: 'var(--border)', color: 'var(--text2)', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{p}</span>
          ))}
        </div>
      )}
      {actual.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: entry.log?.note ? 4 : 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>Réalisé :</span>
          {actual.map((a, i) => (
            <span key={i} style={{ background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{a}</span>
          ))}
        </div>
      )}
      {entry.log?.note && (
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>"{entry.log.note}"</div>
      )}
      {!prescribed.length && !actual.length && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Séance sans détail.</div>
      )}
    </div>
  )
}

function LogPill({ label, value }) {
  return (
    <div style={{ background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>
      {value} {label}
    </div>
  )
}
