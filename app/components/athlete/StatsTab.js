'use client'

import WeeklyStatsBlock from '@/app/components/WeeklyStatsBlock'
import ProgressBlock from '@/app/components/ProgressBlock'

// Regroupe distance/temps/bien-être et progressions de charge — "Objectifs" a rejoint le WOD
// (carte "Séance du jour" en tête), plus consulté ici.
export default function StatsTab({ athlete, activityRefreshKey }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <WeeklyStatsBlock athleteId={athlete.id} refreshKey={activityRefreshKey} />
      <ProgressBlock athleteId={athlete.id} />
    </div>
  )
}
