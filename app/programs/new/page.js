'use client'

import { useState, useEffect } from 'react'
import { ClipboardText, CalendarBlank, Tag, Plus, MagnifyingGlass, TrendUp } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import ActivityTypeSelect from '@/app/components/ActivityTypeSelect'
import { getCoachId } from '@/lib/coach'
import { cloneTemplateToAthlete } from '@/lib/programTemplates'

const LEVELS = ['Débutant', 'Intermédiaire', 'Avancé']

const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }
const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }
const selectStyle = { padding: '7px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }
const selectLabelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

export default function NewProgramPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null) // 'blank' ou l'id du template en cours de duplication
  const [showBlankForm, setShowBlankForm] = useState(false)
  const [blankTitle, setBlankTitle] = useState('')
  const [blankCategory, setBlankCategory] = useState('')
  const [blankGoal, setBlankGoal] = useState('')
  const [blankLevel, setBlankLevel] = useState('')
  const [blankEquipment, setBlankEquipment] = useState('')
  const [blankDuration, setBlankDuration] = useState('')
  const [search, setSearch] = useState('')
  const [goalFilter, setGoalFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => {
    async function load() {
      // is_template : statut explicite coché par le coach depuis l'éditeur d'un programme —
      // tous les programmes sans sportif assigné ne sont pas des templates réutilisables pour
      // autant (brouillons en cours, essais...), donc pas de filtre implicite sur athlete_id ici.
      const { data } = await supabase
        .from('programs')
        .select('*, program_sessions(id)')
        .eq('is_template', true)
        .order('created_at', { ascending: false })
      setTemplates(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const createBlank = async () => {
    if (!blankTitle.trim()) return
    setBusyId('blank')
    const coachId = await getCoachId()
    const { data, error } = await supabase.from('programs')
      .insert({
        title: blankTitle.trim(), coach_id: coachId,
        activity_type: blankCategory || 'Musculation 🏋️',
        goal: blankGoal.trim() || null,
        level: blankLevel || null,
        equipment: blankEquipment.trim() || null,
        duration_weeks: blankDuration ? parseInt(blankDuration) : null,
      })
      .select().single()
    if (!data) {
      alert('Erreur : ' + (error?.message || ''))
      setBusyId(null)
      return
    }
    await supabase.from('program_sessions').insert({ program_id: data.id, order_index: 0, title: 'Séance 1' })
    router.push(`/programs/templates/${data.id}`)
  }

  const duplicateTemplate = async (tpl) => {
    setBusyId(tpl.id)
    const coachId = await getCoachId()
    const copy = await cloneTemplateToAthlete({
      templateProgramId: tpl.id, templateTitle: `${tpl.title} (copie)`, templateActivityType: tpl.activity_type,
      athleteId: null, coachId,
    })
    if (!copy) {
      alert('Erreur lors de la duplication.')
      setBusyId(null)
      return
    }
    router.push(`/programs/templates/${copy.id}`)
  }

  const allGoals = [...new Set(templates.map(t => t.goal).filter(Boolean))].sort()
  const allCategories = [...new Set(templates.map(t => t.activity_type).filter(Boolean))].sort()

  let visibleTemplates = templates
  if (goalFilter) visibleTemplates = visibleTemplates.filter(t => t.goal === goalFilter)
  if (levelFilter) visibleTemplates = visibleTemplates.filter(t => t.level === levelFilter)
  if (categoryFilter) visibleTemplates = visibleTemplates.filter(t => t.activity_type === categoryFilter)
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    visibleTemplates = visibleTemplates.filter(t => t.title?.toLowerCase().includes(q))
  }

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/programs" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>Nouveau programme</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Vierge, ou à partir d&apos;un template existant</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {showBlankForm && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
              <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17 }}>Créer un programme vierge</div>
              <div>
                <div style={labelStyle}>Nom du programme</div>
                <input autoFocus value={blankTitle} onChange={e => setBlankTitle(e.target.value)}
                  placeholder="ex: Force 8 semaines" style={{ ...fieldStyle, fontSize: 15, padding: '12px 14px' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <div style={labelStyle}>Catégorie</div>
                  <ActivityTypeSelect value={blankCategory} onChange={setBlankCategory} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <div style={labelStyle}>Objectif</div>
                  <input value={blankGoal} onChange={e => setBlankGoal(e.target.value)}
                    placeholder="ex: Prise de masse" style={fieldStyle} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <div style={labelStyle}>Niveau</div>
                  <select value={blankLevel} onChange={e => setBlankLevel(e.target.value)} style={fieldStyle}>
                    <option value="">—</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Matériel</div>
                  <input value={blankEquipment} onChange={e => setBlankEquipment(e.target.value)}
                    placeholder="ex: Haltères, banc" style={fieldStyle} />
                </div>
                <div style={{ width: 140 }}>
                  <div style={labelStyle}>Durée (semaines)</div>
                  <input type="number" min="0" value={blankDuration} onChange={e => setBlankDuration(e.target.value)}
                    placeholder="ex: 8" style={fieldStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={createBlank} disabled={busyId !== null || !blankTitle.trim()} style={{
                  flex: 1, background: blankTitle.trim() ? 'var(--green)' : 'var(--border)', color: '#fff', border: 'none',
                  borderRadius: 'var(--r)', padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  {busyId === 'blank' ? 'Création…' : 'Créer le programme'}
                </button>
                <button onClick={() => setShowBlankForm(false)} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '11px 16px', fontSize: 14, cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              Créer un programme à partir d&apos;un template
            </div>

            {/* Filtres */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14, marginBottom: 14 }}>
              <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                <div style={selectLabelStyle}>Recherche</div>
                <div style={{ position: 'relative' }}>
                  <MagnifyingGlass size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom du template"
                    style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px' }} />
                </div>
              </div>
              {allGoals.length > 0 && (
                <div>
                  <div style={selectLabelStyle}>Objectif</div>
                  <select value={goalFilter} onChange={e => setGoalFilter(e.target.value)} style={selectStyle}>
                    <option value="">Tous</option>
                    {allGoals.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              )}
              <div>
                <div style={selectLabelStyle}>Niveau</div>
                <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={selectStyle}>
                  <option value="">Tous</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {allCategories.length > 0 && (
                <div>
                  <div style={selectLabelStyle}>Catégorie</div>
                  <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selectStyle}>
                    <option value="">Toutes</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Grille */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>

              {/* Carte "vierge" */}
              <button onClick={() => { setShowBlankForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{
                display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: 'var(--green-light)', border: '1.5px dashed var(--green)', borderRadius: 'var(--rl)', overflow: 'hidden', padding: 0,
              }}>
                <div style={{ aspectRatio: '3 / 2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                  <Plus size={32} weight="bold" />
                </div>
                <div style={{ padding: '10px 14px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>Programme vierge</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Page blanche, à construire toi-même</div>
                </div>
              </button>

              {loading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text3)', padding: 30, fontSize: 13 }}>Chargement…</div>
              ) : visibleTemplates.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text3)', padding: '30px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)', fontSize: 13 }}>
                  {templates.length === 0 ? 'Tu n’as pas encore de template à dupliquer.' : 'Aucun template ne correspond à ces filtres.'}
                </div>
              ) : visibleTemplates.map(tpl => {
                const nSessions = (tpl.program_sessions || []).length
                const busy = busyId === tpl.id
                return (
                  <button key={tpl.id} onClick={() => duplicateTemplate(tpl)} disabled={busyId !== null} style={{
                    display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: busyId ? 'default' : 'pointer', fontFamily: 'inherit',
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden', padding: 0,
                    opacity: busyId && !busy ? 0.5 : 1,
                  }}>
                    <div style={{
                      aspectRatio: '3 / 2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg2)', color: 'var(--text3)',
                    }}>
                      <ClipboardText size={30} />
                    </div>
                    <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{busy ? 'Duplication…' : tpl.title}</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CalendarBlank size={11} /> {tpl.duration_weeks ? `${tpl.duration_weeks} sem.` : `${nSessions} séance${nSessions !== 1 ? 's' : ''}`}
                        </span>
                        {tpl.level && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <TrendUp size={11} /> {tpl.level}
                          </span>
                        )}
                      </div>
                      {tpl.activity_type && (
                        <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
                          <Tag size={11} /> {tpl.activity_type}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
