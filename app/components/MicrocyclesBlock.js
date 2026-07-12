'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { getCoachId } from '@/lib/coach'

export default function MicrocyclesBlock({ athleteId, athleteToken }) {
  const router = useRouter()
  const [programs, setPrograms] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')
  const [creatingFree, setCreatingFree] = useState(false)
  const [activityTypes, setActivityTypes] = useState([])
  const [newActivityType, setNewActivityType] = useState('Musculation 🏋️')
  const [selectedSessions, setSelectedSessions] = useState(new Set())
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => { load() }, [athleteId])

  useEffect(() => {
    supabase.from('activity_definitions').select('label').order('created_at')
      .then(({ data }) => setActivityTypes((data || []).map(d => d.label)))
  }, [])

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

  async function createFreeSession() {
    setCreatingFree(true)
    const coachId = await getCoachId()
    const dateLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const { data: prog, error } = await supabase.from('programs')
      .insert({ athlete_id: athleteId, title: `Séance libre — ${dateLabel}`, coach_id: coachId })
      .select().single()
    if (!prog) { alert('Erreur : ' + (error?.message || 'impossible de créer la séance')); setCreatingFree(false); return }
    const { data: sess } = await supabase.from('program_sessions')
      .insert({ program_id: prog.id, order_index: 0, title: 'Séance libre' })
      .select().single()
    router.push(`/programs/${athleteId}/${prog.id}${sess ? `?open=${sess.id}` : ''}`)
  }

  async function createProgram() {
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('programs')
      .insert({ title: newName.trim(), athlete_id: athleteId, activity_type: newActivityType })
      .select().single()
    if (data) {
      const prog = { ...data, sessions: [] }
      setPrograms(prev => [prog, ...prev])
      setExpandedId(data.id)
    }
    setNewName('')
    setNewActivityType('Musculation 🏋️')
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

  async function duplicateSession(sess, programId, forcedIdx = null) {
    const prog = programs.find(p => p.id === programId)
    const idx = forcedIdx !== null ? forcedIdx : (prog?.sessions?.length || 0)
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

  async function duplicateSelected(programId) {
    const prog = programs.find(p => p.id === programId)
    if (!prog) return
    const toDuplicate = prog.sessions.filter(s => selectedSessions.has(s.id))
    if (!toDuplicate.length) return
    setDuplicating(true)
    let nextIdx = prog.sessions.length
    for (const sess of toDuplicate) {
      await duplicateSession(sess, programId, nextIdx)
      nextIdx++
    }
    setSelectedSessions(new Set())
    setDuplicating(false)
  }

  function toggleSessionSelected(id) {
    setSelectedSessions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={createFreeSession}
            disabled={creatingFree}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {creatingFree ? '…' : '⚡ Séance libre'}
          </button>
          <button
            onClick={() => { setCreating(true); setNewName('') }}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            + Créer
          </button>
        </div>
      </div>

      {/* Formulaire création */}
      {creating && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <input
            autoFocus
            placeholder="Nom du micro-cycle…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProgram(); if (e.key === 'Escape') setCreating(false) }}
            style={{ padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          />
          <select
            value={newActivityType}
            onChange={e => setNewActivityType(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          >
            {!activityTypes.includes('Musculation 🏋️') && <option value="Musculation 🏋️">Musculation 🏋️</option>}
            {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setCreating(false)} style={{ flex: 1, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px 10px', fontSize: 14, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
            <button onClick={createProgram} disabled={saving || !newName.trim()}
              style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '…' : 'Créer'}
            </button>
          </div>
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
              {!isRenaming && (
                <button
                  onClick={e => { e.stopPropagation(); setRenamingId(prog.id); setRenameVal(prog.title) }}
                  title="Renommer"
                  style={{ background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', flexShrink: 0 }}
                >✏️</button>
              )}
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
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(sess.id)}
                      onChange={() => toggleSessionSelected(sess.id)}
                      style={{ accentColor: 'var(--green)', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, width: 18, flexShrink: 0 }}>
                      {si + 1}
                    </span>
                    <Link
                      href={`/programs/${athleteId}/${prog.id}?open=${sess.id}`}
                      style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}
                    >
                      {sess.title || `Séance ${si + 1}`}
                    </Link>
                    {athleteToken && (
                      <a
                        href={`/s/${athleteToken}?coach=1&session=${sess.id}`}
                        target="_blank" rel="noreferrer"
                        title="Lancer cette séance (coaching)"
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--green)', padding: '2px 4px', flexShrink: 0, textDecoration: 'none' }}
                      >🏋️</a>
                    )}
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

                {prog.sessions.some(s => selectedSessions.has(s.id)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--green-light)' }}>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                      {prog.sessions.filter(s => selectedSessions.has(s.id)).length} sélectionnée(s)
                    </span>
                    <button
                      onClick={() => duplicateSelected(prog.id)}
                      disabled={duplicating}
                      style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {duplicating ? '…' : '⧉ Dupliquer'}
                    </button>
                    <button
                      onClick={() => setSelectedSessions(new Set())}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}
                    >
                      Annuler
                    </button>
                  </div>
                )}

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
