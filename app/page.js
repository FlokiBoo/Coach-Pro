'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function formatDateLong(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Home() {
  const router = useRouter()
  const [athletes, setAthletes] = useState([])
  const [completedSessions, setCompletedSessions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [coachToken, setCoachToken] = useState(null)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selected, setSelected] = useState(null)
  const [browserSession, setBrowserSession] = useState(null)
  const [movementsMissingMuscles, setMovementsMissingMuscles] = useState([])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  useEffect(() => {
    async function load() {
      const [{ data: aths }, { data: sessions }, { data: progComps }, { data: actValidated }] = await Promise.all([
        supabase.from('athletes').select('*').neq('archived', true).order('created_at'),
        supabase
          .from('sessions')
          .select('id, date, title, coach_notes, athlete_id, athletes(id, name), exercises(id, name, sets, reps, kg, note, athlete_logs(sets_done, reps_done, kg_done, note))')
          .order('date', { ascending: false })
          .limit(40),
        supabase
          .from('program_completions')
          .select('id, completed_at, athlete_id, pleasure, difficulty, duration_minutes, athletes(id, name), program_sessions(id, title, program_id, program_exercises(id, name, sets, reps, kg, note))')
          .order('completed_at', { ascending: false })
          .limit(40),
        supabase
          .from('activity_logs')
          .select('id, athlete_id, athletes(id, name), label, km, duration_minutes, difficulty, validated_at')
          .not('validated_at', 'is', null)
          .order('validated_at', { ascending: false })
          .limit(40)
      ])
      const athList = aths || []
      setAthletes(athList)

      const progSessionIds = (progComps || []).flatMap(c => (c.program_sessions?.program_exercises || []).map(e => e.id))
      const { data: progLogs } = progSessionIds.length
        ? await supabase.from('program_exercise_logs').select('program_exercise_id, sets_done, reps_done, kg_done, note').in('program_exercise_id', progSessionIds)
        : { data: [] }
      const progLogsMap = {}
      ;(progLogs || []).forEach(l => { progLogsMap[l.program_exercise_id] = l })

      const { data: missingMuscles } = await supabase
        .from('movements')
        .select('id, name')
        .or('muscles.is.null,muscles.eq.')
        .order('name')
      setMovementsMissingMuscles(missingMuscles || [])

      const coachId = await getCoachId()
      if (coachId) {
        const { data: me } = await supabase.from('coaches').select('is_admin').eq('id', coachId).single()
        if (me?.is_admin) setIsAdmin(true)
      }

      // La ligne athletes marquée is_coach = le profil perso de ce coach (RLS la scope déjà à lui).
      const coach = athList.find(a => a.is_coach)
      if (coach) {
        if (coach.token) {
          setCoachToken(coach.token)
        } else {
          const token = crypto.randomUUID()
          const { data } = await supabase.from('athletes').update({ token }).eq('id', coach.id).select().single()
          if (data) setCoachToken(data.token)
        }
      }

      const legacyDone = (sessions || [])
        .filter(s => s.exercises?.some(e => e.athlete_logs?.length > 0))
        .map(s => ({
          id: `legacy-${s.id}`,
          type: 'legacy',
          date: s.date,
          sortKey: s.date,
          athleteId: s.athlete_id,
          athleteName: s.athletes?.name || '—',
          title: s.title,
          coachNotes: s.coach_notes,
          feedback: null,
          exosDone: s.exercises.filter(e => e.athlete_logs?.length > 0).map(e => ({
            id: e.id, name: e.name, sets: e.sets, reps: e.reps, kg: e.kg, note: e.note,
            log: e.athlete_logs[0],
          })),
        }))

      const progDone = (progComps || [])
        .filter(c => c.program_sessions)
        .map(c => ({
          id: `prog-${c.id}`,
          type: 'program',
          date: c.completed_at,
          sortKey: c.completed_at,
          athleteId: c.athlete_id,
          athleteName: c.athletes?.name || '—',
          programId: c.program_sessions?.program_id,
          sessionId: c.program_sessions?.id,
          title: c.program_sessions?.title,
          coachNotes: null,
          feedback: { pleasure: c.pleasure, difficulty: c.difficulty, duration_minutes: c.duration_minutes },
          exosDone: (c.program_sessions.program_exercises || []).filter(e => e.name).map(e => ({
            id: e.id, name: e.name, sets: e.sets, reps: e.reps, kg: e.kg, note: e.note,
            log: progLogsMap[e.id] || {},
          })),
        }))

      const activityDone = (actValidated || []).map(a => ({
        id: `activity-${a.id}`,
        type: 'activity',
        date: a.validated_at,
        sortKey: a.validated_at,
        athleteId: a.athlete_id,
        athleteName: a.athletes?.name || '—',
        title: a.label,
        coachNotes: null,
        feedback: { pleasure: null, difficulty: a.difficulty, duration_minutes: a.duration_minutes },
        km: a.km,
        exosDone: [],
      }))

      const merged = [...legacyDone, ...progDone, ...activityDone].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      setCompletedSessions(merged)
      setLoading(false)
    }
    load()
  }, [])

  const createAthlete = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const coachId = await getCoachId()
    const { data } = await supabase.from('athletes').insert({ name, coach_id: coachId }).select().single()
    if (data) setAthletes(prev => [...prev, data])
    setNewName('')
    setShowForm(false)
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main">

        {/* Header */}
        <div style={{
          padding: '20px 16px 14px', background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 10
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>CoachPro</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              {athletes.length} sportif{athletes.length !== 1 ? 's' : ''}
            </div>
          </div>
          {/* Toggle Vue Sportif */}
          {coachToken && (
            <button
              onClick={() => router.push(`/s/${coachToken}?coach=1`)}
              style={{
                background: 'var(--green-light)', color: 'var(--green)',
                border: '1.5px solid #B8EAD8', borderRadius: 20,
                padding: '8px 14px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5
              }}
            >
              👤 Vue sportif
            </button>
          )}
          {isAdmin && (
            <Link href="/admin/coachs" style={{
              background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)',
              borderRadius: 20, padding: '8px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0
            }}>🛡️ Coachs</Link>
          )}
          <a href="https://tracker-nutrition.netlify.app/coach.html" target="_blank" rel="noreferrer" style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)',
            borderRadius: 20, padding: '8px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0
          }}>🥗 Nutrition</a>
          <button onClick={() => setShowForm(v => !v)} style={{
            background: 'var(--green)', color: '#fff', border: 'none',
            borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>+ Sportif</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Formulaire ajout */}
          {showForm && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', gap: 8 }}>
              <input
                autoFocus
                placeholder="Prénom Nom du sportif"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createAthlete()}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)' }}
              />
              <button onClick={createAthlete} disabled={saving} style={{
                background: 'var(--green)', color: '#fff', border: 'none',
                borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>{saving ? '…' : 'Créer'}</button>
            </div>
          )}

          {/* Mouvements sans muscles renseignés */}
          {movementsMissingMuscles.length > 0 && (
            <Link href="/movements" style={{
              display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--rl)', padding: '12px 14px',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                  {movementsMissingMuscles.length} mouvement{movementsMissingMuscles.length !== 1 ? 's' : ''} sans muscle renseigné
                </div>
                <div style={{ fontSize: 12, color: '#92400E', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {movementsMissingMuscles.map(m => m.name).join(', ')}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E', flexShrink: 0 }}>Corriger →</span>
            </Link>
          )}

          {/* Titre feed */}
          {!athletes.length && !showForm ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏋️</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun sportif</div>
              <div style={{ fontSize: 13 }}>Clique sur « + Sportif » pour commencer</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Séances & activités validées
              </div>

              {completedSessions === null ? (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Chargement…</div>
              ) : completedSessions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
                  <div style={{ fontSize: 13 }}>Aucune séance validée pour l'instant.</div>
                </div>
              ) : completedSessions.map(s => (
                <SessionCard key={s.id} session={s} onOpen={() => {
                  if (s.type === 'program' && s.programId) setBrowserSession(s)
                  else setSelected(s)
                }} />
              ))}
            </>
          )}
        </div>
      </div>
      {selected && <SessionDetailModal session={selected} onClose={() => setSelected(null)} />}
      {browserSession && (
        <SessionBrowserModal
          programId={browserSession.programId}
          initialSessionId={browserSession.sessionId}
          athleteId={browserSession.athleteId}
          athleteName={browserSession.athleteName}
          onClose={() => setBrowserSession(null)}
        />
      )}
    </div>
  )
}

function SessionCard({ session, onOpen }) {
  const dateLabel = session.type === 'program' || session.type === 'activity' ? session.date.slice(0, 10) : session.date
  const isActivity = session.type === 'activity'

  return (
    <div onClick={onOpen} style={{
      display: 'block', background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--rl)', padding: '14px 16px', cursor: 'pointer', color: 'inherit'
    }}>
      {/* Header : avatar + nom + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'var(--green-light)', color: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800
        }}>
          {session.athleteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{session.athleteName}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'capitalize' }}>
            {formatDateLong(dateLabel)}
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
          {isActivity ? '🏃 Activité' : `✓ ${session.exosDone.length} exercice${session.exosDone.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Titre séance */}
      {session.title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
          {session.title}
        </div>
      )}

      {/* Détail activité (km / durée / RPE) */}
      {isActivity && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {session.km != null && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{session.km} km</span>}
          {session.feedback?.duration_minutes && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{session.feedback.duration_minutes} min</span>}
          {session.feedback?.difficulty != null && <span style={{ fontSize: 12, color: 'var(--text3)' }}>RPE {session.feedback.difficulty}/10</span>}
        </div>
      )}

      {/* Exercices réalisés */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {session.exosDone.map(e => {
          const log = e.log
          const prescribed = [e.sets && `${e.sets} séries`, e.reps && `${e.reps} reps`, e.kg && `${e.kg} kg`].filter(Boolean).join(' · ')
          const done = [log.sets_done && `${log.sets_done}×`, log.reps_done, log.kg_done && `${log.kg_done} kg`].filter(Boolean).join(' ')
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{e.name}</span>
              {done && <span style={{ color: '#166534', fontWeight: 700 }}>→ {done}</span>}
              {prescribed && <span style={{ color: 'var(--text3)' }}>({prescribed})</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SessionDetailModal({ session, onClose }) {
  const dateLabel = session.type === 'program' || session.type === 'activity' ? session.date.slice(0, 10) : session.date
  const f = session.feedback

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480,
        maxHeight: '88svh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'var(--green-light)', color: 'var(--green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800
          }}>
            {session.athleteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{session.athleteName}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'capitalize' }}>{formatDateLong(dateLabel)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>✕</button>
        </div>

        {session.title && <div style={{ fontSize: 14, fontWeight: 700 }}>{session.title}</div>}

        {(session.km != null || (f && (f.pleasure != null || f.difficulty != null || f.duration_minutes))) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {session.km != null && <Stat label="Distance" value={`${session.km} km`} />}
            {f?.pleasure != null && <Stat label="Plaisir" value={`${f.pleasure}/10`} />}
            {f?.difficulty != null && <Stat label={session.type === 'activity' ? 'RPE' : 'Difficulté'} value={`${f.difficulty}/10`} />}
            {f?.duration_minutes && <Stat label="Durée" value={`${f.duration_minutes} min`} />}
          </div>
        )}

        {session.coachNotes && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.6 }}>
            {session.coachNotes}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {session.exosDone.map(e => {
            const log = e.log || {}
            const prescribed = [e.sets && `${e.sets} séries`, e.reps && `${e.reps} reps`, e.kg && `${e.kg} kg`].filter(Boolean).join(' · ')
            const done = [log.sets_done && `${log.sets_done} séries`, log.reps_done && `${log.reps_done} reps`, log.kg_done && `${log.kg_done} kg`].filter(Boolean).join(' · ')
            return (
              <div key={e.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{e.name}</div>
                {prescribed && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Prescrit : {prescribed}</div>}
                {done && <div style={{ fontSize: 12, color: '#166534', fontWeight: 700, marginTop: 2 }}>Réalisé : {done}</div>}
                {e.note && <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginTop: 4 }}>Note coach : {e.note}</div>}
                {log.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 4 }}>« {log.note} »</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function SessionBrowserModal({ programId, initialSessionId, athleteId, athleteName, onClose }) {
  const [sessions, setSessions] = useState(null)
  const [visibleIndices, setVisibleIndices] = useState([0])

  useEffect(() => {
    async function load() {
      const { data: sessData } = await supabase
        .from('program_sessions')
        .select('id, title, order_index, coach_notes, program_exercises(id, name, sets, reps, kg, note, order_index)')
        .eq('program_id', programId)
        .order('order_index')

      const sessionIds = (sessData || []).map(s => s.id)
      const exoIds = (sessData || []).flatMap(s => (s.program_exercises || []).map(e => e.id))

      const [{ data: comps }, { data: logs }] = await Promise.all([
        sessionIds.length
          ? supabase.from('program_completions').select('program_session_id, pleasure, difficulty, duration_minutes, completed_at').eq('athlete_id', athleteId).in('program_session_id', sessionIds)
          : Promise.resolve({ data: [] }),
        exoIds.length
          ? supabase.from('program_exercise_logs').select('program_exercise_id, sets_done, reps_done, kg_done, note').eq('athlete_id', athleteId).in('program_exercise_id', exoIds)
          : Promise.resolve({ data: [] }),
      ])
      const compMap = {}
      ;(comps || []).forEach(c => { compMap[c.program_session_id] = c })
      const logMap = {}
      ;(logs || []).forEach(l => { logMap[l.program_exercise_id] = l })

      const list = (sessData || []).map(s => ({
        ...s,
        completion: compMap[s.id] || null,
        exercises: [...(s.program_exercises || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map(e => ({ ...e, log: logMap[e.id] || {} })),
      }))
      setSessions(list)
      const idx = list.findIndex(s => s.id === initialSessionId)
      setVisibleIndices([idx >= 0 ? idx : 0])
    }
    load()
  }, [programId, athleteId, initialSessionId])

  if (sessions === null) return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )

  const sorted = [...visibleIndices].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const isFirst = min === 0
  const isLast = max === sessions.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 900, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{athleteName}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sorted.map(i => i + 1).join(', ')} / {sessions.length}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button onClick={() => setVisibleIndices(v => [...v, min - 1])} disabled={isFirst}
          style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: isFirst ? 'var(--border2)' : 'var(--text2)', cursor: isFirst ? 'default' : 'pointer', flexShrink: 0, marginTop: 40, whiteSpace: 'nowrap' }}>
          ‹ Séance précédente
        </button>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${sorted.length}, minmax(280px, 1fr))`, gap: 12 }}>
          {sorted.map(fullIndex => {
            const closeCard = () => {
              if (sorted.length === 1) { onClose(); return }
              setVisibleIndices(v => v.filter(i => i !== fullIndex))
            }
            return <SessionMiniCard key={sessions[fullIndex].id} session={sessions[fullIndex]} onClose={closeCard} />
          })}
        </div>

        <button onClick={() => setVisibleIndices(v => [...v, max + 1])} disabled={isLast}
          style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: isLast ? 'var(--border2)' : 'var(--text2)', cursor: isLast ? 'default' : 'pointer', flexShrink: 0, marginTop: 40, whiteSpace: 'nowrap' }}>
          Séance suivante ›
        </button>
      </div>
    </div>
  )
}

function SessionMiniCard({ session, onClose }) {
  const isDone = !!session.completion

  const saveSessionNote = async (value) => {
    await supabase.from('program_sessions').update({ coach_notes: value }).eq('id', session.id)
  }
  const saveExerciseNote = async (exerciseId, value) => {
    await supabase.from('program_exercises').update({ note: value }).eq('id', exerciseId)
  }
  const saveExerciseField = async (exerciseId, field, value) => {
    await supabase.from('program_exercises').update({ [field]: value }).eq('id', exerciseId)
  }

  const noteFieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid var(--border2)',
    borderRadius: 6, fontSize: 11, outline: 'none', background: 'var(--bg)', color: 'var(--text2)',
    fontStyle: 'italic', resize: 'none', fontFamily: 'inherit', marginTop: 4,
  }
  const prescribedFieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '5px 6px', border: '1px solid var(--border2)',
    borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg)', color: 'var(--text)',
    fontFamily: 'inherit', textAlign: 'center',
  }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title || 'Séance'}</div>
        {isDone ? (
          <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓ Faite</span>
        ) : (
          <span style={{ background: 'var(--bg2)', color: 'var(--text3)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>À venir</span>
        )}
        {onClose && (
          <button onClick={onClose} title="Fermer cette séance" style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>×</button>
        )}
      </div>

      {isDone && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {session.completion.pleasure != null && <Stat label="Plaisir" value={`${session.completion.pleasure}/10`} />}
          {session.completion.difficulty != null && <Stat label="Difficulté" value={`${session.completion.difficulty}/10`} />}
          {session.completion.duration_minutes && <Stat label="Durée" value={`${session.completion.duration_minutes} min`} />}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {session.exercises.filter(e => e.name).map(e => {
          const log = e.log || {}
          const done = [log.sets_done && `${log.sets_done} séries`, log.reps_done && `${log.reps_done} reps`, log.kg_done && `${log.kg_done} kg`].filter(Boolean).join(' · ')
          return (
            <div key={e.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{e.name}</div>

              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Séries</div>
                  <input type="text" defaultValue={e.sets || ''} placeholder="—"
                    onBlur={ev => saveExerciseField(e.id, 'sets', ev.target.value)}
                    style={prescribedFieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Reps</div>
                  <input type="text" defaultValue={e.reps || ''} placeholder="—"
                    onBlur={ev => saveExerciseField(e.id, 'reps', ev.target.value)}
                    style={prescribedFieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Charge (kg)</div>
                  <input type="text" defaultValue={e.kg || ''} placeholder="—"
                    onBlur={ev => saveExerciseField(e.id, 'kg', ev.target.value)}
                    style={prescribedFieldStyle} />
                </div>
              </div>

              {done && <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginTop: 6 }}>Réalisé : {done}</div>}
              {log.note && <div style={{ fontSize: 11, color: 'var(--text2)', fontStyle: 'italic', marginTop: 2 }}>« {log.note} »</div>}
              <textarea
                placeholder="Note coach pour cet exercice…"
                defaultValue={e.note || ''}
                onBlur={ev => saveExerciseNote(e.id, ev.target.value)}
                rows={2}
                style={noteFieldStyle}
              />
            </div>
          )
        })}
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
          Note coach (séance)
        </div>
        <textarea
          placeholder="Ta note pour cette séance…"
          defaultValue={session.coach_notes || ''}
          onBlur={ev => saveSessionNote(ev.target.value)}
          rows={3}
          style={{ ...noteFieldStyle, fontStyle: 'normal', fontSize: 13, marginTop: 0 }}
        />
      </div>
    </div>
  )
}
