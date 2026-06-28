'use client'

import { useState, useEffect, use, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function getWeekBounds(date) {
  const d = new Date(date + 'T12:00:00Z')
  const day = d.getUTCDay() || 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - (day - 1))
  const days = Array.from({ length: 7 }, (_, i) => {
    const d2 = new Date(monday)
    d2.setUTCDate(monday.getUTCDate() + i)
    return d2.toISOString().slice(0, 10)
  })
  return { monday: days[0], sunday: days[6], days }
}

function shiftWeek(date, delta) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function formatDayShort(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').getUTCDate()
}

function formatMonthShort(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'short' })
}

function formatWeekLabel(monday, sunday) {
  const m = new Date(monday + 'T12:00:00Z')
  const s = new Date(sunday + 'T12:00:00Z')
  const mDay = m.getUTCDate()
  const sDay = s.getUTCDate()
  const mMonth = m.toLocaleDateString('fr-FR', { month: 'long' })
  const sMonth = s.toLocaleDateString('fr-FR', { month: 'long' })
  if (mMonth === sMonth) return `${mDay} au ${sDay} ${sMonth}`
  return `${mDay} ${mMonth} au ${sDay} ${sMonth}`
}

export default function SemainePage({ params }) {
  const { athleteId, date } = use(params)
  const [athlete, setAthlete] = useState(null)
  const [byDate, setByDate] = useState({})
  const [themes, setThemes] = useState({})   // { [date]: string }
  const [loading, setLoading] = useState(true)
  const saveThemeTimeout = useRef({})

  const { monday, sunday, days } = getWeekBounds(date)
  const todayStr = today()

  useEffect(() => {
    async function load() {
      const [{ data: ath }, { data: sessions }, { data: themeRows }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase
          .from('sessions')
          .select('id, date, title, exercises(id, name)')
          .eq('athlete_id', athleteId)
          .gte('date', monday)
          .lte('date', sunday),
        supabase
          .from('day_themes')
          .select('date, theme')
          .eq('athlete_id', athleteId)
          .gte('date', monday)
          .lte('date', sunday)
      ])
      setAthlete(ath)
      const map = {}
      ;(sessions || []).forEach(s => {
        if (!map[s.date]) map[s.date] = []
        map[s.date].push(s)
      })
      setByDate(map)
      const tMap = {}
      ;(themeRows || []).forEach(r => { tMap[r.date] = r.theme || '' })
      setThemes(tMap)
      setLoading(false)
    }
    load()
  }, [athleteId, monday, sunday])

  const updateTheme = (dayDate, value) => {
    setThemes(prev => ({ ...prev, [dayDate]: value }))
    // Debounce save
    if (saveThemeTimeout.current[dayDate]) clearTimeout(saveThemeTimeout.current[dayDate])
    saveThemeTimeout.current[dayDate] = setTimeout(async () => {
      await supabase.from('day_themes').upsert(
        { athlete_id: athleteId, date: dayDate, theme: value || null },
        { onConflict: 'athlete_id,date' }
      )
    }, 600)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={athleteId} date={date} />
      <div className="coach-main" style={{ paddingBottom: 40, maxWidth: '100%' }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Link href="/" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{athlete?.name}</div>
            <Link href={`/programs/${athleteId}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 12, fontWeight: 600, textDecoration: 'none', color: 'var(--text2)', flexShrink: 0 }}>
              📋 Programmes
            </Link>
          </div>
          {/* Lien de partage */}
          {athlete?.token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '7px 10px', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--green)', flex: 1, fontWeight: 600 }}>🔗 {typeof window !== 'undefined' ? window.location.origin : ''}/s/{athlete.token}</span>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/s/${athlete.token}`)}
                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Copier
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '7px 10px', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>🔗 Aucun lien de partage</span>
              <button onClick={async () => {
                const token = crypto.randomUUID()
                const { data } = await supabase.from('athletes').update({ token }).eq('id', athleteId).select().single()
                if (data) setAthlete(data)
              }} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Générer le lien
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              href={`/semaine/${athleteId}/${shiftWeek(monday, -7)}`}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 12px', fontSize: 15, textDecoration: 'none', color: 'var(--text2)' }}
            >‹</Link>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
              Semaine du {formatWeekLabel(monday, sunday)}
            </div>
            <Link
              href={`/semaine/${athleteId}/${shiftWeek(monday, 7)}`}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 12px', fontSize: 15, textDecoration: 'none', color: 'var(--text2)' }}
            >›</Link>
          </div>
        </div>

        {/* Grille semaine */}
        <div style={{ padding: '12px 12px', overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))',
            gap: 8,
            minWidth: 700
          }}>
            {days.map((dayDate, i) => {
              const daySessions = byDate[dayDate] || []
              const isToday = dayDate === todayStr
              const theme = themes[dayDate] ?? ''

              return (
                <div
                  key={dayDate}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: isToday ? 'var(--green-light)' : 'var(--bg)',
                    border: isToday ? '1.5px solid #B8EAD8' : '1px solid var(--border)',
                    borderRadius: 'var(--rl)',
                    overflow: 'hidden',
                    minHeight: 120,
                  }}
                >
                  {/* En-tête du jour */}
                  <div style={{
                    padding: '8px 10px 6px',
                    borderBottom: '1px solid var(--border)',
                    background: isToday ? '#D1FAE5' : 'var(--bg2)',
                  }}>
                    <Link href={`/programme/${athleteId}/${dayDate}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--green)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {DAY_LABELS[i]}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? 'var(--green)' : 'var(--text)', lineHeight: 1.1 }}>
                        {formatDayShort(dayDate)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>
                        {formatMonthShort(dayDate)}
                      </div>
                    </Link>

                    {/* Thème du jour — éditable inline */}
                    <input
                      value={theme}
                      onChange={e => updateTheme(dayDate, e.target.value)}
                      placeholder="Thème…"
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '100%',
                        border: 'none',
                        borderRadius: 4,
                        padding: '3px 5px',
                        fontSize: 10,
                        fontWeight: 700,
                        background: theme ? (isToday ? '#A7F3D0' : 'var(--green-light)') : 'transparent',
                        color: theme ? 'var(--green)' : 'var(--text3)',
                        outline: 'none',
                        cursor: 'text',
                        textTransform: theme ? 'uppercase' : 'none',
                        letterSpacing: theme ? '0.3px' : 'normal',
                      }}
                    />
                  </div>

                  {/* Séances du jour */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {daySessions.length === 0 ? (
                      <Link href={`/programme/${athleteId}/${dayDate}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', padding: '12px 10px' }}>
                        <div style={{ fontSize: 11, color: 'var(--border2)', fontStyle: 'italic' }}>Vide</div>
                      </Link>
                    ) : daySessions.map((s, si) => (
                      <Link
                        key={s.id}
                        href={`/programme/${athleteId}/${dayDate}`}
                        style={{
                          display: 'block', textDecoration: 'none', color: 'inherit',
                          padding: '8px 10px',
                          borderTop: si > 0 ? '1px dashed var(--border2)' : 'none',
                        }}
                      >
                        {daySessions.length > 1 && (
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
                            Séance {si + 1}
                          </div>
                        )}
                        {s.title && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.title}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {(s.exercises || []).slice(0, 5).map(e => (
                            <div key={e.id} style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              · {e.name}
                            </div>
                          ))}
                          {(s.exercises || []).length > 5 && (
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                              +{s.exercises.length - 5} exercices
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
