'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

export default function ProgramsPage({ params }) {
  const { athleteId } = use(params)
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: ps }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('programs')
          .select('*, program_sessions(id)')
          .eq('athlete_id', athleteId)
          .order('created_at', { ascending: false })
      ])
      setAthlete(a)
      setPrograms(ps || [])
      setLoading(false)
    }
    load()
  }, [athleteId])

  const createProgram = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('programs')
      .insert({ athlete_id: athleteId, title: newTitle.trim() })
      .select().single()
    if (data) {
      setPrograms(prev => [{ ...data, program_sessions: [] }, ...prev])
      setNewTitle('')
      setShowForm(false)
    } else {
      console.error('Erreur création programme:', error)
      alert('Erreur : ' + (error?.message || 'impossible de créer le programme'))
    }
    setCreating(false)
  }

  const deleteProgram = async (id) => {
    if (!confirm('Supprimer ce programme et toutes ses séances ?')) return
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={athleteId} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <Link href={`/semaine/${athleteId}/${today()}`} style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{athlete?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Programmes d'entraînement</div>
            </div>
            <button onClick={() => setShowForm(v => !v)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Programme
            </button>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {showForm && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', gap: 8 }}>
              <input
                autoFocus
                placeholder="Nom du programme (ex: Prise de masse 8 semaines)"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createProgram()}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)' }}
              />
              <button onClick={createProgram} disabled={creating} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {creating ? '…' : 'Créer'}
              </button>
            </div>
          )}

          {programs.length === 0 && !showForm ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun programme</div>
              <div style={{ fontSize: 13 }}>Crée un programme structuré pour {athlete?.name}</div>
            </div>
          ) : programs.map(p => (
            <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
              <Link href={`/programs/${athleteId}/${p.id}`} style={{ display: 'block', padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {(p.program_sessions || []).length} séance{(p.program_sessions || []).length !== 1 ? 's' : ''}
                </div>
              </Link>
              <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 8 }}>
                <Link href={`/programs/${athleteId}/${p.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>
                  ✏️ Modifier
                </Link>
                <button onClick={() => deleteProgram(p.id)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#DC2626', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  🗑 Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
