'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { ONE_TIME_OFFERS } from '@/lib/offers'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

const STATUS_LABEL = {
  pending: { label: 'En attente', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  accepted: { label: 'Acceptée — en attente de paiement', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  paid: { label: '✓ Payée', bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  declined: { label: 'Refusée', bg: 'var(--bg2)', color: 'var(--text3)', border: 'var(--border)' },
}

export default function DemandesPage() {
  const [requests, setRequests] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('offer_requests').select('*').order('created_at', { ascending: false })
    setRequests(data || [])
  }

  useEffect(() => { load() }, [])

  const decide = async (id, action) => {
    if (action === 'decline' && !confirm('Refuser cette demande ?')) return
    setBusyId(id)
    const res = await fetch('/api/offers/decide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, action }),
    })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) { alert('Erreur : ' + (json.error || '')); return }
    load()
  }

  if (requests === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  const pending = requests.filter(r => r.status === 'pending')
  const others = requests.filter(r => r.status !== 'pending')

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Demandes</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pending.length} en attente</div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
          {requests.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              Aucune demande pour l&apos;instant.
            </div>
          )}

          {[...pending, ...others].map(r => {
            const offer = ONE_TIME_OFFERS[r.offer_key]
            const status = STATUS_LABEL[r.status] || STATUS_LABEL.pending
            return (
              <div key={r.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.customer_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.customer_email}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, border: `1px solid ${status.border}`, borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                    {status.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  <strong>{offer?.label || r.offer_key}</strong> — {offer?.amount}€ ({r.payment_plan === '3x' ? '3x sans frais' : 'en 1 fois'})
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Demandé le {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => decide(r.id, 'accept')} disabled={busyId === r.id}
                      style={{ flex: 1, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {busyId === r.id ? '…' : '✓ Accepter'}
                    </button>
                    <button onClick={() => decide(r.id, 'decline')} disabled={busyId === r.id}
                      style={{ flex: 1, background: 'var(--bg2)', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      ✕ Refuser
                    </button>
                  </div>
                )}
                {r.status === 'accepted' && r.checkout_url && (
                  <a href={r.checkout_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                    Voir le lien de paiement envoyé →
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
