'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const STATUS_LABELS = {
  active: { label: 'Actif', color: '#166534', bg: '#DCFCE7' },
  trialing: { label: 'Essai', color: '#1D4ED8', bg: '#DBEAFE' },
  past_due: { label: 'Paiement en retard', color: '#92400E', bg: '#FEF3C7' },
  unpaid: { label: 'Impayé', color: '#991B1B', bg: '#FEE2E2' },
  incomplete: { label: 'Incomplet', color: '#92400E', bg: '#FEF3C7' },
  incomplete_expired: { label: 'Expiré', color: '#991B1B', bg: '#FEE2E2' },
  canceled: { label: 'Arrêté', color: '#991B1B', bg: '#FEE2E2' },
}

export default function AbonnementsPage() {
  const [athletes, setAthletes] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('athletes').select('*').neq('archived', true).order('name')
    setAthletes(data || [])
  }

  const filtered = (athletes || []).filter(a => a.name.toLowerCase().includes(search.trim().toLowerCase()))
  const actifs = filtered.filter(a => a.subscription_status === 'active')
  const arretes = filtered.filter(a => a.subscription_status && a.subscription_status !== 'active')
  const jamais = filtered.filter(a => !a.subscription_status)

  function Row({ a }) {
    const status = STATUS_LABELS[a.subscription_status]
    const tier = a.subscription_tier && SUBSCRIPTION_TIERS[a.subscription_tier]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'var(--green-light)', color: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
        }}>
          {initials(a.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
          {tier && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tier.label}</div>}
        </div>
        {status ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: status.color, background: status.bg, borderRadius: 10, padding: '3px 10px', flexShrink: 0 }}>
            {status.label}
          </span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 10, padding: '3px 10px', flexShrink: 0 }}>
            Jamais abonné
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 2 }}>💳 Abonnements</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {actifs.length} actif{actifs.length !== 1 ? 's' : ''} · {arretes.length} arrêté{arretes.length !== 1 ? 's' : ''} · {jamais.length} jamais abonné{jamais.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un sportif…"
            style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          />

          {athletes === null ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Chargement…</div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  ✅ Actifs ({actifs.length})
                </div>
                {actifs.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', padding: '10px 0' }}>Aucun abonnement actif.</div>
                ) : (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                    {actifs.map((a, i) => <div key={a.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}><Row a={a} /></div>)}
                  </div>
                )}
              </div>

              {arretes.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                    ⛔ Arrêtés / en souci ({arretes.length})
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                    {arretes.map((a, i) => <div key={a.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}><Row a={a} /></div>)}
                  </div>
                </div>
              )}

              {jamais.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                    ⚪ Jamais abonnés ({jamais.length})
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                    {jamais.map((a, i) => <div key={a.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}><Row a={a} /></div>)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
