'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Sélecteur "Activité" en recherche live : tape pour filtrer la liste, et si rien ne correspond,
// une option "+ Créer" en bas insère une nouvelle discipline dans activity_definitions.
export default function ActivityTypeSelect({ value, onChange, style, inputStyle }) {
  const [options, setOptions] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.from('activity_definitions').select('label').order('created_at')
      .then(({ data }) => {
        const labels = (data || []).map(d => d.label)
        // "Musculation 🏋️" est la valeur par défaut historique de l'app (fallback partout où
        // activity_type est vide) mais n'a jamais forcément de ligne dans activity_definitions.
        setOptions(labels.includes('Musculation 🏋️') ? labels : ['Musculation 🏋️', ...labels])
      })
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(search.trim().toLowerCase()))

  const select = (label) => {
    setOpen(false)
    onChange(label)
  }

  const createAndSelect = async () => {
    const label = search.trim()
    if (!label) return
    await supabase.from('activity_definitions').insert({ label, show_km: false, show_duration: false })
    setOptions(prev => [...prev, label])
    select(label)
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        // Champ non ouvert : affiche la valeur sélectionnée. Ouvert : reflète la saisie en cours
        // (vidée au focus pour montrer la liste complète, comme demandé par le coach).
        value={open ? search : (value || '')}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => { setSearch(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); filtered.length ? select(filtered[0]) : createAndSelect() } }}
        placeholder="Rechercher une activité…"
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, border: '1px solid var(--border2)', borderRadius: 'var(--r)', outline: 'none', background: 'var(--bg2)', color: 'var(--text)', padding: '10px 12px', ...inputStyle }}
      />
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
          {filtered.map(o => (
            <button key={o} onMouseDown={() => select(o)}
              style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: o === value ? 800 : 600, color: o === value ? 'var(--green)' : 'var(--text)', cursor: 'pointer' }}>
              {o === value ? '✓ ' : ''}{o}
            </button>
          ))}
          {filtered.length === 0 && search.trim() && (
            <button onMouseDown={createAndSelect}
              style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'var(--bg2)', border: 'none', fontSize: 13, fontWeight: 700, color: 'var(--green)', cursor: 'pointer' }}>
              + Créer « {search.trim()} »
            </button>
          )}
          {filtered.length === 0 && !search.trim() && (
            <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucune activité</div>
          )}
        </div>
      )}
    </div>
  )
}
