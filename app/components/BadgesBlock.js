'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Barbell } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { bestPerformance, formatTime } from './TrackedMovementsBlock'
import { BADGE_MOVEMENTS, BINARY_BADGE_MOVEMENTS, TIER_STYLES, computeBadge } from '@/lib/badges'
import { CARDIO_BADGE_MOVEMENTS, computeCardioBadge } from '@/lib/cardioBadges'
import ForceRadarBlock from './ForceRadarBlock'

function calcAge(birthDate) {
  if (!birthDate) return null
  return (Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400000)
}

function BadgeCard({ name, subtitle, footerValue, current, next, progress, nextHint, noData, noStandard }) {
  if (noData) {
    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Pas encore de test enregistré pour ce mouvement</div>
      </div>
    )
  }
  if (noStandard) {
    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>{footerValue}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginTop: 8 }}>
          Choisis une base de comparaison (Homme/Femme) dans ton profil pour voir ce badge.
        </div>
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

function BinaryBadgeCard({ name, acquired }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
      {acquired ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0D6B4F', background: '#DDF3EA', borderRadius: 20, padding: '5px 12px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> Acquis</span>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 20, padding: '5px 12px', flexShrink: 0 }}>Pas encore acquis</span>
      )}
    </div>
  )
}

export default function BadgesBlock({ athleteId, weight, badgeStandard, birthDate }) {
  const [cards, setCards] = useState(null)
  const [cardioCards, setCardioCards] = useState(null)
  const [binaryCards, setBinaryCards] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const age = calcAge(birthDate)

  useEffect(() => { load() }, [athleteId, weight, badgeStandard, birthDate])

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
        const mode = bm.mode || 'pct'
        const compareValue = mode === 'reps' ? best.value : (best.value / weight) * 100
        // Pas de badge sans base de comparaison explicite : mieux vaut ne rien afficher plutôt
        // que de retomber silencieusement sur "Homme" par défaut pour qui a choisi de ne pas
        // se comparer (ou qui ne se reconnaît pas dans H/F).
        const badge = badgeStandard ? computeBadge(compareValue, bm.thresholds, badgeStandard) : null
        return { name: bm.name, mode, value: best.value, noStandard: !badgeStandard, ...badge }
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
        const badge = badgeStandard ? computeCardioBadge(best.value, age, cm.table, badgeStandard) : null
        return { name: cm.name, value: best.value, noStandard: !badgeStandard, ...badge }
      })
      setCardioCards(cardioResult)
    } else {
      setCardioCards([])
    }

    const binaryNames = BINARY_BADGE_MOVEMENTS.map(m => m.name)
    const { data: binaryMovements } = await supabase.from('tracked_movements').select('id, name, unit').in('name', binaryNames)
    const binaryMovByName = {}
    ;(binaryMovements || []).forEach(m => { binaryMovByName[m.name] = m })

    const binaryMovementIds = (binaryMovements || []).map(m => m.id)
    const { data: binaryEntries } = binaryMovementIds.length
      ? await supabase.from('tracked_movement_entries').select('*').eq('athlete_id', athleteId).in('tracked_movement_id', binaryMovementIds)
      : { data: [] }

    const binaryResult = BINARY_BADGE_MOVEMENTS.map(bm => {
      const mov = binaryMovByName[bm.name]
      if (!mov) return { name: bm.name, missing: true }
      const movEntries = (binaryEntries || []).filter(e => e.tracked_movement_id === mov.id)
      const best = bestPerformance(mov, movEntries)
      return { name: bm.name, acquired: !!best && best.value >= 1 }
    })
    setBinaryCards(binaryResult)
  }

  if (cards === null || cardioCards === null || binaryCards === null) return (
    <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Chargement…</div>
  )

  const hasStrength = cards.some(c => !c.missing)
  const hasCardio = cardioCards.some(c => !c.missing)
  const hasBinary = binaryCards.some(c => !c.missing)

  if (!hasStrength && !hasCardio && !hasBinary) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ForceRadarBlock strengthCards={cards} cardioCards={cardioCards} onOpen={() => setShowDetail(true)} />

      {showDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowDetail(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><Barbell size={17} /> Force par muscle</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hasStrength && !weight && (
              <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                Renseigne ton poids (dans ton profil) pour débloquer tes badges de force.
              </div>
            )}

            {weight && cards.map(card => {
              if (card.missing) return null
              const isReps = card.mode === 'reps'
              const pct = !card.noData && !isReps ? (card.value / weight) * 100 : null
              return (
                <BadgeCard key={card.name} name={card.name} noData={card.noData} noStandard={card.noStandard}
                  subtitle={!card.noData ? (isReps ? `${card.value} reps` : `${card.value}kg · ${Math.round(pct)}% PDC (${weight}kg)`) : null}
                  footerValue={!card.noData ? (isReps ? `${card.value} reps` : `${card.value}kg`) : null}
                  current={card.current} next={card.next} progress={card.progress}
                  nextHint={card.next
                    ? (isReps
                      ? `à ${card.next.value} reps — encore ${Math.max(0, card.next.value - card.value)} reps`
                      : `à ${Math.round((card.next.value / 100) * weight)}kg — encore ${Math.max(0, Math.round((card.next.value / 100) * weight - card.value))}kg`)
                    : null}
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
                <BadgeCard key={card.name} name={card.name} noData={card.noData} noStandard={card.noStandard}
                  subtitle={!card.noData ? formatTime(card.value) : null}
                  footerValue={!card.noData ? formatTime(card.value) : null}
                  current={card.current} next={card.next} progress={card.progress}
                  nextHint={card.next ? `en ${formatTime(card.next.seconds)} — encore ${formatTime(Math.max(0, card.value - card.next.seconds))}` : null}
                />
              )
            })}

            {binaryCards.map(card => card.missing ? null : (
              <BinaryBadgeCard key={card.name} name={card.name} acquired={card.acquired} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
