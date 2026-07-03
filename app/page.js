'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function formatDateLong(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Home() {
  const router = useRouter()
  const [athletes, setAthletes] = useState([])
  const [completedSessions, setCompletedSessions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [coachToken, setCoachToken] = useState(null)
  const [generatingToken, setGeneratingToken] = useState(false)

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  useEffect(() => {
    async function load() {
      const [{ data: aths }, { data: sessions }] = await Promise.all([
        supabase.from('athletes').select('*').neq('archived', true).order('created_at'),
        supabase
          .from('sessions')
          .select('id, date, title, athlete_id, athletes(id, name), exercises(id, name, sets, reps, kg, athlete_logs(sets_done, reps_done, kg_done))')
          .order('date', { ascending: false })
          .limit(40)
      ])
      const athList = aths || []
      setAthletes(athList)

      // Le premier athlète = le coach. On auto-génère un token s'il n'en a pas.
      if (athList.length > 0) {
        const coach = athList[0]
        if (coach.token) {
          setCoachToken(coach.token)
        } else {
          const token = crypto.randomUUID()
          const { data } = await supabase.from('athletes').update({ token }).eq('id', coach.id).select().single()
          if (data) setCoachToken(data.token)
        }
      }

      const done = (sessions || []).filter(s =>
        s.exercises?.some(e => e.athlete_logs?.length > 0)
      )
      setCompletedSessions(done)
      setLoading(false)
    }
    load()
  }, [])

  const createAthlete = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const { data } = await supabase.from('athletes').insert({ name }).select().single()
    if (data) setAthletes(prev => [...prev, data])
    setNewName('')
    setShowForm(false)
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main">

        {/* Header */}
        <div style={{
          padding: '20px 16px 14px', background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 10
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>CoachPro</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              {athletes.length} sportif{athletes.length !== 1 ? 's' : ''}
            </div>
          </div>
          {/* Toggle Vue Sportif */}
          {coachToken && (
            <button
              onClick={() => router.push(`/s/${coachToken}?coach=1`)}
              style={{
                background: 'var(--green-light)', color: 'var(--green)',
                border: '1.5px solid #B8EAD8', borderRadius: 20,
                padding: '8px 14px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5
              }}
            >
              👤 Vue sportif
            </button>
          )}
          <a href="https://tracker-nutrition.netlify.app/coach.html" target="_blank" rel="noreferrer" style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)',
            borderRadius: 20, padding: '8px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0
          }}>🥗 Nutrition</a>
          <button onClick={() => setShowForm(v => !v)} style={{
            background: 'var(--green)', color: '#fff', border: 'none',
            borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>+ Sportif</button>
          <button onClick={logout} style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text3)',
            borderRadius: 20, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0
          }}>Déconnexion</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Formulaire ajout */}
          {showForm && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', gap: 8 }}>
              <input
                autoFocus
                placeholder="Prénom Nom du sportif"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createAthlete()}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)' }}
              />
              <button onClick={createAthlete} disabled={saving} style={{
                background: 'var(--green)', color: '#fff', border: 'none',
                borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>{saving ? '…' : 'Créer'}</button>
            </div>
          )}

          {/* Titre feed */}
          {!athletes.length && !showForm ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏋️</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun sportif</div>
              <div style={{ fontSize: 13 }}>Clique sur « + Sportif » pour commencer</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Séances validées
              </div>

              {completedSessions === null ? (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Chargement…</div>
              ) : completedSessions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
                  <div style={{ fontSize: 13 }}>Aucune séance validée pour l'instant.</div>
                </div>
              ) : completedSessions.map(s => (
                <SessionCard key={s.id} session={s} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session }) {
  const exosDone = (session.exercises || []).filter(e => e.athlete_logs?.length > 0)
  const athleteName = session.athletes?.name || '—'

  return (
    <Link href={`/semaine/${session.athlete_id}/${session.date}`} style={{
      display: 'block', background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--rl)', padding: '14px 16px', textDecoration: 'none', color: 'inherit'
    }}>
      {/* Header : avatar + nom + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'var(--green-light)', color: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800
        }}>
          {athleteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{athleteName}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'capitalize' }}>
            {formatDateLong(session.date)}
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
          ✓ {exosDone.length} exercice{exosDone.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Titre séance */}
      {session.title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
          {session.title}
        </div>
      )}

      {/* Exercices réalisés */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {exosDone.map(e => {
          const log = e.athlete_logs[0]
          const prescribed = [e.sets && `${e.sets} séries`, e.reps && `${e.reps} reps`, e.kg && `${e.kg} kg`].filter(Boolean).join(' · ')
          const done = [log.sets_done && `${log.sets_done}×`, log.reps_done, log.kg_done && `${log.kg_done} kg`].filter(Boolean).join(' ')
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{e.name}</span>
              {done && <span style={{ color: '#166534', fontWeight: 700 }}>→ {done}</span>}
              {prescribed && <span style={{ color: 'var(--text3)' }}>({prescribed})</span>}
            </div>
          )
        })}
      </div>
    </Link>
  )
}
