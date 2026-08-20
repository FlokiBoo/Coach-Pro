'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatEur(amount) {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
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

const PAYMENT_LABELS = {
  paid: { color: '#166534', bg: '#DCFCE7' },
  failed: { color: '#991B1B', bg: '#FEE2E2' },
  pending: { color: '#92400E', bg: '#FEF3C7' },
  void: { color: 'var(--text3)', bg: 'var(--bg2)' },
}

export default function FinancesPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }
      const { data: me } = await supabase.from('coaches').select('is_admin').eq('id', user.id).single()
      if (!me?.is_admin) { setChecking(false); return }
      setIsAdmin(true)
      setChecking(false)

      const res = await fetch('/api/finances', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Erreur de chargement'); return }
      setData(json)
    }
    load()
  }, [])

  if (checking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )
  if (!isAdmin) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100svh', gap: 12, color: 'var(--text3)' }}>
      <div>Accès réservé.</div>
      <Link href="/" style={{ color: 'var(--green)', fontWeight: 600 }}>← Retour</Link>
    </div>
  )

  const athletes = (data?.athletes || []).filter(a => a.name.toLowerCase().includes(search.trim().toLowerCase()))
  const failedCount = (data?.athletes || []).filter(a => a.lastPayment?.status === 'failed').length

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>💰 Finances</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Abonnements, paiements et chiffre d&apos;affaires</div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {error && (
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {error}
            </div>
          )}

          {!data && !error && (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Chargement des données Stripe…</div>
          )}

          {data && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Ce mois-ci', value: data.revenue.month },
                  { label: 'Ce trimestre', value: data.revenue.quarter },
                  { label: 'Cette année', value: data.revenue.year },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{formatEur(kpi.value)}</div>
                  </div>
                ))}
              </div>

              {failedCount > 0 && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--rl)', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
                  ⚠️ {failedCount} paiement{failedCount > 1 ? 's' : ''} échoué{failedCount > 1 ? 's' : ''} à traiter
                </div>
              )}

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un sportif…"
                style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
              />

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                {athletes.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 14px' }}>Aucun sportif avec un abonnement.</div>
                ) : athletes.map((a, i) => {
                  const status = STATUS_LABELS[a.subscriptionStatus]
                  const tier = a.tier && SUBSCRIPTION_TIERS[a.tier]
                  const pay = a.lastPayment
                  const payStyle = pay ? PAYMENT_LABELS[pay.status] : null
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--green-light)', color: 'var(--green)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                      }}>
                        {initials(a.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {tier?.label || '—'}
                          {pay && ` · ${formatEur(pay.amount / 100)} le ${new Date(pay.date).toLocaleDateString('fr-FR')}`}
                        </div>
                      </div>
                      {pay && payStyle && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: payStyle.color, background: payStyle.bg, borderRadius: 10, padding: '3px 10px', flexShrink: 0 }}>
                          {pay.label}
                        </span>
                      )}
                      {status && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: status.color, background: status.bg, borderRadius: 10, padding: '3px 10px', flexShrink: 0 }}>
                          {status.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
