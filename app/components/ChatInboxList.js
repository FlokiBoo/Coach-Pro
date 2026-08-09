'use client'

export default function ChatInboxList({ threads, onSelect }) {
  if (!threads.length) {
    return <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>Aucun sportif pour l'instant</div>
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {threads.map(t => (
        <div key={t.athleteId} onClick={() => onSelect(t.athleteId)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {t.athleteName?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{t.athleteName}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.lastMessage || 'Aucun message'}
            </div>
          </div>
          {t.unreadCount > 0 && (
            <div style={{ background: '#DC2626', color: '#fff', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
              {t.unreadCount}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
