'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Paperclip } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'

const BUCKET = 'chat-attachments'
const MAX_FILE_MB = 50

export default function ChatThread({ athleteId, myRole, onRead }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  const markRead = useCallback(async () => {
    await fetch(`/api/messages/${athleteId}`, { method: 'PATCH' })
    onRead?.(athleteId)
  }, [athleteId, onRead])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/messages/${athleteId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setMessages(data.messages || [])
        setLoading(false)
        markRead()
      })
    return () => { cancelled = true }
  }, [athleteId, markRead])

  useEffect(() => {
    const channel = supabase
      .channel(`messages-thread-${athleteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `athlete_id=eq.${athleteId}` }, payload => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        if (payload.new.sender_role !== myRole) markRead()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [athleteId, myRole, markRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const postMessage = async (payload) => {
    const res = await fetch(`/api/messages/${athleteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.message) setMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message])
    return data
  }

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    await postMessage({ body })
    setSending(false)
  }

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) {
      alert('Seules les photos et vidéos sont acceptées.')
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`Fichier trop volumineux (max ${MAX_FILE_MB} Mo).`)
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop() || (isImage ? 'jpg' : 'mp4')
    const path = `${athleteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (uploadErr) {
      alert("Échec de l'envoi du fichier : " + uploadErr.message)
      setUploading(false)
      return
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    await postMessage({ attachment_url: pub.publicUrl, attachment_type: isImage ? 'image' : 'video' })
    setUploading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Chargement…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 20 }}>Aucun message pour l'instant</div>
        )}
        {messages.map(m => {
          const mine = m.sender_role === myRole
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '78%', padding: m.attachment_url ? 6 : '8px 12px', borderRadius: 14,
                background: mine ? 'var(--green)' : 'var(--bg3, #eee)',
                color: mine ? '#fff' : 'var(--text)',
                fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {m.attachment_url && m.attachment_type === 'image' && (
                  <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                    <img src={m.attachment_url} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 10, display: 'block' }} />
                  </a>
                )}
                {m.attachment_url && m.attachment_type === 'video' && (
                  <video src={m.attachment_url} controls style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 10, display: 'block' }} />
                )}
                {m.body && <div style={{ padding: m.attachment_url ? '6px 6px 0' : 0 }}>{m.body}</div>}
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, padding: m.attachment_url ? '0 6px 4px' : 0 }}>
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        {uploading && <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Envoi du fichier…</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0, alignItems: 'center' }}>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFilePick} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ background: 'none', border: 'none', display: 'flex', cursor: 'pointer', padding: '4px 2px', flexShrink: 0, opacity: uploading ? 0.5 : 1 }}
          title="Envoyer une photo ou vidéo">
          <Paperclip size={20} />
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Écrire un message…"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid var(--border2)', outline: 'none', fontSize: 13, background: 'var(--bg2)', color: 'var(--text)' }}
        />
        <button onClick={send} disabled={sending || !text.trim()}
          style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          Envoyer
        </button>
      </div>
    </div>
  )
}
