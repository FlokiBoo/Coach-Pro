'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import MicrocyclesBlock from '@/app/components/MicrocyclesBlock'
import WeeklyStatsBlock from '@/app/components/WeeklyStatsBlock'
import ProgressBlock from '@/app/components/ProgressBlock'
import ActivityBlock from '@/app/components/ActivityBlock'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function calcAge(birthDate) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function formatDuration(min) {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2,'0')}`
}

const METRICS = [
  { key: 'sommeil',     emoji: '🌙', label: 'Sommeil',     inverse: false },
  { key: 'stress',      emoji: '😰', label: 'Stress',      inverse: true  },
  { key: 'courbatures', emoji: '💪', label: 'Courbatures', inverse: true  },
  { key: 'forme',       emoji: '⚡', label: 'Forme',       inverse: false },
]


function scoreColor(val, inverse) {
  const s = inverse ? (11 - val) : val
  if (s >= 7) return '#22c55e'
  if (s >= 4) return '#f59e0b'
  return '#ef4444'
}

export default function AthletePage({ params }) {
  const { athleteId } = use(params)
  const router = useRouter()
  const [athlete, setAthlete] = useState(null)
  const [wellness, setWellness] = useState(null)
  const [activityLogs] = useState({})
  const [completionsToday, setCompletionsToday] = useState([])
  const [objectives, setObjectives] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDanger, setShowDanger] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [newObjective, setNewObjective] = useState('')
  const objInputRef = useRef(null)

  const [form, setForm] = useState({ name: '', email: '', birth_date: '', weight: '', height: '' })

  useEffect(() => {
    async function load() {
      const todayStr = today()
      const [{ data: ath }, { data: w }, { data: actLogs }, { data: progs }, { data: objs }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('wellness').select('*').eq('athlete_id', athleteId).eq('date', todayStr).single(),
        Promise.resolve({ data: [] }),
        supabase.from('programs').select('*, program_sessions(id)').eq('athlete_id', athleteId),
        supabase.from('athlete_objectives').select('*').eq('athlete_id', athleteId).order('created_at'),
      ])

      const sessionIds = (progs || []).flatMap(p => (p.program_sessions || []).map(s => s.id))
      let completions = []
      if (sessionIds.length > 0) {
        const { data: comps } = await supabase.from('program_completions')
          .select('*, program_sessions(title, programs(title))')
          .in('program_session_id', sessionIds)
          .gte('completed_at', todayStr + 'T00:00:00')
          .lte('completed_at', todayStr + 'T23:59:59')
        completions = comps || []
      }

      setAthlete(ath)
      setWellness(w)
      setCompletionsToday(completions)
      setObjectives(objs || [])
      if (ath) setForm({ name: ath.name || '', email: ath.email || '', birth_date: ath.birth_date || '', weight: ath.weight || '', height: ath.height || '' })
      setLoading(false)
    }
    load()
  }, [athleteId])

  const saveProfile = async () => {
    setSaving(true)
    const { data } = await supabase.from('athletes').update({
      name: form.name.trim(),
      email: form.email.trim() || null,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseInt(form.height) : null,
    }).eq('id', athleteId).select().single()
    if (data) setAthlete(data)
    setSaving(false)
    setEditingProfile(false)
  }

  const addObjective = async () => {
    const text = newObjective.trim()
    if (!text) return
    const { data } = await supabase.from('athlete_objectives').insert({ athlete_id: athleteId, text }).select().single()
    if (data) setObjectives(prev => [...prev, data])
    setNewObjective('')
    objInputRef.current?.focus()
  }

  const removeObjective = async (id) => {
    await supabase.from('athlete_objectives').delete().eq('id', id)
    setObjectives(prev => prev.filter(o => o.id !== id))
  }

  const inviteClient = async () => {
    const email = form.email.trim() || athlete?.email
    if (!email) return
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, athleteId, athleteName: athlete?.name, redirectTo: window.location.origin }) })
    const json = await res.json()
    setInviteMsg(json.error ? 'Erreur : ' + json.error : 'Invitation envoyée à ' + email + ' !')
    setInviting(false)
  }

  const archiveAthlete = async () => {
    if (!confirm(`Archiver ${athlete?.name} ?`)) return
    await supabase.from('athletes').update({ archived: true }).eq('id', athleteId)
    router.push('/')
  }

  const deleteAthlete = async () => {
    if (!confirm(`Supprimer définitivement ${athlete?.name} ? Cette action est irréversible.`)) return
    await supabase.from('athletes').delete().eq('id', athleteId)
    router.push('/')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  const age = calcAge(athlete?.birth_date)
  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={athleteId} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{athlete?.name}</div>
            <button onClick={() => setShowDanger(v => !v)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 15, cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, lineHeight: 1 }}>···</button>
          </div>
          {showDanger && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={archiveAthlete} style={{ flex: 1, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 'var(--r)', padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📦 Archiver</button>
              <button onClick={deleteAthlete} style={{ flex: 1, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑 Supprimer</button>
            </div>
          )}
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── PROFIL ── */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>👤 Profil</div>
              <button onClick={() => { setEditingProfile(v => !v); setInviteMsg('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {editingProfile ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {editingProfile ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label="Nom complet"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Date de naissance"><input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} style={inputStyle} /></Field>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Poids (kg)" style={{ flex: 1 }}><input type="number" step="0.1" placeholder="70.5" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Taille (cm)" style={{ flex: 1 }}><input type="number" placeholder="175" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} style={inputStyle} /></Field>
                </div>
                <Field label="Email">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="email" placeholder="client@mail.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                    {!athlete?.auth_user_id && (
                      <button onClick={inviteClient} disabled={inviting || !form.email.trim()} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        {inviting ? '…' : '✉️ Inviter'}
                      </button>
                    )}
                  </div>
                </Field>
                {inviteMsg && <div style={{ fontSize: 12, color: inviteMsg.startsWith('Erreur') ? '#DC2626' : '#166534', fontWeight: 600 }}>{inviteMsg}</div>}
                <button onClick={saveProfile} disabled={saving} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            ) : (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Avatar + nom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
                    {athlete?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{athlete?.name}</div>
                    {athlete?.email && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{athlete.email}</div>}
                  </div>
                </div>

                {/* Stats */}
                {(age || athlete?.weight || athlete?.height) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {age !== null && <Stat label="Âge" value={`${age} ans`} />}
                    {athlete?.weight && <Stat label="Poids" value={`${athlete.weight} kg`} />}
                    {athlete?.height && <Stat label="Taille" value={`${athlete.height} cm`} />}
                  </div>
                )}

                {/* Lien personnel */}
                {athlete?.token ? (
                  athlete.is_coach ? (
                    <Link href={`/s/${athlete.token}`} target="_blank"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 'var(--r)', padding: '9px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      👤 Vue sportif
                    </Link>
                  ) : (
                  <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Lien personnel</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {`${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/s/${athlete.token}`}
                      </div>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/s/${athlete.token}`)}
                      style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      Copier
                    </button>
                  </div>
                  )
                ) : (
                  <button onClick={async () => {
                    const token = crypto.randomUUID()
                    const { data } = await supabase.from('athletes').update({ token }).eq('id', athleteId).select().single()
                    if (data) setAthlete(data)
                  }} style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>
                    🔗 Générer un lien personnel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── OBJECTIFS ── */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>🎯 Objectifs</span>
            </div>

            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Liste des objectifs */}
              {objectives.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun objectif défini</div>
              )}
              {objectives.map(obj => (
                <div key={obj.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                  <span style={{ color: 'var(--green)', fontSize: 14, marginTop: 1, flexShrink: 0 }}>▸</span>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>{obj.text}</span>
                  <button onClick={() => removeObjective(obj.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}

              {/* Champ ajout */}
              <div style={{ display: 'flex', gap: 8, marginTop: objectives.length > 0 ? 4 : 0 }}>
                <input
                  ref={objInputRef}
                  value={newObjective}
                  onChange={e => setNewObjective(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addObjective()}
                  placeholder="Ajouter un objectif… (Entrée pour valider)"
                  style={{ ...inputStyle, flex: 1, fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {/* ── STATS SEMAINE / MOIS ── */}
          <WeeklyStatsBlock athleteId={athleteId} />
          <ProgressBlock athleteId={athleteId} />

          {/* ── AUJOURD'HUI ── */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>📅 Aujourd'hui</span>
            </div>

            {/* Bien-être */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Bien-être</div>
              {wellness ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {METRICS.map(m => {
                    const v = wellness[m.key]
                    if (!v) return null
                    return (
                      <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg2)', borderRadius: 20, padding: '4px 10px' }}>
                        <span style={{ fontSize: 13 }}>{m.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(v, m.inverse) }}>{v}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m.label}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Pas renseigné</span>
              )}
            </div>

            {/* Activité */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <ActivityBlock athleteId={athleteId} isCoach={true} />
            </div>

            {/* Séance */}
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Séance</div>
              {completionsToday.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {completionsToday.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#F0FDF4', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                      <span style={{ color: '#22c55e', fontSize: 14, marginTop: 1 }}>✓</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {c.program_sessions?.title || 'Séance'}
                          {c.program_sessions?.programs?.title && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>{c.program_sessions.programs.title}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                          {c.pleasure != null && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Plaisir <b style={{ color: scoreColor(c.pleasure, false) }}>{c.pleasure}/10</b></span>}
                          {c.difficulty != null && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Difficulté <b style={{ color: scoreColor(c.difficulty, true) }}>{c.difficulty}/10</b></span>}
                          {c.duration_minutes && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDuration(c.duration_minutes)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Aucune séance validée</span>
              )}
            </div>
          </div>

          {/* ── PROGRAMMES ── */}
          <MicrocyclesBlock athleteId={athleteId} />

        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 11px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
  fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)',
  fontFamily: 'inherit',
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{label}</div>
      {children}
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
