'use client'

// Page de travail isolée (pas de sidebar, pas de vraies données) pour itérer sur le visuel de
// l'écran "nouvelle séance" avant de reporter les changements dans le vrai fichier
// app/programs/[athleteId]/[programId]/page.js. À supprimer une fois le design validé et reporté.

import { useState } from 'react'
import { Lightbulb, Repeat, CaretDown, Barbell, Backpack, FloppyDisk } from '@phosphor-icons/react'

const WEEK_DAYS = [
  { key: 0, label: 'Lundi', short: 'Lun' },
  { key: 1, label: 'Mardi', short: 'Mar' },
  { key: 2, label: 'Mercredi', short: 'Mer' },
  { key: 3, label: 'Jeudi', short: 'Jeu' },
  { key: 4, label: 'Vendredi', short: 'Ven' },
  { key: 5, label: 'Samedi', short: 'Sam' },
  { key: 6, label: 'Dimanche', short: 'Dim' },
]

const fieldLabel = { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }

export default function PreviewSessionPage() {
  const [title, setTitle] = useState('Séance vierge')
  const [isExplication, setIsExplication] = useState(false)
  const [description, setDescription] = useState('')
  const [weekNumber, setWeekNumber] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('')
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [dailyTarget, setDailyTarget] = useState(1)
  const [materiel, setMateriel] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  return (
    <div style={{ background: 'var(--bg2)', minHeight: '100svh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>

        {/* En-tête */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
            1
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Séance 1"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}
          />
          <button
            onClick={() => setIsExplication(v => !v)}
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 9px', cursor: 'pointer',
              border: isExplication ? '1px solid #93C5FD' : '1px solid var(--border2)',
              background: isExplication ? '#EFF6FF' : 'none',
              color: isExplication ? '#1D4ED8' : 'var(--text3)',
            }}
          >
            <Lightbulb size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Explication
          </button>
          <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>0 ex.</span>
        </div>

        {/* Contenu */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Description */}
          <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)}
            rows={3} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'none', background: 'var(--bg)', fontFamily: 'inherit', color: 'var(--text)' }} />

          {/* Semaine / Jour / Récurrence */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={fieldLabel}>Semaine</div>
              <input type="number" min="1" placeholder="—" value={weekNumber}
                onChange={e => setWeekNumber(e.target.value)}
                style={{ width: 64, boxSizing: 'border-box', padding: '7px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
            <div>
              <div style={fieldLabel}>Jour</div>
              <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}>
                <option value="">—</option>
                {WEEK_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <div style={fieldLabel}>Récurrence</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setIsRecurrent(v => !v)} style={{
                  padding: '7px 12px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: isRecurrent ? '1px solid var(--green)' : '1px solid var(--border2)',
                  background: isRecurrent ? 'var(--green-light)' : 'var(--bg)',
                  color: isRecurrent ? 'var(--green)' : 'var(--text2)',
                }}>
                  {isRecurrent ? 'Récurrente' : 'Ne se répète pas'}
                </button>
                {isRecurrent && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text2)' }}>
                    <input type="number" min="1" value={dailyTarget}
                      onChange={e => setDailyTarget(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ width: 44, boxSizing: 'border-box', padding: '6px 8px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, textAlign: 'center', outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                    fois/jour
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* + Ajouter */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAddMenuOpen(v => !v)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--r)',
              padding: '9px', fontSize: 13, fontWeight: 700, color: 'var(--green)', cursor: 'pointer',
            }}>
              + Ajouter <CaretDown size={12} weight="bold" />
            </button>
            {addMenuOpen && (
              <>
                <div onClick={() => setAddMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  zIndex: 100, padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <button onClick={() => setAddMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <Barbell size={15} /> Ajouter un exercice
                  </button>
                  <button onClick={() => setAddMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <Repeat size={15} /> Ajouter un circuit <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(superset / triset)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Matériel */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Backpack size={11} /> Matériel
              </span>
            </div>
            <textarea placeholder="Matériel à avoir pour cette séance…" value={materiel} onChange={e => setMateriel(e.target.value)}
              rows={2} style={{ width: '100%', boxSizing: 'border-box', border: 'none', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)' }} />
          </div>

          <button style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FloppyDisk size={15} /> Sauvegarder la séance
          </button>
        </div>
      </div>
    </div>
  )
}
