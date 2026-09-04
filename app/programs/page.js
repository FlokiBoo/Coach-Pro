'use client'

import { useState, useEffect } from 'react'
import {
  ClipboardText, User, CalendarBlank, Tag, PencilSimple, UsersThree, Prohibit, Megaphone, Gift,
  Trash, LinkSimple, CheckCircle,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'
import { notifyAssigned, notifyProgramAvailable } from '@/lib/notify'
import { cloneTemplateToAthlete } from '@/lib/programTemplates'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

// Aucun programme réel n'atteint ce nombre de séances : sert de valeur sentinelle pour
// "programme entièrement gratuit" sans ajouter de colonne dédiée (réutilise free_sessions_count,
// déjà géré par la logique de déblocage dans /api/athlete-view/[token]/route.js).
const FULLY_FREE_SESSIONS = 999

export default function ProgramsPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAthleteIds, setNewAthleteIds] = useState([])
  const [creating, setCreating] = useState(false)
  const [assignModal, setAssignModal] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [assignGroupId, setAssignGroupId] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [assignDone, setAssignDone] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('') // '' = Tous
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

  const toggleNewAthlete = (id) => {
    setNewAthleteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const createProgram = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const coachId = await getCoachId()

    if (newAthleteIds.length === 0) {
      // Template sans client
      const { data, error } = await supabase.from('programs')
        .insert({ title: newTitle.trim(), coach_id: coachId })
        .select().single()
      if (data) {
        await supabase.from('program_sessions').insert({ program_id: data.id, order_index: 0, title: 'Séance 1' })
        router.push(`/programs/templates/${data.id}`)
      } else {
        alert('Erreur : ' + (error?.message || ''))
        setCreating(false)
      }
      return
    }

    let firstId = null, firstProgId = null
    for (const aid of newAthleteIds) {
      const { data, error } = await supabase.from('programs')
        .insert({ athlete_id: aid, title: newTitle.trim(), coach_id: coachId })
        .select().single()
      if (data) {
        await supabase.from('program_sessions').insert({ program_id: data.id, order_index: 0, title: 'Séance 1' })
        if (!firstId) { firstId = aid; firstProgId = data.id }
      } else {
        alert('Erreur : ' + (error?.message || ''))
      }
    }
    if (firstId) router.push(`/programs/${firstId}/${firstProgId}`)
    else setCreating(false)
  }

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

  const deleteProgram = async (p) => {
    if (!confirm(`Supprimer "${p.title}" ?`)) return
    await supabase.from('programs').delete().eq('id', p.id)
    setPrograms(prev => prev.filter(x => x.id !== p.id))
  }

  const openAssign = (p) => {
    setAssignModal(p)
    setSelectedIds([])
    setAssignGroupId(null)
    setAssignDone(false)
    setKeepSynced(false)
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
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{programs.length} programme{programs.length !== 1 ? 's' : ''}</div>
            </div>
            <button onClick={() => setShowForm(v => !v)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Programme
            </button>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {showForm && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                autoFocus
                placeholder="Nom du programme (ex: Force 8 semaines)"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Assigner à</div>
                  <button
                    type="button"
                    onClick={() => setNewAthleteIds(newAthleteIds.length === athletes.length ? [] : athletes.map(a => a.id))}
                    style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--green)', cursor: 'pointer', padding: 0 }}
                  >
                    {newAthleteIds.length === athletes.length ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {athletes.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r)', border: newAthleteIds.includes(a.id) ? '1.5px solid var(--green)' : '1px solid var(--border)', background: newAthleteIds.includes(a.id) ? 'var(--green-light)' : 'var(--bg2)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newAthleteIds.includes(a.id)}
                        onChange={() => toggleNewAthlete(a.id)}
                        style={{ accentColor: 'var(--green)', width: 15, height: 15 }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: newAthleteIds.includes(a.id) ? 'var(--green)' : 'var(--text)' }}>{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createProgram} disabled={creating || !newTitle.trim()} style={{ flex: 1, background: newTitle.trim() ? 'var(--green)' : 'var(--border)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {creating ? '…' : newAthleteIds.length === 0 ? 'Créer comme template' : newAthleteIds.length > 1 ? `Créer pour ${newAthleteIds.length} clients` : 'Créer'}
                </button>
                <button onClick={() => { setShowForm(false); setNewAthleteIds([]) }} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {programs.filter(p => !p.athlete_id).length === 0 && !showForm ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><ClipboardText size={36} /></div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun template</div>
              <div style={{ fontSize: 13 }}>Clique sur "+ Programme" pour créer ton premier template</div>
            </div>
          ) : (() => {
            const allTemplates = programs.filter(p => !p.athlete_id)
            const allCategories = [...new Set(allTemplates.map(p => p.activity_type).filter(Boolean))].sort()
            const templates = categoryFilter === '' ? allTemplates : allTemplates.filter(p => p.activity_type === categoryFilter)
            const renderProgram = (p) => {
              const href = p.athlete_id ? `/programs/${p.athlete_id}/${p.id}` : `/programs/templates/${p.id}`
              return (
                <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                  <Link href={href} style={{ display: 'block', padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{p.athlete_id ? <><User size={11} /> {p.athletes?.name || '—'}</> : <><ClipboardText size={11} /> Template</>}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarBlank size={11} /> {(p.program_sessions || []).length} séance{(p.program_sessions || []).length !== 1 ? 's' : ''}</span>
                      {p.activity_type && <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Tag size={11} /> {p.activity_type}</span>}
                      {p.available_to_clients && <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Disponible sportifs</span>}
                    </div>
                  </Link>
                  <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link href={href} style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><PencilSimple size={12} /> Modifier</Link>
                    {athletes.length > 0 && (
                      <button onClick={() => openAssign(p)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', padding: 0, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><UsersThree size={12} /> Assigner</button>
                    )}
                    {!p.athlete_id && (
                      <button onClick={() => toggleAvailable(p)} style={{ background: 'none', border: 'none', fontSize: 12, color: p.available_to_clients ? '#B91C1C' : 'var(--green)', cursor: 'pointer', padding: 0, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {p.available_to_clients ? <><Prohibit size={12} /> Retirer de la sélection</> : <><Megaphone size={12} /> Rendre disponible aux sportifs</>}
                      </button>
                    )}
                    {!p.athlete_id && p.available_to_clients && (
                      p.free_sessions_count >= FULLY_FREE_SESSIONS ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Gift size={12} /> Programme entièrement gratuit</span>
                          <button onClick={() => saveFreeSessionsCount(p, '')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', padding: 0, fontWeight: 600, textDecoration: 'underline' }}>
                            Limiter
                          </button>
                        </div>
                      ) : (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                          Séances gratuites :
                          <input type="number" min="0" placeholder="3 par défaut"
                            defaultValue={p.free_sessions_count ?? ''}
                            onBlur={e => saveFreeSessionsCount(p, e.target.value)}
                            style={{ width: 50, boxSizing: 'border-box', padding: '3px 6px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                          <button onClick={() => saveFreeSessionsCount(p, String(FULLY_FREE_SESSIONS))} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--green)', cursor: 'pointer', padding: 0, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Gift size={12} /> Rendre tout gratuit
                          </button>
                        </label>
                      )
                    )}
                    <button onClick={() => deleteProgram(p)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#DC2626', cursor: 'pointer', padding: 0, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash size={12} /> Supprimer</button>
                  </div>
                </div>
              )
            }
            return (
              <>
                {allTemplates.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 2px', display: 'flex', alignItems: 'center', gap: 5 }}><ClipboardText size={13} /> Templates</div>
                )}
                {allCategories.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                    <button onClick={() => setCategoryFilter('')} style={{
                      flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: categoryFilter === '' ? 'var(--green)' : 'var(--bg2)',
                      color: categoryFilter === '' ? '#fff' : 'var(--text2)',
                      fontSize: 13, fontWeight: 700,
                    }}>
                      Tous
                    </button>
                    {allCategories.map(cat => (
                      <button key={cat} onClick={() => setCategoryFilter(cat)} style={{
                        flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        background: categoryFilter === cat ? 'var(--green)' : 'var(--bg2)',
                        color: categoryFilter === cat ? '#fff' : 'var(--text2)',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
                {templates.length === 0 && categoryFilter !== '' && (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px', fontSize: 13 }}>
                    Aucun template dans cette catégorie
                  </div>
                )}
                {templates.map(renderProgram)}
              </>
            )
          })()}
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
