'use client'

import { useState, useEffect, use, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import WellnessBlock from '@/app/components/WellnessBlock'
import ActivityBlock from '@/app/components/ActivityBlock'

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

function AthleteView({ params }) {
  const { token } = use(params)
  const searchParams = useSearchParams()
  const isCoachView = searchParams.get('coach') === '1'
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([]) // chaque prog a .sessions (triées, avec .exercises)
  const [completions, setCompletions] = useState(new Set())
  const [openSessionId, setOpenSessionId] = useState(null)
  const [validating, setValidating] = useState(false)
  const [exerciseLogs, setExerciseLogs] = useState({}) // { exerciseId: { sets_done, reps_done, note } }

  useEffect(() => {
    supabase.from('athletes').select('*').eq('token', token).single().then(({ data }) => setAthlete(data))
  }, [token])

  useEffect(() => {
    if (!athlete) return
    async function load() {
      const [{ data: progs }, { data: comps }, { data: logs }] = await Promise.all([
        supabase.from('programs')
          .select('*, program_sessions(*, program_exercises(*))')
          .eq('athlete_id', athlete.id)
          .order('created_at', { ascending: false }),
        supabase.from('program_completions').select('program_session_id').eq('athlete_id', athlete.id),
        supabase.from('program_exercise_logs').select('*').eq('athlete_id', athlete.id)
      ])
      const logsMap = {}
      ;(logs || []).forEach(l => { logsMap[l.program_exercise_id] = l })
      setExerciseLogs(logsMap)
      const completionSet = new Set((comps || []).map(c => c.program_session_id))
      setCompletions(completionSet)

      const progList = (progs || []).map(p => ({
        ...p,
        sessions: [...(p.program_sessions || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map(s => ({
            ...s,
            exercises: [...(s.program_exercises || [])].sort((a, b) => a.order_index - b.order_index)
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
  }, [athlete])

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

  const validate = async (sessId, progSessions) => {
    if (!athlete) return
    setValidating(true)
    await supabase.from('program_completions').upsert(
      { athlete_id: athlete.id, program_session_id: sessId },
      { onConflict: 'athlete_id,program_session_id' }
    )
    const newSet = new Set([...completions, sessId])
    setCompletions(newSet)
    const next = progSessions.find(s => !newSet.has(s.id))
    setOpenSessionId(next?.id || null)
    setValidating(false)

    // Demande au service worker de pré-charger les données Supabase mises à jour
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const { supabaseUrl, supabaseKey } = getSupabaseConfig()
      if (supabaseUrl && supabaseKey) {
        const urls = [
          `${supabaseUrl}/rest/v1/program_completions?athlete_id=eq.${athlete.id}&select=program_session_id`,
          `${supabaseUrl}/rest/v1/programs?athlete_id=eq.${athlete.id}&select=*,program_sessions(*,program_exercises(*))`,
        ]
        navigator.serviceWorker.controller.postMessage({
          type: 'PREFETCH_URLS',
          urls,
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        })
      }
    }
  }

  const saveExerciseLog = async (exerciseId, field, value) => {
    if (!athlete) return
    const existing = exerciseLogs[exerciseId] || {}
    const updated = { ...existing, [field]: value }
    setExerciseLogs(prev => ({ ...prev, [exerciseId]: updated }))
    await supabase.from('program_exercise_logs').upsert(
      { athlete_id: athlete.id, program_exercise_id: exerciseId, ...updated },
      { onConflict: 'athlete_id,program_exercise_id' }
    )
  }

  function getSupabaseConfig() {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      return { supabaseUrl: url, supabaseKey: key }
    } catch { return {} }
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
          <a
            href={`https://tracker-nutrition.netlify.app/tracker.html?profil=${encodeURIComponent(athlete.name)}&coach=maxime`}
            target="_blank" rel="noreferrer"
            style={{ background: '#F0FDF4', border: '1px solid #B8EAD8', color: 'var(--green)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
          >🥗 Nutrition</a>
          {!isCoachView && (
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              title="Déconnexion"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 20, padding: '7px 10px', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
            >⎋</button>
          )}
        </div>
        {isCoachView && (
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', fontWeight: 600 }}>
            ← Vue coach
          </a>
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <WellnessBlock athleteId={athlete.id} date={today()} mode="athlete" />
        <ActivityBlock athleteId={athlete.id} date={today()} />

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
          const prevSession = nextSession
            ? prog.sessions[nextIdx - 1] || null
            : prog.sessions[prog.sessions.length - 1]
          const prevIdx = prevSession ? prog.sessions.indexOf(prevSession) : -1
          const isOpenNext = nextSession && openSessionId === nextSession.id
          const isOpenPrev = prevSession && openSessionId === prevSession.id

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
                  onValidate={() => validate(nextSession.id, prog.sessions)}
                  onUnvalidate={null}
                  validating={validating}
                  exerciseLogs={exerciseLogs}
                  onSaveLog={saveExerciseLog}
                />
              )}

              {/* Programme terminé */}
              {allDone && (
                <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 'var(--rl)', padding: '12px 14px', textAlign: 'center', color: '#166534', fontWeight: 700, fontSize: 14 }}>
                  ✓ Programme terminé !
                </div>
              )}

              {/* Séance précédente */}
              {prevSession && (
                <div>
                  <button
                    onClick={() => setOpenSessionId(isOpenPrev ? null : prevSession.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {isOpenPrev ? '▲' : '▼'} Séance précédente ({prevIdx + 1})
                  </button>
                  {isOpenPrev && (
                    <div style={{ marginTop: 4 }}>
                      <SessionCard
                        session={prevSession}
                        idx={prevIdx}
                        isOpen={true}
                        isCompleted={true}
                        onToggle={() => setOpenSessionId(null)}
                        onValidate={null}
                        onUnvalidate={() => unvalidate(prevSession.id, prog.sessions)}
                        validating={validating}
                        exerciseLogs={exerciseLogs}
                        onSaveLog={saveExerciseLog}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SessionCard({ session, idx, isOpen, isCompleted, onToggle, onValidate, onUnvalidate, validating, exerciseLogs = {}, onSaveLog }) {
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
          {session.activation && (
            <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>⚡ Activation</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{session.activation}</div>
            </div>
          )}
          {session.coach_notes && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.6, borderLeft: '3px solid var(--green)' }}>
              {session.coach_notes}
            </div>
          )}
          {exos.map((exo, ei) => (
            <div key={exo.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (exo.sets || exo.reps || exo.kg || exo.note) ? 8 : 0 }}>
                <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, padding: '0 4px', flexShrink: 0 }}>
                  {labels[exo.id] || String.fromCharCode(65 + ei)}
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{exo.name}</span>
                {exo.video_url && (
                  <a href={exo.video_url} target="_blank" rel="noreferrer" style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>▶</a>
                )}
              </div>
              {(exo.sets || exo.reps || exo.kg) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: exo.note ? 6 : 0 }}>
                  {exo.sets && <Pill value={exo.sets} label="séries" />}
                  {exo.reps && <Pill value={exo.reps} label="reps" />}
                  {exo.kg && <Pill value={`${exo.kg} kg`} />}
                </div>
              )}
              {exo.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>{exo.note}</div>}

              {/* Log client */}
              {onSaveLog && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ma séance</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Séries</div>
                      <input
                        type="text"
                        placeholder={exo.sets || '—'}
                        defaultValue={exerciseLogs[exo.id]?.sets_done || ''}
                        onBlur={e => onSaveLog(exo.id, 'sets_done', e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Reps</div>
                      <input
                        type="text"
                        placeholder={exo.reps || '—'}
                        defaultValue={exerciseLogs[exo.id]?.reps_done || ''}
                        onBlur={e => onSaveLog(exo.id, 'reps_done', e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>Note</div>
                    <textarea
                      placeholder="Comment c'était ?"
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

          {!isCompleted && onValidate && (
            <button onClick={onValidate} disabled={validating}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 4 }}>
              {validating ? 'Validation…' : '✓ Séance terminée'}
            </button>
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

function Pill({ value, label }) {
  return (
    <div style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>
      {value}{label ? ` ${label}` : ''}
    </div>
  )
}
