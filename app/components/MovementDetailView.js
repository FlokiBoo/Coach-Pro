'use client'

import { useState } from 'react'
import { estimate1RM, bestPerformance, unitOf, formatPerformance, ProgressChart, EntryForm, emptyEntryForm } from './TrackedMovementsBlock'

const RM_LIST = [1, 2, 3, 4, 5, 6]
const PERCENTAGES = [100, 95, 90, 85, 80, 75, 70, 65, 60, 50, 40, 30]

function bestRawForRep(entries, rep) {
  const vals = entries
    .map(e => (rep === 1 ? e.rm1 : e[`rm${rep}`]))
    .filter(v => v != null)
  return vals.length ? Math.max(...vals) : null
}

function formatDateFr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MovementDetailView({ movement, athleteId, onClose, onSaveEntry, onDeleteEntry }) {
  const isKg = movement.unit === 'kg' || !movement.unit
  const [tab, setTab] = useState('record') // 'record' | 'percent'
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyEntryForm())
  const [saving, setSaving] = useState(false)

  const entries = movement.entries || []
  const best = bestPerformance(movement, entries)
  const headline = best?.value ?? null
  const cfg = unitOf(movement)

  const rmValues = RM_LIST.map(r => bestRawForRep(entries, r))

  const historyEntries = isKg
    ? [...entries].filter(e => e.rm1 != null).sort((a, b) => b.date.localeCompare(a.date))
    : [...entries].filter(e => e.value != null).sort((a, b) => b.date.localeCompare(a.date))

  const save = async () => {
    setSaving(true)
    await onSaveEntry(movement, form)
    setSaving(false)
    setAdding(false)
    setForm(emptyEntryForm())
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{movement.name}</div>
        <button onClick={() => setAdding(v => !v)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          + Ajouter
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {adding && (
          <EntryForm movement={movement} form={form} setForm={setForm} onCancel={() => setAdding(false)} onSave={save} saving={saving} />
        )}

        {isKg && (
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', borderRadius: 20, padding: 3, border: '1px solid var(--border)' }}>
            <button onClick={() => setTab('record')} style={{
              flex: 1, padding: '9px 0', borderRadius: 18, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: tab === 'record' ? 'var(--bg)' : 'transparent', color: tab === 'record' ? 'var(--text)' : 'var(--text3)',
              boxShadow: tab === 'record' ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}>Record</button>
            <button onClick={() => setTab('percent')} style={{
              flex: 1, padding: '9px 0', borderRadius: 18, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: tab === 'percent' ? 'var(--bg)' : 'transparent', color: tab === 'percent' ? 'var(--text)' : 'var(--text3)',
              boxShadow: tab === 'percent' ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}>% Charges</button>
          </div>
        )}

        {!isKg || tab === 'record' ? (
          <>
            {isKg && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 10 }}>
                {RM_LIST.map((r, i) => {
                  const val = r === 1 ? headline : rmValues[i]
                  const isMain = r === 1
                  return (
                    <div key={r} style={{
                      textAlign: 'center', padding: '10px 2px', borderRadius: 'var(--r)',
                      background: isMain ? 'var(--green-light)' : 'transparent',
                    }}>
                      <div style={{ fontSize: isMain ? 20 : 15, fontWeight: 800, color: isMain ? 'var(--green)' : (val != null ? 'var(--text)' : 'var(--text3)') }}>
                        {val != null ? val : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{r}RM</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Gros chiffre */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>
                {headline != null ? formatPerformance(movement, headline) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {isKg
                  ? (best?.estimated ? `1RM estimé (à partir du ${best.from}RM)` : headline != null ? '1RM réel' : 'Aucune donnée')
                  : headline != null ? (cfg.betterIsHigher ? 'Meilleure performance' : 'Meilleur temps') : 'Aucune donnée'}
              </div>
            </div>

            <ProgressChart movement={movement} entries={entries} />

            {/* Historique */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Historique</div>
              {historyEntries.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                  {isKg ? "Aucun 1RM enregistré directement — l'estimation ci-dessus se base sur tes 2-6RM." : 'Aucune performance enregistrée pour le moment.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {historyEntries.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                      <span style={{ background: 'var(--text)', color: 'var(--bg)', fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '3px 7px', flexShrink: 0 }}>
                        {isKg ? '1 RM' : cfg.suffix.toUpperCase() || 'PR'}
                      </span>
                      <div style={{ flex: 1, fontSize: 13, color: 'var(--text2)' }}>{formatDateFr(e.date)}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                        {isKg ? `${e.rm1} kg` : formatPerformance(movement, e.value)}
                      </div>
                      {onDeleteEntry && (
                        <button onClick={() => onDeleteEntry(e.id)} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {headline == null ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', fontSize: 13 }}>
                Enregistre au moins une valeur pour voir les charges par pourcentage.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 12 }}>
                {PERCENTAGES.map(p => {
                  const kg = Math.round(headline * (p / 100) * 2) / 2
                  const isCurrent = p === 100
                  return (
                    <div key={p} style={{
                      textAlign: 'center', padding: '12px 4px', borderRadius: 'var(--r)',
                      background: isCurrent ? 'var(--green-light)' : 'var(--bg2)',
                      border: isCurrent ? '1px solid #B8EAD8' : '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isCurrent ? 'var(--green)' : 'var(--text)' }}>{p}%</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? 'var(--green)' : 'var(--text2)', marginTop: 2 }}>{kg}kg</div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
