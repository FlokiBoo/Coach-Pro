'use client'

import { useState, useRef, useEffect } from 'react'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

export default function AssistantPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setSending(true)
    setError('')

    const res = await fetch('/api/ai/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: next }),
    })
    const json = await res.json()
    setSending(false)
    if (json.error) { setError(json.error); return }
    setMessages(prev => [...prev, { role: 'assistant', content: json.text }])
  }

  return (
    <div className="coach-layout">
      <AthletesSidebar athleteId={null} date={today()} />

      <main className="coach-main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🤖 Assistant IA</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Idées de séances, conseils nutrition, aide à la rédaction…</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', fontSize: 13 }}>
              Pose une question à l&apos;assistant — ex. « Propose-moi une séance full body pour un débutant » ou « Idées de collation à 300 kcal riche en protéines ».
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '75%', background: m.role === 'user' ? 'var(--green)' : 'var(--bg2)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              borderRadius: 'var(--rl)', padding: '10px 14px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          ))}
          {sending && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--text3)', fontSize: 13, padding: '10px 14px' }}>…</div>
          )}
          {error && (
            <div style={{ alignSelf: 'flex-start', color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Écris ton message…"
            style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border2)', borderRadius: 20, fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}
          />
          <button onClick={send} disabled={sending || !input.trim()}
            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: sending || !input.trim() ? 0.6 : 1 }}>
            Envoyer
          </button>
        </div>
      </main>
    </div>
  )
}
