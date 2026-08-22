'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { bestPerformance } from './TrackedMovementsBlock'
import { BADGE_MOVEMENTS, TIER_STYLES, computeBadge } from '@/lib/badges'

export default function BadgesBlock({ athleteId, weight, sex }) {
  const [cards, setCards] = useState(null)

  useEffect(() => { load() }, [athleteId, weight, sex])

  async function load() {
    if (!weight) { setCards([]); return }
    const names = BADGE_MOVEMENTS.map(m => m.name)
    const { data: movements } = await supabase.from('tracked_movements').select('id, name, unit').in('name', names)
    const movByName = {}
    ;(movements || []).forEach(m => { movByName[m.name] = m })

    const movementIds = (movements || []).map(m => m.id)
    const { data: entries } = movementIds.length
      ? await supabase.from('tracked_movement_entries').select('*').eq('athlete_id', athleteId).in('tracked_movement_id', movementIds)
      : { data: [] }

    const result = BADGE_MOVEMENTS.map(bm => {
      const mov = movByName[bm.name]
      if (!mov) return { name: bm.name, missing: true }
      const movEntries = (entries || []).filter(e => e.tracked_movement_id === mov.id)
      const best = bestPerformance(mov, movEntries)
      if (!best) return { name: bm.name, noData: true }
      const pct = (best.value / weight) * 100
      const badge = computeBadge(pct, bm.thresholds, sex)
      return { name: bm.name, value: best.value, pct, ...badge }
    })
    setCards(result)
  }

  if (cards === null) return (
    <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Chargement…</div>
  )

  if (!weight) {
    return (
      <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
        Renseigne ton poids (dans ton profil) pour débloquer tes badges de force.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cards.map(card => {
        if (card.missing) return null
        if (card.noData) {
          return (
            <div key={card.name} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{card.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Pas encore de test enregistré pour ce mouvement</div>
            </div>
          )
        }
        const currentStyle = card.current ? TIER_STYLES[card.current.key] : null
        const nextStyle = card.next ? TIER_STYLES[card.next.key] : null
        const barColor = nextStyle?.color || currentStyle?.color || 'var(--green)'
        return (
          <div key={card.name} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{card.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{card.value}kg · {Math.round(card.pct)}% PDC ({weight}kg)</div>
              </div>
              {currentStyle ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: currentStyle.bg, borderRadius: 20, padding: '5px 12px', flexShrink: 0 }}>
                  <span style={{ fontSize: 13 }}>{currentStyle.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: currentStyle.color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{currentStyle.label}</span>
                </div>
              ) : (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>Pas encore de palier</div>
              )}
            </div>
            <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${card.progress}%`, background: barColor, borderRadius: 20, transition: 'width .4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{card.value}kg</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {card.next
                  ? <>{nextStyle.emoji} {nextStyle.label} à {Math.round((card.next.pct / 100) * weight)}kg — encore {Math.max(0, Math.round((card.next.pct / 100) * weight - card.value))}kg</>
                  : '🎉 Palier maximum atteint'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
