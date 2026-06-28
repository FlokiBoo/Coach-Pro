'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import WellnessBlock from '@/app/components/WellnessBlock'

function computeLabels(exercises) {
  const labels = {}
  let letterIdx = 0
  let i = 0
  while (i < exercises.length) {
    const g = exercises[i].superset_group
    if (!g) {
      labels[exercises[i].id] = String.fromCharCode(65 + letterIdx)
      letterIdx++
      i++
    } else {
      let j = i
      while (j < exercises.length && exercises[j].superset_group === g) j++
      const letter = String.fromCharCode(65 + letterIdx)
      for (let k = i; k < j; k++) labels[exercises[k].id] = `${letter}${k - i + 1}`
      letterIdx++
      i = j
    }
  }
  return labels
}

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
  const [tab, setTab] = useState('seances') // 'seances' | 'programme'
  const [date, setDate] = useState(today())
  const [athlete, setAthlete] = useState(null)
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [logs, setLogs] = useState({})
  const [sessionNote, setSessionNote] = useState('')
  const [histories, setHistories] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Programme
  const [programs, setPrograms] = useState([])
  const [completions, setCompletions] = useState(new Set()) // Set of program_session_ids
  const [activeProgram, setActiveProgram] = useState(null)
  const [progSessions, setProgSessions] = useState([])
  const [openProgSession, setOpenProgSession] = useState(null)
  const [progLogs, setProgLogs] = useState({}) // { [prog_exercise_id]: {...} }
  const [progValidating, setProgValidating] = useState(false)

  useEffect(() => {
    supabase.from('athletes').select('*').eq('token', token).single().then(({ data }) => {
      setAthlete(data)
    })
  }, [token])

  // Charger les programmes quand l'athlète est connu
  useEffect(() => {
    if (!athlete) return
    async function loadPrograms() {
      const [{ data: progs }, { data: comps }] = await Promise.all([
        supabase.from('programs')
          .select('*, program_sessions(*, program_exercises(*))')
          .eq('athlete_id', athlete.id)
          .order('created_at', { ascending: false }),
        supabase.from('program_completions').select('program_session_id').eq('athlete_id', athlete.id)
      ])
      const progList = progs || []
      setPrograms(progList)
      setCompletions(new Set((comps || []).map(c => c.program_session_id)))
      if (progList.length > 0) {
        const prog = progList[0]
        setActiveProgram(prog)
        const sess = [...(prog.program_sessions || [])].sort((a, b) => a.order_index - b.order_index).map(s => ({
          ...s,
          exercises: [...(s.program_exercises || [])].sort((a, b) => a.order_index - b.order_index)
        }))
        setProgSessions(sess)
        // Auto-ouvrir la première séance non complétée
        const first = sess.find(s => !(comps || []).map(c => c.program_session_id).includes(s.id))
        if (first) setOpenProgSession(first.id)
      }
    }
    loadPrograms()
  }, [athlete])

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
          // Récupérer les video_url depuis la bibliothèque
          if (exos.length) {
            const names = [...new Set(exos.map(e => e.name).filter(Boolean))]
            const { data: movs } = await supabase.from('movements').select('name, video_url').in('name', names)
            const videoMap = Object.fromEntries((movs || []).filter(m => m.video_url).map(m => [m.name, m.video_url]))
            setExercises(exos.map(e => ({ ...e, video_url: videoMap[e.name] || null })))
          } else {
            setExercises(exos)
          }
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
    if (histories[name] === 'loading') return
    if (histories[name] !== undefined && histories[name] !== null) {
      setHistories(prev => ({ ...prev, [name]: null }))
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

  const validateProgSession = async (sessId) => {
    if (!athlete) return
    setProgValidating(true)
    await supabase.from('program_completions').upsert(
      { athlete_id: athlete.id, program_session_id: sessId },
      { onConflict: 'athlete_id,program_session_id' }
    )
    const newCompletions = new Set([...completions, sessId])
    setCompletions(newCompletions)
    // Ouvrir la prochaine séance non validée
    const next = progSessions.find(s => !newCompletions.has(s.id))
    setOpenProgSession(next?.id || null)
    setProgValidating(false)
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
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>
            {athlete ? athlete.name : 'CoachPro'}
          </div>
          {athlete && (
            <a
              href={`https://tracker-nutrition.netlify.app/tracker.html?profil=${encodeURIComponent(athlete.name)}&coach=maxime`}
              target="_blank" rel="noreferrer"
              style={{ background: '#F0FDF4', border: '1px solid #B8EAD8', color: 'var(--green)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
            >🥗 Nutrition</a>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setDate(prevDay(date))} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 16, color: 'var(--text2)', cursor: 'pointer' }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize' }}>{formatDate(date)}</div>
          <button onClick={() => setDate(nextDay(date))} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 16, color: 'var(--text2)', cursor: 'pointer' }}>›</button>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {athlete && <WellnessBlock athleteId={athlete.id} date={date} mode="athlete" />}

        {/* ── Programme (si existant) ── */}
        {programs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Sélecteur de programme si plusieurs */}
              {programs.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {programs.map(p => (
                    <button key={p.id} onClick={() => {
                      setActiveProgram(p)
                      const sess = [...(p.program_sessions || [])].sort((a, b) => a.order_index - b.order_index).map(s => ({
                        ...s, exercises: [...(s.program_exercises || [])].sort((a, b) => a.order_index - b.order_index)
                      }))
                      setProgSessions(sess)
                      const first = sess.find(s => !completions.has(s.id))
                      setOpenProgSession(first?.id || null)
                    }} style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      border: '1px solid var(--border2)', cursor: 'pointer',
                      background: activeProgram?.id === p.id ? 'var(--green)' : 'var(--bg2)',
                      color: activeProgram?.id === p.id ? '#fff' : 'var(--text2)',
                    }}>{p.title}</button>
                  ))}
                </div>
              )}

              {/* Titre + progression */}
              {activeProgram && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '12px 14px' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{activeProgram.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--green)', borderRadius: 10, width: `${progSessions.length ? Math.round((progSessions.filter(s => completions.has(s.id)).length / progSessions.length) * 100) : 0}%`, transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', flexShrink: 0 }}>
                      {progSessions.filter(s => completions.has(s.id)).length} / {progSessions.length}
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des séances */}
              {progSessions.map((s, idx) => {
                const isDone = completions.has(s.id)
                const isLocked = !isDone && idx > 0 && !completions.has(progSessions[idx - 1]?.id)
                const isOpen = openProgSession === s.id && !isLocked
                const labels = computeLabels(s.exercises)

                return (
                  <div key={s.id} style={{
                    background: 'var(--bg)', border: `1px solid ${isDone ? '#BBF7D0' : isLocked ? 'var(--border)' : 'var(--border)'}`,
                    borderRadius: 'var(--rl)', overflow: 'hidden',
                    opacity: isLocked ? 0.5 : 1,
                  }}>
                    <div
                      onClick={() => !isLocked && setOpenProgSession(isOpen ? null : s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: isLocked ? 'default' : 'pointer', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: isDone ? '#DCFCE7' : isLocked ? 'var(--bg2)' : 'var(--green-light)',
                        color: isDone ? '#166534' : isLocked ? 'var(--text3)' : 'var(--green)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800
                      }}>
                        {isDone ? '✓' : isLocked ? '🔒' : idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isDone ? '#166534' : 'var(--text)' }}>
                          {s.title || `Séance ${idx + 1}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                          {s.exercises.filter(e => e.name).length} exercice{s.exercises.filter(e => e.name).length !== 1 ? 's' : ''}
                          {isDone ? ' · Complétée ✓' : isLocked ? ' · Bloquée' : ' · En cours'}
                        </div>
                      </div>
                      {!isLocked && <span style={{ color: 'var(--text3)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>}
                    </div>

                    {isOpen && (
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {s.activation && (
                          <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>⚡ Activation</div>
                            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                              <ActivationText text={s.activation} links={s.activation_links || {}} />
                            </div>
                          </div>
                        )}
                        {s.coach_notes && (
                          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', borderLeft: '3px solid var(--green)' }}>
                            {s.coach_notes}
                          </div>
                        )}
                        {s.exercises.filter(e => e.name).map((exo, ei) => {
                          const label = labels[exo.id] || String.fromCharCode(65 + ei)
                          return (
                            <div key={exo.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ minWidth: 22, height: 22, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, padding: '0 3px', flexShrink: 0 }}>{label}</div>
                                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{exo.name}</span>
                                {exo.video_url && (
                                  <a href={exo.video_url} target="_blank" rel="noreferrer" style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '3px 8px', fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>▶</a>
                                )}
                              </div>
                              {(exo.sets || exo.reps || exo.kg) && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: exo.note ? 6 : 0 }}>
                                  {exo.sets && <Pill value={exo.sets} label="séries" />}
                                  {exo.reps && <Pill value={exo.reps} label="reps" />}
                                  {exo.kg && <Pill value={`${exo.kg} kg`} />}
                                </div>
                              )}
                              {exo.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 4 }}>{exo.note}</div>}
                            </div>
                          )
                        })}

                        {!isDone && (
                          <button onClick={() => validateProgSession(s.id)} disabled={progValidating} style={{
                            background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
                            padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 4
                          }}>
                            {progValidating ? 'Validation…' : '✓ Valider cette séance'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        )}

        {/* ── Séance du jour ── */}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Chargement…</div>
        ) : (!session || !exercises.length) ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucune séance ce jour</div>
            <div style={{ fontSize: 13 }}>Ton coach n'a pas encore publié de séance pour ce jour.</div>
          </div>
        ) : (
          <>
            {session.title && (
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', textTransform: 'capitalize' }}>{session.title}</div>
            )}

            {session.activation && (
              <div style={{ background: 'var(--bg)', border: '1px solid #B8EAD8', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #B8EAD8', background: 'var(--green-light)' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Activation</span>
                </div>
                <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>
                  <ActivationText text={session.activation} links={session.activation_links || {}} />
                </div>
              </div>
            )}

            {/* Note : message coach + note perso athlete */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Note</span>
              </div>
              {session.coach_notes && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6, borderBottom: '1px solid var(--border)', fontStyle: 'italic', borderLeft: '3px solid var(--green)' }}>
                  {session.coach_notes}
                </div>
              )}
              <textarea
                placeholder="Ma note personnelle…"
                value={sessionNote}
                onChange={e => setSessionNote(e.target.value)}
                rows={2}
                style={{ width: '100%', border: 'none', padding: '8px 12px', fontSize: 12, outline: 'none', resize: 'vertical', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)', minHeight: 48 }}
              />
            </div>

            {(() => {
              const labels = computeLabels(exercises)
              return exercises.map((exo, idx) => (
                <ExerciseCard
                  key={exo.id}
                  exo={exo}
                  label={labels[exo.id] || String.fromCharCode(65 + idx)}
                  log={logs[exo.id] || {}}
                  onChange={(field, val) => updateLog(exo.id, field, val)}
                  onHistory={() => loadHistory(exo.name)}
                  histData={histories[exo.name]}
                />
              ))
            })()}

            <button onClick={save} disabled={saving} style={{ background: saved ? '#166534' : 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', transition: 'background .3s' }}>
              {saving ? 'Enregistrement…' : saved ? '✓ Enregistré !' : 'Sauvegarder ma séance'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ExerciseCard({ exo, label, log, onChange, onHistory, histData }) {
  const inp = {
    border: '1px solid var(--border2)', borderRadius: 'var(--r)',
    padding: '8px 6px', fontSize: 14, outline: 'none',
    background: 'var(--bg2)', textAlign: 'center', width: '100%', fontFamily: 'inherit'
  }
  const histOpen = histData && histData !== 'loading' && histData !== null

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>

      {/* Nom + bouton historique + vidéo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, padding: '0 4px' }}>{label}</div>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{exo.name}</span>
        {exo.video_url && (
          <a href={exo.video_url} target="_blank" rel="noreferrer" style={{
            background: 'var(--green-light)', color: 'var(--green)',
            border: '1px solid #B8EAD8', borderRadius: 'var(--r)',
            padding: '4px 8px', fontSize: 13, textDecoration: 'none', flexShrink: 0, fontWeight: 700
          }}>▶</a>
        )}
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

function ActivationText({ text, links }) {
  // Découpe le texte en tokens (mots + espaces/sauts de ligne) et rend les mots liés en gras+cliquable
  const tokens = text.split(/(\s+)/)
  return (
    <>
      {tokens.map((token, i) => {
        const clean = token.replace(/^[^a-zA-ZÀ-ÿ0-9]+|[^a-zA-ZÀ-ÿ0-9]+$/g, '')
        const url = links[clean]
        if (url && clean) {
          return (
            <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontWeight: 800, color: 'var(--green)', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              {token}
            </a>
          )
        }
        if (token === '\n' || token === '\r\n') return <br key={i} />
        return <span key={i}>{token}</span>
      })}
    </>
  )
}
