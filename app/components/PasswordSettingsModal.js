'use client'

import { useState } from 'react'
import { GearSix, CheckCircle } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)',
  borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)',
}

export default function PasswordSettingsModal({ onClose }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (next !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (next.length < 6) { setError('Minimum 6 caractères.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setError('Session invalide, reconnecte-toi.'); setLoading(false); return }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (signInErr) { setError('Mot de passe actuel incorrect.'); setLoading(false); return }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next })
    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '24px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><GearSix size={17} /> Paramètres</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>×</button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: '#16A34A', marginBottom: 8 }}><CheckCircle size={32} /></div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Mot de passe modifié</div>
            <button onClick={onClose} style={{ marginTop: 14, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Changer mon mot de passe
            </div>
            <input
              type={showPwd ? 'text' : 'password'} placeholder="Mot de passe actuel"
              value={current} onChange={e => setCurrent(e.target.value)} required autoFocus
              style={inputStyle}
            />
            <input
              type={showPwd ? 'text' : 'password'} placeholder="Nouveau mot de passe"
              value={next} onChange={e => setNext(e.target.value)} required
              style={inputStyle}
            />
            <input
              type={showPwd ? 'text' : 'password'} placeholder="Confirmer le nouveau mot de passe"
              value={confirm} onChange={e => setConfirm(e.target.value)} required
              style={inputStyle}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} />
              Afficher les mots de passe
            </label>

            {error && (
              <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '8px 10px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
              {loading ? '…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
