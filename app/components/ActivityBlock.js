'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const ACTIVITIES = [
  { type: 'velo', label: 'Vélo', emoji: '🚴' },
  { type: 'run', label: 'Run', emoji: '🏃' },
  { type: 'natation', label: 'Natation', emoji: '🏊' },
]

function formatDuration(min) {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export default function ActivityBlock({ athleteId, date }) {
  const [logs, setLogs] = useState({})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ km: '', duration_minutes: '', difficulty: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!athleteId || !date) return
    supabase.from('activity_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('date', date)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(l => { map[l.type] = l })
        setLogs(map)
      })
  }, [athleteId, date])

  const startEdit = (type) => {
    const existing = logs[type]
    setForm({
      km: existing?.km ?? '',
      duration_minutes: existing?.duration_minutes ?? '',
      difficulty: existing?.difficulty ?? '',
    })
    setEditing(type)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const km = form.km !== '' ? parseFloat(form.km) : null
    const duration_minutes = form.duration_minutes !== '' ? parseInt(form.duration_minutes) : null
    const difficulty = form.difficulty !== '' ? parseInt(form.difficulty) : null

    const { data } = await supabase.from('activity_logs').upsert(
      { athlete_id: athleteId, date, type: editing, km, duration_minutes, difficulty },
      { onConflict: 'athlete_id,date,type' }
    ).select().single()

    if (data) setLogs(prev => ({ ...prev, [editing]: data }))
    setEditing(null)
    setSaving(false)
  }

  const hasAnyData = Object.values(logs).some(l => l?.km || l?.duration_minutes || l?.difficulty)

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none' }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1 }}>
          🏃 Cardio du jour
        </div>
        {hasAnyData && !open && (
          <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
            {ACTIVITIES.map(act => logs[act.type]?.km || logs[act.type]?.duration_minutes ? (
              <span key={act.type} style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{act.emoji}</span>
            ) : null)}
          </div>
        )}
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && ACTIVITIES.map((act, i) => {
        const log = logs[act.type]
        const hasData = log?.km || log?.duration_minutes || log?.difficulty
        const isEditing = editing === act.type

        return (
          <div key={act.type} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>

            {/* Ligne principale */}
            <div
              onClick={() => !isEditing && startEdit(act.type)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: isEditing ? 'default' : 'pointer' }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{act.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{act.label}</div>
                {hasData && !isEditing && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {log.km && <span style={{ fontWeight: 600, color: 'var(--green)' }}>{log.km} km</span>}
                    {log.duration_minutes && <span>{formatDuration(log.duration_minutes)}</span>}
                    {log.difficulty && (
                      <span style={{ fontWeight: 700, color: log.difficulty >= 8 ? '#ef4444' : log.difficulty >= 5 ? '#f59e0b' : '#22c55e' }}>
                        RPE {log.difficulty}/10
                      </span>
                    )}
                  </div>
                )}
                {!hasData && !isEditing && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Toucher pour ajouter</div>
                )}
              </div>
              {!isEditing && (
                <span style={{ fontSize: 16, color: 'var(--text3)' }}>{hasData ? '✏️' : '+'}</span>
              )}
            </div>

            {/* Formulaire inline */}
            {isEditing && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Distance (km)</div>
                    <input
                      autoFocus
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0.0"
                      value={form.km}
                      onChange={e => setForm(f => ({ ...f, km: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 16, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Durée (min)</div>
                    <input
                      type="number"
                      min="0"
                      placeholder="45"
                      value={form.duration_minutes}
                      onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 16, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 700 }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Difficulté (RPE)</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, difficulty: f.difficulty === n ? '' : n }))}
                        style={{
                          flex: 1, padding: '8px 0', border: '1px solid',
                          borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          borderColor: form.difficulty === n ? 'transparent' : 'var(--border2)',
                          background: form.difficulty === n
                            ? (n >= 8 ? '#ef4444' : n >= 5 ? '#f59e0b' : '#22c55e')
                            : 'var(--bg2)',
                          color: form.difficulty === n ? '#fff' : 'var(--text2)',
                        }}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(null)} style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Annuler
                  </button>
                  <button onClick={save} disabled={saving} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {saving ? '…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

