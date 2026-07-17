'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

export default function ProgramsPage({ params }) {
  const { athleteId } = use(params)
  const router = useRouter()
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([])
  const [allAthletes, setAllAthletes] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [newAthleteIds, setNewAthleteIds] = useState([athleteId])
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState(null) // program being assigned
  const [selectedIds, setSelectedIds] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [assignDone, setAssignDone] = useState(false)
  const [activityTypes, setActivityTypes] = useState([])
  const [newActivityType, setNewActivityType] = useState('Musculation 🏋️')
  const [selectedTypes, setSelectedTypes] = useState(new Set())
  const [typesInit, setTypesInit] = useState(false)

  useEffect(() => {
    supabase.from('activity_definitions').select('label').order('created_at')
      .then(({ data }) => setActivityTypes((data || []).map(d => d.label)))
  }, [])

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: ps }, { data: aths }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('programs')
          .select('*, program_sessions(id)')
          .eq('athlete_id', athleteId)
          .order('created_at', { ascending: false }),
        supabase.from('athletes').select('id, name').neq('archived', true).order('created_at')
      ])
      setAthlete(a)
      setPrograms(ps || [])
      setAllAthletes(aths || [])
      if (!typesInit && (ps || []).length) {
        setSelectedTypes(new Set((ps || []).map(p => p.activity_type || 'Musculation 🏋️')))
        setTypesInit(true)
      }
      setLoading(false)
    }
    load()
  }, [athleteId])

  const toggleType = (t) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  const toggleNewAthlete = (id) => {
    setNewAthleteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const createFreeSession = async () => {
    setCreating(true)
    const coachId = await getCoachId()
    const dateLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const { data: prog, error } = await supabase.from('programs')
      .insert({ athlete_id: athleteId, title: `Séance libre — ${dateLabel}`, coach_id: coachId })
      .select().single()
    if (!prog) { alert('Erreur : ' + (error?.message || 'impossible de créer la séance')); setCreating(false); return }
    const { data: sess } = await supabase.from('program_sessions')
      .insert({ program_id: prog.id, order_index: 0, title: 'Séance libre' })
      .select().single()
    router.push(`/programs/${athleteId}/${prog.id}${sess ? `?open=${sess.id}` : ''}`)
  }

  const createProgram = async () => {
    if (!newTitle.trim() || newAthleteIds.length === 0) return
    setCreating(true)
    const coachId = await getCoachId()
    let firstId = null, firstProgId = null
    for (const aid of newAthleteIds) {
      const { data, error } = await supabase.from('programs')
        .insert({ athlete_id: aid, title: newTitle.trim(), coach_id: coachId, activity_type: newActivityType })
        .select().single()
      if (data) {
        await supabase.from('program_sessions')
          .insert({ program_id: data.id, order_index: 0, title: 'Séance 1' })
        if (!firstId) { firstId = aid; firstProgId = data.id }
      } else {
        alert('Erreur : ' + (error?.message || 'impossible de créer le programme'))
      }
    }
    if (firstId) router.push(`/programs/${firstId}/${firstProgId}`)
    else setCreating(false)
  }

  const deleteProgram = async (id) => {
    if (!confirm('Supprimer ce programme et toutes ses séances ?')) return

    const { data: sessions } = await supabase.from('program_sessions').select('id').eq('program_id', id)
    const sessionIds = (sessions || []).map(s => s.id)
    if (sessionIds.length) {
      const { data: exos } = await supabase.from('program_exercises').select('id').in('program_session_id', sessionIds)
      const exoIds = (exos || []).map(e => e.id)
      if (exoIds.length) {
        await supabase.from('exercise_performance_history').delete().in('program_exercise_id', exoIds)
        await supabase.from('program_exercise_logs').delete().in('program_exercise_id', exoIds)
        await supabase.from('program_exercises').delete().in('id', exoIds)
      }
      await supabase.from('program_completions').delete().in('program_session_id', sessionIds)
      await supabase.from('program_sessions').delete().in('id', sessionIds)
    }

    const { error } = await supabase.from('programs').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    setPrograms(prev => prev.filter(p => p.id !== id))
  }

  const togglePinned = async (p) => {
    const next = p.pinned_board === false ? true : false
    await supabase.from('programs').update({ pinned_board: next }).eq('id', p.id)
    setPrograms(prev => prev.map(x => x.id === p.id ? { ...x, pinned_board: next } : x))
  }

  const openAssign = (p) => {
    setAssignModal(p)
    setSelectedIds([])
    setAssignDone(false)
  }

  const toggleAthlete = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const assignProgram = async () => {
    if (!selectedIds.length || !assignModal) return
    setAssigning(true)
    const coachId = await getCoachId()

    // Charger le programme complet avec sessions et exercices
    const { data: sessions } = await supabase
      .from('program_sessions')
      .select('*, program_exercises(*)')
      .eq('program_id', assignModal.id)
      .order('order_index')

    for (const targetId of selectedIds) {
      // Créer le programme pour cet athlète
      const { data: newProg } = await supabase.from('programs')
        .insert({ athlete_id: targetId, title: assignModal.title, coach_id: coachId, source_program_id: assignModal.id })
        .select().single()
      if (!newProg) continue

      for (const sess of (sessions || [])) {
        const { data: newSess } = await supabase.from('program_sessions')
          .insert({ program_id: newProg.id, order_index: sess.order_index, title: sess.title || '', source_session_id: sess.id })
          .select().single()
        if (!newSess) continue

        const exos = (sess.program_exercises || []).sort((a, b) => a.order_index - b.order_index)
        if (exos.length > 0) {
          await supabase.from('program_exercises').insert(
            exos.map(e => ({
              program_session_id: newSess.id,
              order_index: e.order_index,
              name: e.name,
              sets: e.sets,
              reps: e.reps,
              kg: e.kg,
              note: e.note,
              video_url: e.video_url,
              superset_group: e.superset_group,
              source_exercise_id: e.id,
            }))
          )
        }
      }
    }

    setAssigning(false)
    setAssignDone(true)
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
            <button onClick={createFreeSession} disabled={creating} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ⚡ Séance libre
            </button>
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
                placeholder="Nom du programme (ex: Prise de masse 8 semaines)"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
              />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Activité</div>
                <select
                  value={newActivityType}
                  onChange={e => setNewActivityType(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                >
                  {!activityTypes.includes('Musculation 🏋️') && <option value="Musculation 🏋️">Musculation 🏋️</option>}
                  {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Assigner à</div>
                  <button type="button" onClick={() => setNewAthleteIds(newAthleteIds.length === allAthletes.length ? [] : allAthletes.map(a => a.id))}
                    style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--green)', cursor: 'pointer', padding: 0 }}>
                    {newAthleteIds.length === allAthletes.length ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {allAthletes.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r)', border: newAthleteIds.includes(a.id) ? '1.5px solid var(--green)' : '1px solid var(--border)', background: newAthleteIds.includes(a.id) ? 'var(--green-light)' : 'var(--bg2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newAthleteIds.includes(a.id)} onChange={() => toggleNewAthlete(a.id)}
                        style={{ accentColor: 'var(--green)', width: 15, height: 15 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: newAthleteIds.includes(a.id) ? 'var(--green)' : 'var(--text)' }}>{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createProgram} disabled={creating || !newTitle.trim() || newAthleteIds.length === 0}
                  style={{ flex: 1, background: newTitle.trim() && newAthleteIds.length ? 'var(--green)' : 'var(--border)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {creating ? '…' : newAthleteIds.length > 1 ? `Créer pour ${newAthleteIds.length} clients` : 'Créer'}
                </button>
                <button onClick={() => { setShowForm(false); setNewAthleteIds([athleteId]) }}
                  style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {programs.length === 0 && !showForm ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun programme</div>
              <div style={{ fontSize: 13 }}>Crée un programme structuré pour {athlete?.name}</div>
            </div>
          ) : (() => {
            const allTypes = [...new Set(programs.map(p => p.activity_type || 'Musculation 🏋️'))]
            const visibleTypes = allTypes.filter(t => selectedTypes.has(t))
            return (
              <>
                {allTypes.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {allTypes.map(t => (
                      <button
                        key={t}
                        onClick={() => toggleType(t)}
                        style={{
                          background: selectedTypes.has(t) ? 'var(--green)' : 'var(--bg2)',
                          color: selectedTypes.has(t) ? '#fff' : 'var(--text2)',
                          border: selectedTypes.has(t) ? 'none' : '1px solid var(--border2)',
                          borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {visibleTypes.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '30px 20px', fontSize: 13 }}>
                    Sélectionne au moins une catégorie ci-dessus
                  </div>
                ) : (
                  <div style={{
                    display: 'grid', gridTemplateColumns: `repeat(${visibleTypes.length}, minmax(240px, 1fr))`,
                    gap: 12, overflowX: 'auto', alignItems: 'start',
                  }}>
                    {visibleTypes.map(type => {
                      const typePrograms = programs.filter(p => (p.activity_type || 'Musculation 🏋️') === type)
                      return (
                        <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                          {allTypes.length > 1 && (
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)' }}>{type}</div>
                          )}
                          {typePrograms.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun programme</div>
                          )}
                          {typePrograms.map(p => (
                            <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                              <Link href={`/programs/${athleteId}/${p.id}`} style={{ display: 'block', padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
                                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                                  {(p.program_sessions || []).length} séance{(p.program_sessions || []).length !== 1 ? 's' : ''}
                                </div>
                              </Link>
                              <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <Link href={`/programs/${athleteId}/${p.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>
                                  ✏️ Modifier
                                </Link>
                                {allAthletes.length > 0 && (
                                  <button onClick={() => openAssign(p)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                                    👥 Assigner
                                  </button>
                                )}
                                <button
                                  onClick={() => togglePinned(p)}
                                  title={p.pinned_board === false ? 'Afficher dans le tableau de bord côte à côte' : 'Masquer du tableau de bord côte à côte'}
                                  style={{ background: 'none', border: 'none', fontSize: 12, color: p.pinned_board === false ? 'var(--text3)' : 'var(--green)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                                >
                                  {p.pinned_board === false ? '📌 Épingler' : '📍 Épinglé'}
                                </button>
                                <button onClick={() => deleteProgram(p.id)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#DC2626', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                                  🗑 Supprimer
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* Modal assignation */}
      {assignModal && (
        <div onClick={() => setAssignModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Assigner à d'autres clients</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
              "{assignModal.title}" sera copié pour chaque client sélectionné.
            </div>

            {assignDone ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
                  {allAthletes.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r)', border: selectedIds.includes(a.id) ? '1.5px solid var(--green)' : '1px solid var(--border)', background: selectedIds.includes(a.id) ? 'var(--green-light)' : 'var(--bg2)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(a.id)}
                        onChange={() => toggleAthlete(a.id)}
                        style={{ accentColor: 'var(--green)', width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: selectedIds.includes(a.id) ? 'var(--green)' : 'var(--text)' }}>{a.name}</span>
                    </label>
                  ))}
                </div>

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
