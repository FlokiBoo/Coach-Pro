'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getCoachId } from '@/lib/coach'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

function emptyForm() {
  return { name: '', description: '', kcal: '', proteines: '', glucides: '', lipides: '' }
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px',
  border: '1px solid var(--border2)', borderRadius: 6,
  fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)',
  fontFamily: 'inherit',
}

export default function RecettesPage() {
  const [recettes, setRecettes] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newForm, setNewForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  const [spoonQuery, setSpoonQuery] = useState('')
  const [spoonResults, setSpoonResults] = useState(null)
  const [spoonSearching, setSpoonSearching] = useState(false)
  const [spoonError, setSpoonError] = useState('')
  const [importingId, setImportingId] = useState(null)

  async function load() {
    const { data } = await supabase.from('recettes').select('*').order('name')
    setRecettes(data || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (showCreate) nameRef.current?.focus() }, [showCreate])

  async function create() {
    if (!newForm.name.trim()) return
    setSaving(true)
    const coachId = await getCoachId()
    const { data, error } = await supabase.from('recettes').insert({
      name: newForm.name.trim(),
      description: newForm.description.trim() || null,
      kcal: newForm.kcal ? Number(newForm.kcal) : null,
      proteines: newForm.proteines ? Number(newForm.proteines) : null,
      glucides: newForm.glucides ? Number(newForm.glucides) : null,
      lipides: newForm.lipides ? Number(newForm.lipides) : null,
      coach_id: coachId,
    }).select().single()
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setRecettes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'fr')))
    setNewForm(emptyForm())
    setShowCreate(false)
  }

  async function remove(id) {
    if (!window.confirm('Supprimer cette recette ?')) return
    await supabase.from('recettes').delete().eq('id', id)
    setRecettes(prev => prev.filter(r => r.id !== id))
  }

  async function spoonSearch() {
    if (!spoonQuery.trim()) return
    setSpoonSearching(true)
    setSpoonError('')
    setSpoonResults(null)
    const res = await fetch(`/api/spoonacular/search?query=${encodeURIComponent(spoonQuery.trim())}`)
    const json = await res.json()
    setSpoonSearching(false)
    if (json.error) { setSpoonError(json.error); return }
    setSpoonResults(json.results)
  }

  async function importSpoonRecipe(r) {
    setImportingId(r.id)
    const coachId = await getCoachId()
    const { data, error } = await supabase.from('recettes').insert({
      name: r.title,
      description: r.sourceUrl || null,
      kcal: r.kcal != null ? Math.round(r.kcal) : null,
      proteines: r.proteines != null ? Math.round(r.proteines) : null,
      glucides: r.glucides != null ? Math.round(r.glucides) : null,
      lipides: r.lipides != null ? Math.round(r.lipides) : null,
      coach_id: coachId,
    }).select().single()
    setImportingId(null)
    if (error) { alert('Erreur : ' + error.message); return }
    setRecettes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'fr')))
    setSpoonResults(prev => prev.filter(x => x.id !== r.id))
  }

  const filtered = recettes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="coach-layout">
      <AthletesSidebar athleteId={null} date={today()} />

      <main className="coach-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>🍳 Recettes</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{recettes.length} recette{recettes.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => { setShowCreate(v => !v); setNewForm(emptyForm()) }}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Ajouter
          </button>
        </div>

        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>🥄 Importer depuis Spoonacular</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={spoonQuery}
              onChange={e => setSpoonQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), spoonSearch())}
              placeholder="Ex: chicken bowl, salmon salad…"
              style={inputStyle}
            />
            <button onClick={spoonSearch} disabled={spoonSearching || !spoonQuery.trim()}
              style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {spoonSearching ? '…' : '🔍 Chercher'}
            </button>
          </div>
          {spoonError && <div style={{ fontSize: 12, color: '#DC2626' }}>{spoonError}</div>}
          {spoonResults && spoonResults.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucun résultat.</div>
          )}
          {spoonResults && spoonResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {spoonResults.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  {r.image && <img src={r.image} alt="" width={40} height={40} style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {r.kcal != null ? `${Math.round(r.kcal)} kcal` : '—'} · P {r.proteines != null ? Math.round(r.proteines) : '—'}g · G {r.glucides != null ? Math.round(r.glucides) : '—'}g · L {r.lipides != null ? Math.round(r.lipides) : '—'}g
                    </div>
                  </div>
                  <button onClick={() => importSpoonRecipe(r)} disabled={importingId === r.id}
                    style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    {importingId === r.id ? '…' : '+ Importer'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {showCreate && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: '#F0FDF4', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Nom *</div>
                <input ref={nameRef} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Bowl poulet-riz" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Kcal</div>
                <input type="number" value={newForm.kcal} onChange={e => setNewForm(f => ({ ...f, kcal: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Protéines</div>
                <input type="number" value={newForm.proteines} onChange={e => setNewForm(f => ({ ...f, proteines: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Glucides</div>
                <input type="number" value={newForm.glucides} onChange={e => setNewForm(f => ({ ...f, glucides: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Lipides</div>
                <input type="number" value={newForm.lipides} onChange={e => setNewForm(f => ({ ...f, lipides: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Description</div>
              <input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="Ingrédients, préparation…" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
              <button onClick={create} disabled={saving || !newForm.name.trim()}
                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
          <input
            placeholder="Rechercher une recette…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, background: 'var(--bg2)', fontSize: 14 }}
          />
        </div>

        <div style={{ padding: '0 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px' }}>Aucune recette.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden', margin: '16px 0' }}>
              {filtered.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                    {r.description && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>{r.kcal ?? '—'} kcal</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>P {r.proteines ?? '—'}g</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>G {r.glucides ?? '—'}g</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>L {r.lipides ?? '—'}g</div>
                  <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
