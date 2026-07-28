'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import TrackedMovementsBlock from './TrackedMovementsBlock'

function calcAge(birthDate) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

const SECTIONS = [
  { key: 'infos', emoji: '👤', label: 'Infos' },
  { key: 'metrics', emoji: '📈', label: 'Metrics' },
  { key: 'mensurations', emoji: '📏', label: 'Mensurations' },
  { key: 'tests', emoji: '🦴', label: 'Tests articulaires' },
]

function FullscreenSection({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16 }}>
        {children}
      </div>
    </div>
  )
}

function ComingSoon({ label }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
      <div style={{ fontWeight: 600 }}>{label} — bientôt disponible</div>
    </div>
  )
}

function InfosSection({ athlete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: athlete.name || '', email: athlete.email || '',
    birth_date: athlete.birth_date || '', weight: athlete.weight ?? '', height: athlete.height ?? '',
    address: athlete.address || '',
  })
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)',
    borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)',
  }

  const age = calcAge(athlete.birth_date)

  const save = async () => {
    setSaving(true)
    const { data, error } = await supabase.from('athletes').update({
      name: form.name.trim(), email: form.email.trim() || null,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseInt(form.height) : null,
      address: form.address.trim() || null,
    }).eq('id', athlete.id).select().single()
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onUpdate(data)
    setEditing(false)
  }

  const sendInvite = async () => {
    if (!athlete.email) return
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: athlete.email, athleteId: athlete.id, athleteName: athlete.name, redirectTo: window.location.origin }),
    })
    const json = await res.json()
    setInviting(false)
    setInviteMsg(json.error ? 'Erreur : ' + json.error : `✓ Invitation envoyée à ${athlete.email}`)
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Nom" value={athlete.name} />
          <Row label="Email" value={athlete.email || '—'} />
          <Row label="Date de naissance" value={athlete.birth_date ? `${new Date(athlete.birth_date + 'T00:00:00').toLocaleDateString('fr-FR')} (${age} ans)` : '—'} />
          <Row label="Poids" value={athlete.weight ? `${athlete.weight} kg` : '—'} />
          <Row label="Taille" value={athlete.height ? `${athlete.height} cm` : '—'} />
          <Row label="Adresse postale" value={athlete.address || '—'} />
        </div>

        {!athlete.auth_user_id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={sendInvite} disabled={inviting || !athlete.email} style={{
              background: athlete.email ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none',
              borderRadius: 'var(--r)', padding: 12, fontSize: 14, fontWeight: 700, cursor: athlete.email ? 'pointer' : 'default',
            }}>
              {inviting ? '…' : athlete.email ? '✉️ Envoyer le lien d\'invitation' : 'Ajoute un email pour inviter'}
            </button>
            {inviteMsg && <div style={{ fontSize: 12, color: inviteMsg.startsWith('Erreur') ? '#DC2626' : '#166534', fontWeight: 600 }}>{inviteMsg}</div>}
          </div>
        )}

        <button onClick={() => setEditing(true)} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ✏️ Modifier
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label="Nom complet"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></Field>
      <Field label="Date de naissance"><input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} style={inputStyle} /></Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Poids (kg)" style={{ flex: 1 }}><input type="number" step="0.1" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} style={inputStyle} /></Field>
        <Field label="Taille (cm)" style={{ flex: 1 }}><input type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} style={inputStyle} /></Field>
      </div>
      <Field label="Adresse postale"><textarea rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditing(false)} style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'Enregistrer'}</button>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{value}</div>
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

export default function AthleteQuickNav({ athlete, onUpdate }) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setOpen(s.key)} style={{
            flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <span style={{ fontSize: 18 }}>{s.emoji}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text2)', textAlign: 'center' }}>{s.label}</span>
          </button>
        ))}
      </div>

      {open === 'infos' && (
        <FullscreenSection title="👤 Infos" onClose={() => setOpen(null)}>
          <InfosSection athlete={athlete} onUpdate={a => { onUpdate?.(a); }} />
        </FullscreenSection>
      )}
      {open === 'metrics' && (
        <FullscreenSection title="📈 Metrics" onClose={() => setOpen(null)}>
          <TrackedMovementsBlock athleteId={athlete.id} isCoach />
        </FullscreenSection>
      )}
      {open === 'mensurations' && (
        <FullscreenSection title="📏 Mensurations" onClose={() => setOpen(null)}>
          <ComingSoon label="Mensurations" />
        </FullscreenSection>
      )}
      {open === 'tests' && (
        <FullscreenSection title="🦴 Tests articulaires" onClose={() => setOpen(null)}>
          <ComingSoon label="Tests articulaires" />
        </FullscreenSection>
      )}
    </>
  )
}
