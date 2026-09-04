'use client'

import { useState, useEffect, useRef } from 'react'
import { CalendarBlank, Trash } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { getCoachId } from '@/lib/coach'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

function emptyForm() {
  return { name: '', athlete_id: '', target_kcal: '', target_proteines: '' }
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px',
  border: '1px solid var(--border2)', borderRadius: 6,
  fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)',
  fontFamily: 'inherit',
}

export default function PlansPage() {
  const [plans, setPlans] = useState([])
  const [athletes, setAthletes] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newForm, setNewForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  async function load() {
    const { data } = await supabase.from('nutrition_plans').select('*, athletes(name)').order('created_at', { ascending: false })
    setPlans(data || [])
    const { data: aths } = await supabase.from('athletes').select('id, name').neq('archived', true).order('name')
    setAthletes(aths || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (showCreate) nameRef.current?.focus() }, [showCreate])

  async function create() {
    if (!newForm.name.trim()) return
    setSaving(true)
    const coachId = await getCoachId()
    const { data, error } = await supabase.from('nutrition_plans').insert({
      name: newForm.name.trim(),
      athlete_id: newForm.athlete_id || null,
      target_kcal: newForm.target_kcal ? Number(newForm.target_kcal) : null,
      target_proteines: newForm.target_proteines ? Number(newForm.target_proteines) : null,
      coach_id: coachId,
    }).select('*, athletes(name)').single()
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setPlans(prev => [data, ...prev])
    setNewForm(emptyForm())
    setShowCreate(false)
  }

  async function remove(id) {
    if (!window.confirm('Supprimer ce plan ?')) return
    await supabase.from('nutrition_plans').delete().eq('id', id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  const filtered = plans.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="coach-layout">
      <AthletesSidebar athleteId={null} date={today()} />

      <main className="coach-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 19, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><CalendarBlank size={18} /> Plans nutritionnels</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{plans.length} plan{plans.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => { setShowCreate(v => !v); setNewForm(emptyForm()) }}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Ajouter
          </button>
        </div>

        {showCreate && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: '#F0FDF4', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Nom *</div>
              <input ref={nameRef} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="Ex: Prise de masse - Semaine 1" style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 160 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Sportif</div>
              <select value={newForm.athlete_id} onChange={e => setNewForm(f => ({ ...f, athlete_id: e.target.value }))} style={inputStyle}>
                <option value="">— Aucun —</option>
                {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Cible kcal</div>
              <input type="number" value={newForm.target_kcal} onChange={e => setNewForm(f => ({ ...f, target_kcal: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Cible protéines</div>
              <input type="number" value={newForm.target_proteines} onChange={e => setNewForm(f => ({ ...f, target_proteines: e.target.value }))} style={inputStyle} />
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

        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
          <input
            placeholder="Rechercher un plan…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, background: 'var(--bg2)', fontSize: 14 }}
          />
        </div>

        <div style={{ padding: '0 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px' }}>Aucun plan.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden', margin: '16px 0' }}>
              {filtered.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 2, fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>{p.athletes?.name || '—'}</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>{p.target_kcal ?? '—'} kcal</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>P {p.target_proteines ?? '—'}g</div>
                  <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><Trash size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
