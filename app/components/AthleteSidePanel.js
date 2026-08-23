'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import TrackedMovementsBlock, { estimate1RM, unitOf, formatPerformance } from './TrackedMovementsBlock'
import BadgesBlock from './BadgesBlock'
import PasswordSettingsModal from './PasswordSettingsModal'
import MealPlannerWizard from './MealPlannerWizard'
import { SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers'

function computeRecordEvents(entries) {
  const byMovement = {}
  entries.forEach(e => {
    const mid = e.tracked_movement_id
    if (!byMovement[mid]) byMovement[mid] = []
    byMovement[mid].push(e)
  })
  const events = []
  Object.values(byMovement).forEach(list => {
    const movement = list[0].tracked_movements
    if (!movement) return
    const cfg = unitOf(movement)
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    let best = null
    sorted.forEach(e => {
      let val
      if (!movement.unit || movement.unit === 'kg') {
        const est = estimate1RM(e)
        val = est ? est.value : null
      } else {
        val = e.value
      }
      if (val == null) return
      const isRecord = best === null || (cfg.betterIsHigher ? val > best : val < best)
      if (isRecord) {
        events.push({ movement, value: val, date: e.date, prevValue: best })
        best = val
      }
    })
  })
  events.sort((a, b) => b.date.localeCompare(a.date))
  return events.slice(0, 3)
}

export default function AthleteSidePanel({ athlete, token, onWeightUpdate, onSexUpdate }) {
  const [open, setOpen] = useState(false)
  const [editingWeight, setEditingWeight] = useState(false)
  const [weightVal, setWeightVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [showMealPlanner, setShowMealPlanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrograms, setShowPrograms] = useState(false)
  const [stravaBusy, setStravaBusy] = useState(false)
  const [availablePrograms, setAvailablePrograms] = useState(null)
  const [choosingId, setChoosingId] = useState(null)
  const [showSubscription, setShowSubscription] = useState(false)
  const [subscribing, setSubscribing] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [changingPlan, setChangingPlan] = useState(null)
  const [recentRecords, setRecentRecords] = useState([])

  useEffect(() => {
    if (!athlete?.id) return
    supabase.from('tracked_movement_entries')
      .select('*, tracked_movements(name, unit)')
      .eq('athlete_id', athlete.id)
      .then(({ data }) => setRecentRecords(computeRecordEvents(data || [])))
  }, [athlete?.id])

  const disconnectStrava = async () => {
    if (!window.confirm('Déconnecter Strava ? Tes prochaines courses ne seront plus enregistrées automatiquement.')) return
    setStravaBusy(true)
    const res = await fetch('/api/strava/disconnect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    if (!res.ok) { alert('Erreur lors de la déconnexion.'); setStravaBusy(false); return }
    window.location.reload()
  }

  const openPrograms = async () => {
    setShowPrograms(true)
    if (availablePrograms !== null) return
    const res = await fetch(`/api/athlete-view/${token}/available-programs`, { cache: 'no-store' })
    const { programs } = await res.json().catch(() => ({ programs: [] }))
    setAvailablePrograms(programs || [])
  }

  const chooseProgram = async (programId) => {
    setChoosingId(programId)
    const res = await fetch(`/api/athlete-view/${token}/available-programs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId }),
    })
    const json = await res.json().catch(() => ({}))
    setChoosingId(null)
    if (json.error) { alert('Erreur : ' + json.error); return }
    window.location.reload()
  }

  const subscribe = async (tier) => {
    setSubscribing(tier)
    const res = await fetch(`/api/athlete-view/${token}/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const json = await res.json().catch(() => ({}))
    setSubscribing(null)
    if (json.error) { alert('Erreur : ' + json.error); return }
    window.location.assign(json.url)
  }

  const changePlan = async (tier) => {
    setChangingPlan(tier)
    const res = await fetch(`/api/athlete-view/${token}/change-plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
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

  const startEdit = () => {
    setWeightVal(athlete?.weight ?? '')
    setEditingWeight(true)
  }

  const saveWeight = async () => {
    if (!weightVal || !athlete) return
    setSaving(true)
    const { error } = await supabase.from('athletes').update({ weight: parseFloat(weightVal) }).eq('id', athlete.id)
    if (!error) {
      onWeightUpdate?.(parseFloat(weightVal))
      setEditingWeight(false)
    }
    setSaving(false)
  }

  const saveSex = async (val) => {
    if (!athlete) return
    await supabase.from('athletes').update({ sex: val }).eq('id', athlete.id)
    onSexUpdate?.(val)
  }

  if (!athlete) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 20, left: 16, zIndex: 250,
          background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: '50%',
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}
        aria-label="Mon profil"
      >
        👤
        {athlete.subscription_status === 'active' && (
          <span title="Abonnement actif" style={{
            position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%',
            background: 'var(--green)', border: '2px solid var(--bg)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800,
          }}>✓</span>
        )}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 400 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: '88%', maxWidth: 380,
            background: 'var(--bg2)', boxShadow: '2px 0 24px rgba(0,0,0,.25)', overflowY: 'auto',
            padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 19 }}>{athlete.name}</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>×</button>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Taille</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{athlete.height ? `${athlete.height} cm` : '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Poids</div>
                  {editingWeight ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number" step="0.1" min="0" autoFocus
                        value={weightVal} onChange={e => setWeightVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveWeight()}
                        style={{ width: 64, boxSizing: 'border-box', padding: '5px 7px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                      />
                      <button onClick={saveWeight} disabled={saving || !weightVal}
                        style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {saving ? '…' : '✓'}
                      </button>
                    </div>
                  ) : (
                    <div onClick={startEdit} style={{ fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {athlete.weight ? `${athlete.weight} kg` : '—'}
                      <span style={{ fontSize: 12, color: 'var(--green)' }}>✏️</span>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Sexe</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[{ v: 'H', l: 'H' }, { v: 'F', l: 'F' }].map(o => (
                      <button key={o.v} onClick={() => saveSex(o.v)} style={{
                        flex: 1, padding: '5px 0', border: '1px solid ' + (athlete.sex === o.v ? 'var(--green)' : 'var(--border2)'),
                        borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        background: athlete.sex === o.v ? 'var(--green-light)' : 'var(--bg2)',
                        color: athlete.sex === o.v ? 'var(--green)' : 'var(--text2)',
                      }}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setShowSubscription(true)} style={{
              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
            }}>
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

            <button onClick={openPrograms} style={{
              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Programmes</span>
              <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
            </button>

            {athlete.strava_athlete_id ? (
              <button onClick={disconnectStrava} disabled={stravaBusy} style={{
                background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontSize: 20 }}>🟠</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
                  Strava
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', borderRadius: 10, padding: '2px 8px' }}>
                    Connecté
                  </span>
                </span>
                <span style={{ color: 'var(--text3)', fontSize: 12 }}>{stravaBusy ? '…' : 'Déconnecter'}</span>
              </button>
            ) : (
              <a href={`/api/strava/connect?token=${token}`} style={{
                background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', textDecoration: 'none',
              }}>
                <span style={{ fontSize: 20 }}>🟠</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Connecter Strava</span>
                <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
              </a>
            )}

            <button onClick={() => setShowMetrics(true)} style={{
              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>📈</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Metric</span>
              <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
            </button>

            <button onClick={() => setShowMealPlanner(true)} style={{
              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>🍽</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Générateur de plan alimentaire</span>
              <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
            </button>

            {recentRecords.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px' }}>
                {recentRecords.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.movement.name}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text2)', flexShrink: 0 }}>
                      {formatPerformance(r.movement, r.value)}
                    </span>
                    {r.prevValue !== null && (
                      <span style={{ color: '#16A34A', fontWeight: 700, flexShrink: 0 }}>
                        {(() => {
                          const cfg = unitOf(r.movement)
                          const pct = cfg.betterIsHigher
                            ? ((r.value - r.prevValue) / r.prevValue) * 100
                            : ((r.prevValue - r.value) / r.prevValue) * 100
                          return `+${Math.round(pct)}%`
                        })()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowSettings(true)}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', textAlign: 'left' }}
              >
                ⚙️ Paramètres
              </button>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', textAlign: 'left' }}
              >
                ⎋ Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubscription && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
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

      {showPrograms && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowPrograms(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Programmes disponibles</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {availablePrograms === null ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>Chargement…</div>
            ) : availablePrograms.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13 }}>Ton coach n&apos;a rendu aucun programme disponible pour l&apos;instant.</div>
              </div>
            ) : (
              availablePrograms.map(p => (
                <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10 }}>
                    {p.activity_type && <span>{p.activity_type}</span>}
                    <span>📅 {p.sessionCount} séance{p.sessionCount !== 1 ? 's' : ''}</span>
                  </div>
                  {p.description && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{p.description}</div>}
                  <button onClick={() => chooseProgram(p.id)} disabled={choosingId === p.id}
                    style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                    {choosingId === p.id ? '…' : '✓ Choisir ce programme'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showMetrics && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowMetrics(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Metric</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>🏅 Badges de force</div>
              <BadgesBlock athleteId={athlete.id} weight={athlete.weight} sex={athlete.sex} />
            </div>
            <TrackedMovementsBlock athleteId={athlete.id} isCoach={false} />
          </div>
        </div>
      )}

      {showMealPlanner && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowMealPlanner(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>🍽 Générateur de plan alimentaire</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16 }}>
            <MealPlannerWizard />
          </div>
        </div>
      )}

      {showSettings && <PasswordSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
