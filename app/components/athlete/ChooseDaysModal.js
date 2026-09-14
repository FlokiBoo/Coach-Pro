'use client'

import { useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import { WEEK_DAYS } from '@/lib/weekDays'

// Popup affiché à l'ouverture quand un programme est assigné à l'athlète mais que le coach n'a
// daté aucune de ses séances (day_of_week) — sans ça le programme restait invisible ailleurs que
// dans "Mes programmes" (voir WodTab). L'athlète choisit librement combien de jours par semaine
// il veut s'entraîner (pas de nombre imposé) : recommended_sessions_per_week et
// min_hours_between_sessions (réglés par le coach dans l'éditeur de programme, "Rythme conseillé")
// ne sont plus qu'un conseil affiché ici, jamais une contrainte — quoi que l'athlète choisisse,
// les séances s'enchaînent dans l'ordre du programme (voir nextUncompletedOf dans WodTab), le jour
// choisi ne sert qu'à afficher une étiquette indicative sur la carte.
export default function ChooseDaysModal({ program, onSave, onDismiss }) {
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const advisedCount = program.recommended_sessions_per_week || null

  const toggleDay = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key])
  }

  const save = async () => {
    setSaving(true)
    await onSave(selected)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(33,29,25,0.55)', zIndex: 1200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card-white)', borderRadius: '20px 20px 0 0', padding: '24px 20px 28px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ostryk-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vert-foret)' }}>
            <CalendarBlank size={20} weight="light" />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 19, color: 'var(--bordeaux)', textAlign: 'center', marginBottom: 6 }}>
          Choisis ton rythme d&apos;entraînement
        </div>
        <div style={{ fontSize: 13, color: 'var(--ostryk-text2)', textAlign: 'center', marginBottom: 14, lineHeight: 1.5 }}>
          Pour « {program.title} », choisis combien de fois par semaine tu veux t&apos;entraîner et quels jours.
        </div>

        {(advisedCount || program.min_hours_between_sessions) && (
          <div style={{
            background: 'var(--ostryk-border)', borderRadius: 12, padding: '10px 14px', marginBottom: 18,
            fontSize: 12.5, color: 'var(--bordeaux)', lineHeight: 1.5, textAlign: 'center',
          }}>
            💡 Conseil de ton coach : {advisedCount ? `${advisedCount} séance${advisedCount > 1 ? 's' : ''} par semaine` : ''}
            {advisedCount && program.min_hours_between_sessions ? ', ' : ''}
            {program.min_hours_between_sessions ? `au moins ${program.min_hours_between_sessions}h entre deux séances` : ''}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {WEEK_DAYS.map(d => {
            const isSelected = selected.includes(d.key)
            return (
              <button key={d.key} onClick={() => toggleDay(d.key)} style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                border: `1.5px solid ${isSelected ? 'var(--vert-foret)' : 'var(--ostryk-border-input)'}`,
                background: isSelected ? 'var(--vert-foret)' : 'var(--card-white)',
                color: isSelected ? '#fff' : 'var(--ostryk-text2)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                {d.short}
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: 'var(--ostryk-text3)', textAlign: 'center', marginBottom: 18 }}>
          {selected.length === 0 ? 'Sélectionne au moins un jour' : `${selected.length} séance${selected.length > 1 ? 's' : ''} par semaine`}
        </div>

        <button onClick={save} disabled={selected.length === 0 || saving} style={{
          width: '100%', background: selected.length > 0 ? 'var(--bordeaux)' : 'var(--ostryk-border)',
          color: selected.length > 0 ? '#fff' : 'var(--ostryk-text3)',
          border: 'none', borderRadius: 'var(--ostryk-pill-radius)', padding: '14px',
          fontSize: 15, fontWeight: 700, cursor: selected.length > 0 ? 'pointer' : 'default', marginBottom: 10,
        }}>
          {saving ? '…' : 'Valider mes jours'}
        </button>

        <button onClick={onDismiss} style={{
          width: '100%', background: 'none', border: 'none', color: 'var(--ostryk-text2)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 6,
        }}>
          Plus tard
        </button>
      </div>
    </div>
  )
}
