'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

const COLUMNS = [
  { key: 'name',        label: 'Nom du mouvement',   flex: 3 },
  { key: 'muscles',     label: 'Muscles principaux',  flex: 2 },
  { key: 'torque',      label: 'Torque',              flex: 1 },
  { key: 'youtube_url', label: 'Vidéo',               flex: 1 },
]

function emptyForm() {
  return { name: '', muscles: '', torque: '', youtube_url: '' }
}

export default function MovementsPage() {
  const router = useRouter()
  const [movements, setMovements] = useState([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [showCreate, setShowCreate] = useState(false)
  const [newForm, setNewForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { load() }, [])
  useEffect(() => { if (showCreate) nameRef.current?.focus() }, [showCreate])

  async function load() {
    const { data } = await supabase.from('movements').select('*').order('name')
    setMovements(data || [])
  }

  async function create() {
    if (!newForm.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('movements').insert({
      name: newForm.name.trim(),
      muscles: newForm.muscles.trim() || null,
      torque: newForm.torque.trim() || null,
      youtube_url: newForm.youtube_url.trim() || null,
    }).select().single()
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    if (!data) { alert('Mouvement non créé — exécute "ALTER TABLE movements DISABLE ROW LEVEL SECURITY;" dans Supabase'); setSaving(false); return }
    setMovements(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'fr')))
    setNewForm(emptyForm())
    setShowCreate(false)
    setSaving(false)
  }

  async function saveEdit() {
    if (!editForm.name.trim()) return
    setSaving(true)
    await supabase.from('movements').update({
      name: editForm.name.trim(),
      muscles: editForm.muscles.trim() || null,
      torque: editForm.torque.trim() || null,
      youtube_url: editForm.youtube_url.trim() || null,
    }).eq('id', editingId)
    setMovements(prev => prev.map(m =>
      m.id === editingId ? { ...m, ...editForm } : m
    ).sort((a, b) => a.name.localeCompare(b.name, 'fr')))
    setEditingId(null)
    setSaving(false)
  }

  async function remove(id) {
    if (!window.confirm('Supprimer ce mouvement ?')) return
    await supabase.from('movements').delete().eq('id', id)
    setMovements(prev => prev.filter(m => m.id !== id))
  }

  const filtered = movements.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.muscles || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.torque || '').toLowerCase().includes(search.toLowerCase())
  )

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '7px 10px',
    border: '1px solid var(--border2)', borderRadius: 6,
    fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)',
    fontFamily: 'inherit',
  }

  return (
    <div className="coach-layout">
      <AthletesSidebar athleteId={null} date={today()} />

      <main className="coach-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>📚 Bibliothèque</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{movements.length} mouvements</div>
          </div>
          <button
            onClick={() => { setShowCreate(v => !v); setNewForm(emptyForm()) }}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Ajouter
          </button>
        </div>

        {/* Formulaire création */}
        {showCreate && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: '#F0FDF4', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 3, minWidth: 160 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Nom *</div>
              <input ref={nameRef} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="Ex: Squat, Hip Thrust…" style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 130 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Muscles principaux</div>
              <input value={newForm.muscles} onChange={e => setNewForm(f => ({ ...f, muscles: e.target.value }))}
                placeholder="Ex: Quadriceps, Fessiers" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Torque</div>
              <input value={newForm.torque} onChange={e => setNewForm(f => ({ ...f, torque: e.target.value }))}
                placeholder="Ex: Interne" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Lien YouTube</div>
              <input value={newForm.youtube_url} onChange={e => setNewForm(f => ({ ...f, youtube_url: e.target.value }))}
                placeholder="https://…" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
              <button onClick={create} disabled={saving || !newForm.name.trim()}
                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* Barre de recherche */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 14 }}>🔍</span>
            <input
              placeholder="Rechercher par nom, muscle…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 34, background: 'var(--bg2)', fontSize: 14 }}
            />
          </div>
        </div>

        {/* En-tête colonnes */}
        <div style={{ display: 'flex', padding: '8px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          {COLUMNS.map(col => (
            <div key={col.key} style={{ flex: col.flex, fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {col.label}
            </div>
          ))}
          <div style={{ width: 72 }} />
        </div>

        {/* Lignes */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {search ? 'Aucun résultat pour cette recherche' : 'Aucun mouvement — clique sur "+ Ajouter"'}
            </div>
          )}

          {filtered.map(m => (
            <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>

              {editingId === m.id ? (
                /* Ligne en édition */
                <div style={{ display: 'flex', padding: '10px 24px', gap: 10, alignItems: 'center', background: '#F0FDF4' }}>
                  <div style={{ flex: 3 }}>
                    <input autoFocus value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      style={inputStyle} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <input value={editForm.muscles} onChange={e => setEditForm(f => ({ ...f, muscles: e.target.value }))}
                      placeholder="Muscles" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input value={editForm.torque} onChange={e => setEditForm(f => ({ ...f, torque: e.target.value }))}
                      placeholder="Torque" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input value={editForm.youtube_url} onChange={e => setEditForm(f => ({ ...f, youtube_url: e.target.value }))}
                      placeholder="URL YouTube" style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, width: 72, flexShrink: 0 }}>
                    <button onClick={() => setEditingId(null)}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
                    <button onClick={saveEdit} disabled={saving}
                      style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                  </div>
                </div>
              ) : (
                /* Ligne normale */
                <div
                  onClick={() => router.push(`/movements/${m.id}`)}
                  style={{ display: 'flex', padding: '13px 24px', alignItems: 'center', gap: 0, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 3, fontWeight: 600, fontSize: 14, color: 'var(--text)', paddingRight: 12 }}>
                    {m.name}
                  </div>
                  <div style={{ flex: 2, fontSize: 13, color: 'var(--text2)', paddingRight: 12 }}>
                    {m.muscles || <span style={{ color: 'var(--border2)' }}>—</span>}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text2)', paddingRight: 12 }}>
                    {m.torque || <span style={{ color: 'var(--border2)' }}>—</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    {m.youtube_url
                      ? <a href={m.youtube_url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          ▶ Vidéo
                        </a>
                      : <span style={{ color: 'var(--border2)', fontSize: 13 }}>—</span>
                    }
                  </div>
                  <div style={{ width: 72, display: 'flex', gap: 4, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); setEditingId(m.id); setEditForm({ name: m.name, muscles: m.muscles || '', torque: m.torque || '', youtube_url: m.youtube_url || '' }) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 15, cursor: 'pointer', padding: '4px 6px', borderRadius: 4 }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); remove(m.id) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', padding: '4px 6px', borderRadius: 4 }}>🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
