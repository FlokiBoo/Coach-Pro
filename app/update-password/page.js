'use client'

import { useState, useEffect, Suspense } from 'react'
import { Key, Eye, EyeSlash } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { isPasswordValid, passwordPolicyMessage } from '@/lib/passwordPolicy'
import PasswordChecklist from '@/app/components/PasswordChecklist'

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordPageInner />
    </Suspense>
  )
}

function UpdatePasswordPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [needConfirm, setNeedConfirm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const tokenHash = searchParams.get('token_hash')

  useEffect(() => {
    // Lien expiré / déjà utilisé : Supabase renvoie l'erreur dans le hash de l'URL
    if (typeof window !== 'undefined' && window.location.hash.includes('error=')) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const desc = hashParams.get('error_description')
      setError(
        desc
          ? decodeURIComponent(desc.replace(/\+/g, ' '))
          : 'Ce lien a expiré ou a déjà été utilisé. Redemande un lien depuis "mot de passe oublié".'
      )
      return
    }

    // Supabase fire PASSWORD_RECOVERY quand le lien du mail est cliqué (flow implicite)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    // Client en mode PKCE : le lien du mail contient ?code=... à échanger contre une session
    const code = searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (!err) setReady(true)
        else setError(err.message)
      })
    } else {
      // Vérifie si déjà une session active (rechargement de page)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true)
        else if (tokenHash) setNeedConfirm(true)
      })
    }
    return () => subscription.unsubscribe()
  }, [])

  const confirmRecovery = async () => {
    setConfirming(true)
    setError('')
    const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    setConfirming(false)
    if (err) {
      setError(err.message === 'Token has expired or is invalid'
        ? "Ce lien a expiré ou a déjà été utilisé (souvent car un antivirus/scanner mail l'a ouvert automatiquement). Redemande un lien depuis \"mot de passe oublié\"."
        : err.message)
      setNeedConfirm(false)
      return
    }
    setNeedConfirm(false)
    setReady(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (!isPasswordValid(password)) { setError(passwordPolicyMessage()); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }

    const res = await fetch('/api/password-set', { method: 'POST' })
    const { athleteToken } = await res.json().catch(() => ({}))
    router.push(athleteToken ? `/s/${athleteToken}` : '/')
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Key size={32} /></div>
          <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 22, fontWeight: 700 }}>Nouveau mot de passe</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Choisis ton nouveau mot de passe</div>
        </div>

        {!ready && error ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {error}
            </div>
            <a href="/login" style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>
              ← Retour à la connexion
            </a>
          </div>
        ) : !ready && needConfirm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.5 }}>
              Clique ci-dessous pour confirmer et choisir ton nouveau mot de passe.
            </div>
            <button onClick={confirmRecovery} disabled={confirming}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {confirming ? '…' : '✓ Confirmer'}
            </button>
          </div>
        ) : !ready ? (
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
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', display: 'flex', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                {showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
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

            <PasswordChecklist password={password} />

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
