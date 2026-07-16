'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const VISIBLE_COUNT = 3

export default function ActivityBlock({ athleteId, date = null, isCoach = false }) {
  const [defs, setDefs]         = useState([])
  const [dayLogs, setDayLogs]   = useState({})
  const [open, setOpen]         = useState(false)
  const [allVisible, setAllVisible] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm]   = useState({ label: '', show_km: false, show_duration: false })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ label: '', show_km: false, show_duration: false })
  const [saving, setSaving]     = useState(false)
  const dayLogsRef = useRef(dayLogs)
  useEffect(() => { dayLogsRef.current = dayLogs }, [dayLogs])

  // Charger les définitions globales
  useEffect(() => {
    supabase.from('activity_definitions').select('*').order('created_at')
      .then(({ data, error }) => { if (!error) setDefs(data || []) })
  }, [])

  // Charger les logs du jour
  useEffect(() => {
    if (!athleteId || !date) return
    supabase.from('activity_logs').select('*').eq('athlete_id', athleteId).eq('date', date)
      .then(({ data, error }) => {
        if (!error) {
          const map = {}
          ;(data || []).forEach(l => { map[l.label || l.type] = l })
          setDayLogs(map)
        }
      })
  }, [athleteId, date])

  // ── CRUD définitions (coach uniquement) ───────────────────────────────────

  const createDef = async () => {
    if (!newForm.label.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('activity_definitions').insert({
      label: newForm.label.trim(), show_km: newForm.show_km, show_duration: newForm.show_duration,
    }).select().single()
    if (error) {
      alert('Erreur : ' + error.message)
      setSaving(false)
      return
    }
    if (data) setDefs(prev => [...prev, data])
    setCreating(false)
    setNewForm({ label: '', show_km: false, show_duration: false })
    setSaving(false)
  }

  const updateDef = async () => {
    if (!editForm.label.trim()) return
    setSaving(true)
    const { data } = await supabase.from('activity_definitions')
      .update({ label: editForm.label.trim(), show_km: editForm.show_km, show_duration: editForm.show_duration })
      .eq('id', editingId).select().single()
    if (data) setDefs(prev => prev.map(d => d.id === editingId ? data : d))
    setEditingId(null)
    setSaving(false)
  }

  const deleteDef = async (id) => {
    if (!confirm('Supprimer cette activité ?')) return
    await supabase.from('activity_definitions').delete().eq('id', id)
    setDefs(prev => prev.filter(d => d.id !== id))
  }

  // ── Log journalier ─────────────────────────────────────────────────────────

  const saveLog = async (label, field, value) => {
    if (!date || !athleteId) return
    const { id, created_at, ...existingFields } = dayLogsRef.current[label] || {}
    const payload = { athlete_id: athleteId, date, type: 'custom', ...existingFields, label, [field]: value ?? null }
    const { data, error } = await supabase.from('activity_logs')
      .upsert(payload, { onConflict: 'athlete_id,date,type,label' })
      .select().single()
    if (error) { alert("Erreur d'enregistrement de l'activité : " + error.message); return }
    if (data) setDayLogs(prev => ({ ...prev, [label]: data }))
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const inp = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: '1px solid var(--border2)', borderRadius: 'var(--r)',
    fontSize: 15, outline: 'none', background: 'var(--bg)',
    color: 'var(--text)', fontWeight: 700, fontFamily: 'inherit',
  }

  const visible = allVisible ? defs : defs.slice(0, VISIBLE_COUNT)

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', borderBottom: open ? '1px solid var(--border)' : 'none' }}>
        <div onClick={() => setOpen(v => !v)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1, cursor: 'pointer' }}>
          🏃 Activité du jour
        </div>
        {defs.length > 0 && !open && (
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginRight: 8 }}>
            {defs.length} activité{defs.length > 1 ? 's' : ''}
          </span>
        )}
        {isCoach && (
          <button onClick={e => { e.stopPropagation(); setOpen(true); setCreating(true); setEditingId(null) }}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 8 }}>
            + Discipline
          </button>
        )}
        <span onClick={() => setOpen(v => !v)} style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {defs.length === 0 && !creating && (
            <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {isCoach ? 'Aucune activité. Créez-en une avec + Discipline.' : 'Aucune activité disponible.'}
            </div>
          )}

          {visible.map((def, i) => {
            const log = dayLogs[def.label] || null
            const isEditing = editingId === def.id

            return (
              <div key={def.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>

                {isEditing ? (
                  /* ── Formulaire édition (coach) ── */
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input autoFocus value={editForm.label}
                      onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                      style={{ ...inp, fontWeight: 600 }} />
                    <div style={{ display: 'flex', gap: 14 }}>
                      {[{ key: 'show_km', label: 'Kilométrage' }, { key: 'show_duration', label: 'Durée' }].map(({ key, label }) => (
                        <label key={key} onClick={() => setEditForm(f => ({ ...f, [key]: !f[key] }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `2px solid ${editForm[key] ? 'var(--green)' : 'var(--border2)'}`, background: editForm[key] ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {editForm[key] && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingId(null)} style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                      <button onClick={updateDef} disabled={saving} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'Enregistrer'}</button>
                    </div>
                  </div>
                ) : (
                  /* ── Carte activité ── */
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Titre + boutons coach */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{def.label}</div>
                      {isCoach && (
                        <>
                          <button onClick={() => { setEditingId(def.id); setEditForm({ label: def.label, show_km: def.show_km, show_duration: def.show_duration }) }}
                            style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '3px 9px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>✏️</button>
                          <button onClick={() => deleteDef(def.id)}
                            style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '3px 9px', fontSize: 13, cursor: 'pointer', color: '#DC2626' }}>🗑️</button>
                        </>
                      )}
                    </div>

                    {/* Log du jour (si date fournie) */}
                    {date ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(def.show_km || def.show_duration) && (
                          <div style={{ display: 'flex', gap: 10 }}>
                            {def.show_km && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>km</div>
                                <input key={`km-${def.id}-${date}`} type="number" step="0.1" min="0" placeholder="0.0"
                                  defaultValue={log?.km ?? ''}
                                  onBlur={e => saveLog(def.label, 'km', e.target.value ? parseFloat(e.target.value) : null)}
                                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                  style={inp} />
                              </div>
                            )}
                            {def.show_duration && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>min</div>
                                <input key={`dur-${def.id}-${date}`} type="number" min="0" placeholder="45"
                                  defaultValue={log?.duration_minutes ?? ''}
                                  onBlur={e => saveLog(def.label, 'duration_minutes', e.target.value ? parseInt(e.target.value) : null)}
                                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                  style={inp} />
                              </div>
                            )}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>RPE</div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <button key={n} type="button"
                                onClick={() => saveLog(def.label, 'difficulty', log?.difficulty === n ? null : n)}
                                style={{
                                  flex: 1, padding: '7px 0', border: '1px solid', borderRadius: 'var(--r)',
                                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                  borderColor: log?.difficulty === n ? 'transparent' : 'var(--border2)',
                                  background: log?.difficulty === n ? (n >= 8 ? '#ef4444' : n >= 5 ? '#f59e0b' : '#22c55e') : 'var(--bg2)',
                                  color: log?.difficulty === n ? '#fff' : 'var(--text2)',
                                }}>{n}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {log?.validated_at ? (
                            <button onClick={() => saveLog(def.label, 'validated_at', null)}
                              style={{ background: '#DCFCE7', color: '#166534', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              ✓ Validée
                            </button>
                          ) : (
                            <button onClick={() => saveLog(def.label, 'validated_at', new Date().toISOString())}
                              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              ✓ Valider
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Mode sans date : affiche les champs configurés */
                      <div style={{ display: 'flex', gap: 5 }}>
                        {def.show_km && <span style={{ fontSize: 11, background: 'var(--bg2)', color: 'var(--text3)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>km</span>}
                        {def.show_duration && <span style={{ fontSize: 11, background: 'var(--bg2)', color: 'var(--text3)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>durée</span>}
                        <span style={{ fontSize: 11, background: 'var(--bg2)', color: 'var(--text3)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>RPE</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {defs.length > VISIBLE_COUNT && (
            <button onClick={() => setAllVisible(v => !v)}
              style={{ background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
              {allVisible ? <>▲ Masquer</> : <>{`▼ Voir les ${defs.length - VISIBLE_COUNT} autre${defs.length - VISIBLE_COUNT > 1 ? 's' : ''}`}</>}
            </button>
          )}

          {/* Formulaire création (coach uniquement) */}
          {creating && isCoach && (
            <div style={{ borderTop: defs.length > 0 ? '1px solid var(--border)' : 'none', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Nom de l'activité</div>
                <input autoFocus placeholder="Ex: Vélo, Run, Yoga…"
                  value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && createDef()}
                  style={{ ...inp, fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Champs à afficher</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[{ key: 'show_km', label: 'Kilométrage' }, { key: 'show_duration', label: 'Durée' }].map(({ key, label }) => (
                    <label key={key} onClick={() => setNewForm(f => ({ ...f, [key]: !f[key] }))} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, border: `2px solid ${newForm[key] ? 'var(--green)' : 'var(--border2)'}`, background: newForm[key] ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <button onClick={createDef} disabled={saving || !newForm.label.trim()}
                  style={{ flex: 2, background: newForm.label.trim() ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '…' : 'Créer'}
                </button>
              </div>
            </div>
          )}


        </div>
      )}
    </div>
  )
}
