'use client'

export default function AddActionSheet({ onClose, onAddActivity, onFreeSession }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 600, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '20px 16px', width: '100%', maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 8px' }} />

        <button onClick={onAddActivity} style={{
          display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--rl)', padding: '16px', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 24 }}>🏃</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Ajouter une activité</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Choisis une discipline, note ton bien-être et tes résultats</div>
          </div>
        </button>

        <button onClick={onFreeSession} style={{
          display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--rl)', padding: '16px', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 24 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Séance libre</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Ajoute des exercices et note tes performances</div>
          </div>
        </button>

        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 0', textAlign: 'center' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
