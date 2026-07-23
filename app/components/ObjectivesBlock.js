'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

function formatDateFr(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeRemaining(dateStr) {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target - now) / 86400000)
  if (diffDays < 0) return `Échéance dépassée (${Math.abs(diffDays)} j)`
  if (diffDays === 0) return "Aujourd'hui"
  const weeks = Math.floor(diffDays / 7)
  const months = Math.floor(diffDays / 30)
  return `${diffDays} j · ${weeks} sem. · ${months} mois`
}

const PRIORITY_OPTIONS = [
  { value: 1, label: '1 - Haute' },
  { value: 2, label: '2 - Moyenne' },
  { value: 3, label: '3 - Basse' },
]

const PRIORITY_STYLES = {
  1: { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626', textDate: '#B91C1C', bullet: '#DC2626' },
  2: { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', textDate: '#C2410C', bullet: '#EA580C' },
  3: { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', textDate: '#1D4ED8', bullet: '#2563EB' },
}

export default function ObjectivesBlock({ athleteId, objectives, setObjectives }) {
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPriority, setNewPriority] = useState(2)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ text: '', target_date: '', priority: 2 })
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  const sorted = [...objectives].sort((a, b) => {
    if (!a.target_date && !b.target_date) return 0
    if (!a.target_date) return 1
    if (!b.target_date) return -1
    return a.target_date.localeCompare(b.target_date)
  })

  const addObjective = async () => {
    const text = newText.trim()
    if (!text) return
    setSaving(true)
    const { data, error } = await supabase.from('athlete_objectives')
      .insert({ athlete_id: athleteId, text, target_date: newDate || null, priority: newPriority })
      .select().single()
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    if (data) setObjectives(prev => [...prev, data])
    setNewText(''); setNewDate(''); setNewPriority(2)
    setSaving(false)
    inputRef.current?.focus()
  }

  const startEdit = (o) => {
    setEditingId(o.id)
    setEditForm({ text: o.text, target_date: o.target_date || '', priority: o.priority || 2 })
  }

  const saveEdit = async () => {
    if (!editForm.text.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('athlete_objectives')
      .update({ text: editForm.text.trim(), target_date: editForm.target_date || null, priority: editForm.priority })
      .eq('id', editingId).select().single()
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    if (data) setObjectives(prev => prev.map(o => o.id === editingId ? data : o))
    setEditingId(null)
    setSaving(false)
  }

  const removeObjective = async (id) => {
    const { error } = await supabase.from('athlete_objectives').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    setObjectives(prev => prev.filter(o => o.id !== id))
  }

  const inputStyle = {
    padding: '9px 11px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
    fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit',
  }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>🎯 Objectifs</span>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun objectif défini</div>
        )}

        {sorted.map(obj => {
          const isTop = obj.priority === 1
          const isEditing = editingId === obj.id
          const style = PRIORITY_STYLES[obj.priority] || PRIORITY_STYLES[2]
          return (
            <div key={obj.id} style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 'var(--r)', padding: '10px 12px' }}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input autoFocus value={editForm.text} onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()} style={inputStyle} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" value={editForm.target_date} onChange={e => setEditForm(f => ({ ...f, target_date: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                    <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: parseInt(e.target.value) }))} style={{ ...inputStyle, width: 120 }}>
                      {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 'var(--r)', padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                    <button onClick={saveEdit} disabled={saving} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'Enregistrer'}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: style.bullet, fontSize: 14, marginTop: 1, flexShrink: 0 }}>▸</span>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => startEdit(obj)} title="Cliquer pour modifier">
                    <div style={{ fontSize: isTop ? 16 : 14, fontWeight: isTop ? 800 : 600, color: style.text, lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {obj.text}
                    </div>
                    {obj.target_date && (
                      <div style={{ fontSize: 11, color: style.textDate, marginTop: 3 }}>
                        📅 {formatDateFr(obj.target_date)} · {timeRemaining(obj.target_date)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeObjective(obj.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              )}
            </div>
          )
        })}

        {/* Formulaire ajout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: sorted.length > 0 ? 4 : 0 }}>
          <input
            ref={inputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addObjective()}
            placeholder="Ajouter un objectif…"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <select value={newPriority} onChange={e => setNewPriority(parseInt(e.target.value))} style={{ ...inputStyle, width: 120 }}>
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={addObjective} disabled={saving || !newText.trim()}
              style={{ background: newText.trim() ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {saving ? '…' : '+ Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
