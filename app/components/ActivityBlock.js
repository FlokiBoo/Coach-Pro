'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function formatDuration(min) {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export default function ActivityBlock({ athleteId, date }) {
  const [activities, setActivities] = useState([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm] = useState({ label: '', show_km: false, show_duration: false })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ km: '', duration_minutes: '', difficulty: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!athleteId || !date) return
    supabase.from('activity_logs').select('*').eq('athlete_id', athleteId).eq('date', date)
      .then(({ data }) => setActivities(data || []))
  }, [athleteId, date])

  const createActivity = async () => {
    if (!newForm.label.trim()) return
    setSaving(true)
    const { data } = await supabase.from('activity_logs').insert({
      athlete_id: athleteId, date, type: 'custom',
      label: newForm.label.trim(), show_km: newForm.show_km, show_duration: newForm.show_duration,
    }).select().single()
    if (data) {
      setActivities(prev => [...prev, data])
      setEditingId(data.id)
      setEditForm({ km: '', duration_minutes: '', difficulty: '' })
    }
    setCreating(false)
    setNewForm({ label: '', show_km: false, show_duration: false })
    setSaving(false)
  }

  const saveValues = async () => {
    if (!editingId) return
    setSaving(true)
    const km = editForm.km !== '' ? parseFloat(editForm.km) : null
    const duration_minutes = editForm.duration_minutes !== '' ? parseInt(editForm.duration_minutes) : null
    const difficulty = editForm.difficulty !== '' ? parseInt(editForm.difficulty) : null
    const { data } = await supabase.from('activity_logs')
      .update({ km, duration_minutes, difficulty }).eq('id', editingId).select().single()
    if (data) setActivities(prev => prev.map(a => a.id === editingId ? data : a))
    setEditingId(null)
    setSaving(false)
  }

  const startEdit = (act) => {
    setEditingId(act.id)
    setEditForm({ km: act.km ?? '', duration_minutes: act.duration_minutes ?? '', difficulty: act.difficulty ?? '' })
    setCreating(false)
  }

  const deleteActivity = async (id) => {
    if (!confirm('Supprimer cette activité ?')) return
    await supabase.from('activity_logs').delete().eq('id', id)
    setActivities(prev => prev.filter(a => a.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 16, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 700, fontFamily: 'inherit' }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1 }}>
          🏃 Activité du jour
        </div>
        {activities.length > 0 && !open && (
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginRight: 8 }}>
            {activities.length} activité{activities.length > 1 ? 's' : ''}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {activities.map((act, i) => {
            const isEditing = editingId === act.id
            const hasData = act.km || act.duration_minutes || act.difficulty
            return (
              <div key={act.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{act.label || act.type}</div>
                    {hasData && !isEditing && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 8 }}>
                        {act.km && <span style={{ fontWeight: 600, color: 'var(--green)' }}>{act.km} km</span>}
                        {act.duration_minutes && <span>{formatDuration(act.duration_minutes)}</span>}
                        {act.difficulty && (
                          <span style={{ fontWeight: 700, color: act.difficulty >= 8 ? '#ef4444' : act.difficulty >= 5 ? '#f59e0b' : '#22c55e' }}>
                            RPE {act.difficulty}/10
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(act)}
                        style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>✏️</button>
                      <button onClick={() => deleteActivity(act.id)}
                        style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 13, cursor: 'pointer', color: '#DC2626' }}>🗑️</button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(act.show_km || act.show_duration) && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        {act.show_km && (
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Distance (km)</div>
                            <input autoFocus type="number" step="0.1" min="0" placeholder="0.0"
                              value={editForm.km} onChange={e => setEditForm(f => ({ ...f, km: e.target.value }))}
                              style={inp} />
                          </div>
                        )}
                        {act.show_duration && (
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Durée (min)</div>
                            <input type="number" min="0" placeholder="45"
                              value={editForm.duration_minutes} onChange={e => setEditForm(f => ({ ...f, duration_minutes: e.target.value }))}
                              style={inp} />
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>RPE</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <button key={n} type="button"
                            onClick={() => setEditForm(f => ({ ...f, difficulty: f.difficulty === n ? '' : n }))}
                            style={{
                              flex: 1, padding: '8px 0', border: '1px solid',
                              borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              borderColor: editForm.difficulty === n ? 'transparent' : 'var(--border2)',
                              background: editForm.difficulty === n ? (n >= 8 ? '#ef4444' : n >= 5 ? '#f59e0b' : '#22c55e') : 'var(--bg2)',
                              color: editForm.difficulty === n ? '#fff' : 'var(--text2)',
                            }}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingId(null)}
                        style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Annuler
                      </button>
                      <button onClick={saveValues} disabled={saving}
                        style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        {saving ? '…' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {creating && (
            <div style={{ borderTop: activities.length > 0 ? '1px solid var(--border)' : 'none', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Nom de l'activité</div>
                <input autoFocus placeholder="Ex: Vélo, Run, Yoga…"
                  value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && createActivity()}
                  style={{ ...inp, fontSize: 14, fontWeight: 400 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Champs à afficher</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[{ key: 'show_km', label: 'Kilométrage' }, { key: 'show_duration', label: 'Durée' }].map(({ key, label }) => (
                    <label key={key} onClick={() => setNewForm(f => ({ ...f, [key]: !f[key] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${newForm[key] ? 'var(--green)' : 'var(--border2)'}`,
                        background: newForm[key] ? 'var(--green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {newForm[key] && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
                    </label>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, border: '2px solid var(--green)', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>RPE (toujours présent)</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setCreating(false); setNewForm({ label: '', show_km: false, show_duration: false }) }}
                  style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button onClick={createActivity} disabled={saving || !newForm.label.trim()}
                  style={{ flex: 2, background: newForm.label.trim() ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '…' : 'Créer'}
                </button>
              </div>
            </div>
          )}

          {!creating && (
            <div style={{ borderTop: activities.length > 0 ? '1px solid var(--border)' : 'none', padding: '10px 14px' }}>
              <button onClick={() => { setCreating(true); setEditingId(null) }}
                style={{ width: '100%', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
                + Ajouter une activité
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
