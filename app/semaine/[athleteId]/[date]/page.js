'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import MicrocyclesBlock from '@/app/components/MicrocyclesBlock'

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

export default function AthletePage({ params }) {
  const { athleteId } = use(params)
  const router = useRouter()
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([])
  const [wellness, setWellness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDanger, setShowDanger] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  const [form, setForm] = useState({
    name: '', email: '', birth_date: '', weight: '', height: ''
  })

  useEffect(() => {
    async function load() {
      const todayStr = today()
      const [{ data: ath }, { data: progs }, { data: w }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('programs').select('*, program_sessions(id)').eq('athlete_id', athleteId).order('created_at', { ascending: false }),
        supabase.from('wellness').select('*').eq('athlete_id', athleteId).eq('date', todayStr).single()
      ])
      setAthlete(ath)
      setPrograms(progs || [])
      setWellness(w)
      if (ath) setForm({
        name: ath.name || '',
        email: ath.email || '',
        birth_date: ath.birth_date || '',
        weight: ath.weight || '',
        height: ath.height || '',
      })
      setLoading(false)
    }
    load()
  }, [athleteId])

  const generateToken = async () => {
    const token = crypto.randomUUID()
    const { data } = await supabase.from('athletes').update({ token }).eq('id', athleteId).select().single()
    if (data) setAthlete(data)
  }

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

  const inviteClient = async () => {
    if (!form.email.trim() && !athlete?.email) return
    const email = form.email.trim() || athlete.email
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, athleteId, athleteName: athlete?.name, redirectTo: window.location.origin })
    })
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

  const METRICS = [
    { key: 'sommeil', emoji: '🌙', label: 'Sommeil', inverse: false },
    { key: 'stress', emoji: '😰', label: 'Stress', inverse: true },
    { key: 'courbatures', emoji: '💪', label: 'Courbatures', inverse: true },
    { key: 'forme', emoji: '⚡', label: 'Forme', inverse: false },
  ]
  function scoreColor(val, inverse) {
    const s = inverse ? (11 - val) : val
    if (s >= 7) return '#22c55e'
    if (s >= 4) return '#f59e0b'
    return '#ef4444'
  }

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
            <Link href={`/programs/${athleteId}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 12, fontWeight: 600, textDecoration: 'none', color: 'var(--text2)', flexShrink: 0 }}>
              📋 Programmes
            </Link>
            <button onClick={() => setShowDanger(v => !v)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 15, cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, lineHeight: 1 }}>
              ···
            </button>
          </div>
          {showDanger && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={archiveAthlete} style={{ flex: 1, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                📦 Archiver
              </button>
              <button onClick={deleteAthlete} style={{ flex: 1, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🗑 Supprimer
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Profil client */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>👤 Profil</div>
              <button
                onClick={() => { setEditingProfile(v => !v); setInviteMsg('') }}
                style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {editingProfile ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {editingProfile ? (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label="Nom complet">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Date de naissance">
                  <input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} style={inputStyle} />
                </Field>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Poids (kg)" style={{ flex: 1 }}>
                    <input type="number" step="0.1" placeholder="70.5" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="Taille (cm)" style={{ flex: 1 }}>
                    <input type="number" placeholder="175" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} style={inputStyle} />
                  </Field>
                </div>

                {/* Email + invitation */}
                <Field label={
                  <span>
                    Email
                    {athlete?.auth_user_id && <span style={{ marginLeft: 6, color: 'var(--green)', fontSize: 11, fontWeight: 700 }}>✓ Compte actif</span>}
                  </span>
                }>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="email" placeholder="client@mail.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                    {!athlete?.auth_user_id && (
                      <button
                        onClick={inviteClient}
                        disabled={inviting || (!form.email.trim() && !athlete?.email)}
                        style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {inviting ? '…' : '✉️ Inviter'}
                      </button>
                    )}
                  </div>
                </Field>

                {inviteMsg && (
                  <div style={{ fontSize: 12, color: inviteMsg.startsWith('Erreur') ? '#DC2626' : '#166534', fontWeight: 600 }}>
                    {inviteMsg}
                  </div>
                )}

                <button onClick={saveProfile} disabled={saving} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            ) : (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Avatar + nom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
                    {athlete?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{athlete?.name}</div>
                    {athlete?.email && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{athlete.email}</div>}
                  </div>
                  {athlete?.auth_user_id && (
                    <div style={{ marginLeft: 'auto', background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✓ Compte</div>
                  )}
                </div>

                {/* Stats */}
                {(age || athlete?.weight || athlete?.height) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {age !== null && <Stat label="Âge" value={`${age} ans`} />}
                    {athlete?.birth_date && <Stat label="Naissance" value={new Date(athlete.birth_date).toLocaleDateString('fr-FR')} />}
                    {athlete?.weight && <Stat label="Poids" value={`${athlete.weight} kg`} />}
                    {athlete?.height && <Stat label="Taille" value={`${athlete.height} cm`} />}
                  </div>
                )}

                {/* Invite si pas de compte et email connu */}
                {!athlete?.auth_user_id && athlete?.email && (
                  <div style={{ marginTop: 4 }}>
                    <button onClick={inviteClient} disabled={inviting} style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {inviting ? '…' : `✉️ Envoyer l'invitation à ${athlete.email}`}
                    </button>
                    {inviteMsg && <div style={{ marginTop: 6, fontSize: 12, color: inviteMsg.startsWith('Erreur') ? '#DC2626' : '#166534', fontWeight: 600 }}>{inviteMsg}</div>}
                  </div>
                )}

                {/* Lien personnel */}
                {athlete?.token && (
                  <div style={{ marginTop: 4, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Lien personnel</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof window !== 'undefined' ? `${window.location.origin}/s/${athlete.token}` : `/s/${athlete.token}`}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/s/${athlete.token}`
                        navigator.clipboard.writeText(url)
                      }}
                      style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                    >
                      Copier
                    </button>
                  </div>
                )}

                {/* Pas encore de profil */}
                {!age && !athlete?.weight && !athlete?.height && !athlete?.email && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                    Clique sur "Modifier" pour renseigner le profil
                  </div>
                )}
              </div>
            )}
          </div>

          <MicrocyclesBlock athleteId={athleteId} />

          {/* Bien-être du jour */}
          {wellness ? (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Bien-être aujourd'hui</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {METRICS.map(m => {
                  const v = wellness[m.key]
                  if (!v) return null
                  return (
                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '6px 12px' }}>
                      <span style={{ fontSize: 15 }}>{m.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(v, m.inverse) }}>{v}/10</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '12px 14px' }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Pas de données bien-être aujourd'hui</div>
            </div>
          )}

          {/* Programmes */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: programs.length ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Programmes</div>
              <Link href={`/programs/${athleteId}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>+ Ajouter</Link>
            </div>
            {programs.length === 0 ? (
              <div style={{ padding: '14px', fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun programme</div>
            ) : programs.map(p => (
              <Link key={p.id} href={`/programs/${athleteId}/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{(p.program_sessions || []).length} séance{(p.program_sessions || []).length !== 1 ? 's' : ''}</div>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 14 }}>›</span>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 11px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
  fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)'
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
