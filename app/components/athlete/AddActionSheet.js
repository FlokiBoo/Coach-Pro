'use client'

import { useState } from 'react'
import { PersonSimpleRun, Lightning, Barbell, Heartbeat, CaretLeft } from '@phosphor-icons/react'

export default function AddActionSheet({ onClose, onAddActivity, onFreeSession }) {
  // "Séance libre" ouvre un second niveau (Standard/Cardio) avant de créer la séance — même choix
  // que côté coach (voir app/programs/.../page.js), pour qu'une séance de course créée par le
  // sportif propose directement les mouvements Run/Row/Ski Erg/Bike plutôt que la bibliothèque force.
  const [choosingMode, setChoosingMode] = useState(false)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 600, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '20px 16px', width: '100%', maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 8px' }} />

        {!choosingMode ? (
          <>
            <button onClick={onAddActivity} style={{
              display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--rl)', padding: '16px', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ display: 'flex' }}><PersonSimpleRun size={24} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Ajouter une activité</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Choisis une discipline, note ton bien-être et tes résultats</div>
              </div>
            </button>

            <button onClick={() => setChoosingMode(true)} style={{
              display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--rl)', padding: '16px', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ display: 'flex' }}><Lightning size={24} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Séance libre</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Ajoute des exercices et note tes performances</div>
              </div>
            </button>

            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 0', textAlign: 'center' }}>
              Annuler
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setChoosingMode(false)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
              color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 0 4px', alignSelf: 'flex-start',
            }}>
              <CaretLeft size={14} /> Retour
            </button>

            <button onClick={() => onFreeSession('standard')} style={{
              display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--rl)', padding: '16px', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ display: 'flex' }}><Barbell size={24} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Standard</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Musculation, circuit... choisis librement dans le catalogue</div>
              </div>
            </button>

            <button onClick={() => onFreeSession('cardio')} style={{
              display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--rl)', padding: '16px', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ display: 'flex' }}><Heartbeat size={24} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Cardio</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Course, rameur, ski erg... avec une allure en % VMA/Seuil</div>
              </div>
            </button>

            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 0', textAlign: 'center' }}>
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  )
}
