'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

async function logout() {
  await supabase.auth.signOut()
  window.location.href = '/login'
}

const METRICS = [
  { key: 'sommeil',     emoji: '🌙', inverse: false },
  { key: 'stress',      emoji: '😰', inverse: true  },
  { key: 'courbatures', emoji: '💪', inverse: true  },
  { key: 'forme',       emoji: '⚡', inverse: false },
]

function scoreColor(val, inverse) {
  if (!val) return 'var(--border2)'
  const s = inverse ? (11 - val) : val
  if (s >= 7) return '#22c55e'
  if (s >= 4) return '#f59e0b'
  return '#ef4444'
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDateShort(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'short'
  })
}

export default function AthletesSidebar({ athleteId, date }) {
  const [athletes, setAthletes] = useState([])
  const [wellness, setWellness] = useState({})
  const [done, setDone] = useState(new Set())
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem('coachpro_sidebar_collapsed') === '1')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('coachpro_sidebar_collapsed', next ? '1' : '0')
      return next
    })
  }

  useEffect(() => {
    async function load() {
      const { data: aths } = await supabase
        .from('athletes').select('*').neq('archived', true).order('created_at')
      if (!aths?.length) { setAthletes([]); return }
      setAthletes(aths)

      const ids = aths.map(a => a.id)

      // wellness du jour
      const { data: wRows } = await supabase
        .from('wellness').select('*').eq('date', date).in('athlete_id', ids)
      const wMap = {}
      ;(wRows || []).forEach(r => { wMap[r.athlete_id] = r })
      setWellness(wMap)

      // sessions du jour
      const { data: sessions } = await supabase
        .from('sessions').select('id, athlete_id')
        .eq('date', date).in('athlete_id', ids)
      if (!sessions?.length) { setDone(new Set()); return }

      // exercises de ces sessions
      const { data: exos } = await supabase
        .from('exercises').select('id, session_id')
        .in('session_id', sessions.map(s => s.id))
      if (!exos?.length) { setDone(new Set()); return }

      // athlete_logs pour ces exercises
      const { data: logs } = await supabase
        .from('athlete_logs').select('exercise_id')
        .in('exercise_id', exos.map(e => e.id))

      const loggedExoIds = new Set((logs || []).map(l => l.exercise_id))
      const sessionsWithLog = new Set(
        exos.filter(e => loggedExoIds.has(e.id)).map(e => e.session_id)
      )
      const doneIds = new Set(
        sessions.filter(s => sessionsWithLog.has(s.id)).map(s => s.athlete_id)
      )
      setDone(doneIds)
    }
    load()
  }, [date])

  return (
    <>
      {/* Bouton hamburger — mobile uniquement */}
      <button
        onClick={() => setOpen(true)}
        className="sidebar-toggle"
        style={{
          position: 'fixed', bottom: 20, left: 16, zIndex: 200,
          background: 'var(--green)', color: '#fff', border: 'none',
          borderRadius: '50%', width: 48, height: 48,
          fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Ouvrir la liste des sportifs"
      >☰</button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 299 }}
        />
      )}

    <div className={`coach-sidebar${open ? ' coach-sidebar--open' : ''}${collapsed ? ' coach-sidebar--collapsed' : ''}`}>
      {/* Header sidebar */}
      <div style={{ padding: '16px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>CoachPro</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>
            {formatDateShort(date)}
          </div>
        </div>
        <button onClick={toggleCollapsed} className="sidebar-collapse-btn"
          style={{ display: 'none', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
          title="Réduire le bandeau">«</button>
        <button onClick={() => setOpen(false)} className="sidebar-close"
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>✕</button>
      </div>

      {/* Navigation principale */}
      <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Link href="/" onClick={() => setOpen(false)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          borderRadius: 'var(--r)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          color: 'var(--text2)', background: 'transparent',
        }}>👥 Clients</Link>
        <Link href="/programs" onClick={() => setOpen(false)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          borderRadius: 'var(--r)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          color: 'var(--text2)', background: 'transparent',
        }}>📋 Programmes</Link>
        <Link href="/movements" onClick={() => setOpen(false)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          borderRadius: 'var(--r)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          color: 'var(--text2)', background: 'transparent',
        }}>📚 Bibliothèque</Link>
      </div>

      {/* Liste sportifs */}
      <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 4px', marginBottom: 4 }}>
          Mes sportifs
        </div>

        {athletes.map(a => {
          const active = a.id === athleteId
          const w = wellness[a.id]
          const seanceFaite = done.has(a.id)

          return (
            <Link
              key={a.id}
              href={`/semaine/${a.id}/${date}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 8px', borderRadius: 'var(--r)',
                background: active ? 'var(--green-light)' : 'transparent',
                border: active ? '1px solid #B8EAD8' : '1px solid transparent',
                textDecoration: 'none', color: 'inherit',
                transition: 'background .15s',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: active ? 'var(--green)' : 'var(--bg2)',
                color: active ? '#fff' : 'var(--text2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
                border: seanceFaite ? '2px solid #22c55e' : '1px solid var(--border2)',
              }}>
                {initials(a.name)}
              </div>

              {/* Infos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: active ? '#0D6B4F' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {a.name}
                  {a.is_coach && (
                    <span style={{ fontSize: 9, fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>COACH</span>
                  )}
                </div>
                {/* Dots bien-être sportif */}
                {w ? (
                  <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                    {METRICS.map(m => {
                      const v = w[m.key]
                      if (!v) return null
                      return (
                        <span key={m.key} style={{ fontSize: 10, fontWeight: 700, color: scoreColor(v, m.inverse) }}>
                          {m.emoji}{v}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{a.is_coach ? 'Coach' : 'Pas de données'}</div>
                )}
              </div>

              {/* Badge séance faite */}
              {seanceFaite && (
                <span style={{ fontSize: 11, color: '#22c55e', flexShrink: 0 }}>✓</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bas de sidebar : déconnexion + accueil */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={logout}
          style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', textAlign: 'left' }}
        >
          ⎋ Déconnexion
        </button>
        <Link href="/" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none', fontWeight: 600, padding: '2px 0' }}>
          ← Accueil
        </Link>
      </div>
    </div>

    {/* Bouton pour rouvrir le bandeau réduit — desktop uniquement */}
    <button
      onClick={toggleCollapsed}
      className="sidebar-reopen-btn"
      style={{
        display: 'none', position: 'sticky', top: 10, left: 0, alignSelf: 'flex-start',
        background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: 'none',
        borderRadius: '0 var(--r) var(--r) 0', width: 20, height: 40,
        fontSize: 13, color: 'var(--text3)', cursor: 'pointer', flexShrink: 0, zIndex: 5,
      }}
      title="Afficher le bandeau"
    >»</button>
    </>
  )
}
