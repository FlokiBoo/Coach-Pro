'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { bestPerformance, formatTime } from './TrackedMovementsBlock'
import { BADGE_MOVEMENTS, TIER_STYLES, computeBadge } from '@/lib/badges'
import { CARDIO_BADGE_MOVEMENTS, computeCardioBadge } from '@/lib/cardioBadges'

function calcAge(birthDate) {
  if (!birthDate) return null
  return (Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400000)
}

function BadgeCard({ name, subtitle, footerValue, current, next, progress, nextHint, noData }) {
  if (noData) {
    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Pas encore de test enregistré pour ce mouvement</div>
      </div>
    )
  }
  const currentStyle = current ? TIER_STYLES[current.key] : null
  const nextStyle = next ? TIER_STYLES[next.key] : null
  const barColor = nextStyle?.color || currentStyle?.color || 'var(--green)'
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</div>
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
        <div style={{ height: '100%', width: `${progress}%`, background: barColor, borderRadius: 20, transition: 'width .4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{footerValue}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {next
            ? <>{nextStyle.emoji} {nextStyle.label} — {nextHint}</>
            : '🎉 Palier maximum atteint'}
        </span>
      </div>
    </div>
  )
}

export default function BadgesBlock({ athleteId, weight, sex, birthDate }) {
  const [cards, setCards] = useState(null)
  const [cardioCards, setCardioCards] = useState(null)
  const age = calcAge(birthDate)

  useEffect(() => { load() }, [athleteId, weight, sex, birthDate])

  async function load() {
    if (weight) {
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
    } else {
      setCards([])
    }

    if (age != null) {
      const cardioNames = CARDIO_BADGE_MOVEMENTS.map(m => m.name)
      const { data: cardioMovements } = await supabase.from('tracked_movements').select('id, name, unit').in('name', cardioNames)
      const cardioMovByName = {}
      ;(cardioMovements || []).forEach(m => { cardioMovByName[m.name] = m })

      const cardioMovementIds = (cardioMovements || []).map(m => m.id)
      const { data: cardioEntries } = cardioMovementIds.length
        ? await supabase.from('tracked_movement_entries').select('*').eq('athlete_id', athleteId).in('tracked_movement_id', cardioMovementIds)
        : { data: [] }

      const cardioResult = CARDIO_BADGE_MOVEMENTS.map(cm => {
        const mov = cardioMovByName[cm.name]
        if (!mov) return { name: cm.name, missing: true }
        const movEntries = (cardioEntries || []).filter(e => e.tracked_movement_id === mov.id)
        const best = bestPerformance(mov, movEntries)
        if (!best) return { name: cm.name, noData: true }
        const badge = computeCardioBadge(best.value, age, cm.table, sex)
        return { name: cm.name, value: best.value, ...badge }
      })
      setCardioCards(cardioResult)
    } else {
      setCardioCards([])
    }
  }

  if (cards === null || cardioCards === null) return (
    <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Chargement…</div>
  )

  const hasStrength = cards.some(c => !c.missing)
  const hasCardio = cardioCards.some(c => !c.missing)

  if (!hasStrength && !hasCardio) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {hasStrength && !weight && (
        <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
          Renseigne ton poids (dans ton profil) pour débloquer tes badges de force.
        </div>
      )}

      {weight && cards.map(card => {
        if (card.missing) return null
        return (
          <BadgeCard key={card.name} name={card.name} noData={card.noData}
            subtitle={!card.noData ? `${card.value}kg · ${Math.round(card.pct)}% PDC (${weight}kg)` : null}
            footerValue={!card.noData ? `${card.value}kg` : null}
            current={card.current} next={card.next} progress={card.progress}
            nextHint={card.next ? `à ${Math.round((card.next.pct / 100) * weight)}kg — encore ${Math.max(0, Math.round((card.next.pct / 100) * weight - card.value))}kg` : null}
          />
        )
      })}

      {hasCardio && age == null && (
        <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
          Renseigne ta date de naissance (dans ton profil) pour débloquer tes badges cardio.
        </div>
      )}

      {age != null && cardioCards.map(card => {
        if (card.missing) return null
        return (
          <BadgeCard key={card.name} name={card.name} noData={card.noData}
            subtitle={!card.noData ? formatTime(card.value) : null}
            footerValue={!card.noData ? formatTime(card.value) : null}
            current={card.current} next={card.next} progress={card.progress}
            nextHint={card.next ? `en ${formatTime(card.next.seconds)} — encore ${formatTime(Math.max(0, card.value - card.next.seconds))}` : null}
          />
        )
      })}
    </div>
  )
}
