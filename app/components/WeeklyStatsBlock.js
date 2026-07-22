'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

function fmt(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function getWeekRange(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: fmt(monday), end: fmt(sunday) }
}

function getMonthRange(offset = 0) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { start: fmt(first), end: fmt(last) }
}

function formatDur(min) {
  if (!min || min <= 0) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function parseNum(val) {
  if (!val && val !== 0) return 0
  const str = String(val).trim()
  if (str.includes('-')) {
    const parts = str.split('-').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
    return parts.length === 2 ? (parts[0] + parts[1]) / 2 : parts[0] || 0
  }
  return parseFloat(str) || 0
}

function fmtKm(km) {
  if (!km) return null
  return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`
}

async function fetchStats(athleteId, start, end) {
  const [{ data: actLogs }, { data: comps }] = await Promise.all([
    supabase.from('activity_logs')
      .select('label, type, km, duration_minutes')
      .eq('athlete_id', athleteId)
      .gte('date', start)
      .lte('date', end),
    supabase.from('program_completions')
      .select('program_session_id, duration_minutes, distance_km, program_sessions(program_id, programs(activity_type))')
      .eq('athlete_id', athleteId)
      .gte('completed_at', start + 'T00:00:00')
      .lte('completed_at', end + 'T23:59:59'),
  ])

  const kmByLabel = {}, durByLabel = {}
  ;(actLogs || []).forEach(l => {
    const key = l.label || l.type || 'Activité'
    if (l.km) kmByLabel[key] = (kmByLabel[key] || 0) + parseFloat(l.km)
    if (l.duration_minutes) durByLabel[key] = (durByLabel[key] || 0) + parseInt(l.duration_minutes)
  })
  ;(comps || []).forEach(c => {
    const key = c.program_sessions?.programs?.activity_type || 'Musculation 🏋️'
    if (c.duration_minutes) durByLabel[key] = (durByLabel[key] || 0) + parseInt(c.duration_minutes)
    if (c.distance_km) kmByLabel[key] = (kmByLabel[key] || 0) + parseFloat(c.distance_km)
  })
  const totalKm = Object.values(kmByLabel).reduce((s, v) => s + v, 0)
  const totalCardioMin = Object.values(durByLabel).reduce((s, v) => s + v, 0)

  let tonnage = 0
  const sessionIds = (comps || []).map(c => c.program_session_id).filter(Boolean)
  if (sessionIds.length > 0) {
    const { data: exercises } = await supabase
      .from('program_exercises')
      .select('id, sets, reps, kg')
      .in('program_session_id', sessionIds)

    if (exercises?.length) {
      const { data: logs } = await supabase
        .from('program_exercise_logs')
        .select('program_exercise_id, sets_done, reps_done, kg_done')
        .eq('athlete_id', athleteId)
        .in('program_exercise_id', exercises.map(e => e.id))

      const logsMap = {}
      ;(logs || []).forEach(l => { logsMap[l.program_exercise_id] = l })

      exercises.forEach(e => {
        const log = logsMap[e.id]
        const sets = parseNum(log?.sets_done || e.sets)
        const reps = parseNum(log?.reps_done || e.reps)
        const kg = parseNum(log?.kg_done || e.kg)
        tonnage += sets * reps * kg
      })
    }
  }

  return { kmByLabel, durByLabel, totalKm, totalCardioMin, tonnage }
}

async function fetchProgressions(athleteId, start, end) {
  const { data: logs } = await supabase
    .from('program_exercise_logs')
    .select('kg_done, logged_at, program_exercises(name)')
    .eq('athlete_id', athleteId)
    .lte('logged_at', end + 'T23:59:59')
    .order('logged_at', { ascending: true })

  const byExercise = {}
  ;(logs || []).forEach(l => {
    const name = l.program_exercises?.name
    const kg = parseNum(l.kg_done)
    if (!name || !kg) return
    if (!byExercise[name]) byExercise[name] = []
    byExercise[name].push({ kg, date: l.logged_at.slice(0, 10) })
  })

  const results = []
  Object.entries(byExercise).forEach(([name, entries]) => {
    const before = entries.filter(e => e.date < start)
    const during = entries.filter(e => e.date >= start && e.date <= end)
    if (!before.length || !during.length) return
    const prevKg = before[before.length - 1].kg
    const currentKg = Math.max(...during.map(e => e.kg))
    if (prevKg <= 0) return
    const pct = ((currentKg - prevKg) / prevKg) * 100
    if (pct > 0) results.push({ name, prevKg, currentKg, pct })
  })

  results.sort((a, b) => b.pct - a.pct)
  return results.slice(0, 8)
}

export default function WeeklyStatsBlock({ athleteId }) {
  const [mode, setMode] = useState('week')
  const [offset, setOffset] = useState(0)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showRecap, setShowRecap] = useState(false)
  const [progressions, setProgressions] = useState(null)

  const changeMode = (m) => { setMode(m); setOffset(0) }

  useEffect(() => {
    if (!athleteId) return
    setLoading(true)
    const { start, end } = mode === 'week' ? getWeekRange(offset) : getMonthRange(offset)
    fetchStats(athleteId, start, end).then(s => {
      setStats({ ...s, start, end })
      setLoading(false)
    })
  }, [athleteId, mode, offset])

  if (!stats && !loading) return null

  const periodLabel = (() => {
    if (!stats) return ''
    if (mode === 'week') {
      const d = new Date(stats.start + 'T00:00:00')
      const e = new Date(stats.end + 'T00:00:00')
      const fmtShort = (x) => `${x.getDate()}/${String(x.getMonth() + 1).padStart(2, '0')}`
      return `${fmtShort(d)} au ${fmtShort(e)}`
    }
    const d = new Date(stats.start + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  })()

  const { kmByLabel = {}, durByLabel = {}, totalKm = 0, totalCardioMin = 0, tonnage = 0 } = stats || {}
  const totalMin = totalCardioMin
  const hasAny = tonnage > 0 || totalKm > 0 || totalMin > 0

  const bigStats = [
    tonnage > 0 && { value: Math.round(tonnage).toLocaleString('fr-FR') + ' kg', label: '🏋️ Tonnage' },
    totalKm > 0 && { value: fmtKm(Math.round(totalKm * 10) / 10), label: '🗺️ Distance' },
    totalMin > 0 && { value: formatDur(totalMin), label: '⏱️ Temps total' },
  ].filter(Boolean)

  const activityLabels = [...new Set([...Object.keys(kmByLabel), ...Object.keys(durByLabel)])]
  const hasBreakdown = activityLabels.length > 0

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>

      {/* Header avec toggle */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', flex: 1 }}>
          📊 {mode === 'week' ? 'Ma semaine' : 'Mon mois'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg2)', borderRadius: 20, padding: '2px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => changeMode('week')}
            style={{
              background: mode === 'week' ? 'var(--bg)' : 'transparent',
              border: mode === 'week' ? '1px solid var(--border2)' : '1px solid transparent',
              borderRadius: 18, padding: '3px 10px', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', color: mode === 'week' ? 'var(--text)' : 'var(--text3)',
              transition: 'all .15s',
            }}
          >Sem.</button>
          <button
            onClick={() => changeMode('month')}
            style={{
              background: mode === 'month' ? 'var(--bg)' : 'transparent',
              border: mode === 'month' ? '1px solid var(--border2)' : '1px solid transparent',
              borderRadius: 18, padding: '3px 10px', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', color: mode === 'month' ? 'var(--text)' : 'var(--text3)',
              transition: 'all .15s',
            }}
          >Mois</button>
        </div>
      </div>

      {/* Navigation période */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setOffset(o => o - 1)}
          style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text2)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}
        >‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'capitalize' }}>
          {periodLabel}
        </div>
        <button
          onClick={() => setOffset(o => Math.min(0, o + 1))}
          disabled={offset >= 0}
          style={{ background: 'none', border: 'none', fontSize: 18, color: offset >= 0 ? 'var(--border2)' : 'var(--text2)', cursor: offset >= 0 ? 'default' : 'pointer', padding: '2px 6px', lineHeight: 1 }}
        >›</button>
      </div>

      {loading && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>…</div>
      )}

      {!loading && !hasAny && (
        <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Aucune activité {mode === 'week' ? 'cette semaine' : 'ce mois-ci'}
        </div>
      )}

      {!loading && hasAny && (
        <>
          <div style={{ display: 'flex', borderBottom: hasBreakdown ? '1px solid var(--border)' : 'none' }}>
            {bigStats.map((stat, i) => (
              <div key={i} style={{
                flex: 1, padding: '14px 10px', textAlign: 'center',
                borderRight: i < bigStats.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {hasBreakdown && (
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activityLabels.map(label => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', flex: 1 }}>{label}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {kmByLabel[label] > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>{fmtKm(Math.round(kmByLabel[label] * 10) / 10)}</span>
                    )}
                    {durByLabel[label] > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>{formatDur(durByLabel[label])}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '0 14px 12px' }}>
            <button onClick={() => {
              setProgressions(null)
              setShowRecap(true)
              fetchProgressions(athleteId, stats.start, stats.end).then(setProgressions)
            }} style={{
              width: '100%', background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8',
              borderRadius: 20, padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              📋 Voir le récap {mode === 'week' ? 'de la semaine' : 'du mois'}
            </button>
          </div>
        </>
      )}

      {showRecap && (
        <WeekRecapModal
          mode={mode}
          periodLabel={periodLabel}
          bigStats={bigStats}
          activityLabels={activityLabels}
          kmByLabel={kmByLabel}
          durByLabel={durByLabel}
          progressions={progressions}
          onClose={() => setShowRecap(false)}
        />
      )}
    </div>
  )
}

function WeekRecapModal({ mode, periodLabel, bigStats, activityLabels, kmByLabel, durByLabel, progressions, onClose }) {
  const [page, setPage] = useState(0)
  const touchStartX = useRef(0)

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -40) setPage(1)
    else if (delta > 40) setPage(0)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: 20, padding: '24px 20px', maxWidth: 420, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '90svh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 8 }}>{page === 0 ? '📊' : '📈'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
            {page === 0 ? `Récap ${mode === 'week' ? 'de la semaine' : 'du mois'}` : 'Progressions'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>{periodLabel}</div>
        </div>

        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ overflow: 'hidden', flex: 1, minHeight: 0 }}
        >
          <div style={{
            display: 'flex', width: '200%', transform: `translateX(${page === 0 ? '0' : '-50%'})`,
            transition: 'transform .25s ease', overflowY: 'auto',
          }}>
            <div style={{ width: '50%', paddingRight: 4 }}>
              {bigStats.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                  {bigStats.map((stat, i) => (
                    <div key={i} style={{ flex: 1, background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', lineHeight: 1.1 }}>{stat.value}</div>
                      <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
                Activités pratiquées
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {activityLabels.map(label => {
                  const emojiMatch = label.match(/\p{Emoji}/u)
                  const emoji = emojiMatch ? emojiMatch[0] : '🏅'
                  const name = label.replace(/\s*\p{Emoji}\s*/gu, '').trim() || label
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                      <div style={{ fontSize: 22, flexShrink: 0 }}>{emoji}</div>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{name}</div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {kmByLabel[label] > 0 && (
                          <span style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                            {fmtKm(Math.round(kmByLabel[label] * 10) / 10)}
                          </span>
                        )}
                        {durByLabel[label] > 0 && (
                          <span style={{ background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                            {formatDur(durByLabel[label])}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ width: '50%', paddingLeft: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
                Charges en progression
              </div>

              {progressions === null ? (
                <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>…</div>
              ) : progressions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>
                  Aucune progression de charge détectée sur cette période.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                  {progressions.map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.prevKg} kg → {p.currentKg} kg</div>
                      </div>
                      <span style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 20, padding: '5px 10px', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                        +{Math.round(p.pct)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '14px 0 4px' }}>
          {[0, 1].map(i => (
            <button key={i} onClick={() => setPage(i)} style={{
              width: 7, height: 7, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
              background: page === i ? 'var(--green)' : 'var(--border2)',
            }} />
          ))}
        </div>

        <button onClick={onClose} style={{
          marginTop: 6, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20,
          padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', flexShrink: 0,
        }}>
          Fermer
        </button>
      </div>
    </div>
  )
}
