'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const PERIODS = [
  { key: 'matin', label: 'Matin' },
  { key: 'apres_midi', label: 'Après-midi' },
]

const COLORS = [
  { bg: '#DCFCE7', text: '#166534' },
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#E0F2FE', text: '#0369A1' },
  { bg: '#F3E8FF', text: '#6B21A8' },
]

function colorFor(label) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function guessEmoji(label) {
  const l = label.toLowerCase()
  if (l.includes('muscu')) return '🏋️'
  if (l.includes('vélo') || l.includes('velo') || l.includes('cycl')) return '🚴'
  if (l.includes('course') || l.includes('run')) return '🏃'
  if (l.includes('nat')) return '🏊'
  if (l.includes('repos') || l.includes('rest')) return '😴'
  if (l.includes('yoga')) return '🧘'
  if (l.includes('marche')) return '🚶'
  return '🏷️'
}

export default function WeeklyPlannerBlock({ athleteId }) {
  const [blocks, setBlocks] = useState([])
  const [defs, setDefs] = useState([])
  const [modal, setModal] = useState(null) // { day, period, id, discipline }
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('activity_definitions').select('label').order('created_at')
      .then(({ data }) => setDefs((data || []).map(d => d.label)))
  }, [])

  const load = () => {
    if (!athleteId) return
    supabase.from('weekly_blocks').select('*')
      .eq('athlete_id', athleteId)
      .order('order_index')
      .then(({ data }) => setBlocks(data || []))
  }

  useEffect(() => { load() }, [athleteId])

  const openCreate = (day, period) => setModal({ day, period, id: null, discipline: '' })
  const openEdit = (b) => setModal({ day: b.day_of_week, period: b.period, id: b.id, discipline: b.discipline })
  const closeModal = () => setModal(null)

  const saveModal = async () => {
    if (!modal.discipline.trim()) return
    setSaving(true)
    if (modal.id) {
      await supabase.from('weekly_blocks').update({ discipline: modal.discipline.trim() }).eq('id', modal.id)
    } else {
      const sameSlot = blocks.filter(b => b.day_of_week === modal.day && b.period === modal.period)
      await supabase.from('weekly_blocks').insert({
        athlete_id: athleteId, day_of_week: modal.day, period: modal.period,
        discipline: modal.discipline.trim(), order_index: sameSlot.length,
      })
    }
    setSaving(false)
    closeModal()
    load()
  }

  const deleteModal = async () => {
    if (!modal.id) return
    setSaving(true)
    await supabase.from('weekly_blocks').delete().eq('id', modal.id)
    setSaving(false)
    closeModal()
    load()
  }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          🗓️ Semaine-type
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, minmax(0, 1fr))', boxSizing: 'border-box', padding: '10px 6px 10px 4px', gap: '4px 2px', alignItems: 'start' }}>
        {/* En-tête : coin vide + jours */}
        <div />
        {DAYS.map(label => (
          <div key={label} style={{ fontSize: 10, fontWeight: 800, color: 'var(--text2)', textAlign: 'center' }}>{label}</div>
        ))}

        {/* Ligne Matin */}
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Matin
        </div>
        {DAYS.map((_, dayIdx) => {
          const slotBlocks = blocks.filter(b => b.day_of_week === dayIdx && b.period === 'matin')
          return (
            <div key={dayIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', minWidth: 0 }}>
              {slotBlocks.map(b => {
                const c = colorFor(b.discipline)
                return (
                  <button key={b.id} onClick={() => openEdit(b)} title={b.discipline} style={{
                    width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 6, padding: '3px 2px',
                    background: c.bg, color: c.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
                  }}>
                    {guessEmoji(b.discipline)}
                  </button>
                )
              })}
              <button onClick={() => openCreate(dayIdx, 'matin')} style={{
                width: '100%', boxSizing: 'border-box', border: '1px dashed var(--border2)', borderRadius: 6,
                background: 'none', color: 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 0', lineHeight: 1.3,
              }}>+</button>
            </div>
          )
        })}

        {/* Trait de séparation */}
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

        {/* Ligne Après-midi */}
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Après-midi
        </div>
        {DAYS.map((_, dayIdx) => {
          const slotBlocks = blocks.filter(b => b.day_of_week === dayIdx && b.period === 'apres_midi')
          return (
            <div key={dayIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', minWidth: 0 }}>
              {slotBlocks.map(b => {
                const c = colorFor(b.discipline)
                return (
                  <button key={b.id} onClick={() => openEdit(b)} title={b.discipline} style={{
                    width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 6, padding: '3px 2px',
                    background: c.bg, color: c.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
                  }}>
                    {guessEmoji(b.discipline)}
                  </button>
                )
              })}
              <button onClick={() => openCreate(dayIdx, 'apres_midi')} style={{
                width: '100%', boxSizing: 'border-box', border: '1px dashed var(--border2)', borderRadius: 6,
                background: 'none', color: 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 0', lineHeight: 1.3,
              }}>+</button>
            </div>
          )
        })}
      </div>

      {modal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][modal.day]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, fontWeight: 600 }}>
              {PERIODS.find(p => p.key === modal.period)?.label}
            </div>

            <input
              autoFocus
              value={modal.discipline}
              onChange={e => setModal(m => ({ ...m, discipline: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveModal()}
              placeholder="Ex : Musculation, Vélo…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', marginBottom: 10 }}
            />

            {defs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {defs.map(label => (
                  <button key={label} onClick={() => setModal(m => ({ ...m, discipline: label }))} style={{
                    background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20, padding: '5px 10px',
                    fontSize: 12, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer',
                  }}>{guessEmoji(label)} {label}</button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {modal.id && (
                <button onClick={deleteModal} disabled={saving} style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🗑
                </button>
              )}
              <button onClick={closeModal} style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={saveModal} disabled={saving || !modal.discipline.trim()} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
