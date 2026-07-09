'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

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
  const [assigning, setAssigning] = useState(false)
  const [assignDone, setAssignDone] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: aths }, { data: progs }] = await Promise.all([
        supabase.from('athletes').select('id, name').neq('archived', true).order('created_at'),
        supabase.from('programs')
          .select('*, athletes(name), program_sessions(id)')
          .order('created_at', { ascending: false })
      ])
      setAthletes(aths || [])
      setPrograms(progs || [])
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
      // Modèle sans client
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

  const deleteProgram = async (p) => {
    if (!confirm(`Supprimer "${p.title}" ?`)) return
    await supabase.from('programs').delete().eq('id', p.id)
    setPrograms(prev => prev.filter(x => x.id !== p.id))
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

    const { data: sessions } = await supabase
      .from('program_sessions')
      .select('*, program_exercises(*)')
      .eq('program_id', assignModal.id)
      .order('order_index')

    for (const targetId of selectedIds) {
      const { data: newProg } = await supabase.from('programs')
        .insert({ athlete_id: targetId, title: assignModal.title, coach_id: coachId })
        .select().single()
      if (!newProg) continue

      for (const sess of (sessions || [])) {
        const { data: newSess } = await supabase.from('program_sessions')
          .insert({ program_id: newProg.id, order_index: sess.order_index, title: sess.title || '' })
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
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Programmes</div>
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
                  {creating ? '…' : newAthleteIds.length === 0 ? 'Créer comme modèle' : newAthleteIds.length > 1 ? `Créer pour ${newAthleteIds.length} clients` : 'Créer'}
                </button>
                <button onClick={() => { setShowForm(false); setNewAthleteIds([]) }} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {programs.filter(p => !p.athlete_id).length === 0 && !showForm ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun modèle</div>
              <div style={{ fontSize: 13 }}>Clique sur "+ Programme" pour créer ton premier modèle</div>
            </div>
          ) : (() => {
            const templates = programs.filter(p => !p.athlete_id)
            const renderProgram = (p) => {
              const href = p.athlete_id ? `/programs/${p.athlete_id}/${p.id}` : `/programs/templates/${p.id}`
              return (
                <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
                  <Link href={href} style={{ display: 'block', padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10 }}>
                      <span>{p.athlete_id ? `👤 ${p.athletes?.name || '—'}` : '📋 Modèle'}</span>
                      <span>📅 {(p.program_sessions || []).length} séance{(p.program_sessions || []).length !== 1 ? 's' : ''}</span>
                    </div>
                  </Link>
                  <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 12 }}>
                    <Link href={href} style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>✏️ Modifier</Link>
                    {athletes.length > 0 && (
                      <button onClick={() => openAssign(p)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>👥 Assigner</button>
                    )}
                    <button onClick={() => deleteProgram(p)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#DC2626', cursor: 'pointer', padding: 0, fontWeight: 600 }}>🗑 Supprimer</button>
                  </div>
                </div>
              )
            }
            return (
              <>
                {templates.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 2px' }}>📋 Modèles</div>
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
                  {athletes.filter(a => a.id !== assignModal.athlete_id).map(a => (
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
