'use client'

import { ForkKnife } from '@phosphor-icons/react'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import MealPlannerWizard from '@/app/components/MealPlannerWizard'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

export default function MealPlannerPage() {
  return (
    <div className="coach-layout">
      <AthletesSidebar athleteId={null} date={today()} />

      <main className="coach-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        <div style={{ padding: '18px 24px 0', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 19, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><ForkKnife size={18} /> Générateur de plan repas</div>
        </div>

        <div style={{ flex: 1, padding: '0 24px 24px', overflowY: 'auto' }}>
          <MealPlannerWizard />
        </div>

      </main>
    </div>
  )
}
