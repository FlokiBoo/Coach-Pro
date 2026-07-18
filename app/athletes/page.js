'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function AthletesPage() {
  const router = useRouter()
  const [athletes, setAthletes] = useState(null)
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState(null) // { athlete, top, left, openUp }
  const [busyId, setBusyId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('athletes').select('*').neq('archived', true).order('name')
    setAthletes(data || [])
  }

  const archiveAthlete = async (a) => {
    if (!confirm(`Archiver ${a.name} ?`)) return
    setMenu(null)
    setBusyId(a.id)
    const { error } = await supabase.from('athletes').update({ archived: true }).eq('id', a.id)
    setBusyId(null)
    if (error) { alert('Erreur : ' + error.message); return }
    setAthletes(prev => prev.filter(x => x.id !== a.id))
  }

  const deleteAthlete = async (a) => {
    if (!confirm(`Supprimer définitivement ${a.name} ? Cette action est irréversible.`)) return
    setMenu(null)
    setBusyId(a.id)
    const res = await fetch(`/api/athletes/${a.id}`, { method: 'DELETE' })
    setBusyId(null)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}))
      alert('Erreur : ' + (error || 'suppression impossible'))
      return
    }
    setAthletes(prev => prev.filter(x => x.id !== a.id))
  }

  const filtered = (athletes || []).filter(a => a.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 2 }}>👤 Sportifs</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{(athletes || []).length} sportif{(athletes || []).length !== 1 ? 's' : ''}</div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un sportif…"
            style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }}
          />

          {athletes === null ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 13 }}>Aucun sportif trouvé.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
              {filtered.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', position: 'relative', opacity: busyId === a.id ? 0.5 : 1 }}>
                  <div
                    onClick={() => router.push(`/semaine/${a.id}/${today()}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--green-light)', color: 'var(--green)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                    }}>
                      {initials(a.name)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name}
                    </div>
                  </div>

                  <button onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const openUp = rect.bottom > window.innerHeight - 100
                    setMenu(menu?.athlete.id === a.id ? null : {
                      athlete: a,
                      left: rect.right,
                      top: openUp ? rect.top : rect.bottom,
                      openUp,
                    })
                  }}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 15, cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, lineHeight: 1 }}>
                    ···
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {menu && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
          <div style={{
            position: 'fixed', left: menu.left, zIndex: 1000,
            transform: 'translateX(-100%)',
            ...(menu.openUp ? { bottom: window.innerHeight - menu.top + 4 } : { top: menu.top + 4 }),
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            boxShadow: '0 8px 24px rgba(0,0,0,.2)', overflow: 'hidden', minWidth: 180,
          }}>
            <button onClick={() => archiveAthlete(menu.athlete)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}>
              📦 Archiver
            </button>
            <button onClick={() => deleteAthlete(menu.athlete)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#991B1B', cursor: 'pointer', borderTop: '1px solid var(--border)' }}>
              🗑 Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  )
}
