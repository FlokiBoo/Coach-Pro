'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'signup') {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      setSuccess('Compte créé ! Vérifie ton email pour confirmer.')
      setLoading(false)
      return
    }

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }

    // Chercher si cet utilisateur est un client (athlete avec auth_user_id)
    const { data: athlete } = await supabase
      .from('athletes')
      .select('token')
      .eq('auth_user_id', data.user.id)
      .single()

    if (athlete?.token) {
      router.push(`/s/${athlete.token}`)
    } else {
      router.push('/')
    }
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
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏃</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>CoachPro</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            {mode === 'login' ? 'Connexion à ton espace' : 'Créer un compte'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
              fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)'
            }}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={{
              padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
              fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)'
            }}
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

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
              padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4
            }}
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text3)' }}>
          {mode === 'login' ? (
            <>
              Première connexion ?{' '}
              <button onClick={() => { setMode('signup'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Créer un compte
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{' '}
              <button onClick={() => { setMode('login'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Se connecter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
