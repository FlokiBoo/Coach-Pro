'use client'

import { useState } from 'react'
import { EyeSlash, Backpack, ClipboardText, CalendarBlank } from '@phosphor-icons/react'
import { WEEK_DAYS, jsDayToWeekDay } from '@/lib/weekDays'

// Page d'accueil : la prochaine séance doit être visible immédiatement, sans scroll (retour
// terrain : objectifs/stats en haut noyaient l'élément principal) — ils ont leur propre onglet
// Stats désormais. Donc notes puis liste des séances simplifiée (nom + flèche → ouvre le mode
// focus existant), groupée par thème quand il y en a plusieurs. Le détail (séries/reps/
// progression) reste dans le mode focus, pas ici.
export default function WodTab({
  isCoachView, noteBlocks,
  programs, completions, skippedSessions, selectedType, setSelectedType,
  router, token, setActiveTab, onUpdateProgramDays,
}) {
  const [selectedProgramId, setSelectedProgramId] = useState(null)
  const [materielSession, setMaterielSession] = useState(null)
  const [dayPickerProgram, setDayPickerProgram] = useState(null)

  const openSession = (sessionId) => {
    router.push(`/s/${token}?session=${sessionId}&focus=1${isCoachView ? '&coach=1' : ''}`)
  }

  const boardPrograms = programs.filter(p => p.pinned_board !== false && !p.archived)

  // Retour terrain (Simon) : avec 2 templates actifs en parallèle (ex: Course + Hyrox), les
  // pastilles de sélection par programme/type ne donnent aucune vue d'ensemble claire de la
  // semaine. Deux façons d'obtenir un jour pour une séance : le coach le fixe séance par séance
  // sur le template (day_of_week), ou — pour les templates existants qu'on ne veut pas
  // réorganiser — le coach conseille juste un rythme (recommended_sessions_per_week) et c'est
  // l'athlète qui choisit ses jours (athlete_days_of_week) depuis son espace. Dans les deux cas
  // les séances rejoignent la même vue "Ma semaine", fusionnées par jour. Les programmes sans
  // aucun jour restent dans l'ancien système de pastilles ci-dessous (coexistence volontaire,
  // pas de migration forcée).
  const coachDatedPrograms = []
  const athleteDatedPrograms = []
  const unscheduledPrograms = []
  boardPrograms.forEach(prog => {
    if (prog.sessions.some(s => s.day_of_week != null)) coachDatedPrograms.push(prog)
    else if (prog.athlete_days_of_week?.length) athleteDatedPrograms.push(prog)
    else unscheduledPrograms.push(prog)
  })
  const datedProgramsCount = coachDatedPrograms.length + athleteDatedPrograms.length

  const dayGroups = WEEK_DAYS.map(d => ({ ...d, entries: [] }))
  coachDatedPrograms.forEach(prog => {
    const nextUncompleted = prog.sessions.find(s => !(completions.has(s.id) && !skippedSessions.has(s.id)))
    if (!nextUncompleted) return
    const weekSessions = nextUncompleted.week_number != null
      ? prog.sessions.filter(s => s.week_number === nextUncompleted.week_number)
      : [nextUncompleted]
    weekSessions.forEach(s => {
      if (s.day_of_week != null) dayGroups[s.day_of_week].entries.push({ session: s, program: prog })
    })
  })
  // Jours choisis par l'athlète : chaque séance est assignée à un jour fixe selon sa position
  // dans le programme (séance 1 → jour A, séance 2 → jour B, séance 3 → jour A à nouveau, etc.),
  // pas recalculé "à plat" à chaque validation — sinon compléter une séance décale toutes les
  // suivantes d'un jour à l'autre au lieu de garder chaque jour sur sa propre rotation stable.
  athleteDatedPrograms.forEach(prog => {
    const chosenDays = prog.athlete_days_of_week
    chosenDays.forEach((day, slotIdx) => {
      const sessionsForSlot = prog.sessions.filter((_, idx) => idx % chosenDays.length === slotIdx)
      const nextForSlot = sessionsForSlot.find(s => !(completions.has(s.id) && !skippedSessions.has(s.id)))
      if (nextForSlot) dayGroups[day].entries.push({ session: nextForSlot, program: prog })
    })
  })
  const todayWeekDay = jsDayToWeekDay(new Date().getDay())
  const hasDayView = datedProgramsCount > 0

  const renderSessionRow = (s, { showProgramLabel, isNext } = {}) => {
    const isDone = completions.has(s.id) && !skippedSessions.has(s.id)
    const isSkipped = skippedSessions.has(s.id)
    return (
      <div key={s.id} role="button" tabIndex={0} onClick={() => openSession(s.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openSession(s.id) }} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
        borderBottom: '1px solid var(--border)', padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
      }}>
        {isDone ? (
          <span style={{ color: 'var(--green)', fontSize: 15, flexShrink: 0 }}>✓</span>
        ) : isSkipped ? (
          <span style={{ color: '#DC2626', fontSize: 15, flexShrink: 0 }}>✗</span>
        ) : (
          <span style={{ width: 15, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: isNext ? 16 : 14, fontWeight: isNext ? 800 : 600, color: isDone || isSkipped ? 'var(--text3)' : 'var(--text)' }}>
            {s.hidden && <EyeSlash size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}{s.title || 'Séance'}
          </span>
          {showProgramLabel && (
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{showProgramLabel}</span>
          )}
        </span>
        {s.materiel && (
          <button onClick={e => { e.stopPropagation(); setMaterielSession(s) }} title="Matériel à prévoir pour cette séance"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20, padding: '2px 8px', display: 'flex', cursor: 'pointer', flexShrink: 0 }}>
            <Backpack size={13} />
          </button>
        )}
        <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
      </div>
    )
  }

  const allTypes = [...new Set(unscheduledPrograms.map(p => p.activity_type || 'Musculation 🏋️'))]
  const effectiveType = allTypes.length <= 1 ? null
    : ((selectedType && allTypes.includes(selectedType)) ? selectedType
      : ((unscheduledPrograms.find(p => p.sessions.some(s => !completions.has(s.id))) || unscheduledPrograms[0]).activity_type || 'Musculation 🏋️'))
  const typePrograms = effectiveType
    ? unscheduledPrograms.filter(p => (p.activity_type || 'Musculation 🏋️') === effectiveType)
    : unscheduledPrograms

  const effectiveProgramId = (selectedProgramId && typePrograms.some(p => p.id === selectedProgramId)) ? selectedProgramId
    : (typePrograms.find(p => p.sessions.some(s => !completions.has(s.id))) || typePrograms[0])?.id
  const visiblePrograms = typePrograms.filter(p => p.id === effectiveProgramId)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {noteBlocks.map(b => (
        <div key={b.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
          {b.title && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{b.title}</span>
            </div>
          )}
          {b.content && (
            <div className="font-editorial" style={{ padding: 14, fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{b.content}</div>
          )}
        </div>
      ))}

      {programs.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><ClipboardText size={36} /></div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Aucun programme actif</div>
          {!isCoachView && (
            <>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Sélectionne ton premier programme pour commencer.</div>
              <button onClick={() => setActiveTab?.('templates')} style={{
                background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
                padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Choisir un programme
              </button>
            </>
          )}
        </div>
      )}

      {boardPrograms.length === 0 && programs.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px', fontSize: 13 }}>
          Aucun programme épinglé au tableau de bord
        </div>
      )}

      {hasDayView && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarBlank size={14} /> Ma semaine
          </div>
          {dayGroups.map(d => (
            <div key={d.key}>
              <div style={{
                padding: '8px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px',
                background: d.key === todayWeekDay ? 'var(--green-light)' : 'var(--bg2)',
                color: d.key === todayWeekDay ? 'var(--green)' : 'var(--text3)',
              }}>
                {d.label}{d.key === todayWeekDay ? " · Aujourd'hui" : ''}
              </div>
              {d.entries.length === 0 ? (
                <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>
                  Repos
                </div>
              ) : (
                d.entries.map(({ session, program }) => renderSessionRow(session, {
                  showProgramLabel: datedProgramsCount > 1 ? program.title : null,
                }))
              )}
            </div>
          ))}
        </div>
      )}

      {allTypes.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allTypes.length}, minmax(100px, 1fr))`, gap: 8, overflowX: 'auto' }}>
          {allTypes.map(t => {
            const tPrograms = unscheduledPrograms.filter(p => (p.activity_type || 'Musculation 🏋️') === t)
            const total = tPrograms.reduce((n, p) => n + p.sessions.length, 0)
            const done = tPrograms.reduce((n, p) => n + p.sessions.filter(s => completions.has(s.id) && !skippedSessions.has(s.id)).length, 0)
            const isSelected = effectiveType === t
            return (
              <button key={t} onClick={() => setSelectedType(t)} style={{
                display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', minWidth: 0,
                background: isSelected ? 'var(--green-light)' : 'var(--bg)',
                border: isSelected ? '1.5px solid var(--green)' : '1px solid var(--border)',
                borderRadius: 'var(--rl)', padding: '10px 8px', cursor: 'pointer',
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? 'var(--green)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</div>
                {total > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>{done}/{total}</div>}
              </button>
            )
          })}
        </div>
      )}

      {typePrograms.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {typePrograms.map(p => {
            const isSelected = effectiveProgramId === p.id
            return (
              <button key={p.id} onClick={() => setSelectedProgramId(p.id)} style={{
                flexShrink: 0, background: isSelected ? 'var(--green-light)' : 'var(--bg)',
                border: isSelected ? '1.5px solid var(--green)' : '1px solid var(--border)',
                borderRadius: 20, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                color: isSelected ? 'var(--green)' : 'var(--text2)', whiteSpace: 'nowrap',
              }}>
                {p.title}
              </button>
            )
          })}
        </div>
      )}

      {visiblePrograms.map(prog => (
        <div key={prog.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
          {typePrograms.length <= 1 && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{prog.title}</span>
              {!isCoachView && onUpdateProgramDays && (
                <button onClick={() => setDayPickerProgram(prog)} style={{
                  background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20,
                  padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', flexShrink: 0,
                }}>
                  <CalendarBlank size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Choisir mes jours
                </button>
              )}
            </div>
          )}
          {(() => {
            const nextSessionId = prog.sessions.find(s => !(completions.has(s.id) && !skippedSessions.has(s.id)) && !skippedSessions.has(s.id))?.id
            return prog.sessions.map(s => renderSessionRow(s, { isNext: s.id === nextSessionId }))
          })()}
        </div>
      ))}

      {materielSession && (
        <div onClick={() => setMaterielSession(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Backpack size={32} /></div>
            <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 17, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
              Matériel à prévoir
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginBottom: 12 }}>{materielSession.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{materielSession.materiel}</div>
            <button onClick={() => setMaterielSession(null)} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Compris
            </button>
          </div>
        </div>
      )}

      {dayPickerProgram && (
        <DayPickerModal
          program={dayPickerProgram}
          onClose={() => setDayPickerProgram(null)}
          onSave={days => { onUpdateProgramDays(dayPickerProgram.id, days); setDayPickerProgram(null) }}
        />
      )}
    </div>
  )
}

function DayPickerModal({ program, onClose, onSave }) {
  const [selected, setSelected] = useState(new Set(program.athlete_days_of_week || []))
  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 17, fontWeight: 700, marginBottom: 4, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <CalendarBlank size={16} /> Mes jours — {program.title}
        </div>
        {(program.recommended_sessions_per_week || program.min_hours_between_sessions) && (
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginBottom: 12 }}>
            Conseillé par ton coach :{' '}
            {program.recommended_sessions_per_week ? `${program.recommended_sessions_per_week} séances/semaine` : ''}
            {program.recommended_sessions_per_week && program.min_hours_between_sessions ? ', ' : ''}
            {program.min_hours_between_sessions ? `min. ${program.min_hours_between_sessions}h d'écart entre les séances` : ''}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, marginBottom: 16 }}>
          {WEEK_DAYS.map(d => (
            <button key={d.key} onClick={() => toggle(d.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r)',
              border: selected.has(d.key) ? '1.5px solid var(--green)' : '1px solid var(--border2)',
              background: selected.has(d.key) ? 'var(--green-light)' : 'var(--bg2)',
              color: selected.has(d.key) ? 'var(--green)' : 'var(--text2)',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left',
            }}>
              <span>{selected.has(d.key) ? '✓' : ''}</span>
              {d.label}
            </button>
          ))}
        </div>
        <button onClick={() => onSave([...selected])} disabled={selected.size === 0}
          style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '11px', fontSize: 14, fontWeight: 700, cursor: selected.size === 0 ? 'default' : 'pointer', width: '100%', opacity: selected.size === 0 ? 0.5 : 1, marginBottom: 8 }}>
          Valider
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', padding: 6 }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
