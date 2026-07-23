'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import TrackedMovementsBlock from './TrackedMovementsBlock'
import FaimSatieteBlock from './FaimSatieteBlock'

export default function AthleteSidePanel({ athlete, onWeightUpdate }) {
  const [open, setOpen] = useState(false)
  const [editingWeight, setEditingWeight] = useState(false)
  const [weightVal, setWeightVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [showFaimSat, setShowFaimSat] = useState(false)

  const startEdit = () => {
    setWeightVal(athlete?.weight ?? '')
    setEditingWeight(true)
  }

  const saveWeight = async () => {
    if (!weightVal || !athlete) return
    setSaving(true)
    const { error } = await supabase.from('athletes').update({ weight: parseFloat(weightVal) }).eq('id', athlete.id)
    if (!error) {
      onWeightUpdate?.(parseFloat(weightVal))
      setEditingWeight(false)
    }
    setSaving(false)
  }

  if (!athlete) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 20, left: 16, zIndex: 250,
          background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: '50%',
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}
        aria-label="Mon profil"
      >
        👤
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 400 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: '88%', maxWidth: 380,
            background: 'var(--bg2)', boxShadow: '2px 0 24px rgba(0,0,0,.25)', overflowY: 'auto',
            padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontWeight: 800, fontSize: 18 }}>{athlete.name}</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>×</button>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Taille</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{athlete.height ? `${athlete.height} cm` : '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Poids</div>
                  {editingWeight ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number" step="0.1" min="0" autoFocus
                        value={weightVal} onChange={e => setWeightVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveWeight()}
                        style={{ width: 64, boxSizing: 'border-box', padding: '5px 7px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                      />
                      <button onClick={saveWeight} disabled={saving || !weightVal}
                        style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {saving ? '…' : '✓'}
                      </button>
                    </div>
                  ) : (
                    <div onClick={startEdit} style={{ fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {athlete.weight ? `${athlete.weight} kg` : '—'}
                      <span style={{ fontSize: 12, color: 'var(--green)' }}>✏️</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <TrackedMovementsBlock athleteId={athlete.id} isCoach={false} />

            <button onClick={() => setShowFaimSat(true)} style={{
              background: '#12181c', color: '#eef0ee', border: '1px solid #2c363c', borderRadius: 'var(--rl)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>🍽️</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Faim & Satiété</span>
              <span style={{ color: '#7c8a90', fontSize: 18 }}>›</span>
            </button>
          </div>
        </div>
      )}

      {showFaimSat && (
        <div style={{ position: 'fixed', inset: 0, background: '#12181c', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#1c252b', borderBottom: '1px solid #2c363c', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowFaimSat(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#eef0ee', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17, color: '#eef0ee' }}>Faim & Satiété</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16 }}>
            <FaimSatieteBlock />
          </div>
        </div>
      )}
    </>
  )
}
