'use client'

import ObjectivesBlock from '@/app/components/ObjectivesBlock'
import WeeklyStatsBlock from '@/app/components/WeeklyStatsBlock'
import ProgressBlock from '@/app/components/ProgressBlock'

// Regroupe tout ce qui n'est pas "ma prochaine séance" (objectifs, distance/temps/bien-être,
// progressions de charge) — sorti du WOD pour que cette dernière reste consultable sans scroll.
export default function StatsTab({ athlete, objectives, setObjectives, isCoachView, activityRefreshKey }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {athlete?.id && <ObjectivesBlock athleteId={athlete.id} objectives={objectives} setObjectives={setObjectives} isCoach={isCoachView} />}
      <WeeklyStatsBlock athleteId={athlete.id} refreshKey={activityRefreshKey} />
      <ProgressBlock athleteId={athlete.id} />
    </div>
  )
}
