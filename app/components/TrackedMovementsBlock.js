'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const RM_KEYS = [2, 3, 4, 5, 6]

// Estime le 1RM (formule d'Epley) à partir du RM rempli le plus lourd entre 2 et 6RM
function estimate1RM(entry) {
  if (entry.rm1 != null) return { value: entry.rm1, estimated: false }
  let best = null
  for (const r of RM_KEYS) {
    const w = entry[`rm${r}`]
    if (w == null) continue
    if (!best || w > best.w) best = { w, r }
  }
  if (!best) return null
  const value = Math.round(best.w * (1 + best.r / 30) * 10) / 10
  return { value, estimated: true, from: best.r }
}

function formatDateFr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function emptyEntryForm() {
  return { date: new Date().toISOString().slice(0, 10), rm1: '', rm2: '', rm3: '', rm4: '', rm5: '', rm6: '', note: '' }
}

export default function TrackedMovementsBlock({ athleteId, isCoach = false }) {
  const [movements, setMovements] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [addingEntryFor, setAddingEntryFor] = useState(null)
  const [entryForm, setEntryForm] = useState(emptyEntryForm())

  useEffect(() => { load() }, [athleteId])

  async function load() {
    const { data } = await supabase
      .from('tracked_movements')
      .select('*, tracked_movement_entries(*)')
      .order('created_at')
    const list = (data || []).map(m => ({
      ...m,
      entries: [...(m.tracked_movement_entries || [])]
        .filter(e => e.athlete_id === athleteId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    setMovements(list)
  }

  const searchMovements = async (val) => {
    if (val.trim().length < 2) { setSuggestions([]); return }
    const { data } = await supabase.from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions((data || []).map(m => m.name))
  }

  const createMovement = async (name) => {
    const label = (name ?? newName).trim()
    if (!label) return
    setSaving(true)
    const { data, error } = await supabase.from('tracked_movements').insert({ name: label }).select().single()
    if (data) {
      setMovements(prev => [...(prev || []), { ...data, entries: [] }])
    } else if (error?.code === '23505') {
      // Le mouvement existe déjà dans le catalogue global — on le récupère simplement
      const { data: existing } = await supabase.from('tracked_movements').select('*').eq('name', label).single()
      if (existing && !movements.some(m => m.id === existing.id)) {
        setMovements(prev => [...(prev || []), { ...existing, entries: [] }])
      }
    }
    setNewName('')
    setSuggestions([])
    setCreating(false)
    setSaving(false)
  }

  const deleteMovement = async (id) => {
    if (!confirm('Supprimer ce mouvement du catalogue global (et tout son historique, pour tous les clients) ?')) return
    await supabase.from('tracked_movements').delete().eq('id', id)
    setMovements(prev => prev.filter(m => m.id !== id))
  }

  const openAddEntry = (id) => {
    setAddingEntryFor(id)
    setEntryForm(emptyEntryForm())
  }

  const saveEntry = async (movementId) => {
    const payload = {
      tracked_movement_id: movementId,
      athlete_id: athleteId,
      date: entryForm.date,
      note: entryForm.note.trim() || null,
    }
    RM_KEYS.forEach(r => { payload[`rm${r}`] = entryForm[`rm${r}`] ? parseFloat(entryForm[`rm${r}`]) : null })
    payload.rm1 = entryForm.rm1 ? parseFloat(entryForm.rm1) : null
    if (!Object.keys(payload).some(k => k.startsWith('rm') && payload[k] != null)) return

    setSaving(true)
    const { data } = await supabase.from('tracked_movement_entries').insert(payload).select().single()
    if (data) {
      setMovements(prev => prev.map(m => m.id === movementId
        ? { ...m, entries: [...m.entries, data].sort((a, b) => a.date.localeCompare(b.date)) }
        : m))
      setAddingEntryFor(null)
    }
    setSaving(false)
  }

  const deleteEntry = async (movementId, entryId) => {
    await supabase.from('tracked_movement_entries').delete().eq('id', entryId)
    setMovements(prev => prev.map(m => m.id === movementId
      ? { ...m, entries: m.entries.filter(e => e.id !== entryId) }
      : m))
  }

  if (movements === null) return null

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          🏆 Records & Tests
        </div>
        {isCoach && (
          <button onClick={() => { setCreating(v => !v); setNewName('') }} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            + Mouvement
          </button>
        )}
      </div>

      {/* Formulaire création (coach uniquement) */}
      {creating && isCoach && (
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg2)', position: 'relative' }}>
          <input
            autoFocus
            placeholder="Nom du mouvement (ex: Back Squat)"
            value={newName}
            onChange={e => { setNewName(e.target.value); searchMovements(e.target.value) }}
            onKeyDown={e => e.key === 'Enter' && createMovement()}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', left: 12, right: 12, top: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
              {suggestions.map((s, i) => (
                <button key={i} onMouseDown={() => createMovement(s)}
                  style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setCreating(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
            <button onClick={() => createMovement()} disabled={saving || !newName.trim()} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '…' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {/* Vide */}
      {movements.length === 0 && !creating && (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {isCoach ? 'Aucun mouvement dans le catalogue — clique sur "+ Mouvement" pour en ajouter un (visible pour tous les clients).' : 'Aucun mouvement suivi pour le moment.'}
        </div>
      )}

      {/* Liste des mouvements */}
      {movements.map(m => {
        const isOpen = expandedId === m.id
        const isAdding = addingEntryFor === m.id
        const best = m.entries.reduce((acc, e) => {
          const est = estimate1RM(e)
          if (!est) return acc
          return (!acc || est.value > acc.value) ? est : acc
        }, null)

        return (
          <div key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
            <div onClick={() => setExpandedId(isOpen ? null : m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 14, flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
              </div>
              {best && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--green)' }}>{best.value} kg</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{best.estimated ? `1RM estimé (${best.from}RM)` : '1RM'}</div>
                </div>
              )}
              {isCoach && (
                <button onClick={e => { e.stopPropagation(); deleteMovement(m.id) }} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}>🗑️</button>
              )}
            </div>

            {isOpen && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                <ProgressChart entries={m.entries} />

                {isAdding ? (
                  <EntryForm form={entryForm} setForm={setEntryForm} onCancel={() => setAddingEntryFor(null)} onSave={() => saveEntry(m.id)} saving={saving} />
                ) : (
                  <button onClick={() => openAddEntry(m.id)} style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    + Ajouter une valeur
                  </button>
                )}

                {m.entries.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...m.entries].reverse().map(e => {
                      const est = estimate1RM(e)
                      const filled = [1, ...RM_KEYS].filter(r => e[`rm${r}`] != null).map(r => `${r}RM ${e[`rm${r}`]}kg`)
                      return (
                        <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 11px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 80, flexShrink: 0 }}>{formatDateFr(e.date)}</div>
                            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{filled.join(' · ')}</div>
                            {est && (
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
                                {est.value}kg{est.estimated ? ' (est.)' : ''}
                              </div>
                            )}
                            {isCoach && (
                              <button onClick={() => deleteEntry(m.id, e.id)} style={{ background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}>×</button>
                            )}
                          </div>
                          {e.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>« {e.note} »</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EntryForm({ form, setForm, onCancel, onSave, saving }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Date</div>
        <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>1RM (optionnel — remplace l'estimation)</div>
        <input type="number" step="0.5" min="0" placeholder="ex: 100" value={form.rm1} onChange={e => set('rm1', e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>2RM à 6RM (kg)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {RM_KEYS.map(r => (
            <div key={r}>
              <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', marginBottom: 2 }}>{r}RM</div>
              <input type="number" step="0.5" min="0" value={form[`rm${r}`]} onChange={e => set(`rm${r}`, e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 4px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)', textAlign: 'center' }} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Note</div>
        <input placeholder="ex: sensations, technique…" value={form.note} onChange={e => set('note', e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
        <button onClick={onSave} disabled={saving} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

function ProgressChart({ entries }) {
  const points = entries.map(e => ({ date: e.date, est: estimate1RM(e) })).filter(p => p.est)
  if (points.length < 2) return null

  const W = 300, H = 90, PAD = 8
  const values = points.map(p => p.est.value)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((p.est.value - min) / range) * (H - PAD * 2)
    return { x, y, value: p.est.value }
  })
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  const firstLabelIdx = 0
  const lastLabelIdx = coords.length - 1

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 8px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth="1" />
        <path d={path} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={i === firstLabelIdx || i === lastLabelIdx ? 3.5 : 2.5} fill="var(--green)" />
        ))}
        {coords.map((c, i) => (i === firstLabelIdx || i === lastLabelIdx) && (
          <text key={`t-${i}`} x={c.x} y={c.y - 8} fontSize="9" fontWeight="700" fill="var(--text)" textAnchor={i === firstLabelIdx ? 'start' : 'end'}>
            {c.value}kg
          </text>
        ))}
      </svg>
    </div>
  )
}
