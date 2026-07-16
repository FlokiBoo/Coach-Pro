'use client'

import { useEffect } from 'react'

export default function Toast({ message, show, onDone }) {
  useEffect(() => {
    if (!show) return
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [show, onDone])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#16A34A', color: '#fff', padding: '10px 18px', borderRadius: 999,
      fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
    }}>
      ✓ {message}
    </div>
  )
}
