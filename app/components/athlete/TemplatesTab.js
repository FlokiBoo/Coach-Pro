'use client'

import { useState, useEffect } from 'react'

export default function TemplatesTab({ token }) {
  const [availablePrograms, setAvailablePrograms] = useState(null)
  const [choosingId, setChoosingId] = useState(null)
  const [selectedType, setSelectedType] = useState('')

  useEffect(() => {
    fetch(`/api/athlete-view/${token}/available-programs`, { cache: 'no-store' })
      .then(res => res.json()).catch(() => ({ programs: [] }))
      .then(({ programs }) => setAvailablePrograms(programs || []))
  }, [token])

  const chooseProgram = async (programId) => {
    setChoosingId(programId)
    const res = await fetch(`/api/athlete-view/${token}/available-programs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId }),
    })
    const json = await res.json().catch(() => ({}))
    setChoosingId(null)
    if (json.error) { alert('Erreur : ' + json.error); return }
    window.location.reload()
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Templates</div>

      {availablePrograms === null ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>Chargement…</div>
      ) : availablePrograms.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 13 }}>Ton coach n&apos;a rendu aucun programme disponible pour l&apos;instant.</div>
        </div>
      ) : (
        <>
          {(() => {
            const types = [...new Set(availablePrograms.map(p => p.activity_type).filter(Boolean))]
            if (types.length < 2) return null
            return (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 2 }}>
                {['', ...types].map(t => (
                  <button key={t || 'all'} onClick={() => setSelectedType(t)} style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: selectedType === t ? 'var(--green)' : 'var(--bg)',
                    color: selectedType === t ? '#fff' : 'var(--text2)',
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {t || 'Tous'}
                  </button>
                ))}
              </div>
            )
          })()}

          {availablePrograms.filter(p => !selectedType || p.activity_type === selectedType).map(p => (
          <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10 }}>
              {p.activity_type && <span>{p.activity_type}</span>}
              <span>📅 {p.sessionCount} séance{p.sessionCount !== 1 ? 's' : ''}</span>
            </div>
            {p.description && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{p.description}</div>}
            <button onClick={() => chooseProgram(p.id)} disabled={choosingId === p.id}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
              {choosingId === p.id ? '…' : '✓ Choisir ce programme'}
            </button>
          </div>
          ))}
        </>
      )}
    </div>
  )
}
