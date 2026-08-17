'use client'

import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

export default function AssistantPage() {
  return (
    <div className="coach-layout">
      <AthletesSidebar athleteId={null} date={today()} />

      <main className="coach-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🤖 Assistant IA</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Idées de séances, conseils nutrition, aide à la rédaction…</div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 15, fontWeight: 700 }}>À venir</div>
        </div>
      </main>
    </div>
  )
}
