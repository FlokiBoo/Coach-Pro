'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'
import { cloneTemplateToAthlete } from '@/lib/programTemplates'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

export default function GroupsPage() {
  const [groups, setGroups] = useState(null)
  const [athletes, setAthletes] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMemberIds, setNewMemberIds] = useState([])
  const [creating, setCreating] = useState(false)
  const [busyMemberKey, setBusyMemberKey] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: gs }, { data: aths }] = await Promise.all([
      supabase.from('groups').select('*, group_members(athlete_id, is_leader)').order('created_at', { ascending: false }),
      supabase.from('athletes').select('id, name').neq('archived', true).order('name'),
    ])
    setGroups(gs || [])
    setAthletes(aths || [])
  }

  const toggleNewMember = (id) => {
    setNewMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const openAdd = () => {
    setNewName('')
    setNewMemberIds([])
    setShowAdd(true)
  }

  const createGroup = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const coachId = await getCoachId()
    const { data: group, error } = await supabase.from('groups')
      .insert({ name: newName.trim(), coach_id: coachId })
      .select().single()
    if (error || !group) { alert('Erreur : ' + (error?.message || '')); setCreating(false); return }
    if (newMemberIds.length) {
      await supabase.from('group_members').insert(newMemberIds.map(athlete_id => ({ group_id: group.id, athlete_id })))
    }
    setCreating(false)
    setShowAdd(false)
    setGroups(prev => [{ ...group, group_members: newMemberIds.map(athlete_id => ({ athlete_id })) }, ...prev])
  }

  const deleteGroup = async (g) => {
    if (!confirm(`Supprimer le groupe "${g.name}" ? Les clients ne sont pas affectés.`)) return
    await supabase.from('groups').delete().eq('id', g.id)
    setGroups(prev => prev.filter(x => x.id !== g.id))
  }

  const toggleMember = async (group, athleteId) => {
    const isMember = group.group_members.some(m => m.athlete_id === athleteId)
    const key = `${group.id}-${athleteId}`
    setBusyMemberKey(key)
    if (isMember) {
      await supabase.from('group_members').delete().eq('group_id', group.id).eq('athlete_id', athleteId)
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, group_members: g.group_members.filter(m => m.athlete_id !== athleteId) } : g))
    } else {
      await supabase.from('group_members').insert({ group_id: group.id, athlete_id: athleteId })
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, group_members: [...g.group_members, { athlete_id: athleteId }] } : g))
      await syncLinkedTemplatesToNewMember(group.id, athleteId)
    }
    setBusyMemberKey(null)
  }

  const toggleLeader = async (group, athleteId) => {
    const member = group.group_members.find(m => m.athlete_id === athleteId)
    const nextLeader = !member?.is_leader
    setGroups(prev => prev.map(g => g.id !== group.id ? g : {
      ...g, group_members: g.group_members.map(m => m.athlete_id === athleteId ? { ...m, is_leader: nextLeader } : m),
    }))
    await supabase.from('group_members').update({ is_leader: nextLeader }).eq('group_id', group.id).eq('athlete_id', athleteId)
  }

  // Un nouveau membre reçoit automatiquement les templates liés au groupe (voir la case "garder
  // synchronisé" dans l'assignation de programme) — sauf s'il a déjà une copie du même template
  // (ex : retiré puis réajouté au groupe).
  const syncLinkedTemplatesToNewMember = async (groupId, athleteId) => {
    const { data: links } = await supabase.from('group_program_templates')
      .select('program_id, programs(title, activity_type)').eq('group_id', groupId)
    if (!links?.length) return
    const { data: existing } = await supabase.from('programs').select('source_program_id').eq('athlete_id', athleteId)
    const alreadyHas = new Set((existing || []).map(p => p.source_program_id).filter(Boolean))
    const coachId = await getCoachId()
    for (const link of links) {
      if (alreadyHas.has(link.program_id)) continue
      await cloneTemplateToAthlete({
        templateProgramId: link.program_id, templateTitle: link.programs?.title, templateActivityType: link.programs?.activity_type,
        athleteId, coachId, groupId,
      })
    }
  }

  if (groups === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18, marginBottom: 2 }}>👥 Groupes</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{groups.length} groupe{groups.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={openAdd} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            + Groupe
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {showAdd && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                autoFocus
                placeholder="Nom du groupe (ex: Cours collectif mardi)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
              />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Membres (optionnel)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
                  {athletes.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r)', border: newMemberIds.includes(a.id) ? '1.5px solid var(--green)' : '1px solid var(--border)', background: newMemberIds.includes(a.id) ? 'var(--green-light)' : 'var(--bg2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newMemberIds.includes(a.id)} onChange={() => toggleNewMember(a.id)}
                        style={{ accentColor: 'var(--green)', width: 15, height: 15 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: newMemberIds.includes(a.id) ? 'var(--green)' : 'var(--text)' }}>{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createGroup} disabled={creating || !newName.trim()} style={{ flex: 1, background: newName.trim() ? 'var(--green)' : 'var(--border)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {creating ? '…' : 'Créer le groupe'}
                </button>
                <button onClick={() => setShowAdd(false)} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 && !showAdd ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun groupe</div>
              <div style={{ fontSize: 13 }}>Crée un groupe pour assigner des séances à plusieurs clients d'un coup</div>
            </div>
          ) : groups.map(g => {
            const memberIds = new Set(g.group_members.map(m => m.athlete_id))
            const isOpen = expandedId === g.id
            return (
              <div key={g.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
                  <button onClick={() => setExpandedId(isOpen ? null : g.id)} style={{
                    flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 10, padding: 0,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {memberIds.size} membre{memberIds.size !== 1 ? 's' : ''}
                        {memberIds.size > 0 && ` · ${athletes.filter(a => memberIds.has(a.id)).map(a => a.name).join(', ')}`}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text3)', fontSize: 13, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  <Link href={`/groups/${g.id}`} style={{ flexShrink: 0, background: 'var(--green)', color: '#fff', borderRadius: 20, padding: '7px 14px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                    Ouvrir →
                  </Link>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Membres</div>
                    {athletes.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun client</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
                        {athletes.map(a => {
                          const isMember = memberIds.has(a.id)
                          const isLeader = g.group_members.find(m => m.athlete_id === a.id)?.is_leader
                          const busy = busyMemberKey === `${g.id}-${a.id}`
                          return (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r)', border: isMember ? '1.5px solid var(--green)' : '1px solid var(--border)', background: isMember ? 'var(--green-light)' : 'var(--bg2)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                                <input type="checkbox" checked={isMember} disabled={busy} onChange={() => toggleMember(g, a.id)}
                                  style={{ accentColor: 'var(--green)', width: 15, height: 15 }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: isMember ? 'var(--green)' : 'var(--text)' }}>{a.name}</span>
                              </label>
                              {isMember && (
                                <button onClick={() => toggleLeader(g, a.id)} title={isLeader ? 'Retirer le statut leader' : 'Faire de ce sportif un leader'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0, opacity: isLeader ? 1 : 0.3 }}>
                                  ⭐
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <button onClick={() => deleteGroup(g)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#DC2626', cursor: 'pointer', padding: '6px 0 0', fontWeight: 600, textAlign: 'left' }}>
                      🗑 Supprimer le groupe
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
