'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Target, CalendarBlank, ClipboardText } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import SwipeCarousel from './athlete/SwipeCarousel'

function formatDateFr(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeRemaining(dateStr) {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target - now) / 86400000)
  if (diffDays < 0) return `Échéance dépassée (${Math.abs(diffDays)} j)`
  if (diffDays === 0) return "Aujourd'hui"
  const weeks = Math.floor(diffDays / 7)
  const months = Math.floor(diffDays / 30)
  return `${diffDays} j · ${weeks} sem. · ${months} mois`
}

// Version courte pour la carte carrousel côté athlète ("Dans 1 jour") — le détail (semaines/mois,
// date complète) reste dans la vue coach (timeRemaining/formatDateFr ci-dessus, inchangées).
function shortTimeRemaining(dateStr) {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target - now) / 86400000)
  if (diffDays < 0) return `Échéance dépassée (${Math.abs(diffDays)} j)`
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Dans 1 jour'
  if (diffDays < 14) return `Dans ${diffDays} jours`
  if (diffDays < 60) return `Dans ${Math.round(diffDays / 7)} semaines`
  return `Dans ${Math.round(diffDays / 30)} mois`
}

// Échelle fixe (pas relative à la date de création, qui n'a rien à voir avec le début de la
// préparation) : plus l'échéance est proche, plus la barre est remplie. Au-delà de l'horizon,
// l'objectif est considéré "pas encore commencé" (barre vide) ; à J-0, elle est pleine.
const PROGRESS_HORIZON_DAYS = 180

function progressPercent(targetDate) {
  const end = new Date(targetDate + 'T00:00:00').getTime()
  const daysLeft = (end - Date.now()) / 86400000
  if (daysLeft <= 0) return 100
  return Math.max(0, Math.min(100, 100 * (1 - daysLeft / PROGRESS_HORIZON_DAYS)))
}

// Échéance proche (<= 2 mois) = urgent/actif -> bordeaux ; lointaine ou absente = neutre -> vert-forêt.
// Uniquement pour le rendu carrousel côté athlète (isCoach=false) — la vue coach garde le code
// couleur par priorité (PRIORITY_STYLES), inchangé.
const PROXIMITY_THRESHOLD_DAYS = 60
function proximityAccent(targetDate) {
  if (!targetDate) return { accent: 'var(--vert-foret)', accentLight: 'var(--vert-foret-light)' }
  const daysLeft = (new Date(targetDate + 'T00:00:00').getTime() - Date.now()) / 86400000
  return daysLeft <= PROXIMITY_THRESHOLD_DAYS
    ? { accent: 'var(--bordeaux)', accentLight: 'var(--bordeaux-light)' }
    : { accent: 'var(--vert-foret)', accentLight: 'var(--vert-foret-light)' }
}

const PRIORITY_OPTIONS = [
  { value: 1, label: '1 - Haute' },
  { value: 2, label: '2 - Moyenne' },
  { value: 3, label: '3 - Basse' },
]

const EMOJI_OPTIONS = ['🎯', '🏆', '🔥', '💪', '🚀', '⭐️', '✅', '🏁', '💯', '🥇', '🏃', '🏋️']

function EmojiPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {EMOJI_OPTIONS.map(e => (
        <button key={e} type="button" onClick={() => onChange(e)} style={{
          width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, borderRadius: 8, cursor: 'pointer',
          background: value === e ? 'var(--green-light)' : 'var(--bg2)',
          border: `1px solid ${value === e ? 'var(--green)' : 'var(--border2)'}`,
        }}>
          {e}
        </button>
      ))}
    </div>
  )
}

const PRIORITY_STYLES = {
  1: { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626', textDate: '#B91C1C', bullet: '#DC2626' },
  2: { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', textDate: '#C2410C', bullet: '#EA580C' },
  3: { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', textDate: '#1D4ED8', bullet: '#2563EB' },
}

export default function ObjectivesBlock({ athleteId, objectives, setObjectives, isCoach = true }) {
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPriority, setNewPriority] = useState(2)
  const [newEmoji, setNewEmoji] = useState('🎯')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ text: '', target_date: '', priority: 2, emoji: '🎯' })
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const sorted = [...objectives].sort((a, b) => {
    if (!a.target_date && !b.target_date) return 0
    if (!a.target_date) return 1
    if (!b.target_date) return -1
    return a.target_date.localeCompare(b.target_date)
  })

  const addObjective = async () => {
    const text = newText.trim()
    if (!text) return
    setSaving(true)
    const { data, error } = await supabase.from('athlete_objectives')
      .insert({ athlete_id: athleteId, text, target_date: newDate || null, priority: newPriority, emoji: newEmoji })
      .select().single()
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    if (data) setObjectives(prev => [...prev, data])
    setNewText(''); setNewDate(''); setNewPriority(2); setNewEmoji('🎯')
    setSaving(false)
    setShowAddForm(false)
  }

  const startEdit = (o) => {
    setEditingId(o.id)
    setEditForm({ text: o.text, target_date: o.target_date || '', priority: o.priority || 2, emoji: o.emoji || '🎯' })
  }

  const saveEdit = async () => {
    if (!editForm.text.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('athlete_objectives')
      .update({ text: editForm.text.trim(), target_date: editForm.target_date || null, priority: editForm.priority, emoji: editForm.emoji })
      .eq('id', editingId).select().single()
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    if (data) setObjectives(prev => prev.map(o => o.id === editingId ? data : o))
    setEditingId(null)
    setSaving(false)
  }

  const removeObjective = async (id) => {
    const { error } = await supabase.from('athlete_objectives').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    setObjectives(prev => prev.filter(o => o.id !== id))
  }

  const inputStyle = {
    padding: '9px 11px', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
    fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit',
  }

  return (
    <div style={{
      background: isCoach ? 'var(--bg)' : 'var(--card-white)',
      border: `1px solid ${isCoach ? 'var(--border)' : 'var(--ostryk-border)'}`,
      borderRadius: isCoach ? 'var(--rl)' : 'var(--ostryk-card-radius)', overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${isCoach ? 'var(--border)' : 'var(--ostryk-border)'}` }}>
        {isCoach ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Target size={13} /> Objectifs</span>
        ) : (
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 15, color: 'var(--bordeaux)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Target size={14} weight="light" color="var(--vert-foret)" /> Objectifs</span>
        )}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun objectif défini</div>
        )}

        {isCoach && sorted.map(obj => {
          const isTop = obj.priority === 1
          const isEditing = editingId === obj.id
          const style = PRIORITY_STYLES[obj.priority] || PRIORITY_STYLES[2]
          return (
            <div key={obj.id} style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
            <div style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 'var(--r)', padding: '10px 12px', flex: 1, minWidth: 0 }}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input autoFocus value={editForm.text} onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()} style={inputStyle} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" value={editForm.target_date} onChange={e => setEditForm(f => ({ ...f, target_date: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                    <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: parseInt(e.target.value) }))} style={{ ...inputStyle, width: 120 }}>
                      {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <EmojiPicker value={editForm.emoji} onChange={e => setEditForm(f => ({ ...f, emoji: e }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 'var(--r)', padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                    <button onClick={saveEdit} disabled={saving} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'Enregistrer'}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: style.bullet, fontSize: 14, marginTop: 1, flexShrink: 0 }}>▸</span>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => startEdit(obj)} title="Cliquer pour modifier">
                    <div style={{ fontSize: isTop ? 16 : 14, fontWeight: isTop ? 800 : 600, color: style.text, lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {obj.text}
                    </div>
                    {obj.target_date && (
                      <>
                        <div style={{ fontSize: 11, color: style.textDate, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CalendarBlank size={11} /> {formatDateFr(obj.target_date)} · {timeRemaining(obj.target_date)}
                        </div>
                        <div style={{ position: 'relative', marginTop: 14, marginBottom: 4, paddingTop: 6 }}>
                          <div style={{ height: 6, borderRadius: 20, background: 'rgba(255,255,255,0.6)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 20, background: style.bullet,
                              width: `${progressPercent(obj.target_date)}%`, transition: 'width 0.3s',
                            }} />
                          </div>
                          <div style={{
                            position: 'absolute', top: 0, fontSize: 15, lineHeight: 1,
                            left: `${progressPercent(obj.target_date)}%`, transform: 'translate(-50%, -50%)',
                          }}>
                            {obj.emoji || '🎯'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => removeObjective(obj.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              )}
            </div>
            {!isEditing && (
              <Link href={`/programs/${athleteId}?objective=${obj.id}`} title="Programmer cet objectif"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, flexShrink: 0, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', textDecoration: 'none' }}>
                <ClipboardText size={16} />
              </Link>
            )}
            </div>
          )
        })}

        {/* Carrousel swipe côté athlète (isCoach=false) — pattern réutilisable partagé avec la
            page Performances (SwipeCarousel). Couleur par proximité d'échéance (bordeaux/vert-forêt)
            au lieu du code couleur par priorité utilisé côté coach ci-dessus. */}
        {!isCoach && sorted.length > 0 && (
          <SwipeCarousel
            activeColor="var(--bordeaux)"
            peek
            slides={sorted.map(obj => {
              const isEditing = editingId === obj.id
              const { accent, accentLight } = proximityAccent(obj.target_date)
              return {
                key: obj.id,
                content: (
                  <div style={{ background: accentLight, border: `1px solid ${accent}`, borderRadius: 'var(--ostryk-card-radius)', padding: '14px 16px', margin: '0 2px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input autoFocus value={editForm.text} onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveEdit()} style={inputStyle} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="date" value={editForm.target_date} onChange={e => setEditForm(f => ({ ...f, target_date: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                        </div>
                        <EmojiPicker value={editForm.emoji} onChange={e => setEditForm(f => ({ ...f, emoji: e }))} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--ostryk-border-input)', color: 'var(--ostryk-text2)', borderRadius: 'var(--r)', padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                          <button onClick={saveEdit} disabled={saving} style={{ background: 'var(--bordeaux)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'Enregistrer'}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => startEdit(obj)} title="Toucher pour modifier">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 20, color: accent, lineHeight: 1.3, wordBreak: 'break-word' }}>
                            <span>{obj.emoji || '🎯'}</span> {obj.text}
                          </div>
                          {obj.target_date && (
                            <>
                              <div style={{ fontSize: 13, color: 'var(--ostryk-text2)', marginTop: 5 }}>
                                {shortTimeRemaining(obj.target_date)}
                              </div>
                              <div style={{ height: 6, borderRadius: 'var(--ostryk-pill-radius)', background: 'rgba(255,255,255,0.6)', overflow: 'hidden', marginTop: 10 }}>
                                <div style={{
                                  height: '100%', borderRadius: 'var(--ostryk-pill-radius)', background: accent,
                                  width: `${progressPercent(obj.target_date)}%`, transition: 'width 0.3s',
                                }} />
                              </div>
                            </>
                          )}
                        </div>
                        <button onClick={() => removeObjective(obj.id)} style={{ background: 'none', border: 'none', color: 'var(--ostryk-text3)', fontSize: 16, cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
                      </div>
                    )}
                  </div>
                ),
              }
            })}
          />
        )}

        {/* Formulaire ajout */}
        {showAddForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: sorted.length > 0 ? 4 : 0 }}>
            <input
              autoFocus
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addObjective()}
              placeholder="Ajouter un objectif…"
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <select value={newPriority} onChange={e => setNewPriority(parseInt(e.target.value))} style={{ ...inputStyle, width: 120 }}>
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowAddForm(false); setNewText(''); setNewDate(''); setNewPriority(2); setNewEmoji('🎯') }}
                style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 'var(--r)', padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={addObjective} disabled={saving || !newText.trim()}
                style={{ background: newText.trim() ? (isCoach ? 'var(--green)' : 'var(--bordeaux)') : 'var(--border2)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' }}>
                {saving ? '…' : '+ Ajouter'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddForm(true)} style={{
            marginTop: sorted.length > 0 ? 4 : 0,
            background: isCoach ? 'var(--bg2)' : 'var(--card-white)',
            border: `1px dashed ${isCoach ? 'var(--border2)' : 'var(--ostryk-border-input)'}`,
            color: isCoach ? 'var(--text2)' : 'var(--ostryk-text2)', borderRadius: isCoach ? 'var(--r)' : 'var(--ostryk-card-radius)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            + Ajouter un objectif
          </button>
        )}
      </div>
    </div>
  )
}
