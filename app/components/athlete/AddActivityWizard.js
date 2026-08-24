'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import WellnessBlock from '@/app/components/WellnessBlock'
import { ActivityLogForm } from '@/app/components/ActivityBlock'

// Assistant en 3 temps : choisir la discipline → remplir bien-être → remplir les détails de
// l'activité choisie (km/durée/RPE). Réutilise WellnessBlock et ActivityLogForm tels quels.
export default function AddActivityWizard({ athleteId, date, onClose }) {
  const [step, setStep] = useState(1)
  const [defs, setDefs] = useState(null)
  const [selectedDef, setSelectedDef] = useState(null)
  const [log, setLog] = useState(null)

  useEffect(() => {
    supabase.from('activity_definitions').select('*').order('created_at')
      .then(({ data }) => setDefs(data || []))
  }, [])

  useEffect(() => {
    if (!selectedDef) return
    supabase.from('activity_logs').select('*')
      .eq('athlete_id', athleteId).eq('date', date).eq('label', selectedDef.label).maybeSingle()
      .then(({ data }) => setLog(data || null))
  }, [selectedDef, athleteId, date])

  const back = () => { if (step === 1) onClose(); else setStep(s => s - 1) }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={back} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 18 }}>
          {step === 1 && 'Quelle activité ?'}
          {step === 2 && 'Bien-être du jour'}
          {step === 3 && selectedDef?.label}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3].map(n => (
            <span key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: n <= step ? 'var(--green)' : 'var(--border2)' }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {step === 1 && (
          defs === null ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>Chargement…</div>
          ) : defs.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              Aucune discipline disponible pour l&apos;instant.
            </div>
          ) : (
            defs.map(def => (
              <button key={def.id} onClick={() => { setSelectedDef(def); setStep(2) }} style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--rl)', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{def.label}</span>
                <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
              </button>
            ))
          )
        )}

        {step === 2 && (
          <>
            <WellnessBlock athleteId={athleteId} date={date} mode="athlete" />
            <button onClick={() => setStep(3)} style={{
              background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
              padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              Suivant →
            </button>
          </>
        )}

        {step === 3 && selectedDef && (
          <>
            <ActivityLogForm def={selectedDef} log={log} date={date} athleteId={athleteId} onSaved={setLog} />
            <button onClick={onClose} style={{
              background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--rl)',
              padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              ✓ Terminer
            </button>
          </>
        )}
      </div>
    </div>
  )
}
