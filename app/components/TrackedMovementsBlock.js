'use client'

import { useState, useEffect, useMemo } from 'react'
import { Trophy, PencilSimple, Trash } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import MovementDetailView from './MovementDetailView'
import { RACE_TARGETS, computeRaceEstimates, buildKnownRaces, computeThreshold60, computeDeltaZones, formatDistance, formatPace, parsePaceInput } from '@/lib/raceEstimates'

const RM_KEYS = [2, 3, 4, 5, 6]
export const CATEGORIES = ['Lift', 'Gym', 'Cardio', 'Autre']
export const DOT_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
export const isRunningSubcat = (category, subcat) => category === 'Cardio' && /run|course/i.test(subcat || '')

export const UNITS = {
  kg:          { label: 'Kg (charge)',       suffix: 'kg',   betterIsHigher: true },
  time:        { label: 'Temps (h/min/sec)', suffix: '',     betterIsHigher: false },
  cal:         { label: 'Calories',          suffix: 'cal',  betterIsHigher: true },
  height_cm:   { label: 'Hauteur (cm)',      suffix: 'cm',   betterIsHigher: true },
  length_cm:   { label: 'Longueur (cm)',     suffix: 'cm',   betterIsHigher: true },
  watt:        { label: 'Watt',              suffix: 'W',    betterIsHigher: true },
  reps:        { label: 'Répétitions',       suffix: 'reps', betterIsHigher: true },
  distance_m:  { label: 'Distance (m)',      suffix: 'm',    betterIsHigher: true },
  distance_km: { label: 'Distance (km)',     suffix: 'km',   betterIsHigher: true },
  speed_kmh:   { label: 'Vitesse (km/h)',    suffix: 'km/h', betterIsHigher: true },
  score:       { label: 'Score / Points',    suffix: 'pts',  betterIsHigher: true },
}

export function unitOf(movement) {
  return UNITS[movement?.unit] || UNITS.kg
}

export function formatTime(totalSeconds) {
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Estime le 1RM (formule d'Epley) à partir du RM rempli le plus lourd entre 2 et 6RM (unité kg uniquement)
export function estimate1RM(entry) {
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

// Meilleure performance pour un mouvement, quelle que soit son unité — sauf si le sportif a
// explicitement marqué une entrée comme record malgré une valeur inférieure (is_pr), auquel cas
// cette entrée (la plus récente si plusieurs) fait foi à la place du calcul numérique.
export function bestPerformance(movement, entries) {
  const flagged = entries.filter(e => e.is_pr).sort((a, b) => b.date.localeCompare(a.date))
  if (flagged.length) {
    const e = flagged[0]
    if (movement.unit === 'kg' || !movement.unit) {
      const est = estimate1RM(e)
      if (est) return { ...est, isManualPr: true }
    } else if (e.value != null) {
      return { value: e.value, estimated: false, isManualPr: true }
    }
  }

  if (movement.unit === 'kg' || !movement.unit) {
    return entries.reduce((acc, e) => {
      const est = estimate1RM(e)
      if (!est) return acc
      return (!acc || est.value > acc.value) ? est : acc
    }, null)
  }
  const cfg = unitOf(movement)
  const vals = entries.filter(e => e.value != null).map(e => e.value)
  if (!vals.length) return null
  const value = cfg.betterIsHigher ? Math.max(...vals) : Math.min(...vals)
  return { value, estimated: false }
}

export function formatPerformance(movement, value) {
  const cfg = unitOf(movement)
  if (movement.unit === 'time') return formatTime(value)
  return `${value}${cfg.suffix ? ' ' + cfg.suffix : ''}`
}

export function emptyEntryForm() {
  return { date: new Date().toISOString().slice(0, 10), rm1: '', rm2: '', rm3: '', rm4: '', rm5: '', rm6: '', h: '', m: '', s: '', value: '', note: '', avg_pace: '', distance_km: '', intervals: [] }
}

export default function TrackedMovementsBlock({ athleteId, isCoach = false }) {
  const [movements, setMovements] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('kg')
  const [newCategory, setNewCategory] = useState('Lift')
  const [newSubcategory, setNewSubcategory] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [detailMovementId, setDetailMovementId] = useState(null)
  const [search, setSearch] = useState('')
  const [editingNameFor, setEditingNameFor] = useState(null)
  const [editNameVal, setEditNameVal] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Lift')
  const [selectedSubcat, setSelectedSubcat] = useState('all')

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

    // Lie (ou crée) l'entrée correspondante dans la bibliothèque de mouvements
    const { data: existingLib } = await supabase.from('movements').select('id').ilike('name', label).maybeSingle()
    let libId = existingLib?.id
    if (!libId) {
      const { data: newLib } = await supabase.from('movements').insert({ name: label }).select().single()
      libId = newLib?.id
    }

    const payload = { name: label, unit: newUnit, category: newCategory, subcategory: newSubcategory.trim() || null, movement_id: libId || null }
    const { data, error } = await supabase.from('tracked_movements').insert(payload).select().single()
    if (data) {
      setMovements(prev => [...(prev || []), { ...data, entries: [] }])
    } else if (error?.code === '23505') {
      const { data: existing } = await supabase.from('tracked_movements').select('*').eq('name', label).single()
      if (existing && !movements.some(m => m.id === existing.id)) {
        setMovements(prev => [...(prev || []), { ...existing, entries: [] }])
      }
    }
    setNewName('')
    setNewUnit('kg')
    setNewSubcategory('')
    setSuggestions([])
    setCreating(false)
    setSaving(false)
  }

  const saveMeta = async (id, category, subcategory) => {
    const payload = { category, subcategory: subcategory?.trim() || null }
    const { error } = await supabase.from('tracked_movements').update(payload).eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    setMovements(prev => prev.map(m => m.id === id ? { ...m, ...payload } : m))
  }

  const deleteMovement = async (id) => {
    if (!confirm('Supprimer ce mouvement du catalogue global (et tout son historique, pour tous les clients) ?')) return
    await supabase.from('tracked_movements').delete().eq('id', id)
    setMovements(prev => prev.filter(m => m.id !== id))
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
    setMovements(prev => prev.map(m => m.id === id ? { ...m, name } : m))
    setEditingNameFor(null)
  }

  const saveEntry = async (movement, form) => {
    const f = form
    const payload = {
      tracked_movement_id: movement.id,
      athlete_id: athleteId,
      date: f.date,
      note: f.note.trim() || null,
    }

    if (isRunningSubcat(movement.category, movement.subcategory) && movement.unit === 'distance_m') {
      // Tests à durée fixe (6min/20min) : distances typiquement sous 2-3 km, saisies directement
      // en mètres — un champ "km" avec x1000 implicite fait entrer des valeurs ~1000x trop grandes
      // (bug constaté : 1475 tapé en pensant "mètres" → stocké comme 1475 km, VMA/estimations absurdes).
      const distanceM = f.distance_km ? parseFloat(f.distance_km) : null
      if (!distanceM) return
      payload.distance_km = Math.round(distanceM) / 1000
      payload.value = Math.round(distanceM)
    } else if (isRunningSubcat(movement.category, movement.subcategory)) {
      const distanceKm = f.distance_km ? parseFloat(f.distance_km) : null
      const paceSec = parsePaceInput(f.avg_pace)
      if (!distanceKm && !paceSec) return
      payload.avg_pace = f.avg_pace.trim() || null
      payload.distance_km = distanceKm
      payload.intervals = (f.intervals || []).filter(it => it.distance || it.pace)
      payload.value = (distanceKm && paceSec) ? Math.round(distanceKm * paceSec) : null
      if (payload.value == null) return
    } else if (movement.unit === 'kg' || !movement.unit) {
      RM_KEYS.forEach(r => { payload[`rm${r}`] = f[`rm${r}`] ? parseFloat(f[`rm${r}`]) : null })
      payload.rm1 = f.rm1 ? parseFloat(f.rm1) : null
      if (!Object.keys(payload).some(k => k.startsWith('rm') && payload[k] != null)) return
    } else if (movement.unit === 'time') {
      const total = (parseInt(f.h) || 0) * 3600 + (parseInt(f.m) || 0) * 60 + (parseInt(f.s) || 0)
      if (!total) return
      payload.value = total
    } else {
      if (!f.value) return
      payload.value = parseFloat(f.value)
    }

    // Si la nouvelle perf n'améliore pas le record actuel, on demande si elle doit quand même
    // devenir le record affiché (utile si les conditions du test ont changé, par exemple).
    const currentBest = bestPerformance(movement, movement.entries)
    if (currentBest) {
      const candidateValue = (movement.unit === 'kg' || !movement.unit)
        ? estimate1RM(payload)?.value
        : payload.value
      if (candidateValue != null) {
        const cfg = unitOf(movement)
        const improves = cfg.betterIsHigher ? candidateValue > currentBest.value : candidateValue < currentBest.value
        if (!improves) {
          const ok = confirm(
            `Cette performance (${formatPerformance(movement, candidateValue)}) n'améliore pas ton record actuel `
            + `(${formatPerformance(movement, currentBest.value)}). L'enregistrer quand même comme nouveau record ?`
          )
          if (ok) {
            await supabase.from('tracked_movement_entries').update({ is_pr: false })
              .eq('tracked_movement_id', movement.id).eq('athlete_id', athleteId)
            payload.is_pr = true
          }
        }
      }
    }

    setSaving(true)
    const { data } = await supabase.from('tracked_movement_entries').insert(payload).select().single()
    if (data) {
      setMovements(prev => prev.map(m => m.id === movement.id
        ? { ...m, entries: [...(payload.is_pr ? m.entries.map(e => ({ ...e, is_pr: false })) : m.entries), data].sort((a, b) => a.date.localeCompare(b.date)) }
        : m))
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

  const filteredMovements = movements.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()))

  const categoriesInData = new Set(movements.map(m => m.category || 'À classer'))
  const tabs = categoriesInData.has('À classer') ? [...CATEGORIES, 'À classer'] : CATEGORIES

  const categoryMovements = filteredMovements.filter(m => (m.category || 'À classer') === selectedCategory)
  const subcatOrder = []
  const bySubcat = {}
  categoryMovements.forEach(m => {
    const sc = m.subcategory?.trim() || 'Général'
    if (!bySubcat[sc]) { bySubcat[sc] = []; subcatOrder.push(sc) }
    bySubcat[sc].push(m)
  })
  const visibleSubcats = selectedSubcat === 'all' ? subcatOrder : subcatOrder.filter(sc => sc === selectedSubcat)

  const knownRaces = buildKnownRaces(movements)
  const raceEstimates = computeRaceEstimates(knownRaces)
  const threshold60 = computeThreshold60(knownRaces)
  const deltaZones = computeDeltaZones(knownRaces)

  // Mouvement réel derrière chaque cible de course (pour pouvoir cliquer et rentrer une donnée)
  const raceMovementByKey = {}
  movements.forEach(m => {
    const target = RACE_TARGETS.find(t => t.match(m.name))
    if (!target) return
    if ((target.kind === 'time' && m.unit === 'time') || (target.kind === 'distance' && m.unit === 'distance_m')) {
      raceMovementByKey[target.key] = m
    }
  })

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trophy size={13} /> Records &amp; Tests
          </div>
          {isCoach && (
            <button onClick={() => { setCreating(v => !v); setNewName(''); setNewUnit('kg'); setNewCategory(selectedCategory === 'À classer' ? 'Lift' : selectedCategory); setNewSubcategory('') }} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              + Mouvement
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
          PR = Personal Record (record personnel). Tes records de force (Lift, Gym…) mais aussi tes tests et estimations en course à pied — vois les onglets ci-dessous.
        </div>
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
            <div style={{ position: 'absolute', left: 12, right: 12, top: 46, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden' }}>
              {suggestions.map((s, i) => (
                <button key={i} onMouseDown={() => createMovement(s)}
                  style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <select value={newUnit} onChange={e => setNewUnit(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)', marginTop: 8 }}>
            {Object.entries(UNITS).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
              style={{ flex: 1, boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Sous-catégorie (ex: Squats)"
              value={newSubcategory}
              onChange={e => setNewSubcategory(e.target.value)}
              style={{ flex: 1, boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setCreating(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
            <button onClick={() => createMovement()} disabled={saving || !newName.trim()} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '…' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {/* Recherche */}
      {movements.length > 4 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un exercice…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid var(--border2)', borderRadius: 20, fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
          />
        </div>
      )}

      {/* Vide */}
      {movements.length === 0 && !creating && (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {isCoach ? 'Aucun mouvement dans le catalogue — clique sur "+ Mouvement" pour en ajouter un (visible pour tous les clients).' : 'Aucun mouvement suivi pour le moment.'}
        </div>
      )}

      {movements.length > 0 && (
        <>
          {/* Onglets catégories */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px 0', overflowX: 'auto' }}>
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

          {/* Sections par sous-catégorie */}
          {visibleSubcats.map((sc, i) => {
            const color = DOT_COLORS[subcatOrder.indexOf(sc) % DOT_COLORS.length]
            const isRunning = isRunningSubcat(selectedCategory, sc)
            const list = isRunning
              ? bySubcat[sc].filter(m => !RACE_TARGETS.some(t => t.match(m.name)))
              : bySubcat[sc]
            return (
              <div key={sc}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 14px 6px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{sc}</span>
                </div>

                {isRunning && raceEstimates.slice(0, 2).map(re => {
                  const movement = raceMovementByKey[re.key]
                  return (
                    <div key={re.key} onClick={movement ? () => setDetailMovementId(movement.id) : undefined}
                      style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: movement ? 'pointer' : 'default' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{re.label}</div>
                        {!re.measured && re.from?.length > 0 && (
                          <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700, marginTop: 1 }}>Estimation</div>
                        )}
                        {!movement && (
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginTop: 1 }}>Demande à ton coach de créer ce mouvement</div>
                        )}
                      </div>
                      {re.timeSec != null ? (
                        <div style={{ fontWeight: 800, fontSize: 15, color: re.measured ? 'var(--green)' : '#DC2626', flexShrink: 0 }}>{formatTime(re.timeSec)}</div>
                      ) : re.distanceM != null ? (
                        <div style={{ fontWeight: 800, fontSize: 15, color: re.measured ? 'var(--green)' : '#DC2626', flexShrink: 0 }}>{formatDistance(re.distanceM)}</div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', flexShrink: 0 }}>—</div>
                      )}
                    </div>
                  )
                })}

                {isRunning && (
                  <div style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Seuil 60min</div>
                      {threshold60 && (
                        <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700, marginTop: 1 }}>Calcul automatique (à partir du 6min et du 20min)</div>
                      )}
                    </div>
                    {threshold60 ? (
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#DC2626' }}>
                          {threshold60.lowKmh.toFixed(1)}–{threshold60.highKmh.toFixed(1)} km/h
                        </div>
                        <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 1 }}>
                          {formatPace(threshold60.highKmh)}–{formatPace(threshold60.lowKmh)} /km
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', flexShrink: 0 }}>—</div>
                    )}
                  </div>
                )}

                {isRunning && deltaZones && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>VMA</div>
                        <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700, marginTop: 1 }}>Calcul automatique (Demi Cooper, distance 6min ÷ 100)</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#DC2626', flexShrink: 0 }}>{deltaZones.vma.toFixed(1)} km/h</div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Δ (VMA − Seuil60)</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', flexShrink: 0 }}>{deltaZones.delta.toFixed(2)} km/h</div>
                    </div>
                    {deltaZones.zones.map(z => (
                      <div key={z.key} style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{z.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>Seuil60 + {Math.round(z.lowPct * 100)}–{Math.round(z.highPct * 100)}%Δ</div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#DC2626' }}>
                            {z.lowKmh.toFixed(1)}–{z.highKmh.toFixed(1)} km/h
                          </div>
                          <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 1 }}>
                            {formatPace(z.highKmh)}–{formatPace(z.lowKmh)} /km
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {isRunning && raceEstimates.slice(2).map(re => {
                  const movement = raceMovementByKey[re.key]
                  return (
                    <div key={re.key} onClick={movement ? () => setDetailMovementId(movement.id) : undefined}
                      style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: movement ? 'pointer' : 'default' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{re.label}</div>
                        {!re.measured && re.from?.length > 0 && (
                          <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700, marginTop: 1 }}>Estimation</div>
                        )}
                        {!movement && (
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginTop: 1 }}>Demande à ton coach de créer ce mouvement</div>
                        )}
                      </div>
                      {re.timeSec != null ? (
                        <div style={{ fontWeight: 800, fontSize: 15, color: re.measured ? 'var(--green)' : '#DC2626', flexShrink: 0 }}>{formatTime(re.timeSec)}</div>
                      ) : re.distanceM != null ? (
                        <div style={{ fontWeight: 800, fontSize: 15, color: re.measured ? 'var(--green)' : '#DC2626', flexShrink: 0 }}>{formatDistance(re.distanceM)}</div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', flexShrink: 0 }}>—</div>
                      )}
                    </div>
                  )
                })}

                {list.map(m => {
                  const best = bestPerformance(m, m.entries)
                  const isEditingName = editingNameFor === m.id
                  return (
                    <div key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <div onClick={() => !isEditingName && setDetailMovementId(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: isEditingName ? 'default' : 'pointer' }}>
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
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                          </div>
                        )}
                        {isCoach && !isEditingName && (
                          <button onClick={e => { e.stopPropagation(); startEditName(m) }} style={{ background: 'none', border: 'none', display: 'flex', cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}><PencilSimple size={13} /></button>
                        )}
                        {best ? (
                          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--green)', flexShrink: 0 }}>{formatPerformance(m, best.value)}</div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', flexShrink: 0 }}>—</div>
                        )}
                        {isCoach && !isEditingName && (
                          <button onClick={e => { e.stopPropagation(); deleteMovement(m.id) }} style={{ background: 'none', border: 'none', display: 'flex', cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}><Trash size={14} /></button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}

      {detailMovementId && (() => {
        const detailMovement = movements.find(m => m.id === detailMovementId)
        if (!detailMovement) return null
        return (
          <MovementDetailView
            movement={detailMovement}
            athleteId={athleteId}
            onClose={() => setDetailMovementId(null)}
            onSaveEntry={saveEntry}
            onDeleteEntry={(entryId) => deleteEntry(detailMovement.id, entryId)}
            isCoach={isCoach}
            onSaveMeta={isCoach ? (category, subcategory) => saveMeta(detailMovement.id, category, subcategory) : null}
          />
        )
      })()}
    </div>
  )
}

export function EntryForm({ movement, form, setForm, onCancel, onSave, saving }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isRunning = isRunningSubcat(movement.category, movement.subcategory)
  const isKg = !isRunning && (movement.unit === 'kg' || !movement.unit)
  const isTime = !isRunning && movement.unit === 'time'
  const raceTarget = RACE_TARGETS.find(t => t.match(movement.name))
  const distanceOnly = raceTarget?.kind === 'distance'
  const cfg = unitOf(movement)

  const intervals = form.intervals || []
  const addInterval = () => set('intervals', [...intervals, { distance: '', pace: '' }])
  const updateInterval = (i, field, val) => set('intervals', intervals.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  const removeInterval = (i) => set('intervals', intervals.filter((_, idx) => idx !== i))

  // TM (Training Max) = 90% du 1RM (saisi ou estimé via Epley depuis 2RM-6RM), recalculé en direct pendant la saisie.
  const formTM = (() => {
    if (!isKg) return null
    const parsed = { rm1: form.rm1 ? parseFloat(form.rm1) : null }
    RM_KEYS.forEach(r => { parsed[`rm${r}`] = form[`rm${r}`] ? parseFloat(form[`rm${r}`]) : null })
    const est = estimate1RM(parsed)
    return est ? Math.round(est.value * 0.9 * 10) / 10 : null
  })()

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Date</div>
        <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
      </div>

      {isKg && (
        <>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>TM (Training Max — 90% du 1RM)</div>
            <div style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, background: 'var(--bg3, #f0f0f0)', color: formTM != null ? 'var(--text)' : 'var(--text3)' }}>
              {formTM != null ? `${formTM} kg` : '—'}
            </div>
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
        </>
      )}

      {isTime && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Temps réalisé</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[{ k: 'h', label: 'Heures' }, { k: 'm', label: 'Minutes' }, { k: 's', label: 'Secondes' }].map(({ k, label }) => (
              <div key={k}>
                <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', marginBottom: 2 }}>{label}</div>
                <input type="number" min="0" value={form[k]} onChange={e => set(k, e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 4px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)', textAlign: 'center' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isRunning && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            {!distanceOnly && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Allure moyenne (min/km)</div>
                <input type="text" placeholder="ex: 5'30" value={form.avg_pace} onChange={e => set('avg_pace', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>
                {distanceOnly ? 'Distance parcourue (m)' : 'Distance parcourue (km)'}
              </div>
              <input
                type="number" step={distanceOnly ? '1' : '0.01'} min="0"
                placeholder={distanceOnly ? 'ex: 1475' : 'ex: 6.5'}
                value={form.distance_km} onChange={e => set('distance_km', e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
          </div>

          {!distanceOnly && intervals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {intervals.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" step="0.01" min="0" placeholder="Distance (km)" value={it.distance}
                    onChange={e => updateInterval(i, 'distance', e.target.value)}
                    style={{ flex: 1, boxSizing: 'border-box', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                  <input type="text" placeholder="Allure (min/km)" value={it.pace}
                    onChange={e => updateInterval(i, 'pace', e.target.value)}
                    style={{ flex: 1, boxSizing: 'border-box', padding: '7px 9px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                  <button onClick={() => removeInterval(i)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {!distanceOnly && (
            <button onClick={addInterval} style={{ background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '7px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
              + Ajouter un intervalle
            </button>
          )}
        </>
      )}

      {!isRunning && !isKg && !isTime && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>Valeur ({cfg.suffix})</div>
          <input type="number" step="0.1" min="0" placeholder={`ex: 10`} value={form.value} onChange={e => set('value', e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
        </div>
      )}

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

export function ProgressChart({ movement, entries }) {
  const isKg = movement.unit === 'kg' || !movement.unit
  const points = isKg
    ? entries.map(e => ({ date: e.date, val: estimate1RM(e)?.value })).filter(p => p.val != null)
    : entries.map(e => ({ date: e.date, val: e.value })).filter(p => p.val != null)
  if (points.length < 2) return null

  const W = 300, H = 90, PAD = 8
  const values = points.map(p => p.val)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((p.val - min) / range) * (H - PAD * 2)
    return { x, y, value: p.val }
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
            {formatPerformance(movement, c.value)}
          </text>
        ))}
      </svg>
    </div>
  )
}
