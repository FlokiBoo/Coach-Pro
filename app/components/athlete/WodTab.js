'use client'

import { useState, useEffect } from 'react'
import { ClipboardText, UsersThree, Play, Repeat, Barbell, Clock } from '@phosphor-icons/react'
import { WEEK_DAYS, jsDayToWeekDay } from '@/lib/weekDays'
import ObjectivesBlock from '@/app/components/ObjectivesBlock'
import SwipeCarousel from './SwipeCarousel'

// Aucune durée réelle n'est connue avant d'avoir fait la séance (duration_minutes n'existe qu'en
// feedback post-séance) — estimation grossière à partir du nombre de séries prescrites, juste pour
// donner un ordre de grandeur sur la carte "Séance du jour".
function estimateDurationMin(exercises) {
  const base = 5
  const perExo = (exercises || []).filter(e => e.name).reduce((sum, e) => sum + (parseInt(e.sets, 10) || 3) * 1.5, 0)
  return Math.round(base + perExo)
}

// Page d'accueil : la séance du jour doit être visible immédiatement, sans scroll. "Objectifs"
// (déplacé depuis l'onglet Stats, qui garde le reste) et "Séance du jour" (fusion des séances
// récurrentes + séances placées sur aujourd'hui) sont en tête — "Ma semaine" et l'affichage par
// type d'activité/programme non daté ont été retirés (redondants avec "Séance du jour").
export default function WodTab({
  isCoachView, noteBlocks,
  programs, completions, skippedSessions,
  router, token, setActiveTab,
  recurringTodayCounts = {},
  athlete, objectives, setObjectives,
}) {
  const [leaderGroups, setLeaderGroups] = useState([])

  const openSession = (sessionId) => {
    router.push(`/s/${token}?session=${sessionId}&focus=1${isCoachView ? '&coach=1' : ''}`)
  }

  // Un leader de groupe n'a pas accès à l'espace coach (/groups/...), confiné comme tout athlète à
  // /s/[token] — il pilote donc sa séance de groupe (présence, contenu, ressenti) depuis ici. Un
  // membre normal peut aussi voir apparaître le programme du groupe (sans bouton Lancer) si le
  // coach a réglé sa visibilité sur "Tout le monde" — le serveur tranche selon le rôle réel.
  useEffect(() => {
    if (isCoachView) return
    const n = new Date()
    const localDate = [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
    fetch(`/api/athlete-view/${token}/leader-groups?date=${localDate}`).then(r => r.json()).then(data => setLeaderGroups(data.groups || []))
  }, [isCoachView, token])

  // Un programme assigné à un groupe (fan-out depuis la fiche groupe) ne doit pas apparaître ici :
  // le sportif le suit en direct pendant la séance collective, pas en autonomie — l'afficher aussi
  // dans sa liste perso fait doublon avec ce qu'il vit en cours et surcharge l'écran pour rien.
  const boardPrograms = programs.filter(p => p.pinned_board !== false && !p.archived && !p.group_id)

  // Deux façons d'obtenir un jour pour une séance : le coach le fixe séance par séance sur le
  // template (day_of_week), ou l'athlète choisit ses jours (athlete_days_of_week) — dans les deux
  // cas la séance rejoint "Séance du jour" quand c'est aujourd'hui (voir todaysEntries plus bas).
  // Les programmes sans aucun jour assigné (unscheduledPrograms) ne remontent plus nulle part sur
  // cet écran — plus d'affichage par type d'activité ici (retiré, coach doit désormais assigner
  // des jours à toute séance ; TODO.md : reprendre l'accès à ces programmes tant qu'ils n'ont pas
  // de jour, ex. depuis l'onglet Templates).
  // Séance récurrente (session_type === 'recurrent') : vit hors du calendrier — elle ne compte pas
  // pour déterminer si un programme est "daté", elle est listée à part (voir recurringEntries plus
  // bas), et jamais "consommée" par la progression classique (reste proposable indéfiniment).
  const recurringEntries = []
  boardPrograms.forEach(prog => {
    prog.sessions.filter(s => s.session_type === 'recurrent').forEach(s => recurringEntries.push({ session: s, program: prog }))
  })

  const coachDatedPrograms = []
  const athleteDatedPrograms = []
  const unscheduledPrograms = []
  boardPrograms.forEach(prog => {
    if (prog.sessions.some(s => s.session_type !== 'recurrent' && s.day_of_week != null)) coachDatedPrograms.push(prog)
    else if (prog.athlete_days_of_week?.length) athleteDatedPrograms.push(prog)
    else if (!prog.sessions.every(s => s.session_type === 'recurrent')) unscheduledPrograms.push(prog)
  })
  const datedProgramsCount = coachDatedPrograms.length + athleteDatedPrograms.length

  const dayGroups = WEEK_DAYS.map(d => ({ ...d, entries: [] }))
  coachDatedPrograms.forEach(prog => {
    const progressionSessions = prog.sessions.filter(s => s.session_type !== 'recurrent')
    const nextUncompleted = progressionSessions.find(s => !(completions.has(s.id) && !skippedSessions.has(s.id)))
    if (!nextUncompleted) return
    const weekSessions = nextUncompleted.week_number != null
      ? progressionSessions.filter(s => s.week_number === nextUncompleted.week_number)
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

  // Bilan "Ma semaine" : séances de la semaine "active" de chaque programme daté par le coach
  // (même semaine que la prochaine séance non complétée, ou la dernière si tout est fait — même
  // ancrage que dayGroups ci-dessus). Les programmes datés par l'athlète (rotation par créneaux,
  // pas de week_number) n'ont pas de notion de "semaine" comparable et ne sont pas comptés ici.
  const weekTally = { done: 0, total: 0 }
  coachDatedPrograms.forEach(prog => {
    const progressionSessions = prog.sessions.filter(s => s.session_type !== 'recurrent' && s.day_of_week != null)
    if (!progressionSessions.length) return
    const nextUncompleted = progressionSessions.find(s => !(completions.has(s.id) && !skippedSessions.has(s.id)))
    const weekNum = nextUncompleted ? nextUncompleted.week_number : progressionSessions[progressionSessions.length - 1].week_number
    const weekSessions = weekNum != null ? progressionSessions.filter(s => s.week_number === weekNum) : progressionSessions
    weekTally.total += weekSessions.length
    weekTally.done += weekSessions.filter(s => completions.has(s.id) && !skippedSessions.has(s.id)).length
  })

  // "Séance du jour" = récurrentes (toujours dispo) + séances placées sur aujourd'hui (programmes
  // datés coach/athlète). Les programmes non datés n'apparaissent plus du tout sur cet écran.
  const todaysEntries = [
    ...recurringEntries.map(e => ({ ...e, isRecurring: true })),
    ...(hasDayView ? dayGroups.find(d => d.key === todayWeekDay).entries.map(e => ({ ...e, isRecurring: false })) : []),
  ]

  // Séance récurrente : hors calendrier, proposée tous les jours, fusionnée dans la carte "Séance
  // du jour" ci-dessous. S'ouvre comme n'importe quelle séance (voir openSession) — le compteur du
  // jour (recurring_session_logs) repart à zéro le lendemain sans faire disparaître la séance.

  const renderDayCard = (entry, i) => {
    const { session: s, program, isRecurring } = entry
    const exoCount = (s.exercises || []).filter(e => e.name).length
    const durationMin = estimateDurationMin(s.exercises)
    const isDone = !isRecurring && completions.has(s.id) && !skippedSessions.has(s.id)
    const recurringMet = isRecurring && (recurringTodayCounts[s.id] || 0) >= (s.recurring_daily_target || 1)
    const isPrimary = i === 0
    return (
      <div key={s.id} style={{ background: 'var(--card-white)', border: '1px solid var(--ostryk-border)', borderRadius: 'var(--ostryk-card-radius)', padding: '16px', margin: '0 2px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isRecurring && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--vert-foret)' }}><Repeat size={12} weight="light" /> Tous les jours</span>
        )}
        <div style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 19, color: 'var(--bordeaux)' }}>
          {s.title || 'Séance'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--ostryk-text2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Barbell size={13} weight="light" color="var(--vert-foret)" /> {exoCount} exercice{exoCount > 1 ? 's' : ''}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} weight="light" color="var(--vert-foret)" /> ~{durationMin} min</span>
        </div>
        <button onClick={() => openSession(s.id)} style={{
          background: isPrimary ? 'var(--bordeaux)' : 'transparent',
          color: isPrimary ? '#fff' : 'var(--vert-foret)',
          border: isPrimary ? 'none' : '1.5px solid var(--vert-foret)',
          borderRadius: 'var(--ostryk-pill-radius)', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%',
        }}>
          {(isDone || recurringMet) ? '✓ Commencer' : 'Commencer'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!isCoachView && athlete?.id && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ostryk-text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Objectifs</div>
          <ObjectivesBlock athleteId={athlete.id} objectives={objectives} setObjectives={setObjectives} isCoach={false} bare />
        </div>
      )}

      {todaysEntries.length > 0 && (
        <div id="seance-du-jour">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ostryk-text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Séance du jour</div>
          {todaysEntries.length === 1 ? (
            renderDayCard(todaysEntries[0], 0)
          ) : (
            <SwipeCarousel activeColor="var(--bordeaux)" peek slides={todaysEntries.map((entry, i) => ({
              key: entry.session.id,
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ostryk-text3)', textAlign: 'center' }}>
                    {i + 1}/{todaysEntries.length}{datedProgramsCount + (recurringEntries.length ? 1 : 0) > 1 ? ` · ${entry.program.title}` : ''}
                  </div>
                  {renderDayCard(entry, i)}
                </div>
              ),
            }))} />
          )}
        </div>
      )}

      {weekTally.total > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ostryk-text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Ma semaine</div>
          <div style={{ background: 'var(--card-white)', border: '1px solid var(--ostryk-border)', borderRadius: 'var(--ostryk-card-radius)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 22, color: 'var(--bordeaux)' }}>{weekTally.done}/{weekTally.total}</span>
              <span style={{ fontSize: 13, color: 'var(--ostryk-text2)' }}>séances cette semaine</span>
            </div>
            <div style={{ height: 6, borderRadius: 'var(--ostryk-pill-radius)', background: 'var(--beige)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 'var(--ostryk-pill-radius)', background: 'var(--vert-foret)', width: `${Math.round((weekTally.done / weekTally.total) * 100)}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {weekTally.total === 0 && hasDayView && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ostryk-text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Ma semaine</div>
          <div style={{ background: 'var(--card-white)', border: '1px solid var(--ostryk-border)', borderRadius: 'var(--ostryk-card-radius)', padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: 14, color: 'var(--ostryk-text2)' }}>Pas encore de séance cette semaine</span>
            <button onClick={() => document.getElementById('seance-du-jour')?.scrollIntoView({ behavior: 'smooth' })} style={{
              background: 'var(--bordeaux)', color: '#fff', border: 'none', borderRadius: 'var(--ostryk-pill-radius)',
              padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Voir ma séance du jour
            </button>
          </div>
        </div>
      )}

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

      {leaderGroups.map(g => (
        <div key={g.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <UsersThree size={14} /> {g.name}
          </div>
          {g.sessions.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.title || 'Séance'}</span>
              {g.canLaunch && (
                <button onClick={() => router.push(`/s/${token}/groupe/${s.id}`)} style={{
                  background: s.ranToday ? 'var(--bg2)' : 'var(--green)', color: s.ranToday ? 'var(--text2)' : '#fff',
                  border: s.ranToday ? '1px solid var(--border2)' : 'none', borderRadius: 20, padding: '6px 12px',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                  <Play size={11} weight="fill" />{s.ranToday ? 'Modifier' : 'Lancer'}
                </button>
              )}
            </div>
          ))}
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

    </div>
  )
}
