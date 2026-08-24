'use client'

const TABS = [
  { key: 'wod', label: 'WOD', icon: '📊' },
  { key: 'templates', label: 'Templates', icon: '📋' },
]
const TABS_RIGHT = [
  { key: 'pr', label: 'PR', icon: '🏆' },
  { key: 'profil', label: 'Profil', icon: '👤' },
]

export default function AthleteTabBar({ active, onChange, onAdd, addActive = false }) {
  const renderTab = (t) => {
    const isActive = active === t.key
    return (
      <button key={t.key} onClick={() => onChange(t.key)} style={{
        flex: 1, background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '10px 4px 8px', color: isActive ? 'var(--green)' : 'var(--text3)',
      }}>
        <span style={{ fontSize: 19, lineHeight: 1, opacity: isActive ? 1 : 0.7 }}>{t.icon}</span>
        <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{t.label}</span>
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
      background: 'var(--bg)', borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', paddingBottom: 'env(safe-area-inset-bottom)',
      maxWidth: 480, margin: '0 auto',
    }}>
      {TABS.map(renderTab)}

      <button onClick={onAdd} style={{
        flex: '0 0 auto', width: 48, height: 48, borderRadius: '50%', margin: '0 6px',
        background: addActive ? 'var(--green-light)' : 'var(--green)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: addActive ? 'var(--green)' : '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }} aria-label="Ajouter">
        +
      </button>

      {TABS_RIGHT.map(renderTab)}
    </div>
  )
}
