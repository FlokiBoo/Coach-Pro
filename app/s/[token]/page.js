'use client'

import { useState, useEffect, use, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import WellnessBlock from '@/app/components/WellnessBlock'
import ActivityBlock from '@/app/components/ActivityBlock'
import WeeklyStatsBlock from '@/app/components/WeeklyStatsBlock'
import ProgressBlock from '@/app/components/ProgressBlock'
import CelebrationModal, { parseMusclesFromText } from '@/app/components/CelebrationModal'
import MuscleAnatomyDiagram from '@/app/components/MuscleAnatomyDiagram'

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

export default function AthleteViewWrapper({ params }) {
  return (
    <Suspense>
      <AthleteView params={params} />
    </Suspense>
  )
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
  const searchParams = useSearchParams()
  const isCoachView = searchParams.get('coach') === '1'
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([])
  const [completions, setCompletions] = useState(new Set())
  const [openSessionId, setOpenSessionId] = useState(null)
  const [validating, setValidating] = useState(false)
  const [exerciseLogs, setExerciseLogs] = useState({})
  const [viewDate, setViewDate] = useState(today())
  const [celebration, setCelebration] = useState(null)
  const [showFreeForm, setShowFreeForm] = useState(false)
  const [completionFeedback, setCompletionFeedback] = useState({})

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/athlete-view/${token}`)
      if (!res.ok) return
      const { athlete: ath, programs: progs, completions: comps, exerciseLogs: logs, movieMap } = await res.json()
      setAthlete(ath)

      const logsMap = {}
      ;(logs || []).forEach(l => { logsMap[l.program_exercise_id] = l })
      setExerciseLogs(logsMap)
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
              .map(e => ({ ...e, video_url: (movieMap || {})[e.name] ?? e.video_url }))
          }))
      }))
      setPrograms(progList)

      // Auto-ouvrir la première séance à faire du premier programme
      for (const prog of progList) {
        const next = prog.sessions.find(s => !completionSet.has(s.id))
        if (next) { setOpenSessionId(next.id); break }
      }
    }
    load()
  }, [token])

  const unvalidate = async (sessId, progSessions) => {
    if (!athlete) return
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
      setCelebration({ tonnage: Math.round(tonnage), muscles })
    }
  }

  const saveExerciseLog = async (exerciseId, field, value) => {
    if (!athlete) return
    const existing = exerciseLogs[exerciseId] || {}
    const updated = { ...existing, [field]: value }
    setExerciseLogs(prev => ({ ...prev, [exerciseId]: updated }))
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
  }

  const createFreeSession = async (exos) => {
    if (!athlete) return
    const res = await fetch(`/api/athlete-view/${token}/free-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises: exos }),
    })
    const json = await res.json()
    if (!res.ok) { alert('Erreur : ' + (json?.error || 'impossible de créer la séance')); return }

    const newProg = {
      ...json.program,
      sessions: [{ ...json.session, exercises: (json.session.exercises || []).sort((a, b) => a.order_index - b.order_index) }],
    }
    setPrograms(prev => [newProg, ...prev])
    setOpenSessionId(json.session.id)
    setShowFreeForm(false)
  }

  if (!athlete) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>{athlete.name}</div>
        </div>
        {isCoachView && (
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', fontWeight: 600 }}>
            ← Vue coach
          </a>
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <WeeklyStatsBlock athleteId={athlete.id} />
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
          <button onClick={() => setShowFreeForm(true)} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 20, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ⚡ Séance libre
          </button>
        </div>

        {programs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600 }}>Aucun programme actif</div>
          </div>
        )}

        {programs.map(prog => {
          const done = prog.sessions.filter(s => completions.has(s.id)).length
          const total = prog.sessions.length
          const allDone = done === total && total > 0
          const nextSession = prog.sessions.find(s => !completions.has(s.id))
          const nextIdx = prog.sessions.indexOf(nextSession)
          const pastSessions = prog.sessions
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => completions.has(s.id))
            .reverse()
          const isOpenNext = nextSession && openSessionId === nextSession.id

          return (
            <div key={prog.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

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

              {/* Séance à faire */}
              {nextSession && (
                <SessionCard
                  session={nextSession}
                  idx={nextIdx}
                  isOpen={isOpenNext}
                  isCompleted={false}
                  onToggle={() => setOpenSessionId(isOpenNext ? null : nextSession.id)}
                  onValidate={(fb) => validate(nextSession.id, prog.sessions, fb)}
                  onUnvalidate={null}
                  validating={validating}
                  exerciseLogs={exerciseLogs}
                  onSaveLog={saveExerciseLog}
                  athleteId={athlete.id}
                />
              )}

              {/* Programme terminé */}
              {allDone && (
                <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 'var(--rl)', padding: '12px 14px', textAlign: 'center', color: '#166534', fontWeight: 700, fontSize: 14 }}>
                  ✓ Programme terminé !
                </div>
              )}

              {/* Séances validées : consultables et modifiables */}
              {pastSessions.map(({ s: pastSession, i: pastIdx }) => {
                const isOpenPast = openSessionId === pastSession.id
                return (
                  <div key={pastSession.id}>
                    <button
                      onClick={() => setOpenSessionId(isOpenPast ? null : pastSession.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {isOpenPast ? '▲' : '▼'} {pastSession.title || `Séance ${pastIdx + 1}`} · validée
                    </button>
                    {isOpenPast && (
                      <div style={{ marginTop: 4 }}>
                        <SessionCard
                          session={pastSession}
                          idx={pastIdx}
                          isOpen={true}
                          isCompleted={true}
                          onToggle={() => setOpenSessionId(null)}
                          onValidate={(fb) => validate(pastSession.id, prog.sessions, fb, { isUpdate: true })}
                          onUnvalidate={() => unvalidate(pastSession.id, prog.sessions)}
                          initialFeedback={completionFeedback[pastSession.id]}
                          validating={validating}
                          exerciseLogs={exerciseLogs}
                          onSaveLog={saveExerciseLog}
                          athleteId={athlete.id}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {celebration && (
        <CelebrationModal
          tonnage={celebration.tonnage}
          muscles={celebration.muscles}
          onClose={() => setCelebration(null)}
        />
      )}

      {showFreeForm && (
        <FreeSessionModal onClose={() => setShowFreeForm(false)} onCreate={createFreeSession} />
      )}
    </div>
  )
}

const logInputStyle = {
  width: '100%', padding: '7px 9px', border: '1px solid var(--border2)',
  borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, outline: 'none',
  background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box'
}

function SessionCard({ session, idx, isOpen, isCompleted, onToggle, onValidate, onUnvalidate, initialFeedback, validating, exerciseLogs = {}, onSaveLog, athleteId }) {
  const exos = session.exercises.filter(e => e.name)
  const labels = computeLabels(session.exercises)
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
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            {session.title || `Séance ${idx + 1}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {exos.length} exercice{exos.length !== 1 ? 's' : ''}{isCompleted ? ' · déjà validée' : ''}
          </div>
        </div>
        {isOpen && !isCompleted && onValidate && (
          <button onClick={e => { e.stopPropagation(); onValidate() }} disabled={validating}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            ✓ Validé
          </button>
        )}
        <span style={{ fontSize: 18, color: 'var(--text3)' }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
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
                        <a href={v.video_url} target="_blank" rel="noreferrer"
                          style={{ background: 'var(--green)', color: '#fff', borderRadius: 'var(--r)', padding: '4px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                          ▶ Voir
                        </a>
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
                        <a href={v.video_url} target="_blank" rel="noreferrer"
                          style={{ background: '#4338CA', color: '#fff', borderRadius: 'var(--r)', padding: '4px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                          ▶ Voir
                        </a>
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
                  <a href={exo.video_url} target="_blank" rel="noreferrer" style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>▶</a>
                )}
              </div>
              {(() => {
                const flow = getSupersetFlow(exos, ei, labels)
                return flow ? (
                  <div style={{ fontSize: 11, color: '#6366f1', background: '#EEF2FF', borderRadius: 6, padding: '4px 10px', marginBottom: 6, fontWeight: 700, letterSpacing: '0.2px' }}>
                    {flow}
                  </div>
                ) : null
              })()}
              {(exo.sets || exo.reps || exo.kg || exo.rest) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: exo.note ? 6 : 0 }}>
                  {exo.sets && <Pill value={exo.sets} label="séries" />}
                  {exo.reps && <Pill value={exo.reps} label="reps" />}
                  {exo.kg && <Pill value={`${exo.kg} kg`} />}
                  {exo.rest && <Pill value={exo.rest} label="récup" color="#EFF6FF" textColor="#1D4ED8" />}
                </div>
              )}
              {exo.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>{exo.note}</div>}

              {/* Log client */}
              {onSaveLog && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ma séance</div>
                  {(exo.sets || exo.reps || exo.kg) && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {exo.sets && (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Séries</div>
                          <input type="text" placeholder={exo.sets}
                            defaultValue={exerciseLogs[exo.id]?.sets_done || ''}
                            onBlur={e => onSaveLog(exo.id, 'sets_done', e.target.value)}
                            style={logInputStyle} />
                        </div>
                      )}
                      {exo.reps && (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Reps</div>
                          <input type="text" placeholder={exo.reps}
                            defaultValue={exerciseLogs[exo.id]?.reps_done || ''}
                            onBlur={e => onSaveLog(exo.id, 'reps_done', e.target.value)}
                            style={logInputStyle} />
                        </div>
                      )}
                      {exo.kg && (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Charge (kg)</div>
                          <input type="text" placeholder={`${exo.kg} kg`}
                            defaultValue={exerciseLogs[exo.id]?.kg_done || ''}
                            onBlur={e => onSaveLog(exo.id, 'kg_done', e.target.value)}
                            style={logInputStyle} />
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Note</div>
                    <textarea placeholder="Comment c'était ?"
                      defaultValue={exerciseLogs[exo.id]?.note || ''}
                      onBlur={e => onSaveLog(exo.id, 'note', e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {onValidate && (
            <SessionFeedback onValidate={onValidate} validating={validating} isUpdate={isCompleted} initial={initialFeedback} />
          )}
          {isCompleted && onUnvalidate && (
            <button onClick={onUnvalidate} disabled={validating}
              style={{ background: 'var(--bg2)', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 'var(--rl)', padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 4 }}>
              {validating ? '…' : '↩ Annuler la validation'}
            </button>
          )}
        </div>
      )}
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

function SessionFeedback({ onValidate, validating, isUpdate = false, initial = null }) {
  const [pleasure, setPleasure] = useState(initial?.pleasure ?? null)
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? null)
  const [duration, setDuration] = useState(initial?.duration_minutes ? String(initial.duration_minutes) : '')

  const canSubmit = pleasure !== null && difficulty !== null

  return (
    <div style={{ marginTop: 8, background: 'var(--bg2)', borderRadius: 'var(--rl)', border: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Bilan de séance</div>

      <RatingRow label="Plaisir" value={pleasure} onChange={setPleasure} />
      <RatingRow label="Difficulté" value={difficulty} onChange={setDifficulty} />

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Durée (minutes)</div>
        <input
          type="number" min="1" placeholder="ex: 60"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 15, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
        />
      </div>

      <button
        onClick={() => onValidate({ pleasure, difficulty, duration_minutes: duration ? parseInt(duration) : null })}
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

let tipsCache = null

function TipsButton() {
  const [open, setOpen] = useState(false)
  const [tips, setTips] = useState(tipsCache)
  const [selected, setSelected] = useState(null)

  const openModal = async (e) => {
    e.stopPropagation()
    setOpen(true)
    setSelected(null)
    if (!tipsCache) {
      const { data } = await supabase.from('tips').select('*').order('order_index')
      tipsCache = data || []
      setTips(tipsCache)
    }
  }

  return (
    <>
      <button onClick={openModal} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        💡
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
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
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
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
      )}
    </>
  )
}

function emptyFreeExo() {
  return { _key: Date.now() + Math.random(), name: '', sets: '', reps: '', kg: '' }
}

function FreeSessionModal({ onClose, onCreate }) {
  const [exos, setExos] = useState([emptyFreeExo()])
  const [suggestions, setSuggestions] = useState({})
  const [saving, setSaving] = useState(false)

  const updateExo = (key, field, value) => {
    setExos(prev => prev.map(e => e._key === key ? { ...e, [field]: value } : e))
  }

  const searchMovements = async (key, val) => {
    if (val.trim().length < 2) { setSuggestions(prev => ({ ...prev, [key]: [] })); return }
    const { data } = await supabase.from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions(prev => ({ ...prev, [key]: (data || []).map(m => m.name) }))
  }

  const pickSuggestion = (key, name) => {
    updateExo(key, 'name', name)
    setSuggestions(prev => ({ ...prev, [key]: [] }))
  }

  const addExo = () => setExos(prev => [...prev, emptyFreeExo()])
  const removeExo = (key) => setExos(prev => prev.length > 1 ? prev.filter(e => e._key !== key) : prev)

  const canSave = exos.some(e => e.name.trim())

  const save = async () => {
    setSaving(true)
    await onCreate(exos)
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
        maxHeight: '85vh', overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>⚡ Séance libre</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Ajoute tes exercices. Tape le début d'un nom pour retrouver un mouvement existant, ou entre un nom libre.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {exos.map((exo, i) => (
            <div key={exo._key} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    placeholder="Nom du mouvement"
                    value={exo.name}
                    onChange={e => { updateExo(exo._key, 'name', e.target.value); searchMovements(exo._key, e.target.value) }}
                    onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, [exo._key]: [] })), 150)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 600, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                  {suggestions[exo._key]?.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                      {suggestions[exo._key].map((sug, si) => (
                        <button key={si} onMouseDown={() => pickSuggestion(exo._key, sug)}
                          style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: si < suggestions[exo._key].length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => removeExo(exo._key)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, padding: '0 2px', cursor: 'pointer', flexShrink: 0 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input placeholder="Séries" value={exo.sets} onChange={e => updateExo(exo._key, 'sets', e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                <input placeholder="Reps" value={exo.reps} onChange={e => updateExo(exo._key, 'reps', e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                <input placeholder="Kg" value={exo.kg} onChange={e => updateExo(exo._key, 'kg', e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
            </div>
          ))}
        </div>

        <button onClick={addExo} style={{ background: 'none', border: '2px dashed var(--border2)', borderRadius: 'var(--r)', padding: 10, fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
          + Ajouter un exercice
        </button>

        <button onClick={save} disabled={!canSave || saving} style={{
          background: canSave ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none',
          borderRadius: 'var(--rl)', padding: 14, fontSize: 15, fontWeight: 700, cursor: canSave ? 'pointer' : 'default'
        }}>
          {saving ? 'Création…' : 'Créer la séance'}
        </button>
      </div>
    </div>
  )
}
