'use client'

import { useState, useEffect } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { QUALITY_LEVELS, qualityLevel, HAND_POSITION_OPTIONS, handPositionLabel } from '@/lib/jointTests'

// Saisie autonome du Jefferson Curl (flexion vertébrale segment par segment) côté sportif — pas de
// goniomètre ici (test qualitatif), donc un flux dédié plutôt que de réutiliser GoniometerView qui
// ne gère que les articulations à degrés.
export default function JeffersonCurlModal({ athleteId, onClose }) {
  const [previous, setPrevious] = useState(undefined)
  const [quality, setQuality] = useState('')
  const [handPosition, setHandPosition] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('joint_test_entries').select('*')
      .eq('athlete_id', athleteId).eq('test_name', 'Jefferson Curls').eq('joint', 'Colonne')
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => setPrevious(data || null))
  }, [athleteId])

  const submit = async () => {
    if (!quality || saving) return
    setSaving(true)
    const payload = {
      athlete_id: athleteId, test_name: 'Jefferson Curls', joint: 'Colonne',
      quality_d: quality, hand_position: handPosition || null, note: note.trim() || null,
    }
    let { error } = await supabase.from('joint_test_entries').insert(payload)
    if (error?.message?.includes('hand_position')) {
      // Colonne "hand_position" pas encore migrée en base : réessaie sans ce champ.
      ;({ error } = await supabase.from('joint_test_entries').insert({ ...payload, hand_position: undefined }))
    }
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setDone(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 700, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Jefferson Curl</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16 }}>
        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center', paddingTop: 20 }}>
            <CheckCircle size={40} color="#16A34A" />
            <div style={{ fontWeight: 800, fontSize: 17 }}>Test enregistré</div>
            <button onClick={onClose} style={{ width: '100%', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Terminé
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
              Debout, penche-toi lentement vers l&apos;avant, vertèbre par vertèbre, jusqu&apos;à ta limite — genoux tendus mais pas verrouillés.
            </div>

            {previous === undefined ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chargement…</div>
            ) : previous ? (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                Dernier test ({new Date(previous.date + 'T00:00:00').toLocaleDateString('fr-FR')}) :
                {previous.quality_d != null && ` ${qualityLevel(previous.quality_d)?.label}`}
                {previous.hand_position && ` · Mains : ${handPositionLabel(previous.hand_position)}`}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, fontStyle: 'italic' }}>Aucun test précédent.</div>
            )}

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                Ressenti
              </div>
              <select value={quality} onChange={e => setQuality(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border2)', fontSize: 13, fontWeight: 600, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}>
                <option value="" disabled>Choisis un niveau…</option>
                {QUALITY_LEVELS.map(l => (
                  <option key={l.key} value={l.key}>{l.label} — {l.description}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                Où as-tu posé les mains ?
              </div>
              <select value={handPosition} onChange={e => setHandPosition(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border2)', fontSize: 13, fontWeight: 600, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }}>
                <option value="" disabled>Choisis…</option>
                {HAND_POSITION_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Note (optionnel)</div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <button onClick={submit} disabled={saving || !quality}
              style={{ background: quality ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '…' : '✓ Valider le test'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
