'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DefinirMotDePasse() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)

    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    // Effacer le flag needs_password côté admin
    await fetch('/api/password-set', { method: 'POST' })

    // Récupérer le token athlete pour rediriger
    const { data: { user } } = await supabase.auth.getUser()
    const token = user?.app_metadata?.athlete_token
    window.location.href = token ? `/s/${token}` : '/'
  }

  return (
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg2)', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: 'var(--bg)',
        border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '32px 28px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Crée ton mot de passe</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            Choisis un mot de passe pour sécuriser ton espace personnel.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder="Nouveau mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 44px 12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
                fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)'
              }}
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>

          <input
            type={showPwd ? 'text' : 'password'}
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
              fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)',
              width: '100%', boxSizing: 'border-box'
            }}
          />

          {password && (
            <div style={{ fontSize: 12, color: password.length >= 8 ? 'var(--green)' : 'var(--text3)' }}>
              {password.length >= 8 ? '✓ Longueur suffisante' : `${8 - password.length} caractères minimum`}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
              padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4
            }}>
            {loading ? '…' : 'Confirmer et accéder à mon espace'}
          </button>
        </form>
      </div>
    </div>
  )
}
