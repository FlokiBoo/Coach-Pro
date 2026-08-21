'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const fmt = x => [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-')
  return { start: fmt(start), end: fmt(end), label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
}

function formatDateFr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

async function copyProgramToAthletes(sourceProgram, targetAthleteIds, { coachId, groupId, batchId }) {
  const { data: sessions } = await supabase.from('program_sessions')
    .select('*, program_exercises(*)').eq('program_id', sourceProgram.id).order('order_index')

  for (const targetId of targetAthleteIds) {
    const { data: newProg } = await supabase.from('programs')
      .insert({
        athlete_id: targetId, title: sourceProgram.title, coach_id: coachId, source_program_id: sourceProgram.id,
        activity_type: sourceProgram.activity_type, group_id: groupId, group_batch_id: batchId, is_microcycle: sourceProgram.is_microcycle,
      })
      .select().single()
    if (!newProg) continue

    for (const sess of (sessions || [])) {
      const { data: newSess } = await supabase.from('program_sessions')
        .insert({
          program_id: newProg.id, order_index: sess.order_index, title: sess.title || '', source_session_id: sess.id,
          activation: sess.activation || null, coach_notes: sess.coach_notes || null,
          activation_videos: sess.activation_videos || [], circuits: sess.circuits || [],
          session_type: sess.session_type || null, week_number: sess.week_number,
        })
        .select().single()
      if (!newSess) continue

      const exos = (sess.program_exercises || []).sort((a, b) => a.order_index - b.order_index)
      if (exos.length > 0) {
        await supabase.from('program_exercises').insert(
          exos.map(e => ({
            program_session_id: newSess.id, order_index: e.order_index, name: e.name, sets: e.sets, reps: e.reps,
            kg: e.kg, rest: e.rest, note: e.note, video_url: e.video_url, superset_group: e.superset_group,
            focus_muscles: e.focus_muscles || null, pace_base: e.pace_base || null, pct_low: e.pct_low, pct_high: e.pct_high,
            source_exercise_id: e.id,
          }))
        )
      }
    }
  }
}

export default function GroupDetailPage({ params }) {
  const { groupId } = use(params)
  const router = useRouter()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [currentProgram, setCurrentProgram] = useState(null)
  const [currentMicrocycle, setCurrentMicrocycle] = useState(null)
  const [runs, setRuns] = useState([])
  const [runStats, setRunStats] = useState({}) // { [runId]: { avgDifficulty, avgPleasure, details: [...] } }
  const [monthlyAttendance, setMonthlyAttendance] = useState({}) // { [athleteId]: count }
  const [loading, setLoading] = useState(true)
  const [expandedRunId, setExpandedRunId] = useState(null)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [creatingType, setCreatingType] = useState(null) // 'program' | 'microcycle'
  const [newTitle, setNewTitle] = useState('')
  const [fanningOut, setFanningOut] = useState(null) // program being assigned to the whole group

  const month = monthBounds()

  useEffect(() => { load() }, [groupId])

  async function load() {
    setLoading(true)
    const [{ data: g }, { data: gm }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('athlete_id, athletes(id, name)').eq('group_id', groupId),
    ])
    setGroup(g)
    const memberList = (gm || []).map(m => m.athletes).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
    setMembers(memberList)

    const [{ data: prog }, { data: micro }] = await Promise.all([
      supabase.from('programs').select('*, program_sessions(*)').eq('group_id', groupId).eq('is_microcycle', false).is('athlete_id', null).order('created_at', { ascending: false }).limit(1),
      supabase.from('programs').select('*, program_sessions(*)').eq('group_id', groupId).eq('is_microcycle', true).is('athlete_id', null).order('created_at', { ascending: false }).limit(1),
    ])
    setCurrentProgram(prog?.[0] || null)
    setCurrentMicrocycle(micro?.[0] || null)

    const { data: runsData } = await supabase.from('group_session_runs')
      .select('*').eq('group_id', groupId).gte('date', month.start).lte('date', month.end).order('date', { ascending: false })
    setRuns(runsData || [])

    if (runsData?.length) {
      const { data: att } = await supabase.from('group_session_attendance')
        .select('run_id, athlete_id').in('run_id', runsData.map(r => r.id))

      const attByAthlete = {}
      ;(att || []).forEach(a => { attByAthlete[a.athlete_id] = (attByAthlete[a.athlete_id] || 0) + 1 })
      setMonthlyAttendance(attByAthlete)

      // Résoudre, pour chaque athlète présent, sa propre copie de la séance (via source_session_id)
      // et son éventuelle validation, pour calculer difficulté/plaisir moyens par séance.
      const { data: memberPrograms } = await supabase.from('programs').select('id, athlete_id').eq('group_id', groupId).not('athlete_id', 'is', null)
      const programIds = (memberPrograms || []).map(p => p.id)
      const sourceSessionIds = [...new Set(runsData.map(r => r.source_session_id))]
      const { data: memberSessions } = programIds.length
        ? await supabase.from('program_sessions').select('id, program_id, source_session_id').in('program_id', programIds).in('source_session_id', sourceSessionIds)
        : { data: [] }
      const sessionIds = (memberSessions || []).map(s => s.id)
      const { data: completions } = sessionIds.length
        ? await supabase.from('program_completions').select('*').in('program_session_id', sessionIds)
        : { data: [] }

      const athleteByProgramId = {}
      ;(memberPrograms || []).forEach(p => { athleteByProgramId[p.id] = p.athlete_id })
      const sessionByAthleteAndSource = {}
      ;(memberSessions || []).forEach(s => {
        const athleteId = athleteByProgramId[s.program_id]
        sessionByAthleteAndSource[`${athleteId}::${s.source_session_id}`] = s.id
      })
      const completionBySessionId = {}
      ;(completions || []).forEach(c => { completionBySessionId[c.program_session_id] = c })

      const stats = {}
      for (const run of runsData) {
        const presentIds = (att || []).filter(a => a.run_id === run.id).map(a => a.athlete_id)
        const details = presentIds.map(athleteId => {
          const sessId = sessionByAthleteAndSource[`${athleteId}::${run.source_session_id}`]
          const completion = sessId ? completionBySessionId[sessId] : null
          return { athleteId, ownSessionId: sessId, completion }
        })
        const withRatings = details.filter(d => d.completion && !d.completion.skipped && d.completion.difficulty != null && d.completion.pleasure != null)
        stats[run.id] = {
          details,
          avgDifficulty: withRatings.length ? withRatings.reduce((s, d) => s + d.completion.difficulty, 0) / withRatings.length : null,
          avgPleasure: withRatings.length ? withRatings.reduce((s, d) => s + d.completion.pleasure, 0) / withRatings.length : null,
        }
      }
      setRunStats(stats)
    } else {
      setMonthlyAttendance({})
      setRunStats({})
    }

    setLoading(false)
  }

  const createGroupProgram = async (isMicrocycle) => {
    if (!newTitle.trim()) return
    const coachId = await getCoachId()
    const { data, error } = await supabase.from('programs')
      .insert({ title: newTitle.trim(), coach_id: coachId, group_id: groupId, is_microcycle: isMicrocycle })
      .select().single()
    if (error || !data) { alert('Erreur : ' + (error?.message || '')); return }
    await supabase.from('program_sessions').insert({ program_id: data.id, order_index: 0, title: 'Séance 1' })
    router.push(`/programs/templates/${data.id}`)
  }

  const fanOutToGroup = async (program) => {
    if (!members.length) { alert('Ce groupe n\'a aucun membre.'); return }
    setFanningOut(program.id)
    const coachId = await getCoachId()
    const batchId = crypto.randomUUID()
    await copyProgramToAthletes(program, members.map(m => m.id), { coachId, groupId, batchId })
    setFanningOut(null)
    alert(`"${program.title}" a été copié pour ${members.length} membre${members.length > 1 ? 's' : ''}.`)
  }

  const startCoaching = (sessionId) => {
    setShowStartPicker(false)
    router.push(`/groups/${groupId}/session/${sessionId}`)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/groups" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>👥 {group?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {members.length} membre{members.length !== 1 ? 's' : ''}{members.length > 0 && ` · ${members.map(m => m.name).join(', ')}`}
              </div>
            </div>
            {(currentProgram || currentMicrocycle) && (
              <button onClick={() => setShowStartPicker(true)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                ▶ Débuter coaching
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>

          {/* Bilan du mois */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
              📅 Bilan de {month.label}
            </div>
            {members.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun membre dans ce groupe</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20, padding: '6px 12px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{m.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: monthlyAttendance[m.id] ? 'var(--green)' : 'var(--text3)' }}>
                      {monthlyAttendance[m.id] || 0} présence{(monthlyAttendance[m.id] || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rectangles de séance */}
          {runs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runs.map(run => {
                const stats = runStats[run.id]
                const isExpanded = expandedRunId === run.id
                return (
                  <div key={run.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                    <button onClick={() => setExpandedRunId(isExpanded ? null : run.id)} style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{run.title || 'Séance'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDateFr(run.date)} · {stats?.details.length || 0} présent{(stats?.details.length || 0) !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        <span style={{ color: 'var(--text2)' }}>😤 {stats?.avgDifficulty != null ? stats.avgDifficulty.toFixed(1) : '—'}</span>
                        <span style={{ color: 'var(--green)' }}>😊 {stats?.avgPleasure != null ? stats.avgPleasure.toFixed(1) : '—'}</span>
                      </div>
                      <span style={{ color: 'var(--text3)', fontSize: 13, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {run.coach_note && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 4 }}>📝 {run.coach_note}</div>
                        )}
                        {(stats?.details || []).map(d => {
                          const athleteName = members.find(m => m.id === d.athleteId)?.name || '—'
                          const c = d.completion
                          return (
                            <div key={d.athleteId} style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{athleteName}</span>
                                {!c ? (
                                  <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>⏳ En attente</span>
                                ) : c.skipped ? (
                                  <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>⏭ Sautée</span>
                                ) : (
                                  <span style={{ fontSize: 11, fontWeight: 700, display: 'flex', gap: 8 }}>
                                    <span>😤 {c.difficulty ?? '—'}</span>
                                    <span style={{ color: 'var(--green)' }}>😊 {c.pleasure ?? '—'}</span>
                                  </span>
                                )}
                              </div>
                              {c?.comment && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.comment}</div>}
                            </div>
                          )
                        })}
                        {(stats?.details || []).length === 0 && (
                          <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Personne n&apos;était marqué présent</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Programme en cours */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1 }}>📋 Programme en cours</div>
              {!creatingType && (
                <button onClick={() => { setCreatingType('program'); setNewTitle('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Créer</button>
              )}
            </div>
            {creatingType === 'program' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input autoFocus placeholder="Nom du programme" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                <button onClick={() => createGroupProgram(false)} disabled={!newTitle.trim()} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Créer</button>
                <button onClick={() => setCreatingType(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
              </div>
            )}
            {currentProgram ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{currentProgram.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{(currentProgram.program_sessions || []).length} séance{(currentProgram.program_sessions || []).length !== 1 ? 's' : ''}</div>
                </div>
                <Link href={`/programs/templates/${currentProgram.id}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>✏️ Modifier</Link>
                <button onClick={() => fanOutToGroup(currentProgram)} disabled={fanningOut === currentProgram.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
                  {fanningOut === currentProgram.id ? '…' : '👥 Assigner au groupe'}
                </button>
              </div>
            ) : (
              !creatingType && <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun programme pour ce groupe</div>
            )}
          </div>

          {/* Micro-cycle en cours */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1 }}>🔄 Micro-cycle en cours</div>
              {creatingType !== 'microcycle' && (
                <button onClick={() => { setCreatingType('microcycle'); setNewTitle('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Créer</button>
              )}
            </div>
            {creatingType === 'microcycle' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input autoFocus placeholder="Nom du micro-cycle" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                <button onClick={() => createGroupProgram(true)} disabled={!newTitle.trim()} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Créer</button>
                <button onClick={() => setCreatingType(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
              </div>
            )}
            {currentMicrocycle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{currentMicrocycle.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{(currentMicrocycle.program_sessions || []).length} séance{(currentMicrocycle.program_sessions || []).length !== 1 ? 's' : ''}</div>
                </div>
                <Link href={`/programs/templates/${currentMicrocycle.id}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>✏️ Modifier</Link>
                <button onClick={() => fanOutToGroup(currentMicrocycle)} disabled={fanningOut === currentMicrocycle.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
                  {fanningOut === currentMicrocycle.id ? '…' : '👥 Assigner au groupe'}
                </button>
              </div>
            ) : (
              creatingType !== 'microcycle' && <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun micro-cycle pour ce groupe</div>
            )}
          </div>
        </div>
      </div>

      {showStartPicker && (
        <div onClick={() => setShowStartPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17, marginBottom: 12 }}>▶ Choisir la séance à débuter</div>
            {[{ label: 'Programme', prog: currentProgram }, { label: 'Micro-cycle', prog: currentMicrocycle }].map(({ label, prog }) => prog && (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label} · {prog.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(prog.program_sessions || []).sort((a, b) => a.order_index - b.order_index).map((s, i) => (
                    <button key={s.id} onClick={() => startCoaching(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ color: 'var(--text3)', fontWeight: 700 }}>{i + 1}</span>
                      {s.title || `Séance ${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setShowStartPicker(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
