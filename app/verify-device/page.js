'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function getDeviceId() {
  const match = document.cookie.match(/(?:^|; )cp_device=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  const id = crypto.randomUUID()
  document.cookie = `cp_device=${id}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; SameSite=Lax`
  return id
}

export default function VerifyDevicePageWrapper() {
  return (
    <Suspense>
      <VerifyDevicePage />
    </Suspense>
  )
}

function VerifyDevicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const autoSent = useRef(false)

  const sendCode = async (addr) => {
    if (!addr || sending) return
    setSending(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: false } })
    setSending(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const addr = data?.user?.email
      if (addr) {
        setEmail(addr)
        if (!autoSent.current) { autoSent.current = true; sendCode(addr) }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setVerifying(true)
    setError('')
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    if (err) { setError('Code invalide ou expiré.'); setVerifying(false); return }

    const deviceId = getDeviceId()
    const res = await fetch('/api/device/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    })
    setVerifying(false)
    if (!res.ok) { setError('Erreur lors de l’enregistrement de l’appareil.'); return }
    router.push(token ? `/s/${token}` : '/')
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Nouvel appareil détecté</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
            Pour la sécurité de ton compte (max. 2 appareils), valide cet appareil avec le code envoyé par email à {email || '…'}.
          </div>
        </div>

        <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text" inputMode="numeric" placeholder="Code reçu par email"
            value={code} onChange={e => setCode(e.target.value)}
            autoFocus maxLength={12}
            style={{ padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 20, textAlign: 'center', letterSpacing: 4, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
          />

          {error && (
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {error}
            </div>
          )}
          {sent && !error && (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Code envoyé ✓</div>
          )}

          <button type="submit" disabled={verifying || !code.trim()}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {verifying ? '…' : 'Valider'}
          </button>

          <button type="button" onClick={() => sendCode(email)} disabled={sending || !email}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            {sending ? 'Envoi…' : 'Renvoyer le code'}
          </button>
        </form>
      </div>
    </div>
  )
}
