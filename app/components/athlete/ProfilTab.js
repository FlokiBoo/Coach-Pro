'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import BadgesBlock from '@/app/components/BadgesBlock'
import MobilityRadarBlock from '@/app/components/MobilityRadarBlock'
import MealPlannerWizard from '@/app/components/MealPlannerWizard'
import ChatThread from '@/app/components/ChatThread'
import SettingsScreen from './SettingsScreen'

function calcAge(birthDate) {
  if (!birthDate) return null
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400000))
}

const statLabelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }
const editIconStyle = { fontSize: 12, color: 'var(--green)' }

export default function ProfilTab({ athlete, token, onWeightUpdate, onSexUpdate, onHeightUpdate, onBirthDateUpdate }) {
  const [editingField, setEditingField] = useState(null) // 'weight' | 'height' | 'birth_date' | null
  const [fieldVal, setFieldVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [showMealPlanner, setShowMealPlanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [unread, setUnread] = useState(0)

  const refreshUnread = useCallback(() => {
    if (!athlete) return
    fetch(`/api/messages/${athlete.id}`).then(r => r.json()).then(data => {
      const u = (data.messages || []).filter(m => m.sender_role === 'coach' && !m.read_by_athlete_at).length
      setUnread(u)
    })
  }, [athlete])

  useEffect(() => { refreshUnread() }, [refreshUnread])

  useEffect(() => {
    if (!athlete) return
    const channel = supabase
      .channel(`messages-profil-${athlete.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `athlete_id=eq.${athlete.id}` }, refreshUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [athlete, refreshUnread])

  const startEdit = (field, current) => { setEditingField(field); setFieldVal(current ?? '') }

  const saveField = async () => {
    if (!fieldVal || !athlete) return
    setSaving(true)
    const value = editingField === 'birth_date' ? fieldVal : parseFloat(fieldVal)
    const { error } = await supabase.from('athletes').update({ [editingField]: value }).eq('id', athlete.id)
    if (!error) {
      if (editingField === 'weight') onWeightUpdate?.(value)
      if (editingField === 'height') onHeightUpdate?.(value)
      if (editingField === 'birth_date') onBirthDateUpdate?.(value)
      setEditingField(null)
    }
    setSaving(false)
  }

  const saveSex = async (val) => {
    if (!athlete) return
    await supabase.from('athletes').update({ sex: val }).eq('id', athlete.id)
    onSexUpdate?.(val)
  }

  if (!athlete) return null
  const age = calcAge(athlete.birth_date)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>👤</div>
        <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 20 }}>{athlete.name}</div>
      </div>

      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { field: 'height', label: 'Taille', unit: 'cm', value: athlete.height, step: '1' },
            { field: 'weight', label: 'Poids', unit: 'kg', value: athlete.weight, step: '0.1' },
          ].map(f => (
            <div key={f.field} style={{ flex: 1 }}>
              <div style={statLabelStyle}>{f.label}</div>
              {editingField === f.field ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" step={f.step} min="0" autoFocus value={fieldVal} onChange={e => setFieldVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveField()}
                    style={{ width: 60, boxSizing: 'border-box', padding: '5px 7px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                  <button onClick={saveField} disabled={saving || !fieldVal}
                    style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {saving ? '…' : '✓'}
                  </button>
                </div>
              ) : (
                <div onClick={() => startEdit(f.field, f.value)} style={{ fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {f.value ? `${f.value} ${f.unit}` : '—'}
                  <span style={editIconStyle}>✏️</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={statLabelStyle}>Âge</div>
            {editingField === 'birth_date' ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="date" autoFocus value={fieldVal} onChange={e => setFieldVal(e.target.value)}
                  style={{ boxSizing: 'border-box', padding: '5px 7px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13, fontWeight: 700, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                <button onClick={saveField} disabled={saving || !fieldVal}
                  style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '…' : '✓'}
                </button>
              </div>
            ) : (
              <div onClick={() => startEdit('birth_date', athlete.birth_date)} style={{ fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {age != null ? `${age} ans` : '—'}
                <span style={editIconStyle}>✏️</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={statLabelStyle}>Sexe</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 'H', l: 'H' }, { v: 'F', l: 'F' }].map(o => (
                <button key={o.v} onClick={() => saveSex(o.v)} style={{
                  flex: 1, padding: '5px 0', border: '1px solid ' + (athlete.sex === o.v ? 'var(--green)' : 'var(--border2)'),
                  borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: athlete.sex === o.v ? 'var(--green-light)' : 'var(--bg2)',
                  color: athlete.sex === o.v ? 'var(--green)' : 'var(--text2)',
                }}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>🏅 Badges de force</div>
        <BadgesBlock athleteId={athlete.id} weight={athlete.weight} sex={athlete.sex} />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>🎯 Tests de mobilité</div>
        <MobilityRadarBlock athleteId={athlete.id} />
      </div>

      <button onClick={() => setShowMessages(true)} style={{
        background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 20 }}>💬</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Messagerie</span>
        {unread > 0 && (
          <span style={{
            background: '#DC2626', color: '#fff', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}>{unread}</span>
        )}
        <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
      </button>

      <button onClick={() => setShowMealPlanner(true)} style={{
        background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 20 }}>🍽</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Générateur de plan alimentaire</span>
        <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
      </button>

      <button onClick={() => setShowSettings(true)} style={{
        background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 20 }}>⚙️</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Réglages</span>
        <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
      </button>

      {showMealPlanner && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowMealPlanner(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>🍽 Générateur de plan alimentaire</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16 }}>
            <MealPlannerWizard />
          </div>
        </div>
      )}

      {showSettings && <SettingsScreen athlete={athlete} token={token} onClose={() => setShowSettings(false)} />}

      {showMessages && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowMessages(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
            <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>💬 Messagerie</div>
          </div>
          <ChatThread athleteId={athlete.id} myRole="athlete" onRead={() => setUnread(0)} />
        </div>
      )}
    </div>
  )
}
