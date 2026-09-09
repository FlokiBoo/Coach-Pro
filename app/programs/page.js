'use client'

import { useState, useEffect } from 'react'
import {
  ClipboardText, User, CalendarBlank, PencilSimple, UsersThree, Prohibit, Megaphone, Gift,
  Trash, LinkSimple, CheckCircle, MagnifyingGlass, DotsThreeVertical, CopySimple,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { notifyAssigned, notifyProgramAvailable } from '@/lib/notify'
import { cloneTemplateToAthlete } from '@/lib/programTemplates'
import { getCoachId } from '@/lib/coach'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function formatDateFr(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Aucun programme réel n'atteint ce nombre de séances : sert de valeur sentinelle pour
// "programme entièrement gratuit" sans ajouter de colonne dédiée (réutilise free_sessions_count,
// déjà géré par la logique de déblocage dans /api/athlete-view/[token]/route.js).
const FULLY_FREE_SESSIONS = 999

const selectStyle = { padding: '7px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }
const selectLabelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }

export default function ProgramsPage() {
  const [programs, setPrograms] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [assignGroupId, setAssignGroupId] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [assignDone, setAssignDone] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('') // '' = Tous
  const [statusFilter, setStatusFilter] = useState('') // '' | 'available' | 'template' | 'draft'
  const [sortBy, setSortBy] = useState('created_desc') // 'created_desc' | 'title_asc'
  const [search, setSearch] = useState('')
  const [openActionsId, setOpenActionsId] = useState(null)
  const [actionsMenuPos, setActionsMenuPos] = useState(null) // { top, right } en coordonnées viewport
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [groups, setGroups] = useState([])
  const [groupTemplateLinks, setGroupTemplateLinks] = useState([])
  const [keepSynced, setKeepSynced] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: aths }, { data: progs }, { data: grps }, { data: links }] = await Promise.all([
        supabase.from('athletes').select('id, name').neq('archived', true).order('created_at'),
        supabase.from('programs')
          .select('*, athletes(name), program_sessions(id)')
          .order('created_at', { ascending: false }),
        supabase.from('groups').select('*, group_members(athlete_id)').order('name'),
        supabase.from('group_program_templates').select('group_id, program_id'),
      ])
      setAthletes(aths || [])
      setPrograms(progs || [])
      setGroups(grps || [])
      setGroupTemplateLinks(links || [])
      setLoading(false)
    }
    load()
  }, [])

  const toggleAvailable = async (p) => {
    const next = !p.available_to_clients
    setPrograms(prev => prev.map(x => x.id === p.id ? { ...x, available_to_clients: next } : x))
    const { error } = await supabase.from('programs').update({ available_to_clients: next }).eq('id', p.id)
    if (error) {
      setPrograms(prev => prev.map(x => x.id === p.id ? { ...x, available_to_clients: !next } : x))
      alert('Erreur : ' + error.message)
      return
    }
    if (next) notifyProgramAvailable(p.id)
  }

  const saveFreeSessionsCount = async (p, value) => {
    const count = value === '' ? null : Math.max(0, parseInt(value) || 0)
    setPrograms(prev => prev.map(x => x.id === p.id ? { ...x, free_sessions_count: count } : x))
    await supabase.from('programs').update({ free_sessions_count: count }).eq('id', p.id)
  }

  const duplicateProgram = async (p) => {
    setDuplicatingId(p.id)
    const coachId = await getCoachId()
    const copy = await cloneTemplateToAthlete({
      templateProgramId: p.id, templateTitle: `${p.title} (copie)`, templateActivityType: p.activity_type,
      athleteId: null, coachId,
    })
    setDuplicatingId(null)
    setOpenActionsId(null)
    if (!copy) {
      alert('Erreur lors de la duplication.')
      return
    }
    const { data: full } = await supabase.from('programs')
      .select('*, athletes(name), program_sessions(id)').eq('id', copy.id).single()
    if (full) setPrograms(prev => [full, ...prev])
  }

  const deleteProgram = async (p) => {
    if (!confirm(`Supprimer "${p.title}" ?`)) return
    await supabase.from('programs').delete().eq('id', p.id)
    setPrograms(prev => prev.filter(x => x.id !== p.id))
    setOpenActionsId(null)
  }

  const openAssign = (p) => {
    setAssignModal(p)
    setSelectedIds([])
    setAssignGroupId(null)
    setAssignDone(false)
    setKeepSynced(false)
    setOpenActionsId(null)
  }

  const toggleAthlete = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setAssignGroupId(null)
    setKeepSynced(false)
  }

  const toggleGroupSelect = (g) => {
    const memberIds = g.group_members.map(m => m.athlete_id)
    const allSelected = memberIds.length > 0 && memberIds.every(id => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !memberIds.includes(id)))
      setAssignGroupId(null)
      setKeepSynced(false)
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...memberIds])])
      setAssignGroupId(g.id)
      // Sélectionner un groupe entier suggère l'intention de le garder à jour automatiquement —
      // le coach peut décocher s'il ne voulait qu'une copie ponctuelle.
      setKeepSynced(true)
    }
  }

  const isGroupLinked = (groupId, programId) => groupTemplateLinks.some(l => l.group_id === groupId && l.program_id === programId)

  const assignProgram = async () => {
    if (!selectedIds.length || !assignModal) return
    setAssigning(true)
    const coachId = await getCoachId()
    const batchId = crypto.randomUUID()

    for (const targetId of selectedIds) {
      await cloneTemplateToAthlete({
        templateProgramId: assignModal.id, templateTitle: assignModal.title, templateActivityType: assignModal.activity_type,
        athleteId: targetId, coachId, groupId: assignGroupId, batchId,
      })
    }

    if (assignGroupId && keepSynced && !isGroupLinked(assignGroupId, assignModal.id)) {
      const { error } = await supabase.from('group_program_templates')
        .insert({ group_id: assignGroupId, program_id: assignModal.id })
      if (!error) setGroupTemplateLinks(prev => [...prev, { group_id: assignGroupId, program_id: assignModal.id }])
    }

    notifyAssigned({ athleteIds: selectedIds, kind: 'program', title: assignModal.title })
    setAssigning(false)
    setAssignDone(true)
  }

  const unlinkGroupTemplate = async (groupId, programId) => {
    await supabase.from('group_program_templates').delete().eq('group_id', groupId).eq('program_id', programId)
    setGroupTemplateLinks(prev => prev.filter(l => !(l.group_id === groupId && l.program_id === programId)))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  const allTemplates = programs.filter(p => !p.athlete_id)
  const allCategories = [...new Set(allTemplates.map(p => p.activity_type).filter(Boolean))].sort()

  let visible = allTemplates
  if (categoryFilter) visible = visible.filter(p => p.activity_type === categoryFilter)
  if (statusFilter === 'available') visible = visible.filter(p => p.available_to_clients)
  else if (statusFilter === 'template') visible = visible.filter(p => p.is_template)
  else if (statusFilter === 'draft') visible = visible.filter(p => !p.is_template)
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    visible = visible.filter(p => {
      if (p.title?.toLowerCase().includes(q)) return true
      return programs.some(c => c.source_program_id === p.id && c.athletes?.name?.toLowerCase().includes(q))
    })
  }
  visible = [...visible].sort((a, b) => sortBy === 'title_asc'
    ? (a.title || '').localeCompare(b.title || '')
    : new Date(b.created_at) - new Date(a.created_at))

  const filtersActive = categoryFilter || statusFilter || search.trim()

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Programmes</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{allTemplates.length} programme{allTemplates.length !== 1 ? 's' : ''}</div>
            </div>
            <Link href="/programs/new" style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              + Programme
            </Link>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {allTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><ClipboardText size={36} /></div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun programme</div>
              <div style={{ fontSize: 13 }}>Clique sur "+ Programme" pour créer ton premier programme</div>
            </div>
          ) : (
            <>
              {/* Barre de recherche */}
              <div style={{ position: 'relative' }}>
                <MagnifyingGlass size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un programme ou un sportif"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
                />
              </div>

              {/* Filtres */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
                <div>
                  <div style={selectLabelStyle}>Statut</div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                    <option value="">Tous</option>
                    <option value="available">Disponible aux sportifs</option>
                    <option value="template">Templates</option>
                    <option value="draft">Brouillons</option>
                  </select>
                </div>
                {allCategories.length > 0 && (
                  <div>
                    <div style={selectLabelStyle}>Catégorie</div>
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selectStyle}>
                      <option value="">Toutes</option>
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 12, color: 'var(--text3)', paddingBottom: 8 }}>
                  {visible.length} programme{visible.length !== 1 ? 's' : ''}
                </div>
                <div>
                  <div style={selectLabelStyle}>Trier par</div>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
                    <option value="created_desc">Date de création</option>
                    <option value="title_asc">Nom (A → Z)</option>
                  </select>
                </div>
              </div>

              {/* Tableau */}
              {visible.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '30px 20px', fontSize: 13, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)' }}>
                  {filtersActive ? 'Aucun programme ne correspond à ces filtres.' : 'Aucun programme.'}
                </div>
              ) : (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflowX: 'auto' }}>
                  <div style={{ minWidth: 780 }}>
                    {/* En-tête */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                      <div style={{ flex: '2 1 260px', minWidth: 200, fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Programme</div>
                      <div style={{ flex: '1 1 200px', minWidth: 160, fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Assigné à</div>
                      <div style={{ flex: '0 0 130px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Objectif</div>
                      <div style={{ flex: '0 0 110px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Créé le</div>
                      <div style={{ flex: '0 0 32px' }} />
                    </div>

                    {visible.map((p, idx) => {
                      const href = p.athlete_id ? `/programs/${p.athlete_id}/${p.id}` : `/programs/templates/${p.id}`
                      const nSessions = (p.program_sessions || []).length
                      const assignedCopies = programs.filter(x => x.source_program_id === p.id)
                      const isFullyFree = p.free_sessions_count >= FULLY_FREE_SESSIONS
                      const actionsOpen = openActionsId === p.id
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: idx === visible.length - 1 ? 'none' : '1px solid var(--border)' }}>

                          {/* Programme */}
                          <div style={{ flex: '2 1 260px', minWidth: 200, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r)',
                              background: p.available_to_clients ? 'var(--green-light)' : 'var(--bg2)',
                              border: `1px solid ${p.available_to_clients ? '#B8EAD8' : 'var(--border2)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: p.available_to_clients ? 'var(--green)' : 'var(--text3)',
                            }}>
                              <ClipboardText size={18} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <Link href={href} style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)', textDecoration: 'none' }}>{p.title}</Link>
                              <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <CalendarBlank size={11} /> {nSessions} séance{nSessions !== 1 ? 's' : ''}{p.activity_type ? ` · ${p.activity_type}` : ''}
                              </div>
                            </div>
                          </div>

                          {/* Assigné à */}
                          <div style={{ flex: '1 1 200px', minWidth: 160, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {p.available_to_clients && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} /> Disponible sportifs
                              </span>
                            )}
                            {assignedCopies.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {assignedCopies.slice(0, 3).map(c => (
                                  <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20, padding: '2px 8px' }}>
                                    <User size={10} /> {c.athletes?.name || '—'}
                                  </span>
                                ))}
                                {assignedCopies.length > 3 && (
                                  <span style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 4px' }}>+{assignedCopies.length - 3}</span>
                                )}
                              </div>
                            ) : (!p.available_to_clients && <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>)}
                          </div>

                          {/* Objectif */}
                          <div style={{ flex: '0 0 130px', fontSize: 12, color: 'var(--text2)' }}>{p.goal || '—'}</div>

                          {/* Créé le */}
                          <div style={{ flex: '0 0 110px', fontSize: 12, color: 'var(--text3)' }}>{formatDateFr(p.created_at)}</div>

                          {/* Actions */}
                          <div style={{ flex: '0 0 32px', position: 'relative' }}>
                            <button
                              onClick={(e) => {
                                if (actionsOpen) { setOpenActionsId(null); return }
                                // position: fixed calculée depuis le bouton — la case "Assigné à" scrolle
                                // horizontalement (overflowX: auto), ce qui coupait le menu en position:
                                // absolute (overflow-y devient implicitement "auto" dès que overflow-x
                                // n'est pas "visible", donc le menu était rogné par ce même conteneur).
                                const rect = e.currentTarget.getBoundingClientRect()
                                setActionsMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                setOpenActionsId(p.id)
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex' }}
                            >
                              <DotsThreeVertical size={18} weight="bold" />
                            </button>
                            {actionsOpen && actionsMenuPos && (
                              <>
                                <div onClick={() => setOpenActionsId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                                <div style={{ position: 'fixed', top: actionsMenuPos.top, right: actionsMenuPos.right, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100, minWidth: 220, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <Link href={href} onClick={() => setOpenActionsId(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}>
                                    <PencilSimple size={14} /> Modifier
                                  </Link>
                                  {athletes.length > 0 && (
                                    <button onClick={() => openAssign(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                      <UsersThree size={14} /> Assigner
                                    </button>
                                  )}
                                  {!p.athlete_id && (
                                    <button onClick={() => duplicateProgram(p)} disabled={duplicatingId === p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                      <CopySimple size={14} /> {duplicatingId === p.id ? 'Duplication…' : 'Dupliquer'}
                                    </button>
                                  )}
                                  {!p.athlete_id && (
                                    <button onClick={() => toggleAvailable(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, fontSize: 13, color: p.available_to_clients ? '#B91C1C' : 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                      {p.available_to_clients ? <><Prohibit size={14} /> Retirer de la sélection</> : <><Megaphone size={14} /> Rendre disponible aux sportifs</>}
                                    </button>
                                  )}
                                  {!p.athlete_id && p.available_to_clients && (
                                    <div style={{ padding: '6px 10px', borderTop: '1px solid var(--border)', marginTop: 2 }}>
                                      {isFullyFree ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Gift size={12} /> Gratuit</span>
                                          <button onClick={() => saveFreeSessionsCount(p, '')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text3)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                                            Limiter
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Séances gratuites :</span>
                                          <input type="number" min="0" placeholder="3"
                                            defaultValue={p.free_sessions_count ?? ''}
                                            onBlur={e => saveFreeSessionsCount(p, e.target.value)}
                                            style={{ width: 44, boxSizing: 'border-box', padding: '3px 6px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                                          <button onClick={() => saveFreeSessionsCount(p, String(FULLY_FREE_SESSIONS))} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--green)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                                            Tout gratuit
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <button onClick={() => deleteProgram(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, fontSize: 13, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--border)', marginTop: 2 }}>
                                    <Trash size={14} /> Supprimer
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal assignation */}
      {assignModal && (
        <div onClick={() => setAssignModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Assigner à d'autres clients</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
              "{assignModal.title}" sera copié pour chaque client sélectionné.
            </div>

            {assignDone ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: '#16A34A', marginBottom: 8 }}><CheckCircle size={32} /></div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Programme assigné !</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
                  Une copie a été créée pour {selectedIds.length} client{selectedIds.length > 1 ? 's' : ''}.
                </div>
                <button onClick={() => setAssignModal(null)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Fermer
                </button>
              </div>
            ) : (
              <>
                {groups.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {groups.map(g => {
                      const memberIds = g.group_members.map(m => m.athlete_id)
                      const allSelected = memberIds.length > 0 && memberIds.every(id => selectedIds.includes(id))
                      const linked = isGroupLinked(g.id, assignModal.id)
                      return (
                        <button key={g.id} type="button" onClick={() => toggleGroupSelect(g)} disabled={memberIds.length === 0}
                          style={{
                            background: allSelected ? 'var(--green)' : 'var(--bg2)', color: allSelected ? '#fff' : 'var(--text2)',
                            border: allSelected ? 'none' : '1px solid var(--border2)', borderRadius: 20, padding: '6px 12px',
                            fontSize: 12, fontWeight: 700, cursor: memberIds.length === 0 ? 'default' : 'pointer', opacity: memberIds.length === 0 ? 0.5 : 1,
                          }}>
                          <UsersThree size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{g.name} ({memberIds.length}){linked ? <LinkSimple size={11} style={{ verticalAlign: -1, marginLeft: 4 }} /> : ''}
                        </button>
                      )
                    })}
                  </div>
                )}
                {assignGroupId && (
                  isGroupLinked(assignGroupId, assignModal.id) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--green)' }}>
                      <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}><LinkSimple size={12} /> Ce programme est lié à ce groupe — les nouveaux membres le reçoivent automatiquement.</span>
                      <button type="button" onClick={() => unlinkGroupTemplate(assignGroupId, assignModal.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--green)', textDecoration: 'underline', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={keepSynced} onChange={e => setKeepSynced(e.target.checked)}
                        style={{ accentColor: 'var(--green)', width: 16, height: 16 }} />
                      <LinkSimple size={12} style={{ verticalAlign: -1, marginRight: 4 }} />Garder synchronisé — les futurs membres de ce groupe recevront aussi ce programme automatiquement
                    </label>
                  )
                )}
                {(() => {
                  const alreadyAssignedIds = new Set(programs.filter(p => p.source_program_id === assignModal.id).map(p => p.athlete_id))
                  return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
                  {athletes.filter(a => a.id !== assignModal.athlete_id).map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r)', border: selectedIds.includes(a.id) ? '1.5px solid var(--green)' : '1px solid var(--border)', background: selectedIds.includes(a.id) ? 'var(--green-light)' : 'var(--bg2)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(a.id)}
                        onChange={() => toggleAthlete(a.id)}
                        style={{ accentColor: 'var(--green)', width: 16, height: 16 }}
                      />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: selectedIds.includes(a.id) ? 'var(--green)' : 'var(--text)' }}>{a.name}</span>
                      {alreadyAssignedIds.has(a.id) && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
                          ✓ Déjà assigné
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                  )
                })()}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={assignProgram}
                    disabled={assigning || selectedIds.length === 0}
                    style={{ flex: 1, background: selectedIds.length ? 'var(--green)' : 'var(--border)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '11px', fontSize: 14, fontWeight: 700, cursor: selectedIds.length ? 'pointer' : 'default' }}
                  >
                    {assigning ? 'Assignation…' : `Assigner à ${selectedIds.length || '—'} client${selectedIds.length > 1 ? 's' : ''}`}
                  </button>
                  <button onClick={() => setAssignModal(null)} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '11px 16px', fontSize: 14, cursor: 'pointer' }}>
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
