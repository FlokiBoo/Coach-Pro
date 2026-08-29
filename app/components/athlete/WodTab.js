'use client'

import { useState } from 'react'
import ObjectivesBlock from '@/app/components/ObjectivesBlock'
import WeeklyStatsBlock from '@/app/components/WeeklyStatsBlock'
import ProgressBlock from '@/app/components/ProgressBlock'

// Page d'accueil : objectifs en premier, puis résumé/notes, puis la liste des séances
// simplifiée (nom + flèche → ouvre le mode focus existant), groupée par thème quand il y en a
// plusieurs. Le détail (séries/reps/progression) reste dans le mode focus, pas ici.
export default function WodTab({
  athlete, objectives, setObjectives, isCoachView, noteBlocks, activityRefreshKey,
  programs, completions, skippedSessions, selectedType, setSelectedType, isFinishedFreeSessionFn,
  router, token,
}) {
  const [selectedProgramId, setSelectedProgramId] = useState(null)

  const openSession = (sessionId) => {
    router.push(`/s/${token}?session=${sessionId}&focus=1${isCoachView ? '&coach=1' : ''}`)
  }

  const boardPrograms = programs.filter(p => p.pinned_board !== false && !p.archived && !isFinishedFreeSessionFn(p, completions))
  const allTypes = [...new Set(boardPrograms.map(p => p.activity_type || 'Musculation 🏋️'))]
  const effectiveType = allTypes.length <= 1 ? null
    : ((selectedType && allTypes.includes(selectedType)) ? selectedType
      : ((boardPrograms.find(p => p.sessions.some(s => !completions.has(s.id))) || boardPrograms[0]).activity_type || 'Musculation 🏋️'))
  const typePrograms = effectiveType
    ? boardPrograms.filter(p => (p.activity_type || 'Musculation 🏋️') === effectiveType)
    : boardPrograms

  const effectiveProgramId = (selectedProgramId && typePrograms.some(p => p.id === selectedProgramId)) ? selectedProgramId
    : (typePrograms.find(p => p.sessions.some(s => !completions.has(s.id))) || typePrograms[0])?.id
  const visiblePrograms = typePrograms.filter(p => p.id === effectiveProgramId)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {athlete?.id && <ObjectivesBlock athleteId={athlete.id} objectives={objectives} setObjectives={setObjectives} isCoach={isCoachView} />}

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

      <WeeklyStatsBlock athleteId={athlete.id} refreshKey={activityRefreshKey} />
      <ProgressBlock athleteId={athlete.id} />

      {programs.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600 }}>Aucun programme actif</div>
        </div>
      )}

      {boardPrograms.length === 0 && programs.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px', fontSize: 13 }}>
          Aucun programme épinglé au tableau de bord
        </div>
      )}

      {allTypes.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allTypes.length}, minmax(100px, 1fr))`, gap: 8, overflowX: 'auto' }}>
          {allTypes.map(t => {
            const typePrograms = boardPrograms.filter(p => (p.activity_type || 'Musculation 🏋️') === t)
            const total = typePrograms.reduce((n, p) => n + p.sessions.length, 0)
            const done = typePrograms.reduce((n, p) => n + p.sessions.filter(s => completions.has(s.id) && !skippedSessions.has(s.id)).length, 0)
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
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
              {prog.title}
            </div>
          )}
          {(() => {
            const nextSessionId = prog.sessions.find(s => !(completions.has(s.id) && !skippedSessions.has(s.id)) && !skippedSessions.has(s.id))?.id
            return prog.sessions.map(s => {
              const isDone = completions.has(s.id) && !skippedSessions.has(s.id)
              const isSkipped = skippedSessions.has(s.id)
              const isNext = s.id === nextSessionId
              return (
                <button key={s.id} onClick={() => openSession(s.id)} style={{
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
                  <span style={{ flex: 1, fontSize: isNext ? 16 : 14, fontWeight: isNext ? 800 : 600, color: isDone || isSkipped ? 'var(--text3)' : 'var(--text)' }}>
                    {s.title || 'Séance'}
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
                </button>
              )
            })
          })()}
        </div>
      ))}
    </div>
  )
}
