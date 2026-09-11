'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { bestPerformance } from './TrackedMovementsBlock'
import { BADGE_MOVEMENTS, BINARY_BADGE_MOVEMENTS, computeBadge } from '@/lib/badges'
import { CARDIO_BADGE_MOVEMENTS, computeCardioBadge } from '@/lib/cardioBadges'
import ForceRadarBlock from './ForceRadarBlock'

function calcAge(birthDate) {
  if (!birthDate) return null
  return (Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400000)
}

// Ne calcule/consomme que ce dont ForceRadarBlock a besoin (cards/cardioCards) — la vue détail à
// paliers (Bronze/Argent/Or…) qui vivait ici a été retirée, remplacée par la liste Lift/Gym/Cardio
// de TrackedMovementsBlock à côté du radar sur la page Performances.
export default function BadgesBlock({ athleteId, weight, badgeStandard, birthDate }) {
  const [cards, setCards] = useState(null)
  const [cardioCards, setCardioCards] = useState(null)
  const [binaryCards, setBinaryCards] = useState(null)
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

  return <ForceRadarBlock strengthCards={cards} cardioCards={cardioCards} />
}
