'use client'

import { useState, useEffect } from 'react'
import { ClipboardText, CalendarBlank, Tag, Plus } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import { getCoachId } from '@/lib/coach'
import { cloneTemplateToAthlete } from '@/lib/programTemplates'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

export default function NewProgramPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null) // 'blank' ou l'id du template en cours de duplication

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
    setBusyId('blank')
    const coachId = await getCoachId()
    const { data, error } = await supabase.from('programs')
      .insert({ title: 'Nouveau programme', coach_id: coachId })
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

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <button onClick={createBlank} disabled={busyId !== null} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '16px', textAlign: 'left',
            background: 'var(--green-light)', border: '1.5px dashed var(--green)', borderRadius: 'var(--rl)',
            cursor: busyId ? 'default' : 'pointer', fontFamily: 'inherit', width: '100%',
          }}>
            <div style={{
              width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--r)', background: 'var(--green)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={22} weight="bold" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)' }}>
                {busyId === 'blank' ? 'Création…' : 'Créer un programme vierge'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Page blanche, tu construis les séances toi-même</div>
            </div>
          </button>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Ou partir d&apos;un template existant
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 30, fontSize: 13 }}>Chargement…</div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '30px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)', fontSize: 13 }}>
                Tu n&apos;as pas encore de template à dupliquer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(tpl => (
                  <button key={tpl.id} onClick={() => duplicateTemplate(tpl)} disabled={busyId !== null} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textAlign: 'left',
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
                    cursor: busyId ? 'default' : 'pointer', fontFamily: 'inherit', width: '100%',
                    opacity: busyId && busyId !== tpl.id ? 0.5 : 1,
                  }}>
                    <div style={{
                      width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--r)', background: 'var(--bg2)',
                      border: '1px solid var(--border2)', color: 'var(--text3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ClipboardText size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                        {busyId === tpl.id ? 'Duplication…' : tpl.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CalendarBlank size={11} /> {(tpl.program_sessions || []).length} séance{(tpl.program_sessions || []).length !== 1 ? 's' : ''}
                        </span>
                        {tpl.activity_type && (
                          <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Tag size={11} /> {tpl.activity_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
