'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'
import { notifyAssigned } from '@/lib/notify'

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

// Année scolaire (septembre -> août) contenant aujourd'hui, ou année civile pleine.
function yearBounds(mode, d = new Date()) {
  const fmt = x => [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-')
  if (mode === 'civile') {
    const y = d.getFullYear()
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}` }
  }
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
  return { start: `${y}-09-01`, end: fmt(new Date(y + 1, 7, 31)), label: `${y}-${y + 1}` }
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
          session_type: sess.session_type || null, week_number: sess.week_number, day_of_week: sess.day_of_week ?? null, hidden_until_run: !!sess.hidden_until_run,
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
  notifyAssigned({ athleteIds: targetAthleteIds, kind: 'program', title: sourceProgram.title })
}

export default function GroupDetailPage({ params }) {
  const { groupId } = use(params)
  const router = useRouter()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [currentProgram, setCurrentProgram] = useState(null)
  const [linkedTemplates, setLinkedTemplates] = useState([])
  const [runs, setRuns] = useState([])
  const [runStats, setRunStats] = useState({}) // { [runId]: { avgDifficulty, avgPleasure, details: [...] } }
  const [monthlyAttendance, setMonthlyAttendance] = useState({}) // { [athleteId]: count }
  const [loading, setLoading] = useState(true)
  const [expandedRunId, setExpandedRunId] = useState(null)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [creatingProgram, setCreatingProgram] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [membersExpanded, setMembersExpanded] = useState(false)
  const [togglingLeader, setTogglingLeader] = useState(null)
  const [fanningOut, setFanningOut] = useState(null) // program being assigned to the whole group
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  const [sessionExercises, setSessionExercises] = useState({}) // { [sessionId]: [...] }, chargé à la demande
  const [periodMode, setPeriodMode] = useState('month') // 'month' | 'year'
  const [yearMode, setYearMode] = useState('scolaire') // 'scolaire' | 'civile'
  const [monthCursor, setMonthCursor] = useState(new Date())

  const month = monthBounds(monthCursor)
  const period = periodMode === 'month' ? month : yearBounds(yearMode)

  useEffect(() => { load() }, [groupId, periodMode, yearMode, monthCursor])

  async function load() {
    setLoading(true)
    const [{ data: g }, { data: gm }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('athlete_id, is_leader, athletes(id, name)').eq('group_id', groupId),
    ])
    setGroup(g)
    const memberList = (gm || [])
      .filter(m => m.athletes)
      .map(m => ({ ...m.athletes, is_leader: !!m.is_leader }))
      .sort((a, b) => a.name.localeCompare(b.name))
    setMembers(memberList)

    const { data: prog } = await supabase.from('programs').select('*, program_sessions(*)').eq('group_id', groupId).eq('is_microcycle', false).is('athlete_id', null).order('created_at', { ascending: false }).limit(1)
    setCurrentProgram(prog?.[0] || null)

    const { data: links } = await supabase.from('group_program_templates')
      .select('program_id, programs(title, program_sessions(id, order_index, title))').eq('group_id', groupId)
    setLinkedTemplates(links || [])

    const { data: runsData } = await supabase.from('group_session_runs')
      .select('*').eq('group_id', groupId).gte('date', period.start).lte('date', period.end).order('date', { ascending: false })
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

  const createGroupProgram = async () => {
    if (!newTitle.trim()) return
    const coachId = await getCoachId()
    const { data, error } = await supabase.from('programs')
      .insert({ title: newTitle.trim(), coach_id: coachId, group_id: groupId, is_microcycle: false })
      .select().single()
    if (error || !data) { alert('Erreur : ' + (error?.message || '')); return }
    await supabase.from('program_sessions').insert({ program_id: data.id, order_index: 0, title: 'Séance 1' })
    router.push(`/programs/templates/${data.id}`)
  }

  // Ajoute une séance vide directement à la fin du programme du groupe, sans passer par
  // l'éditeur complet — retour terrain : le coach veut pouvoir créer la structure (séances
  // cachées jusqu'à la séance) d'un clic depuis la fiche groupe.
  const quickAddSession = async () => {
    if (!currentProgram) return
    const nextIndex = (currentProgram.program_sessions || []).length
    const { data, error } = await supabase.from('program_sessions')
      .insert({ program_id: currentProgram.id, order_index: nextIndex, title: `Séance ${nextIndex + 1}` })
      .select().single()
    if (error || !data) { alert('Erreur : ' + (error?.message || '')); return }
    setCurrentProgram(prev => ({ ...prev, program_sessions: [...(prev.program_sessions || []), data] }))
  }

  const toggleSessionExpand = async (sessionId) => {
    if (expandedSessionId === sessionId) { setExpandedSessionId(null); return }
    setExpandedSessionId(sessionId)
    if (!sessionExercises[sessionId]) {
      const { data } = await supabase.from('program_exercises').select('*').eq('program_session_id', sessionId).order('order_index')
      setSessionExercises(prev => ({ ...prev, [sessionId]: data || [] }))
    }
  }

  // Partagé entre le programme direct du groupe et les programmes liés (templates) : même aperçu
  // dépliable, seule la cible de navigation (programId) change — sans ça, un programme lié
  // n'affichait qu'un compteur "X séances" et forçait à cliquer "Modifier" pour tout voir.
  const renderSessionRow = (programId, s, i) => (
    <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)' }}>
        <button onClick={() => toggleSessionExpand(s.id)} title="Aperçu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, padding: '9px 6px 9px 10px', flexShrink: 0 }}>
          {expandedSessionId === s.id ? '▾' : '▸'}
        </button>
        <button onClick={() => router.push(`/programs/templates/${programId}?open=${s.id}`)}
          style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '9px 10px 9px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.title || `Séance ${i + 1}`}
        </button>
      </div>
      {expandedSessionId === s.id && (
        <div style={{ padding: '8px 12px 10px', fontSize: 12, color: 'var(--text2)', borderTop: '1px solid var(--border)' }}>
          {sessionExercises[s.id] === undefined ? (
            <span style={{ color: 'var(--text3)' }}>Chargement…</span>
          ) : sessionExercises[s.id].length === 0 ? (
            <span style={{ fontStyle: 'italic', color: 'var(--text3)' }}>Aucun exercice</span>
          ) : (
            sessionExercises[s.id].map(e => (
              <div key={e.id} style={{ padding: '2px 0' }}>
                {e.name}{e.sets ? ` — ${e.sets}${e.reps ? `x${e.reps}` : ''}` : ''}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )

  const toggleLeader = async (athleteId, current) => {
    setTogglingLeader(athleteId)
    await supabase.from('group_members').update({ is_leader: !current }).eq('group_id', groupId).eq('athlete_id', athleteId)
    setMembers(prev => prev.map(m => m.id === athleteId ? { ...m, is_leader: !current } : m))
    setTogglingLeader(null)
  }

  const unlinkTemplate = async (programId) => {
    if (!confirm('Retirer ce template du groupe ? Les copies déjà créées pour les membres restent intactes — seuls les futurs membres ne le recevront plus automatiquement.')) return
    await supabase.from('group_program_templates').delete().eq('group_id', groupId).eq('program_id', programId)
    setLinkedTemplates(prev => prev.filter(l => l.program_id !== programId))
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
            {(currentProgram || linkedTemplates.length > 0) && (
              <button onClick={() => setShowStartPicker(true)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                ▶ Débuter coaching
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>

          {/* Membres du groupe (dépliant, fermé de base) */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <button onClick={() => setMembersExpanded(v => !v)} style={{
              width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: 16, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1 }}>
                👤 Membres ({members.length})
              </div>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>{membersExpanded ? '▲' : '▼'}</span>
            </button>
            {membersExpanded && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun membre dans ce groupe</div>
                ) : members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                    <button
                      onClick={() => toggleLeader(m.id, m.is_leader)}
                      disabled={togglingLeader === m.id}
                      title={m.is_leader ? 'Retirer le statut de leader' : 'Désigner comme leader'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        background: m.is_leader ? 'var(--green)' : 'var(--bg)', color: m.is_leader ? '#fff' : 'var(--text3)',
                        border: '1px solid ' + (m.is_leader ? 'var(--green)' : 'var(--border2)'), borderRadius: 20,
                        padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}>
                      {m.is_leader ? '⭐' : '☆'} Leader
                    </button>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{m.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bilan de présence */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                📅 Bilan
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ key: 'month', label: 'Mois' }, { key: 'year', label: 'Année' }].map(o => (
                  <button key={o.key} onClick={() => setPeriodMode(o.key)} style={{
                    background: periodMode === o.key ? 'var(--green)' : 'var(--bg2)', color: periodMode === o.key ? '#fff' : 'var(--text3)',
                    border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {o.label}
                  </button>
                ))}
              </div>
              {periodMode === 'year' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {[{ key: 'scolaire', label: 'Scolaire' }, { key: 'civile', label: 'Civile' }].map(o => (
                    <button key={o.key} onClick={() => setYearMode(o.key)} style={{
                      background: yearMode === o.key ? 'var(--green-light)' : 'var(--bg2)', color: yearMode === o.key ? 'var(--green)' : 'var(--text3)',
                      border: '1px solid ' + (yearMode === o.key ? '#B8EAD8' : 'var(--border2)'), borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ flex: 1 }} />
              {periodMode === 'month' && (
                <button onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, width: 26, height: 26, fontSize: 13, color: 'var(--text3)', cursor: 'pointer' }}>‹</button>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'capitalize' }}>{period.label}</div>
              {periodMode === 'month' && (
                <button onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, width: 26, height: 26, fontSize: 13, color: 'var(--text3)', cursor: 'pointer' }}>›</button>
              )}
            </div>
            {members.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun membre dans ce groupe</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[...members].sort((a, b) => (monthlyAttendance[b.id] || 0) - (monthlyAttendance[a.id] || 0)).map(m => (
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
                        <button onClick={() => router.push(`/groups/${groupId}/session/${run.source_session_id}?date=${run.date}`)}
                          style={{ alignSelf: 'flex-start', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
                          ✏️ Modifier mon retour et les présents
                        </button>
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
              {!creatingProgram && (
                <button onClick={() => { setCreatingProgram(true); setNewTitle('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Créer</button>
              )}
            </div>
            {creatingProgram && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input autoFocus placeholder="Nom du programme" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                <button onClick={() => createGroupProgram()} disabled={!newTitle.trim()} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Créer</button>
                <button onClick={() => setCreatingProgram(false)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
              </div>
            )}
            {linkedTemplates.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: currentProgram ? 10 : 0 }}>
                {linkedTemplates.map(l => (
                  <div key={l.program_id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>🔗 {l.programs?.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {(l.programs?.program_sessions || []).length} séance{(l.programs?.program_sessions || []).length !== 1 ? 's' : ''} — lié au groupe, synchronisé pour les futurs membres
                        </div>
                      </div>
                      <Link href={`/programs/templates/${l.program_id}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textDecoration: 'none', flexShrink: 0 }}>✏️ Modifier</Link>
                      <button onClick={() => unlinkTemplate(l.program_id)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', flexShrink: 0 }}>
                        Retirer
                      </button>
                    </div>
                    {(l.programs?.program_sessions || []).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px 10px' }}>
                        {[...(l.programs.program_sessions || [])].sort((a, b) => a.order_index - b.order_index)
                          .map((s, i) => renderSessionRow(l.program_id, s, i))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {currentProgram ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{currentProgram.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{(currentProgram.program_sessions || []).length} séance{(currentProgram.program_sessions || []).length !== 1 ? 's' : ''}</div>
                  </div>
                  <button onClick={() => fanOutToGroup(currentProgram)} disabled={fanningOut === currentProgram.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}>
                    {fanningOut === currentProgram.id ? '…' : '👥 Assigner au groupe'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...(currentProgram.program_sessions || [])].sort((a, b) => a.order_index - b.order_index)
                    .map((s, i) => renderSessionRow(currentProgram.id, s, i))}
                  <button onClick={quickAddSession} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none',
                    border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '8px 10px',
                    fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer',
                  }}>
                    + Ajouter une séance
                  </button>
                </div>
              </div>
            ) : (
              !creatingProgram && linkedTemplates.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun programme pour ce groupe</div>
            )}
          </div>
        </div>
      </div>

      {showStartPicker && (
        <div onClick={() => setShowStartPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17, marginBottom: 12 }}>▶ Choisir la séance à débuter</div>
            {[
              ...(currentProgram ? [{ key: 'programme', label: 'Programme', prog: currentProgram }] : []),
              ...linkedTemplates.map(l => ({ key: `template-${l.program_id}`, label: 'Template', prog: { title: l.programs?.title, program_sessions: l.programs?.program_sessions } })),
            ].map(({ key, label, prog }) => prog && (
              <div key={key} style={{ marginBottom: 14 }}>
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
