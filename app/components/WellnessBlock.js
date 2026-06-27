'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const METRICS = [
  { key: 'sommeil',     label: 'Sommeil',     emoji: '🌙', inverse: false },
  { key: 'stress',      label: 'Stress',      emoji: '😰', inverse: true  },
  { key: 'courbatures', label: 'Courbatures', emoji: '💪', inverse: true  },
  { key: 'forme',       label: 'Forme',       emoji: '⚡', inverse: false },
]

function scoreColor(val, inverse) {
  if (!val) return 'var(--text3)'
  const s = inverse ? (11 - val) : val
  if (s >= 7) return '#22c55e'
  if (s >= 4) return '#f59e0b'
  return '#ef4444'
}

// Résumé compact une ligne (lecture seule)
function WellnessSummary({ data, suffix = '' }) {
  const filled = METRICS.filter(m => data?.[m.key + suffix])
  if (!filled.length) return (
    <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Non rempli</span>
  )
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {METRICS.map(m => {
        const v = data?.[m.key + suffix]
        if (!v) return null
        return (
          <span key={m.key} style={{ fontSize: 13, fontWeight: 700, color: scoreColor(v, m.inverse) }}>
            {m.emoji} {v}
          </span>
        )
      })}
    </div>
  )
}

export default function WellnessBlock({ athleteId, date, mode, athleteName }) {
  const [row, setRow] = useState(null) // null = loading, {} = no data, {...} = data
  const [saving, setSaving] = useState(false)
  const suffix = mode === 'coach' ? '_coach' : ''

  useEffect(() => {
    setRow(null)
    supabase.from('wellness').select('*')
      .eq('athlete_id', athleteId).eq('date', date).maybeSingle()
      .then(({ data }) => setRow(data || {}))
  }, [athleteId, date])

  const set = async (key, val) => {
    const field = key + suffix
    // Toggle : reclique sur la même valeur = effacer
    const newVal = row?.[field] === val ? null : val
    const updated = { ...(row || {}), athlete_id: athleteId, date, [field]: newVal }
    setRow(updated)
    setSaving(true)
    await supabase.from('wellness')
      .upsert({ athlete_id: athleteId, date, [field]: newVal }, { onConflict: 'athlete_id,date' })
    setSaving(false)
  }

  if (row === null) return null

  const vals = {}
  METRICS.forEach(m => { vals[m.key] = row[m.key + suffix] ?? null })

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '10px 12px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {mode === 'coach' ? 'Mon évaluation' : 'Bien-être du jour'}
        </div>
        {saving && <div style={{ fontSize: 10, color: 'var(--text3)' }}>…</div>}
      </div>

      {/* Vue sportif en lecture seule (côté coach uniquement) */}
      {mode === 'coach' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 'var(--r)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', flexShrink: 0 }}>
            {athleteName || 'Sportif'} :
          </span>
          <WellnessSummary data={row} suffix="" />
        </div>
      )}

      {/* Sélecteurs 1–10 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {METRICS.map(m => (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 86, fontSize: 12, fontWeight: 600, color: 'var(--text2)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {m.emoji} {m.label}
            </div>
            <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => {
                const active = vals[m.key] === n
                return (
                  <button key={n} onClick={() => set(m.key, n)} style={{
                    width: 27, height: 27, borderRadius: 6,
                    border: active ? 'none' : '1px solid var(--border2)',
                    background: active ? scoreColor(n, m.inverse) : 'var(--bg2)',
                    color: active ? '#fff' : 'var(--text3)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}>{n}</button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
