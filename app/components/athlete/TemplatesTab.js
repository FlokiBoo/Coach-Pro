'use client'

import { useState, useEffect } from 'react'

export default function TemplatesTab({ token, programs = [], setActiveTab }) {
  const [availablePrograms, setAvailablePrograms] = useState(null)
  const [choosingId, setChoosingId] = useState(null)
  const [selectedType, setSelectedType] = useState('')
  const [conflict, setConflict] = useState(null) // { newProgram, existingProgram }
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    fetch(`/api/athlete-view/${token}/available-programs`, { cache: 'no-store' })
      .then(res => res.json()).catch(() => ({ programs: [] }))
      .then(({ programs }) => setAvailablePrograms(programs || []))
  }, [token])

  const selectProgram = async (programId) => {
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

  // Retour terrain (coach) : cumuler deux programmes du même type (ex: deux plans de running)
  // n'a pas de sens — l'un des deux ne sera jamais suivi correctement. On prévient avant de
  // confirmer plutôt que de laisser l'athlète le découvrir en pleine confusion dans son WOD.
  const chooseProgram = (p) => {
    const existing = programs.find(existing => !existing.archived && p.activity_type && existing.activity_type === p.activity_type)
    if (existing) { setConflict({ newProgram: p, existingProgram: existing }); return }
    selectProgram(p.id)
  }

  const stopExistingAndChoose = async () => {
    if (!conflict) return
    setArchiving(true)
    const res = await fetch(`/api/athlete-view/${token}/archive-program`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: conflict.existingProgram.id }),
    })
    const json = await res.json().catch(() => ({}))
    setArchiving(false)
    if (json.error) { alert('Erreur : ' + json.error); return }
    const newProgram = conflict.newProgram
    setConflict(null)
    selectProgram(newProgram.id)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Programmes</div>

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
            <button onClick={() => chooseProgram(p)} disabled={choosingId === p.id}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
              {choosingId === p.id ? '…' : '✓ Choisir ce programme'}
            </button>
          </div>
          ))}
        </>
      )}

      {conflict && (
        <div onClick={() => !archiving && setConflict(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>🤔</div>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 17, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
              Tu as déjà un programme {conflict.existingProgram.activity_type}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18, textAlign: 'center', lineHeight: 1.5 }}>
              « {conflict.existingProgram.title} » est en cours. Cumuler deux programmes {conflict.existingProgram.activity_type} en même temps n&apos;est pas une bonne idée — l&apos;un des deux ne sera pas suivi correctement.
            </div>
            <button onClick={() => { setConflict(null); setActiveTab?.('profil') }} style={{
              background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '11px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 8,
            }}>
              💬 Écrire à mon coach pour en discuter
            </button>
            <button onClick={stopExistingAndChoose} disabled={archiving} style={{
              background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '11px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 8,
            }}>
              {archiving ? '…' : `Arrêter « ${conflict.existingProgram.title} » et prendre celui-ci`}
            </button>
            <button onClick={() => setConflict(null)} disabled={archiving} style={{
              background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', padding: 6,
            }}>
              Continuer mon programme actuel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
