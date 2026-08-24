'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import PasswordSettingsModal from '@/app/components/PasswordSettingsModal'
import { SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers'

const rowStyle = {
  background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
}

export default function SettingsScreen({ athlete, token, onClose }) {
  const [showPassword, setShowPassword] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [stravaBusy, setStravaBusy] = useState(false)
  const [subscribing, setSubscribing] = useState(null)
  const [changingPlan, setChangingPlan] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const disconnectStrava = async () => {
    if (!window.confirm('Déconnecter Strava ? Tes prochaines courses ne seront plus enregistrées automatiquement.')) return
    setStravaBusy(true)
    const res = await fetch('/api/strava/disconnect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    if (!res.ok) { alert('Erreur lors de la déconnexion.'); setStravaBusy(false); return }
    window.location.reload()
  }

  const subscribe = async (tier) => {
    setSubscribing(tier)
    const res = await fetch(`/api/athlete-view/${token}/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }),
    })
    const json = await res.json().catch(() => ({}))
    setSubscribing(null)
    if (json.error) { alert('Erreur : ' + json.error); return }
    window.location.assign(json.url)
  }

  const changePlan = async (tier) => {
    setChangingPlan(tier)
    const res = await fetch(`/api/athlete-view/${token}/change-plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }),
    })
    const json = await res.json().catch(() => ({}))
    setChangingPlan(null)
    if (json.error) { alert('Erreur : ' + json.error); return }
    window.location.reload()
  }

  const openPortal = async () => {
    setPortalLoading(true)
    const res = await fetch(`/api/athlete-view/${token}/portal`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setPortalLoading(false)
    if (json.error) { alert('Erreur : ' + json.error); return }
    window.location.assign(json.url)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Réglages</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Compte</div>

        <button onClick={() => setShowSubscription(true)} style={rowStyle}>
          <span style={{ fontSize: 20 }}>💳</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
            Abonnement
            {athlete.subscription_status === 'active' && SUBSCRIPTION_TIERS[athlete.subscription_tier] && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', borderRadius: 10, padding: '2px 8px' }}>
                {SUBSCRIPTION_TIERS[athlete.subscription_tier].label}
              </span>
            )}
          </span>
          <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
        </button>

        {athlete.strava_athlete_id ? (
          <button onClick={disconnectStrava} disabled={stravaBusy} style={rowStyle}>
            <span style={{ fontSize: 20 }}>🟠</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
              Strava
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', borderRadius: 10, padding: '2px 8px' }}>Connecté</span>
            </span>
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>{stravaBusy ? '…' : 'Déconnecter'}</span>
          </button>
        ) : (
          <a href={`/api/strava/connect?token=${token}`} style={{ ...rowStyle, textDecoration: 'none' }}>
            <span style={{ fontSize: 20 }}>🟠</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Connecter Strava</span>
            <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
          </a>
        )}

        <button onClick={() => setShowPassword(true)} style={rowStyle}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Changer mon mot de passe</span>
          <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
        </button>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 8 }}>Aide</div>

        <button onClick={() => setShowHelp(true)} style={rowStyle}>
          <span style={{ fontSize: 20 }}>❓</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Centre d&apos;aide</span>
          <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
        </button>

        <a href="mailto:maxx7796@gmail.com?subject=Contact%20OSTRYK" style={{ ...rowStyle, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>✉️</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Contactez-nous</span>
          <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
        </a>

        <a href="mailto:maxx7796@gmail.com?subject=Probl%C3%A8me%20OSTRYK" style={{ ...rowStyle, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>🐛</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Rapporter un problème</span>
          <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
        </a>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 8 }}>Légal</div>

        <a href="/confidentialite" target="_blank" style={{ ...rowStyle, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>📄</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>CGU &amp; Confidentialité</span>
          <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
        </a>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>OSTRYK — version 1.0</div>

        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
          style={{ ...rowStyle, marginTop: 10, color: '#B91C1C', justifyContent: 'center' }}
        >
          ⎋ Déconnexion
        </button>
      </div>

      {showSubscription && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 550, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowSubscription(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Abonnement</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {athlete.subscription_status === 'active' && (
              <div style={{ background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--rl)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D6B4F' }}>
                  ✓ Abonnement actif — {SUBSCRIPTION_TIERS[athlete.subscription_tier]?.label || athlete.subscription_tier}
                </div>
                <button onClick={openPortal} disabled={portalLoading}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}>
                  {portalLoading ? '…' : 'Gérer mon abonnement'}
                </button>
              </div>
            )}
            {Object.values(SUBSCRIPTION_TIERS).map(t => {
              const isCurrent = athlete.subscription_status === 'active' && athlete.subscription_tier === t.key
              return (
                <div key={t.key} style={{
                  background: 'var(--bg)', border: isCurrent ? '1.5px solid var(--green)' : '1px solid var(--border)',
                  borderRadius: 'var(--rl)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>{t.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{t.amount.toFixed(2).replace('.', ',')}€<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>/mois</span></div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.description}</div>
                  {!isCurrent && athlete.subscription_status !== 'active' && (
                    <button onClick={() => subscribe(t.key)} disabled={subscribing === t.key}
                      style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                      {subscribing === t.key ? '…' : "S'abonner"}
                    </button>
                  )}
                  {!isCurrent && athlete.subscription_status === 'active' && (
                    <button onClick={() => changePlan(t.key)} disabled={changingPlan === t.key}
                      style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                      {changingPlan === t.key ? '…' : 'Passer à cette formule'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 550, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Centre d&apos;aide</div>
          </div>
          <div style={{ flex: 1, padding: 16, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🚧</div>
            <div style={{ fontSize: 13 }}>Bientôt disponible. En attendant, utilise &quot;Contactez-nous&quot; pour toute question.</div>
          </div>
        </div>
      )}

      {showPassword && <PasswordSettingsModal onClose={() => setShowPassword(false)} />}
    </div>
  )
}
