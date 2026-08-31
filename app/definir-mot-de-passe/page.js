'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isPasswordValid, passwordPolicyMessage } from '@/lib/passwordPolicy'
import PasswordChecklist from '@/app/components/PasswordChecklist'

export default function DefinirMotDePasse() {
  return (
    <Suspense>
      <DefinirMotDePasseInner />
    </Suspense>
  )
}

function DefinirMotDePasseInner() {
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') || 'invite'

  const [stage, setStage] = useState('checking') // checking | needConfirm | expired | ready
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('error=')) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const desc = hashParams.get('error_description')
      setConfirmError(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Ce lien a expiré ou a déjà été utilisé.')
      setStage('expired')
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setName(session.user.user_metadata?.athlete_name || '')
        setStage('ready')
      } else if (tokenHash) {
        setStage('needConfirm')
      } else {
        setStage('expired')
        setConfirmError("Lien invalide ou incomplet.")
      }
    })
  }, [])

  const confirmInvite = async () => {
    setConfirming(true)
    setConfirmError('')
    const { data, error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
    setConfirming(false)
    if (err) {
      setConfirmError(err.message === 'Token has expired or is invalid'
        ? "Ce lien a expiré ou a déjà été utilisé (souvent car un antivirus/scanner mail l'a ouvert automatiquement). Redemande une invitation à ton coach."
        : err.message)
      setStage('expired')
      return
    }
    setName(data.user?.user_metadata?.athlete_name || '')
    setStage('ready')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isPasswordValid(password)) { setError(passwordPolicyMessage()); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)

    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    const res = await fetch('/api/password-set', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birth_date: birthDate || null, height: height || null, weight: weight || null }),
    })
    const { athleteToken } = await res.json().catch(() => ({}))
    window.location.href = athleteToken ? `/s/${athleteToken}` : '/'
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 22, fontWeight: 700 }}>Crée ton compte</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            Quelques infos pour préparer ton espace personnel.
          </div>
        </div>

        {stage === 'checking' && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0' }}>Chargement…</div>
        )}

        {stage === 'expired' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {confirmError}
            </div>
          </div>
        )}

        {stage === 'needConfirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.5 }}>
              Clique ci-dessous pour confirmer ton invitation et créer ton compte.
            </div>
            {confirmError && (
              <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                {confirmError}
              </div>
            )}
            <button onClick={confirmInvite} disabled={confirming}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {confirming ? '…' : '✓ Confirmer mon invitation'}
            </button>
          </div>
        )}

        {stage === 'ready' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Prénom et nom">
              <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
            </Field>

            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Date de naissance" style={{ flex: 1 }}>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputStyle} />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Taille (cm)" style={{ flex: 1 }}>
                <input type="number" placeholder="175" value={height} onChange={e => setHeight(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Poids (kg)" style={{ flex: 1 }}>
                <input type="number" step="0.1" placeholder="70.5" value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} />
              </Field>
            </div>

            <Field label="Mot de passe">
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Nouveau mot de passe"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </Field>

            <Field label="Confirmer le mot de passe">
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Confirmer le mot de passe"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={inputStyle}
              />
            </Field>

            <PasswordChecklist password={password} />

            {error && (
              <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
              {loading ? '…' : 'Confirmer et accéder à mon espace'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
  fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)',
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}
