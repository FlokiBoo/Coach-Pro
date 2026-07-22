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
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [createdAthlete, setCreatedAthlete] = useState(null)
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

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

  const openAdd = () => {
    setNewName('')
    setNewEmail('')
    setCreatedAthlete(null)
    setInviteMsg('')
    setShowAdd(true)
  }

  const closeAdd = () => {
    setShowAdd(false)
  }

  const createClient = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('athletes').insert({ name: newName.trim(), email: newEmail.trim() || null }).select().single()
    setCreating(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setAthletes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setCreatedAthlete(data)
  }

  const sendInviteEmail = async () => {
    if (!createdAthlete || !newEmail.trim()) return
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim(), athleteId: createdAthlete.id, athleteName: createdAthlete.name, redirectTo: window.location.origin }),
    })
    const json = await res.json()
    setInviting(false)
    setInviteMsg(json.error ? 'Erreur : ' + json.error : `✓ Invitation envoyée à ${newEmail.trim()}`)
  }

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 2 }}>👤 Sportifs</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{(athletes || []).length} sportif{(athletes || []).length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={openAdd} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            + Ajouter
          </button>
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
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {a.name}
                      {a.is_coach && (
                        <span style={{ fontSize: 9, fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>COACH</span>
                      )}
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

      {showAdd && (
        <div onClick={closeAdd} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>+ Ajouter un client</div>
              <button onClick={closeAdd} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>×</button>
            </div>

            {!createdAthlete ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <input
                  autoFocus
                  placeholder="Prénom Nom"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                />
                <input
                  type="email"
                  placeholder="Email (pour l'inviter)"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
                />
                <button onClick={createClient} disabled={creating || !newName.trim()}
                  style={{ background: newName.trim() ? 'var(--green)' : 'var(--border)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {creating ? '…' : 'Créer le client'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  <b>{createdAthlete.name}</b> a été créé. {newEmail.trim() ? "Envoie-lui son invitation :" : "Ajoute un email pour l'inviter (ou fais-le plus tard depuis sa fiche)."}
                </div>
                {newEmail.trim() && (
                  <button onClick={sendInviteEmail} disabled={inviting}
                    style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {inviting ? '…' : '✉️ Envoyer l\'invitation par email'}
                  </button>
                )}
                {inviteMsg && <div style={{ fontSize: 12, color: inviteMsg.startsWith('Erreur') ? '#DC2626' : '#166534', fontWeight: 600 }}>{inviteMsg}</div>}
                <button onClick={closeAdd} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '9px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>
                  Terminé
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
