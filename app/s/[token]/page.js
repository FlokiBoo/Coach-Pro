'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import WellnessBlock from '@/app/components/WellnessBlock'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}
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

export default function AthleteView({ params }) {
  const { token } = use(params)
  const [date, setDate] = useState(today())
  const [athlete, setAthlete] = useState(null)
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [logs, setLogs] = useState({})
  const [sessionNote, setSessionNote] = useState('')
  const [histories, setHistories] = useState({}) // { [exerciseName]: [] | 'loading' | null }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('athletes').select('*').eq('token', token).single().then(({ data }) => {
      setAthlete(data)
    })
  }, [token])

  useEffect(() => {
    if (!athlete) return
    setLoading(true)
    setHistories({})
    supabase
      .from('sessions')
      .select('*, exercises(*)')
      .eq('athlete_id', athlete.id)
      .eq('date', date)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setSession(data)
          setSessionNote(data.athlete_note || '')
          const exos = [...(data.exercises || [])].sort((a, b) => a.order_index - b.order_index)
          setExercises(exos)
          if (exos.length) {
            const { data: existingLogs } = await supabase
              .from('athlete_logs').select('*').in('exercise_id', exos.map(e => e.id))
            const logsMap = {}
            ;(existingLogs || []).forEach(l => {
              logsMap[l.exercise_id] = { sets_done: l.sets_done || '', reps_done: l.reps_done || '', kg_done: l.kg_done || '', note: l.note || '' }
            })
            setLogs(logsMap)
          } else {
            setLogs({})
          }
        } else {
          setSession(null); setExercises([]); setLogs({}); setSessionNote('')
        }
        setLoading(false)
      })
  }, [athlete, date])

  const updateLog = (exoId, field, value) =>
    setLogs(prev => ({ ...prev, [exoId]: { ...(prev[exoId] || {}), [field]: value } }))

  // ── Historique (même logique que page coach) ──
  const loadHistory = async (name) => {
    if (!name.trim() || !athlete) return
    if (histories[name] !== undefined && histories[name] !== 'loading') {
      setHistories(prev => ({ ...prev, [name]: prev[name] ? null : prev[name] }))
      return
    }
    setHistories(prev => ({ ...prev, [name]: 'loading' }))

    const { data: sess } = await supabase
      .from('sessions').select('id, date')
      .eq('athlete_id', athlete.id).neq('date', date)
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
    if (!session) return
    setSaving(true)
    await supabase.from('sessions').update({ athlete_note: sessionNote }).eq('id', session.id)
    const toUpsert = exercises
      .filter(e => logs[e.id])
      .map(e => ({
        exercise_id: e.id,
        sets_done: logs[e.id].sets_done ? parseInt(logs[e.id].sets_done) : null,
        reps_done: logs[e.id].reps_done || null,
        kg_done: logs[e.id].kg_done ? parseFloat(logs[e.id].kg_done) : null,
        note: logs[e.id].note || null,
        updated_at: new Date().toISOString(),
      }))
    if (toUpsert.length) {
      await supabase.from('athlete_logs').upsert(toUpsert, { onConflict: 'exercise_id' })
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!athlete && !loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Lien invalide.</div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '16px 16px 12px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
          {athlete ? athlete.name : 'CoachPro'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setDate(prevDay(date))} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 16, color: 'var(--text2)', cursor: 'pointer' }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize' }}>{formatDate(date)}</div>
          <button onClick={() => setDate(nextDay(date))} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 16, color: 'var(--text2)', cursor: 'pointer' }}>›</button>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {athlete && <WellnessBlock athleteId={athlete.id} date={date} mode="athlete" />}

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Chargement…</div>
        ) : !session || !exercises.length ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun programme</div>
            <div style={{ fontSize: 13 }}>Ton coach n'a pas encore publié de séance pour ce jour.</div>
          </div>
        ) : (
          <>
            {session.title && (
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', textTransform: 'capitalize' }}>{session.title}</div>
            )}

            {exercises.map((exo, idx) => (
              <ExerciseCard
                key={exo.id}
                exo={exo}
                idx={idx}
                log={logs[exo.id] || {}}
                onChange={(field, val) => updateLog(exo.id, field, val)}
                onHistory={() => loadHistory(exo.name)}
                histData={histories[exo.name]}
              />
            ))}

            {/* Note de séance */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ma note de séance</div>
              <textarea
                placeholder="Ressenti général, observations…"
                value={sessionNote}
                onChange={e => setSessionNote(e.target.value)}
                rows={3}
                style={{ width: '100%', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px 11px', fontSize: 14, outline: 'none', resize: 'vertical', background: 'var(--bg2)', fontFamily: 'inherit' }}
              />
            </div>

            <button onClick={save} disabled={saving} style={{ background: saved ? '#166534' : 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', transition: 'background .3s' }}>
              {saving ? 'Enregistrement…' : saved ? '✓ Enregistré !' : 'Sauvegarder ma séance'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ExerciseCard({ exo, idx, log, onChange, onHistory, histData }) {
  const inp = {
    border: '1px solid var(--border2)', borderRadius: 'var(--r)',
    padding: '8px 6px', fontSize: 14, outline: 'none',
    background: 'var(--bg2)', textAlign: 'center', width: '100%', fontFamily: 'inherit'
  }
  const histOpen = histData && histData !== 'loading' && histData !== null

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>

      {/* Nom + bouton historique */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{idx + 1}</div>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{exo.name}</span>
        <button
          onClick={onHistory}
          style={{
            background: histOpen ? 'var(--green-light)' : 'none',
            border: '1px solid var(--border2)', borderRadius: 'var(--r)',
            padding: '4px 8px', fontSize: 13,
            color: histOpen ? 'var(--green)' : 'var(--text3)',
            cursor: 'pointer', flexShrink: 0
          }}
        >{histData === 'loading' ? '…' : '🕐'}</button>
      </div>

      {/* Programme prescrit */}
      {(exo.sets || exo.reps || exo.kg) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {exo.sets && <Pill value={exo.sets} label="séries" />}
          {exo.reps && <Pill value={exo.reps} label="reps" />}
          {exo.kg && <Pill value={`${exo.kg} kg`} />}
        </div>
      )}

      {/* Consignes coach */}
      {exo.note && (
        <div style={{ fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 12, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 'var(--r)', borderLeft: '3px solid var(--green)' }}>
          {exo.note}
        </div>
      )}

      {/* Historique panel */}
      {histOpen && (
        <div style={{ marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Mes séances précédentes
          </div>
          {histData.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun historique pour cet exercice.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {histData.map((h, i) => <HistoryRow key={i} entry={h} />)}
            </div>
          )}
        </div>
      )}

      {/* Ce que j'ai fait */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Ce que j'ai fait
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        {[{ field: 'sets_done', label: 'Tours' }, { field: 'reps_done', label: 'Reps' }, { field: 'kg_done', label: 'Kg' }].map(({ field, label }) => (
          <div key={field}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textAlign: 'center' }}>{label.toUpperCase()}</div>
            <input
              type={field === 'reps_done' ? 'text' : 'number'} placeholder="—"
              value={log[field] || ''} onChange={e => onChange(field, e.target.value)}
              style={inp} min="0" step={field === 'kg_done' ? '0.5' : '1'} />
          </div>
        ))}
      </div>
      <input
        placeholder="Note (ressenti, difficulté…)"
        value={log.note || ''} onChange={e => onChange('note', e.target.value)}
        style={{ ...inp, textAlign: 'left', padding: '8px 10px' }} />
    </div>
  )
}

function HistoryRow({ entry }) {
  const actual = entry.log ? [
    entry.log.sets_done && `${entry.log.sets_done} tours`,
    entry.log.reps_done && `${entry.log.reps_done} reps`,
    entry.log.kg_done && `${entry.log.kg_done} kg`,
  ].filter(Boolean) : []

  const prescribed = [
    entry.sets && `${entry.sets} séries`,
    entry.reps && `${entry.reps} reps`,
    entry.kg && `${entry.kg} kg`,
  ].filter(Boolean)

  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'capitalize' }}>
        {new Date(entry.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
      {actual.length > 0 ? (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: entry.log?.note ? 4 : 0 }}>
          {actual.map((a, i) => (
            <span key={i} style={{ background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{a}</span>
          ))}
        </div>
      ) : prescribed.length > 0 ? (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {prescribed.map((p, i) => (
            <span key={i} style={{ background: 'var(--border)', color: 'var(--text2)', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{p}</span>
          ))}
        </div>
      ) : null}
      {entry.log?.note && (
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginTop: 2 }}>"{entry.log.note}"</div>
      )}
    </div>
  )
}

function Pill({ value, label }) {
  return (
    <div style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>
      {value}{label ? ` ${label}` : ''}
    </div>
  )
}
