'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase fire PASSWORD_RECOVERY quand le lien du mail est cliqué
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })
    // Vérifie si déjà une session active (rechargement de page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6) { setError('Minimum 6 caractères.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Nouveau mot de passe</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Choisis ton nouveau mot de passe</div>
        </div>

        {!ready ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0' }}>Chargement…</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <input
                autoFocus
                type={showPwd ? 'text' : 'password'}
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
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
              style={{ padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
            />

            {error && (
              <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
              {loading ? '…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
