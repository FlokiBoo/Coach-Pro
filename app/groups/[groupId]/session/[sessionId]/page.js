'use client'

import { useState, useEffect, use, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UsersThree, Lightning, FlagCheckered, FloppyDisk } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { getCoachId } from '@/lib/coach'
import { notifyGroupSessionReminder } from '@/lib/notify'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

const inp = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid var(--border2)',
  borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit',
}

export default function GroupCoachingSessionPageWrapper({ params }) {
  return (
    <Suspense>
      <GroupCoachingSessionPage params={params} />
    </Suspense>
  )
}

function GroupCoachingSessionPage({ params }) {
  const { groupId, sessionId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  // Sans paramètre, on travaille sur la séance du jour (lancement en direct). Avec ?date=,
  // on ré-ouvre une séance passée pour la corriger (présents, ressenti) depuis l'historique groupe.
  const runDate = searchParams.get('date') || today()
  const isPast = runDate !== today()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [presentIds, setPresentIds] = useState(new Set())
  const [exerciseNotes, setExerciseNotes] = useState({})
  const [coachDifficulty, setCoachDifficulty] = useState(null)
  const [coachNote, setCoachNote] = useState('')
  const [runId, setRunId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [groupId, sessionId, runDate])

  async function load() {
    setLoading(true)
    const [{ data: g }, { data: gm }, { data: sess }, { data: exos }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('athlete_id, athletes(id, name)').eq('group_id', groupId),
      supabase.from('program_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('program_exercises').select('*').eq('program_session_id', sessionId).order('order_index'),
    ])
    setGroup(g)
    setMembers((gm || []).map(m => m.athletes).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)))
    setSession(sess)
    setExercises(exos || [])

    const { data: existingRun } = await supabase.from('group_session_runs')
      .select('*').eq('group_id', groupId).eq('source_session_id', sessionId).eq('date', runDate).maybeSingle()
    if (existingRun) {
      setRunId(existingRun.id)
      setExerciseNotes(existingRun.exercise_notes || {})
      setCoachDifficulty(existingRun.coach_difficulty)
      setCoachNote(existingRun.coach_note || '')
      const { data: att } = await supabase.from('group_session_attendance').select('athlete_id').eq('run_id', existingRun.id)
      setPresentIds(new Set((att || []).map(a => a.athlete_id)))
    }
    setLoading(false)
  }

  const togglePresent = (athleteId) => {
    setPresentIds(prev => {
      const next = new Set(prev)
      if (next.has(athleteId)) next.delete(athleteId)
      else next.add(athleteId)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    const coachId = await getCoachId()

    const { data: run, error } = await supabase.from('group_session_runs')
      .upsert({
        id: runId || undefined,
        group_id: groupId, coach_id: coachId, source_session_id: sessionId,
        title: session?.title || 'Séance', date: runDate,
        exercise_notes: exerciseNotes, coach_difficulty: coachDifficulty, coach_note: coachNote.trim() || null,
      }, { onConflict: 'group_id,source_session_id,date' })
      .select().single()
    if (error || !run) { alert('Erreur : ' + (error?.message || '')); setSaving(false); return }
    setRunId(run.id)

    const { data: existingAtt } = await supabase.from('group_session_attendance').select('athlete_id').eq('run_id', run.id)
    const existingIds = new Set((existingAtt || []).map(a => a.athlete_id))
    const toAdd = [...presentIds].filter(id => !existingIds.has(id))
    const toRemove = [...existingIds].filter(id => !presentIds.has(id))
    if (toAdd.length) {
      await supabase.from('group_session_attendance').insert(toAdd.map(athlete_id => ({ run_id: run.id, athlete_id })))
      await supabase.from('notifications').insert(toAdd.map(athlete_id => ({
        athlete_id, type: 'group_session_pending',
        title: 'Séance de groupe à compléter',
        body: session?.title || null,
      })))
    }
    if (toRemove.length) await supabase.from('group_session_attendance').delete().eq('run_id', run.id).in('athlete_id', toRemove)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    if (presentIds.size > 0 && window.confirm(`Envoyer un email aux ${presentIds.size} présent${presentIds.size > 1 ? 's' : ''} pour qu'ils pensent à remplir leur performance ?`)) {
      notifyGroupSessionReminder({ athleteIds: [...presentIds], sessionTitle: session?.title })
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  const circuits = session?.circuits || []

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)', paddingBottom: 60 }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push(`/groups/${groupId}`)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session?.title || 'Séance'}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {group?.name} · {new Date(runDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {isPast && ' · modification'}
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Présence */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
            <UsersThree size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Présents ({presentIds.size}/{members.length})
          </div>
          {members.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun membre dans ce groupe</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map(m => {
                const present = presentIds.has(m.id)
                return (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r)', border: present ? '1.5px solid var(--green)' : '1px solid var(--border)', background: present ? 'var(--green-light)' : 'var(--bg2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={present} onChange={() => togglePresent(m.id)} style={{ accentColor: 'var(--green)', width: 16, height: 16 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: present ? 'var(--green)' : 'var(--text)' }}>{m.name}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Contenu de la séance */}
        {exercises.map(exo => (
          <div key={exo.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{exo.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {exo.sets && <span>{exo.sets} séries</span>}
              {exo.reps && <span>{exo.reps} reps</span>}
              {exo.kg && <span>{exo.kg} kg</span>}
              {exo.rest && <span>récup {exo.rest}</span>}
            </div>
            {exo.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 8 }}>{exo.note}</div>}
            <textarea placeholder="Note perso (visible uniquement par toi)…" value={exerciseNotes[`exercise:${exo.id}`] || ''}
              onChange={e => setExerciseNotes(prev => ({ ...prev, [`exercise:${exo.id}`]: e.target.value }))}
              rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
        ))}

        {circuits.map(c => (
          <div key={c.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Lightning size={13} /> {c.name || 'Circuit'}</div>
            {c.text && <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{c.text}</div>}
            <textarea placeholder="Note perso (visible uniquement par toi)…" value={exerciseNotes[`circuit:${c.id}`] || ''}
              onChange={e => setExerciseNotes(prev => ({ ...prev, [`circuit:${c.id}`]: e.target.value }))}
              rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
        ))}

        {/* Fin de séance */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
            <FlagCheckered size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Fin de séance (ton ressenti)
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>Difficulté ressentie pour le groupe (1-10)</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setCoachDifficulty(n)} style={{
                  width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: coachDifficulty === n ? 'var(--green)' : 'var(--bg2)', color: coachDifficulty === n ? '#fff' : 'var(--text2)',
                }}>{n}</button>
              ))}
            </div>
          </div>
          <textarea placeholder="Note libre sur la séance…" value={coachNote} onChange={e => setCoachNote(e.target.value)}
            rows={3} style={{ ...inp, resize: 'vertical' }} />
        </div>

        <button onClick={save} disabled={saving} style={{
          background: saved ? '#DCFCE7' : 'var(--green)', color: saved ? '#166534' : '#fff', border: saved ? '1px solid #BBF7D0' : 'none',
          borderRadius: 'var(--rl)', padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
        }}>
          {saving ? '…' : saved ? '✓ Enregistré' : <><FloppyDisk size={15} style={{ verticalAlign: -2, marginRight: 5 }} />Enregistrer</>}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
          Les présents recevront une notification pour compléter leur séance (charges, notes, difficulté, plaisir) à leur prochaine connexion.
        </div>
      </div>
    </div>
  )
}
