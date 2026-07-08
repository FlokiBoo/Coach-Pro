'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AdminCoachsPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [coaches, setCoaches] = useState([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }

      const { data: me } = await supabase
        .from('coaches')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (me?.is_admin) {
        setIsAdmin(true)
        const { data: list } = await supabase
          .from('coaches')
          .select('id, email, name, is_admin, created_at')
          .order('created_at')
        setCoaches(list || [])
      }
      setChecking(false)
    }
    load()
  }, [])

  const inviteCoach = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const res = await fetch('/api/invite-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, redirectTo: window.location.origin })
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error || "Erreur lors de l'invitation.")
      setSaving(false)
      return
    }

    setSuccess(`Invitation envoyée à ${email}.`)
    setCoaches(prev => [...prev, { id: json.coachId, email, name, is_admin: false, created_at: new Date().toISOString() }])
    setEmail('')
    setName('')
    setSaving(false)
  }

  if (checking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )

  if (!isAdmin) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)', flexDirection: 'column', gap: 12 }}>
      <div>Accès réservé.</div>
      <Link href="/" style={{ color: 'var(--green)', fontWeight: 600 }}>← Retour</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg2)', padding: '20px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" style={{ color: 'var(--text3)', fontSize: 20, textDecoration: 'none' }}>←</Link>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>Coachs</div>
        </div>

        <form onSubmit={inviteCoach} style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 10
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Inviter un nouveau coach</div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)' }}
          />
          <input
            type="text"
            placeholder="Nom (optionnel)"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)' }}
          />

          {error && (
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ fontSize: 13, color: '#166534', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={saving} style={{
            background: 'var(--green)', color: '#fff', border: 'none',
            borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}>{saving ? '…' : 'Envoyer l\'invitation'}</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {coaches.length} coach{coaches.length !== 1 ? 's' : ''}
          </div>
          {coaches.map(c => (
            <div key={c.id} style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name || c.email}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.email}</div>
              </div>
              {c.is_admin && (
                <div style={{ fontSize: 11, fontWeight: 700, background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                  Admin
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
