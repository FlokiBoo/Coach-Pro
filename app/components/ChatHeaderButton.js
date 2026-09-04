'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatCircle } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'

// Déclenche le panneau de ChatWidget (monté globalement dans layout.js) via un événement custom —
// évite de faire remonter son état d'ouverture jusqu'ici. Calcule son propre badge de non-lus
// (petite duplication assumée avec ChatWidget, déjà le pattern existant dans ce fichier avant refonte).
export default function ChatHeaderButton({ coachId, athleteId }) {
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    try {
      if (coachId) {
        const res = await fetch('/api/messages')
        const data = await res.json().catch(() => ({}))
        setUnread((data.threads || []).reduce((s, t) => s + t.unreadCount, 0))
      } else if (athleteId) {
        const res = await fetch(`/api/messages/${athleteId}`)
        const data = await res.json().catch(() => ({}))
        setUnread((data.messages || []).filter(m => m.sender_role === 'coach' && !m.read_by_athlete_at).length)
      }
    } catch { /* pas bloquant */ }
  }, [coachId, athleteId])

  useEffect(() => { if (coachId || athleteId) refresh() }, [coachId, athleteId, refresh])

  useEffect(() => {
    if (!coachId && !athleteId) return
    const channel = supabase.channel(`chat-header-${coachId || athleteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [coachId, athleteId, refresh])

  return (
    <button onClick={() => window.dispatchEvent(new Event('open-chat-widget'))}
      title="Messages"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, position: 'relative', display: 'flex', lineHeight: 1, color: 'var(--text2)' }}>
      <ChatCircle size={20} />
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
  )
}
