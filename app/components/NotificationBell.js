'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return `il y a ${Math.floor(diff / 86400)} j`
}

export default function NotificationBell({ coachId, athleteId }) {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState(null)
  const btnRef = useRef(null)

  const load = useCallback(async () => {
    let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20)
    q = coachId ? q.eq('coach_id', coachId) : q.eq('athlete_id', athleteId)
    const { data } = await q
    setItems(data || [])
  }, [coachId, athleteId])

  useEffect(() => { if (coachId || athleteId) load() }, [coachId, athleteId, load])

  useEffect(() => {
    if (!coachId && !athleteId) return
    const filter = coachId ? `coach_id=eq.${coachId}` : `athlete_id=eq.${athleteId}`
    const channel = supabase.channel(`notifications-${coachId || athleteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [coachId, athleteId, load])

  const unread = items.filter(n => !n.read_at).length

  // Le bouton est logé dans un petit conteneur d'icônes tôt dans le header (à côté du titre), pas
  // collé au bord droit de l'écran — ancrer le panneau en `right:0` relatif à ce conteneur (comme
  // avant) le faisait déborder hors écran sur iPhone, une bonne partie du texte coupée à gauche.
  // On calcule donc sa position en `fixed` par rapport au viewport au moment de l'ouverture, avec
  // une marge de sécurité des deux côtés.
  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const panelWidth = Math.min(320, window.innerWidth - 16)
      let right = Math.max(8, window.innerWidth - rect.right)
      const maxRight = Math.max(8, window.innerWidth - panelWidth - 8)
      if (right > maxRight) right = maxRight
      setPanelPos({ top: rect.bottom + 6, right, width: panelWidth })
    }
    setOpen(v => !v)
  }

  const markRead = async (n) => {
    setOpen(false)
    if (!n.read_at) {
      const now = new Date().toISOString()
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: now } : x))
      await supabase.from('notifications').update({ read_at: now }).eq('id', n.id)
    }
    if (n.link) router.push(n.link)
  }

  const markAllRead = async (e) => {
    e.stopPropagation()
    const unreadIds = items.filter(n => !n.read_at).map(n => n.id)
    if (!unreadIds.length) return
    const now = new Date().toISOString()
    setItems(prev => prev.map(x => ({ ...x, read_at: x.read_at || now })))
    await supabase.from('notifications').update({ read_at: now }).in('id', unreadIds)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={toggleOpen} title="Notifications"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, position: 'relative', display: 'flex', lineHeight: 1, color: 'var(--text2)' }}>
        <Bell size={20} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, background: '#DC2626', color: '#fff',
            borderRadius: 10, minWidth: 16, height: 16, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>
            {unread}
          </span>
        )}
      </button>

      {open && panelPos && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 800 }} />
          <div style={{
            position: 'fixed', top: panelPos.top, right: panelPos.right, width: panelPos.width,
            maxHeight: 420, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--rl)', boxShadow: '0 10px 40px rgba(0,0,0,0.18)', zIndex: 801,
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, background: 'var(--bg)' }}>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Notifications</div>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Tout marquer lu
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Rien pour l&apos;instant</div>
            ) : items.map(n => (
              <div key={n.id} onClick={() => markRead(n)} style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                background: n.read_at ? 'transparent' : 'var(--green-light)',
              }}>
                <div style={{ fontSize: 13, fontWeight: n.read_at ? 600 : 700, color: 'var(--text)' }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
