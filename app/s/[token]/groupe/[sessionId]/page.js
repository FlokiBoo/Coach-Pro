'use client'

import { useState, useEffect, useCallback, use, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UsersThree, Lightning, FlagCheckered, FloppyDisk } from '@phosphor-icons/react'
import { notifyGroupSessionReminder } from '@/lib/notify'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

const inp = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid var(--border2)',
  borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit',
}

// Équivalent, pour un leader de groupe (compte athlète), de la fiche coach
// /groups/[groupId]/session/[sessionId] — un leader n'a pas accès à l'espace coach (confiné à
// /s/[token] par le middleware), donc cette page vit ici et parle aux API /api/athlete-view/...
// plutôt qu'au client Supabase direct (RLS n'est pas pensée pour un accès athlète à ces tables).
export default function LeaderGroupSessionPageWrapper({ params }) {
  return (
    <Suspense>
      <LeaderGroupSessionPage params={params} />
    </Suspense>
  )
}

function LeaderGroupSessionPage({ params }) {
  const { token, sessionId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/athlete-view/${token}/group-session-run?sessionId=${sessionId}&date=${runDate}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Erreur de chargement'); setLoading(false); return }
    setGroup(data.group)
    setMembers(data.members || [])
    setSession(data.session)
    setExercises(data.exercises || [])
    if (data.existingRun) {
      setExerciseNotes(data.existingRun.exercise_notes || {})
      setCoachDifficulty(data.existingRun.coach_difficulty)
      setCoachNote(data.existingRun.coach_note || '')
    }
    setPresentIds(new Set(data.presentIds || []))
    setLoading(false)
  }, [token, sessionId, runDate])

  useEffect(() => { load() }, [load])

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
    const res = await fetch(`/api/athlete-view/${token}/group-session-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId, date: runDate, exerciseNotes, coachDifficulty, coachNote,
        presentIds: [...presentIds],
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { alert('Erreur : ' + (data.error || '')); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    if (presentIds.size > 0 && window.confirm(`Envoyer un email aux ${presentIds.size} présent${presentIds.size > 1 ? 's' : ''} pour qu'ils pensent à remplir leur performance ?`)) {
      notifyGroupSessionReminder({ athleteIds: [...presentIds], sessionTitle: session?.title })
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)', gap: 12, padding: 20, textAlign: 'center' }}>
      <div>{error}</div>
      <button onClick={() => router.push(`/s/${token}`)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Retour</button>
    </div>
  )

  const circuits = session?.circuits || []

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)', paddingBottom: 60 }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push(`/s/${token}`)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>←</button>
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
