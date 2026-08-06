'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { UNITS, unitOf, estimate1RM, formatPerformance, CATEGORIES, DOT_COLORS } from '@/app/components/TrackedMovementsBlock'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function formatDateFr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const RM_KEYS = [2, 3, 4, 5, 6]

export default function MetricsPage() {
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState([])
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('kg')
  const [newCategory, setNewCategory] = useState('Lift')
  const [newSubcategory, setNewSubcategory] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingUnitFor, setEditingUnitFor] = useState(null)
  const [editingNameFor, setEditingNameFor] = useState(null)
  const [editNameVal, setEditNameVal] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Lift')
  const [selectedSubcat, setSelectedSubcat] = useState('all')

  async function load() {
    const { data } = await supabase
      .from('tracked_movements')
      .select('*, tracked_movement_entries(*, athletes(id, name))')
      .order('name')
    const list = (data || []).map(m => ({
      ...m,
      entries: [...(m.tracked_movement_entries || [])].sort((a, b) => b.date.localeCompare(a.date)),
    }))
    setMovements(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const searchMovements = async (val) => {
    if (val.trim().length < 2) { setSuggestions([]); return }
    const { data } = await supabase.from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions((data || []).map(m => m.name))
  }

  const createMovement = async (name) => {
    const label = (name ?? newName).trim()
    if (!label) return
    setSaving(true)

    // Lie (ou crée) l'entrée correspondante dans la bibliothèque de mouvements
    const { data: existingLib } = await supabase.from('movements').select('id').ilike('name', label).maybeSingle()
    let libId = existingLib?.id
    if (!libId) {
      const { data: newLib } = await supabase.from('movements').insert({ name: label }).select().single()
      libId = newLib?.id
    }

    const { data, error } = await supabase.from('tracked_movements')
      .insert({ name: label, unit: newUnit, category: newCategory, subcategory: newSubcategory.trim() || null, movement_id: libId || null })
      .select().single()
    if (data) setMovements(prev => [...prev, { ...data, entries: [] }].sort((a, b) => a.name.localeCompare(b.name)))
    else if (error?.code === '23505') alert('Ce mouvement existe déjà dans le catalogue.')
    setNewName('')
    setNewUnit('kg')
    setNewSubcategory('')
    setSuggestions([])
    setCreating(false)
    setSaving(false)
  }

  const deleteMovement = async (id) => {
    if (!confirm('Supprimer ce mouvement du catalogue global et tout son historique (tous clients) ?')) return
    await supabase.from('tracked_movements').delete().eq('id', id)
    setMovements(prev => prev.filter(m => m.id !== id))
  }

  const changeUnit = async (id, unit) => {
    await supabase.from('tracked_movements').update({ unit }).eq('id', id)
    setMovements(prev => prev.map(m => m.id === id ? { ...m, unit } : m))
    setEditingUnitFor(null)
  }

  const changeMeta = async (id, category, subcategory) => {
    const payload = { category, subcategory: subcategory?.trim() || null }
    await supabase.from('tracked_movements').update(payload).eq('id', id)
    setMovements(prev => prev.map(m => m.id === id ? { ...m, ...payload } : m))
  }

  const startEditName = (m) => {
    setEditingNameFor(m.id)
    setEditNameVal(m.name)
  }

  const saveName = async (id) => {
    const name = editNameVal.trim()
    if (!name) { setEditingNameFor(null); return }
    const { error } = await supabase.from('tracked_movements').update({ name }).eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    const movementId = movements.find(m => m.id === id)?.movement_id
    if (movementId) await supabase.from('movements').update({ name }).eq('id', movementId)
    setMovements(prev => prev.map(m => m.id === id ? { ...m, name } : m).sort((a, b) => a.name.localeCompare(b.name)))
    setEditingNameFor(null)
  }

  const filtered = movements.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()))

  const categoriesInData = new Set(filtered.map(m => m.category || 'À classer'))
  const tabs = categoriesInData.has('À classer') ? [...CATEGORIES, 'À classer'] : CATEGORIES
  const categoryMovements = filtered.filter(m => (m.category || 'À classer') === selectedCategory)
  const subcatOrder = []
  const bySubcat = {}
  categoryMovements.forEach(m => {
    const sc = m.subcategory?.trim() || 'Général'
    if (!bySubcat[sc]) { bySubcat[sc] = []; subcatOrder.push(sc) }
    bySubcat[sc].push(m)
  })
  const visibleSubcats = selectedSubcat === 'all' ? subcatOrder : subcatOrder.filter(sc => sc === selectedSubcat)

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 2 }}>📈 Metrics</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Catalogue de mouvements suivis, accessible à tous les clients</div>
          </div>
          <button onClick={() => { setCreating(v => !v); setNewName(''); setNewUnit('kg'); setNewCategory(selectedCategory === 'À classer' ? 'Lift' : selectedCategory); setNewSubcategory('') }} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            + Mouvement
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {creating && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, position: 'relative' }}>
              <input
                autoFocus
                placeholder="Nom du mouvement (ex: Zercher Squat)"
                value={newName}
                onChange={e => { setNewName(e.target.value); searchMovements(e.target.value) }}
                onKeyDown={e => e.key === 'Enter' && createMovement()}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
              />
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', left: 14, right: 14, top: 58, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden' }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onMouseDown={() => createMovement(s)}
                      style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                      📚 {s}
                    </button>
                  ))}
                </div>
              )}
              <select value={newUnit} onChange={e => setNewUnit(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', marginTop: 8 }}>
                {Object.entries(UNITS).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  style={{ flex: 1, boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  placeholder="Sous-catégorie (ex: Squats)"
                  value={newSubcategory}
                  onChange={e => setNewSubcategory(e.target.value)}
                  style={{ flex: 1, boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Choisis un mouvement suggéré (issu de la bibliothèque) ou entre un nom libre, puis l'unité et la catégorie.
              </div>
              <button onClick={() => createMovement()} disabled={saving || !newName.trim()}
                style={{ marginTop: 8, width: '100%', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? '…' : 'Ajouter au catalogue'}
              </button>
            </div>
          )}

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un mouvement…"
            style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          />

          {loading ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun mouvement</div>
              <div style={{ fontSize: 13 }}>Clique sur "+ Mouvement" pour ajouter le premier au catalogue.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>

              {/* Onglets catégories */}
              <div style={{ display: 'flex', gap: 6, padding: '12px 14px 0', overflowX: 'auto' }}>
                {tabs.map(cat => (
                  <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedSubcat('all') }} style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: selectedCategory === cat ? 'var(--green)' : 'var(--bg2)',
                    color: selectedCategory === cat ? '#fff' : 'var(--text2)',
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Pastilles sous-catégories */}
              {subcatOrder.length > 0 && (
                <div style={{ display: 'flex', gap: 6, padding: '10px 14px', overflowX: 'auto' }}>
                  <button onClick={() => setSelectedSubcat('all')} style={{
                    flexShrink: 0, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: `1px solid ${selectedSubcat === 'all' ? 'var(--text)' : 'var(--border2)'}`,
                    background: selectedSubcat === 'all' ? 'var(--text)' : 'transparent',
                    color: selectedSubcat === 'all' ? 'var(--bg)' : 'var(--text2)',
                  }}>
                    Tous
                  </button>
                  {subcatOrder.map((sc, i) => {
                    const color = DOT_COLORS[i % DOT_COLORS.length]
                    const active = selectedSubcat === sc
                    return (
                      <button key={sc} onClick={() => setSelectedSubcat(sc)} style={{
                        flexShrink: 0, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        border: `1px solid ${active ? color : 'var(--border2)'}`,
                        background: active ? `${color}1A` : 'transparent',
                        color: active ? color : 'var(--text2)',
                      }}>
                        {sc}
                      </button>
                    )
                  })}
                </div>
              )}

              {categoryMovements.length === 0 && (
                <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  Aucun mouvement dans cette catégorie.
                </div>
              )}

              {visibleSubcats.map(sc => (
                <div key={sc}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 14px 6px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLORS[subcatOrder.indexOf(sc) % DOT_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{sc}</span>
                  </div>

                  {bySubcat[sc].map(m => {
                    const isOpen = expandedId === m.id
                    const isEditingUnit = editingUnitFor === m.id
                    const isEditingName = editingNameFor === m.id
                    const cfg = unitOf(m)
                    return (
                      <div key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <div onClick={() => !isEditingName && setExpandedId(isOpen ? null : m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: isEditingName ? 'default' : 'pointer' }}>
                          <span style={{ fontSize: 11, color: 'var(--text3)', width: 14, flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>
                          {isEditingName ? (
                            <input
                              autoFocus
                              value={editNameVal}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setEditNameVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveName(m.id); if (e.key === 'Escape') setEditingNameFor(null) }}
                              onBlur={() => saveName(m.id)}
                              style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, padding: '4px 6px', border: '1px solid var(--border2)', borderRadius: 6, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                            />
                          ) : (
                            <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.name}
                            </div>
                          )}
                          {!isEditingName && (
                            <button onClick={e => { e.stopPropagation(); startEditName(m) }}
                              style={{ background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}>
                              ✏️
                            </button>
                          )}
                          {isEditingUnit ? (
                            <select
                              autoFocus
                              value={m.unit || 'kg'}
                              onClick={e => e.stopPropagation()}
                              onChange={e => changeUnit(m.id, e.target.value)}
                              onBlur={() => setEditingUnitFor(null)}
                              style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border2)', borderRadius: 6, background: 'var(--bg2)', color: 'var(--text)', flexShrink: 0 }}
                            >
                              {Object.entries(UNITS).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
                            </select>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setEditingUnitFor(m.id) }}
                              style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>
                              {cfg.label}
                            </button>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
                            {m.entries.length} perf.
                          </div>
                          <button onClick={e => { e.stopPropagation(); deleteMovement(m.id) }} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}>🗑️</button>
                        </div>

                        {isOpen && (
                          <div style={{ padding: '0 14px 14px' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                              <select value={m.category || 'À classer'} onChange={e => changeMeta(m.id, e.target.value, m.subcategory)}
                                style={{ flex: 1, boxSizing: 'border-box', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}>
                                {(m.category && !CATEGORIES.includes(m.category) ? [...CATEGORIES, m.category] : CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <input
                                placeholder="Sous-catégorie"
                                defaultValue={m.subcategory || ''}
                                onClick={e => e.stopPropagation()}
                                onBlur={e => changeMeta(m.id, m.category || 'Lift', e.target.value)}
                                style={{ flex: 1, boxSizing: 'border-box', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                              />
                            </div>
                            {m.entries.length === 0 ? (
                              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', padding: '4px 0 10px' }}>Aucune performance enregistrée pour ce mouvement.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {m.entries.map(e => {
                                  const isKg = m.unit === 'kg' || !m.unit
                                  const est = isKg ? estimate1RM(e) : null
                                  const filled = isKg
                                    ? [1, ...RM_KEYS].filter(r => e[`rm${r}`] != null).map(r => `${r}RM ${e[`rm${r}`]}kg`)
                                    : [e.value != null ? formatPerformance(m, e.value) : null].filter(Boolean)
                                  return (
                                    <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 11px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <Link href={`/semaine/${e.athletes?.id}/${today()}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', textDecoration: 'none', flexShrink: 0 }}>
                                          {e.athletes?.name || '—'}
                                        </Link>
                                        <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{formatDateFr(e.date)}</div>
                                        <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)', minWidth: 100 }}>{filled.join(' · ')}</div>
                                        {est && (
                                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                                            {est.value}kg{est.estimated ? ' (est.)' : ''}
                                          </div>
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
