'use client'

import TrackedMovementsBlock from '@/app/components/TrackedMovementsBlock'

export default function PrTab({ athleteId }) {
  return (
    <div style={{ padding: 16 }}>
      <TrackedMovementsBlock athleteId={athleteId} isCoach={false} />
    </div>
  )
}
