'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy'
import PasswordChecklist from '@/app/components/PasswordChecklist'

const fieldStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
  fontSize: 15, outline: 'none', background: 'var(--bg2)', color: 'var(--text)',
}

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [targetHeight, setTargetHeight] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login') // 'login' | 'signup' | 'reset'
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const redirectAfterAuth = async (userId) => {
    const { data: coach } = await supabase.from('coaches').select('id').eq('id', userId).single()
    if (coach) { router.push('/'); return }

    const { data: athlete } = await supabase.from('athletes').select('token').eq('auth_user_id', userId).single()
    router.push(athlete?.token ? `/s/${athlete.token}` : '/')
  }

  const switchMode = (m) => { setMode(m); setError(''); setSuccess('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'reset') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`
      })
      if (err) { setError(err.message); setLoading(false); return }
      setSuccess('Email envoyé ! Vérifie ta boîte mail pour réinitialiser ton mot de passe.')
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      if (!acceptedTerms) { setError('Merci d\'accepter les CGU et la politique de confidentialité.'); setLoading(false); return }
      const name = `${firstName.trim()} ${lastName.trim()}`.trim()
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, password,
          birth_date: birthDate || null,
          height: height || null,
          weight: weight || null,
          target_weight: targetWeight || null,
          target_height: targetHeight || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Erreur lors de la création du compte.'); setLoading(false); return }

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) { setError(signInErr.message); setLoading(false); return }
      await redirectAfterAuth(data.user.id)
      return
    }

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
    await redirectAfterAuth(data.user.id)
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
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ostryk-transparent.png" alt="OSTRYK" style={{ width: 130, height: 'auto', marginBottom: 4 }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: 2 }}>
            Built to grow
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>
            {mode === 'login' && 'Connexion à ton espace'}
            {mode === 'signup' && 'Crée ton compte'}
            {mode === 'reset' && 'Réinitialiser le mot de passe'}
          </div>
        </div>

        {mode !== 'reset' && (
          <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 'var(--rl)', padding: 3, marginBottom: 20 }}>
            <button type="button" onClick={() => switchMode('login')} style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, background: mode === 'login' ? 'var(--green)' : 'none',
              color: mode === 'login' ? '#fff' : 'var(--text3)',
            }}>
              Se connecter
            </button>
            <button type="button" onClick={() => switchMode('signup')} style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, background: mode === 'signup' ? 'var(--green)' : 'none',
              color: mode === 'signup' ? '#fff' : 'var(--text3)',
            }}>
              Créer un compte
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text" placeholder="Prénom" value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required autoComplete="given-name" style={{ ...fieldStyle, flex: 1 }}
                />
                <input
                  type="text" placeholder="Nom" value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required autoComplete="family-name" style={{ ...fieldStyle, flex: 1 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Date de naissance
                </label>
                <input
                  type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                  style={{ ...fieldStyle, marginTop: 5 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Taille (cm)
                  </label>
                  <input
                    type="number" placeholder="175" value={height} onChange={e => setHeight(e.target.value)}
                    style={{ ...fieldStyle, marginTop: 5 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Poids (kg)
                  </label>
                  <input
                    type="number" step="0.1" placeholder="70.5" value={weight} onChange={e => setWeight(e.target.value)}
                    style={{ ...fieldStyle, marginTop: 5 }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Objectif (optionnel, mais conseillé)
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)' }}>Taille cible (cm)</label>
                    <input
                      type="number" placeholder="175" value={targetHeight}
                      onChange={e => setTargetHeight(e.target.value)} style={{ ...fieldStyle, marginTop: 3 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)' }}>Poids cible (kg)</label>
                    <input
                      type="number" step="0.1" placeholder="65.0" value={targetWeight}
                      onChange={e => setTargetWeight(e.target.value)} style={{ ...fieldStyle, marginTop: 3 }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

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

          {mode !== 'reset' && (
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? PASSWORD_MIN_LENGTH : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
          )}

          {mode === 'signup' && <PasswordChecklist password={password} />}

          {mode === 'login' && (
            <div style={{ textAlign: 'right' }}>
              <button type="button" onClick={() => switchMode('reset')}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                Mot de passe oublié ?
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }} />
              <span>
                J&apos;accepte les <a href="/cgu" style={{ color: 'var(--green)' }}>CGU</a> et la{' '}
                <a href="/confidentialite" style={{ color: 'var(--green)' }}>politique de confidentialité</a>.
              </span>
            </label>
          )}

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

          <button type="submit" disabled={loading}
            style={{
              background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
              padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4
            }}>
            {loading ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>

          {mode === 'reset' && (
            <button type="button" onClick={() => switchMode('login')}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }}>
              ← Retour à la connexion
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
