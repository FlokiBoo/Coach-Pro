'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getWeekRange, buildWeekRecapData, WeekRecapModal } from './WeeklyStatsBlock'

// Fenêtre d'affichage : dimanche 18h → mardi 22h (dimanche jusqu'à minuit, lundi toute la
// journée, mardi jusqu'à 22h) — voulu pour donner envie de partager le bilan en story pendant
// que la semaine est encore fraîche, sans harceler le reste de la semaine.
function isInPopupWindow(now) {
  const day = now.getDay() // 0 = dimanche, 1 = lundi, 2 = mardi
  if (day === 0) return now.getHours() >= 18
  if (day === 1) return true
  if (day === 2) return now.getHours() < 22
  return false
}

// La semaine à montrer est celle qui vient de se terminer. Dimanche soir, c'est la semaine en
// cours (getWeekRange calcule lundi→dimanche, donc offset 0 tombe pile sur "cette semaine, qui
// se termine aujourd'hui"). Lundi/mardi, la semaine en cours vient de commencer — on vise donc
// la précédente (offset -1).
function targetWeekOffset(now) {
  return now.getDay() === 0 ? 0 : -1
}

// Affiche automatiquement, à la première connexion de la fenêtre dimanche 18h → mardi 22h, le
// même récap hebdomadaire que le bouton "Récap de la semaine" (voir WeeklyStatsBlock) — pour
// donner envie de le partager en story pendant qu'il est encore chaud. `athlete.weekly_recap_shown_for`
// (date du lundi de la semaine déjà montrée) évite de le réafficher une fois fermé/partagé,
// jusqu'à la semaine suivante.
export default function WeeklyRecapPopup({ athlete, onSeen }) {
  const [data, setData] = useState(null) // { start, ...propsWeekRecapModal } | null

  const markSeen = async (weekStart) => {
    await supabase.from('athletes').update({ weekly_recap_shown_for: weekStart }).eq('id', athlete.id)
    onSeen?.(weekStart)
  }

  useEffect(() => {
    if (!athlete?.id) return
    const now = new Date()
    if (!isInPopupWindow(now)) return

    const { start, end } = getWeekRange(targetWeekOffset(now))
    if (athlete.weekly_recap_shown_for === start) return

    let cancelled = false
    buildWeekRecapData(athlete.id, start, end).then(recap => {
      if (cancelled) return
      if (!recap.hasAny) {
        // Rien à montrer/partager cette semaine-là — on marque quand même comme "vu" pour ne
        // pas refaire ce fetch à chaque chargement de page dans la fenêtre.
        markSeen(start)
        return
      }
      setData({ start, ...recap })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id, athlete?.weekly_recap_shown_for])

  if (!data) return null

  const close = () => { markSeen(data.start); setData(null) }

  return (
    <WeekRecapModal
      mode="week"
      periodLabel={data.periodLabel}
      bigStats={data.bigStats}
      activityLabels={data.activityLabels}
      kmByLabel={data.kmByLabel}
      durByLabel={data.durByLabel}
      countByLabel={data.countByLabel}
      progressions={data.progressions}
      wellnessAvg={data.wellnessAvg}
      feedbackAvg={data.feedbackAvg}
      onClose={close}
      onShare={() => markSeen(data.start)}
    />
  )
}
