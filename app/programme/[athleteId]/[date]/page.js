'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import WellnessBlock from '@/app/components/WellnessBlock'

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}
function formatDateShort(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short'
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
  return { _key: Date.now() + Math.random(), order_index: order, name: '', sets: '', reps: '', kg: '', note: '' }
}

export default function ProgrammePage({ params }) {
  const { athleteId, date } = use(params)

  const [athlete, setAthlete] = useState(null)
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([emptyExercise(0)])
  const [title, setTitle] = useState('')
  const [coachNotes, setCoachNotes] = useState('')
  const [logs, setLogs] = useState({})
  const [athleteNote, setAthleteNote] = useState('')
  const [histories, setHistories] = useState({}) // { [name]: [] | 'loading' | null }
  const [suggestions, setSuggestions] = useState({}) // { [_key]: string[] }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [wellnessOpen, setWellnessOpen] = useState(false)
  const [wellnessHistory, setWellnessHistory] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setHistories({})
      const [{ data: a }, { data: s }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('sessions').select('*, exercises(*)').eq('athlete_id', athleteId).eq('date', date).single()
      ])
      setAthlete(a)
      if (s) {
        setSession(s)
        setTitle(s.title || '')
        setCoachNotes(s.coach_notes || '')
        setAthleteNote(s.athlete_note || '')
        const exos = [...(s.exercises || [])].sort((a, b) => a.order_index - b.order_index)
        const mapped = exos.length
          ? exos.map(e => ({ ...e, _key: e.id, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '', note: e.note ?? '' }))
          : [emptyExercise(0)]
        setExercises(mapped)
        if (exos.length) {
          const { data: existingLogs } = await supabase
            .from('athlete_logs').select('*').in('exercise_id', exos.map(e => e.id))
          const logsMap = {}
          ;(existingLogs || []).forEach(l => { logsMap[l.exercise_id] = l })
          setLogs(logsMap)
        }
      } else {
        setSession(null); setTitle(''); setCoachNotes(''); setAthleteNote('')
        setExercises([emptyExercise(0)]); setLogs({})
      }
      setLoading(false)
    }
    load()
  }, [athleteId, date])

  const updateExo = (key, field, val) =>
    setExercises(prev => prev.map(e => e._key === key ? { ...e, [field]: val } : e))

  const searchMovements = async (key, val) => {
    if (val.trim().length < 2) { setSuggestions(prev => ({ ...prev, [key]: [] })); return }
    const { data } = await supabase
      .from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions(prev => ({ ...prev, [key]: (data || []).map(m => m.name) }))
  }

  const pickSuggestion = (key, name) => {
    updateExo(key, 'name', name)
    setSuggestions(prev => ({ ...prev, [key]: [] }))
  }
  const addExo = () =>
    setExercises(prev => [...prev, emptyExercise(prev.length)])
  const removeExo = (key) =>
    setExercises(prev => { const n = prev.filter(e => e._key !== key); return n.length ? n : [emptyExercise(0)] })
  const moveUp = (idx) => {
    if (idx === 0) return
    setExercises(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })
  }

  // ── Historique ──
  const loadHistory = async (name) => {
    if (!name.trim()) return
    // Toggle fermeture
    if (histories[name] !== undefined && histories[name] !== 'loading') {
      setHistories(prev => ({ ...prev, [name]: prev[name] ? null : prev[name] }))
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

  // ── Sauvegarde ──
  const save = async () => {
    setSaving(true)
    let sessionId = session?.id
    if (!sessionId) {
      const { data: s } = await supabase
        .from('sessions').insert({ athlete_id: athleteId, date, title, coach_notes: coachNotes })
        .select().single()
      sessionId = s.id; setSession(s)
    } else {
      await supabase.from('sessions').update({ title, coach_notes: coachNotes }).eq('id', sessionId)
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
      }))
    if (toInsert.length) {
      await supabase.from('exercises').insert(toInsert)
      // Enregistrer dans la bibliothèque
      await supabase.from('movements')
        .upsert(toInsert.map(e => ({ name: e.name })), { onConflict: 'name', ignoreDuplicates: true })
    }
    // Recharger les exercices pour avoir les vrais IDs
    const { data: freshExos } = await supabase
      .from('exercises').select('*').eq('session_id', sessionId).order('order_index')
    if (freshExos) {
      setExercises(freshExos.map(e => ({ ...e, _key: e.id, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '', note: e.note ?? '' })))
    }
    setHistories({}) // reset historiques après save
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )
  if (!athlete) return (
    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Sportif introuvable.</div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Link href="/" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
          <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{athlete.name}</div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href={`/programme/${athleteId}/${prevDay(date)}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 16, textDecoration: 'none', color: 'var(--text2)' }}>‹</Link>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize' }}>{formatDate(date)}</div>
          <Link href={`/programme/${athleteId}/${nextDay(date)}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 16, textDecoration: 'none', color: 'var(--text2)' }}>›</Link>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Lien sportif */}
        {athlete.token && (
          <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#0D6B4F', flex: 1 }}>🔗 <strong>/s/{athlete.token}</strong></span>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/s/${athlete.token}`)}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Copier</button>
          </div>
        )}

        {/* Bien-être */}
        <WellnessBlock athleteId={athleteId} date={date} mode="coach" athleteName={athlete.name} />

        {/* Titre */}
        <input placeholder="Titre de la séance (ex: Force — Bas du corps)" value={title}
          onChange={e => setTitle(e.target.value)} style={{ ...inp, fontWeight: 600, fontSize: 15 }} />

        {/* Exercices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exercises.map((exo, idx) => {
            const hist = histories[exo.name]
            const histOpen = hist && hist !== 'loading' && hist !== null
            return (
              <div key={exo._key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 12 }}>

                {/* Nom + contrôles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
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
                  {/* Bouton historique */}
                  {exo.id && (
                    <button
                      onClick={() => loadHistory(exo.name)}
                      title="Voir l'historique"
                      style={{
                        background: histOpen ? 'var(--green-light)' : 'none',
                        border: '1px solid var(--border2)', borderRadius: 'var(--r)',
                        padding: '4px 8px', fontSize: 13,
                        color: histOpen ? 'var(--green)' : 'var(--text3)',
                        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
                      }}
                    >
                      {hist === 'loading' ? '…' : '🕐'}
                    </button>
                  )}
                  {idx > 0 && (
                    <button onClick={() => moveUp(idx)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '4px 8px', fontSize: 13, color: 'var(--text3)', cursor: 'pointer' }}>↑</button>
                  )}
                  <button onClick={() => removeExo(exo._key)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, padding: '0 2px', cursor: 'pointer' }}>×</button>
                </div>

                {/* Séries / Reps / Kg */}
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

                {/* Note coach */}
                <input placeholder="Consignes (tempo, récup…)" value={exo.note}
                  onChange={e => updateExo(exo._key, 'note', e.target.value)}
                  style={{ ...inp, fontSize: 13, color: 'var(--text2)' }} />

                {/* Panel historique */}
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

                {/* Ce que le sportif a fait */}
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
          })}
        </div>

        {/* Ajouter exercice */}
        <button onClick={addExo} style={{ background: 'var(--bg)', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 12, fontSize: 14, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', width: '100%' }}>
          + Ajouter un exercice
        </button>

        {/* Notes coach */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes coach (privées)</div>
          <textarea placeholder="Observations, ajustements…" value={coachNotes}
            onChange={e => setCoachNotes(e.target.value)} rows={3}
            style={{ ...inp, resize: 'vertical' }} />
        </div>

        {/* Note du sportif */}
        {athleteNote && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--rl)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Note de {athlete.name}</div>
            <div style={{ fontSize: 14, color: '#166534', fontStyle: 'italic', lineHeight: 1.5 }}>"{athleteNote}"</div>
          </div>
        )}
      </div>

      {/* Panneau historique bien-être */}
      {wellnessOpen && (
        <WellnessHistoryPanel
          athleteName={athlete.name}
          history={wellnessHistory}
          onClose={() => setWellnessOpen(false)}
        />
      )}
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
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100 }} />

      {/* Panneau slide-up */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--bg)', borderRadius: '16px 16px 0 0', zIndex: 101, maxHeight: '80svh', display: 'flex', flexDirection: 'column' }}>

        {/* Handle + titre */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>⚡ Forme — {athleteName}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          {/* Moyennes */}
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
                      <div style={{ fontSize: 20, fontWeight: 800, color: a ? scoreColor(parseFloat(a), m.inverse) : 'var(--text3)' }}>
                        {a ?? '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 0 }} />
        </div>

        {/* Liste scrollable */}
        <div style={{ overflowY: 'auto', padding: '0 16px 24px', flex: 1 }}>
          {history === null ? null : history.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: 13, fontStyle: 'italic' }}>
              Aucune donnée enregistrée.
            </div>
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
      {/* Prescrit */}
      {prescribed.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: actual.length ? 5 : 0 }}>
          {prescribed.map((p, i) => (
            <span key={i} style={{ background: 'var(--border)', color: 'var(--text2)', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{p}</span>
          ))}
        </div>
      )}
      {/* Réalisé */}
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
