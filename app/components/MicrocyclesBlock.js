'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function MicrocyclesBlock({ athleteId }) {
  const [programs, setPrograms] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')

  useEffect(() => { load() }, [athleteId])

  async function load() {
    const { data } = await supabase
      .from('programs')
      .select('*, program_sessions(id, title, order_index)')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
    const progs = (data || []).map(p => ({
      ...p,
      sessions: [...(p.program_sessions || [])].sort((a, b) => a.order_index - b.order_index)
    }))
    setPrograms(progs)
  }

  async function createProgram() {
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('programs')
      .insert({ title: newName.trim(), athlete_id: athleteId })
      .select().single()
    if (data) {
      const prog = { ...data, sessions: [] }
      setPrograms(prev => [prog, ...prev])
      setExpandedId(data.id)
    }
    setNewName('')
    setCreating(false)
    setSaving(false)
  }

  async function renameProgram(id) {
    if (!renameVal.trim()) return
    await supabase.from('programs').update({ title: renameVal.trim() }).eq('id', id)
    setPrograms(prev => prev.map(p => p.id === id ? { ...p, title: renameVal.trim() } : p))
    setRenamingId(null)
  }

  async function deleteProgram(id) {
    if (!window.confirm('Supprimer ce micro-cycle et toutes ses séances ?')) return
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  async function createSession(programId) {
    const prog = programs.find(p => p.id === programId)
    const idx = prog?.sessions?.length || 0
    const { data } = await supabase.from('program_sessions')
      .insert({ program_id: programId, title: `Séance ${idx + 1}`, order_index: idx })
      .select().single()
    if (data) {
      setPrograms(prev => prev.map(p =>
        p.id === programId ? { ...p, sessions: [...p.sessions, data] } : p
      ))
    }
  }

  async function duplicateSession(sess, programId) {
    const prog = programs.find(p => p.id === programId)
    const idx = prog?.sessions?.length || 0
    const { data: newSess } = await supabase.from('program_sessions')
      .insert({ program_id: programId, title: sess.title + ' (copie)', order_index: idx })
      .select().single()
    if (!newSess) return
    const { data: exos } = await supabase.from('program_exercises')
      .select('*').eq('program_session_id', sess.id).order('order_index')
    if (exos?.length) {
      await supabase.from('program_exercises').insert(
        exos.map(({ id, program_session_id, ...e }) => ({ ...e, program_session_id: newSess.id }))
      )
    }
    setPrograms(prev => prev.map(p =>
      p.id === programId ? { ...p, sessions: [...p.sessions, newSess] } : p
    ))
  }

  async function deleteSession(sessId, programId) {
    await supabase.from('program_sessions').delete().eq('id', sessId)
    setPrograms(prev => prev.map(p =>
      p.id === programId ? { ...p, sessions: p.sessions.filter(s => s.id !== sessId) } : p
    ))
  }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          🔄 Micro-cycles
        </div>
        <button
          onClick={() => { setCreating(true); setNewName('') }}
          style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          + Créer
        </button>
      </div>

      {/* Formulaire création */}
      {creating && (
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <input
            autoFocus
            placeholder="Nom du micro-cycle…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProgram(); if (e.key === 'Escape') setCreating(false) }}
            style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          />
          <button onClick={() => setCreating(false)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px 10px', fontSize: 14, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
          <button onClick={createProgram} disabled={saving || !newName.trim()}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '…' : 'OK'}
          </button>
        </div>
      )}

      {/* Vide */}
      {programs.length === 0 && !creating && (
        <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Aucun micro-cycle — clique sur "+ Créer" pour commencer
        </div>
      )}

      {/* Liste des micro-cycles */}
      {programs.map((prog, pi) => {
        const isOpen = expandedId === prog.id
        const isRenaming = renamingId === prog.id

        return (
          <div key={prog.id} style={{ borderTop: '1px solid var(--border)' }}>

            {/* En-tête programme */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', cursor: 'pointer' }}
              onClick={() => !isRenaming && setExpandedId(isOpen ? null : prog.id)}>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 14, flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>

              {isRenaming ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameProgram(prog.id); if (e.key === 'Escape') setRenamingId(null) }}
                  onBlur={() => renameProgram(prog.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                />
              ) : (
                <span
                  style={{ flex: 1, fontWeight: 700, fontSize: 14 }}
                  onDoubleClick={e => { e.stopPropagation(); setRenamingId(prog.id); setRenameVal(prog.title) }}
                >
                  {prog.title}
                </span>
              )}

              <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                {prog.sessions.length} séance{prog.sessions.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={e => { e.stopPropagation(); deleteProgram(prog.id) }}
                style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}
              >🗑️</button>
            </div>

            {/* Séances */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                {prog.sessions.length === 0 && (
                  <div style={{ padding: '10px 14px 0', fontSize: 12, color: 'var(--text3)' }}>
                    Aucune séance
                  </div>
                )}

                {prog.sessions.map((sess, si) => (
                  <div key={sess.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, width: 18, flexShrink: 0 }}>
                      {si + 1}
                    </span>
                    <Link
                      href={`/programs/${athleteId}/${prog.id}?open=${sess.id}`}
                      style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}
                    >
                      {sess.title || `Séance ${si + 1}`}
                    </Link>
                    <button
                      onClick={() => duplicateSession(sess, prog.id)}
                      title="Dupliquer"
                      style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text3)', padding: '2px 4px', flexShrink: 0 }}
                    >⧉</button>
                    <button
                      onClick={() => deleteSession(sess.id, prog.id)}
                      title="Supprimer"
                      style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: 'var(--text3)', padding: '2px 4px', flexShrink: 0 }}
                    >🗑️</button>
                  </div>
                ))}

                <button
                  onClick={() => createSession(prog.id)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '10px 14px', fontSize: 13, color: 'var(--green)', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                >
                  + Ajouter une séance
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
