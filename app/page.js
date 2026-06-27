'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Format date YYYY-MM-DD -> "Lun. 24 juin"
function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long'
  })
}

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

export default function Home() {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('athletes').select('*').order('created_at').then(({ data }) => {
      setAthletes(data || [])
      setLoading(false)
    })
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

  const initials = (name) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>
      Chargement…
    </div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100svh', background: 'var(--bg2)' }}>

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
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'var(--green)', color: '#fff', border: 'none',
            borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >+ Sportif</button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Formulaire ajout */}
        {showForm && (
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--rl)', padding: 14,
            display: 'flex', gap: 8
          }}>
            <input
              autoFocus
              placeholder="Prénom Nom du sportif"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createAthlete()}
              style={{
                flex: 1, padding: '10px 12px',
                border: '1px solid var(--border2)', borderRadius: 'var(--r)',
                fontSize: 14, outline: 'none', background: 'var(--bg2)'
              }}
            />
            <button
              onClick={createAthlete}
              disabled={saving}
              style={{
                background: 'var(--green)', color: '#fff', border: 'none',
                borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14,
                fontWeight: 600, cursor: 'pointer'
              }}
            >{saving ? '…' : 'Créer'}</button>
          </div>
        )}

        {/* Liste des sportifs */}
        {athletes.map(a => (
          <Link
            key={a.id}
            href={`/programme/${a.id}/${today()}`}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--rl)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
              textDecoration: 'none', color: 'inherit'
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--green-light)', color: 'var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 800, flexShrink: 0
            }}>
              {initials(a.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                Programme du {formatDate(today())}
              </div>
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 20 }}>›</span>
          </Link>
        ))}

        {!athletes.length && !showForm && (
          <div style={{
            textAlign: 'center', color: 'var(--text3)',
            padding: '60px 20px', border: '1px dashed var(--border2)',
            borderRadius: 'var(--rl)', background: 'var(--bg)'
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏋️</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun sportif</div>
            <div style={{ fontSize: 13 }}>Clique sur « + Sportif » pour commencer</div>
          </div>
        )}
      </div>
    </div>
  )
}
