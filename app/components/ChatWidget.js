'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ChatThread from './ChatThread'
import ChatInboxList from './ChatInboxList'

const HIDDEN_PREFIXES = ['/login', '/auth', '/update-password', '/definir-mot-de-passe']

export default function ChatWidget() {
  const pathname = usePathname()
  const [identity, setIdentity] = useState(null) // { role, coachId } | { role, athleteId, athleteName, token }
  const [open, setOpen] = useState(false)
  const [selectedAthleteId, setSelectedAthleteId] = useState(null)
  const [threads, setThreads] = useState([])
  const [athleteUnread, setAthleteUnread] = useState(0)

  const hidden = HIDDEN_PREFIXES.some(p => pathname?.startsWith(p))
  const routeToken = pathname?.match(/^\/s\/([^/]+)/)?.[1] || null

  useEffect(() => {
    if (hidden) return
    fetch('/api/whoami').then(r => r.json()).then(setIdentity)
  }, [hidden])

  // Quand le coach consulte la page d'un sportif précis (vue "aperçu sportif"),
  // le widget doit refléter le fil de CE sportif plutôt que la boîte de réception générale.
  useEffect(() => {
    if (!identity || identity.role !== 'coach') return
    if (!routeToken) { setSelectedAthleteId(null); return }
    let cancelled = false
    fetch(`/api/token-athlete/${routeToken}`).then(r => r.json()).then(data => {
      if (cancelled) return
      if (data.athleteId) setSelectedAthleteId(data.athleteId)
    })
    return () => { cancelled = true }
  }, [identity, routeToken])

  const refreshInbox = useCallback(() => {
    if (identity?.role !== 'coach') return
    fetch('/api/messages').then(r => r.json()).then(data => setThreads(data.threads || []))
  }, [identity])

  const refreshAthleteUnread = useCallback(() => {
    if (identity?.role !== 'athlete') return
    fetch(`/api/messages/${identity.athleteId}`).then(r => r.json()).then(data => {
      const unread = (data.messages || []).filter(m => m.sender_role === 'coach' && !m.read_by_athlete_at).length
      setAthleteUnread(unread)
    })
  }, [identity])

  useEffect(() => {
    if (!identity) return
    if (identity.role === 'coach') refreshInbox()
    if (identity.role === 'athlete') refreshAthleteUnread()
  }, [identity, refreshInbox, refreshAthleteUnread])

  useEffect(() => {
    if (!identity || identity.role === null) return
    const channel = supabase
      .channel('messages-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (identity.role === 'coach') refreshInbox()
        if (identity.role === 'athlete') refreshAthleteUnread()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [identity, refreshInbox, refreshAthleteUnread])

  const handleThreadRead = useCallback(() => {
    if (identity?.role === 'coach') refreshInbox()
    else if (identity?.role === 'athlete') refreshAthleteUnread()
  }, [identity, refreshInbox, refreshAthleteUnread])

  // Sur l'espace client, la messagerie est accessible depuis l'onglet Profil (voir ProfilTab.js) —
  // pas de bulle flottante ici, elle se superposait à la barre d'onglets.
  if (hidden || !identity || identity.role === null || identity.role === 'athlete') return null

  const totalUnread = identity.role === 'coach'
    ? threads.reduce((s, t) => s + t.unreadCount, 0)
    : athleteUnread

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 20, right: 16, zIndex: 600,
          background: 'var(--green)', border: 'none', borderRadius: '50%',
          width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,.25)', cursor: 'pointer', overflow: 'visible',
        }}>
        <span style={{ fontSize: 22 }}>💬</span>
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, background: '#DC2626', color: '#fff',
            borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 700 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '92%', maxWidth: 400, zIndex: 701,
            background: 'var(--bg2)', boxShadow: '-2px 0 24px rgba(0,0,0,.25)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {identity.role === 'coach' && selectedAthleteId && (
                <button onClick={() => setSelectedAthleteId(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
              )}
              <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 16, flex: 1 }}>
                {identity.role === 'coach'
                  ? (selectedAthleteId ? (threads.find(t => t.athleteId === selectedAthleteId)?.athleteName || 'Discussion') : 'Messages')
                  : 'Discussion avec ton coach'}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>✕</button>
            </div>

            {identity.role === 'coach' && !selectedAthleteId && (
              <ChatInboxList threads={threads} onSelect={setSelectedAthleteId} />
            )}
            {identity.role === 'coach' && selectedAthleteId && (
              <ChatThread athleteId={selectedAthleteId} myRole="coach" onRead={handleThreadRead} />
            )}
            {identity.role === 'athlete' && (
              <ChatThread athleteId={identity.athleteId} myRole="athlete" onRead={handleThreadRead} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
