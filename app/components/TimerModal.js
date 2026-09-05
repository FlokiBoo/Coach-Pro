'use client'

import { useState, useEffect, useRef } from 'react'
import { FloppyDisk } from '@phosphor-icons/react'
import { HMSField, NumberField } from './TimerFields'
import { beep, unlockAudio } from '@/lib/audioBeep'

const TYPES = [
  { key: 'EMOM', label: 'EMOM' },
  { key: 'AMRAP', label: 'AMRAP' },
  { key: 'TABATA', label: 'TABATA' },
  { key: 'CUSTOM', label: 'Perso' },
]

const STORAGE_KEY = 'coachpro_custom_timers'

function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePresets(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch {}
}

// Construit la liste des segments (ON/RÉCUP/REPOS ENTRE ROUNDS) pour un chrono perso.
function buildCustomSegments(steps, rounds, restBetweenRounds) {
  const segments = []
  for (let r = 0; r < rounds; r++) {
    steps.forEach(s => segments.push({ type: s.type, sec: s.sec, round: r + 1 }))
    if (r < rounds - 1 && restBetweenRounds > 0) segments.push({ type: 'ROUNDREST', sec: restBetweenRounds, round: r + 1 })
  }
  return segments
}

export default function TimerModal({ onClose, presetSeconds, presetLabel }) {
  const hasPreset = presetSeconds != null && presetSeconds > 0
  const [type, setType] = useState(hasPreset ? 'AMRAP' : 'EMOM')
  const [screen, setScreen] = useState(hasPreset ? 'run' : 'setup') // 'setup' | 'run'
  const [running, setRunning] = useState(false)
  const [, forceTick] = useState(0)

  const [emomRoundSec, setEmomRoundSec] = useState(60)
  const [emomRounds, setEmomRounds] = useState(10)
  const [amrapSec, setAmrapSec] = useState(hasPreset ? presetSeconds : 720)
  const [tabataWork, setTabataWork] = useState(20)
  const [tabataRest, setTabataRest] = useState(10)
  const [tabataRounds, setTabataRounds] = useState(8)

  const [customSteps, setCustomSteps] = useState([])
  const [customRounds, setCustomRounds] = useState(1)
  const [customRestBetween, setCustomRestBetween] = useState(0)
  const [customPresets, setCustomPresets] = useState([])

  useEffect(() => { setCustomPresets(loadPresets()) }, [])

  const addCustomStep = (stepType) => {
    setCustomSteps(prev => [...prev, { type: stepType, sec: stepType === 'ON' ? 30 : 15 }])
  }
  const updateCustomStepSec = (i, sec) => {
    setCustomSteps(prev => prev.map((s, idx) => idx === i ? { ...s, sec: Math.max(1, sec) } : s))
  }
  const removeCustomStep = (i) => {
    setCustomSteps(prev => prev.filter((_, idx) => idx !== i))
  }

  const saveCustomPreset = () => {
    if (!customSteps.length) return
    const name = window.prompt('Nom de ce chrono ?')
    if (!name || !name.trim()) return
    const preset = { id: Date.now(), name: name.trim(), steps: customSteps, rounds: customRounds, restBetweenRounds: customRestBetween }
    const next = [...customPresets, preset]
    setCustomPresets(next)
    savePresets(next)
  }
  const loadCustomPreset = (p) => {
    setCustomSteps(p.steps)
    setCustomRounds(p.rounds)
    setCustomRestBetween(p.restBetweenRounds)
  }
  const deleteCustomPreset = (id) => {
    const next = customPresets.filter(p => p.id !== id)
    setCustomPresets(next)
    savePresets(next)
  }

  const elapsedBaseRef = useRef(0)
  const runStartRef = useRef(null)
  const lastBeepKeyRef = useRef(null)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => forceTick(t => t + 1), 100)
    return () => clearInterval(id)
  }, [running])

  const getElapsed = () => elapsedBaseRef.current + (runStartRef.current ? (Date.now() - runStartRef.current) / 1000 : 0)

  const start = () => {
    if (type === 'CUSTOM' && !customSteps.length) return
    unlockAudio()
    runStartRef.current = Date.now()
    setRunning(true)
    setScreen('run')
  }
  // Lancement direct (ex: clic sur la pastille "récup" d'un exercice) : on démarre tout de
  // suite sur le temps proposé, sans passer par l'écran de configuration.
  useEffect(() => {
    if (hasPreset) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pause = () => {
    elapsedBaseRef.current = getElapsed()
    runStartRef.current = null
    setRunning(false)
  }
  const reset = () => {
    elapsedBaseRef.current = 0
    runStartRef.current = null
    lastBeepKeyRef.current = null
    prevPhaseKeyRef.current = null
    setRunning(false)
    forceTick(t => t + 1)
  }
  const backToSetup = () => {
    reset()
    setScreen('setup')
  }

  // Calcule la phase courante à partir du temps écoulé, selon le type choisi.
  const compute = () => {
    const elapsed = getElapsed()
    if (type === 'EMOM') {
      const total = emomRoundSec * emomRounds
      if (elapsed >= total) return { finished: true, remaining: 0, roundIndex: emomRounds, totalRounds: emomRounds, phaseLabel: 'Terminé' }
      const roundIndex = Math.floor(elapsed / emomRoundSec)
      const remaining = emomRoundSec - (elapsed % emomRoundSec)
      return { finished: false, remaining, roundIndex: roundIndex + 1, totalRounds: emomRounds, phaseLabel: `Round ${roundIndex + 1}/${emomRounds}`, phaseKey: `r${roundIndex}` }
    }
    if (type === 'AMRAP') {
      const remaining = amrapSec - elapsed
      if (remaining <= 0) return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
      return { finished: false, remaining, phaseLabel: hasPreset ? (presetLabel || 'RÉCUP') : 'AMRAP', phaseKey: 'amrap' }
    }
    if (type === 'CUSTOM') {
      const segments = buildCustomSegments(customSteps, customRounds, customRestBetween)
      const total = segments.reduce((s, seg) => s + seg.sec, 0)
      if (!segments.length || elapsed >= total) return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
      let acc = 0
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (elapsed < acc + seg.sec) {
          const remaining = acc + seg.sec - elapsed
          const label = seg.type === 'ON' ? 'ON' : seg.type === 'REST' ? 'RÉCUP' : 'REPOS'
          return {
            finished: false, remaining, roundIndex: seg.round, totalRounds: customRounds,
            phaseLabel: `${label} — Round ${seg.round}/${customRounds}`,
            phaseKey: `s${i}`, isWork: seg.type === 'ON',
          }
        }
        acc += seg.sec
      }
      return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
    }
    // TABATA
    const cycle = tabataWork + tabataRest
    const total = cycle * tabataRounds
    if (elapsed >= total) return { finished: true, remaining: 0, roundIndex: tabataRounds, totalRounds: tabataRounds, phaseLabel: 'Terminé' }
    const roundIndex = Math.floor(elapsed / cycle)
    const pos = elapsed % cycle
    const isWork = pos < tabataWork
    const remaining = isWork ? tabataWork - pos : cycle - pos
    return {
      finished: false, remaining, roundIndex: roundIndex + 1, totalRounds: tabataRounds,
      phaseLabel: `${isWork ? 'TRAVAIL' : 'REPOS'} — Round ${roundIndex + 1}/${tabataRounds}`,
      phaseKey: `r${roundIndex}-${isWork ? 'w' : 'r'}`, isWork,
    }
  }

  const state = compute()

  // Bips : décompte 3-2-1 en fin de phase, bip long au changement de phase, bip final.
  useEffect(() => {
    if (!running) return
    if (state.finished) {
      if (lastBeepKeyRef.current !== 'finished') {
        beep(1200, 0.35)
        lastBeepKeyRef.current = 'finished'
        setRunning(false)
      }
      return
    }
    const remInt = Math.ceil(state.remaining)
    const key = `${state.phaseKey}-${remInt}`
    if (lastBeepKeyRef.current === key) return
    if (remInt <= 5 && remInt >= 1) {
      beep(660, 0.08)
      lastBeepKeyRef.current = key
    }
  }, [state.remaining, state.finished, running])

  // Bip au changement de round/segment (transition détectée via phaseKey)
  const prevPhaseKeyRef = useRef(null)
  useEffect(() => {
    if (!running || !state.phaseKey) return
    if (prevPhaseKeyRef.current !== null && prevPhaseKeyRef.current !== state.phaseKey) {
      beep(1000, 0.18)
    }
    prevPhaseKeyRef.current = state.phaseKey
  }, [state.phaseKey, running])

  const accent = (type === 'TABATA' || type === 'CUSTOM') && state.isWork === false ? '#1D4ED8' : 'var(--green)'

  const customTotal = buildCustomSegments(customSteps, customRounds, customRestBetween).reduce((s, seg) => s + seg.sec, 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 900, display: 'flex', flexDirection: 'column', color: 'var(--text)' }}>
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => screen === 'run' ? backToSetup() : onClose()} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 22, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: 'var(--green)' }}>TIMER</span>
        </div>
      </div>

      {screen === 'setup' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 30px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {TYPES.map(t => (
              <button key={t.key} onClick={() => setType(t.key)} style={{
                flex: 1, padding: '11px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: `1px solid ${type === t.key ? 'var(--green)' : 'var(--border2)'}`,
                background: type === t.key ? 'var(--green-light)' : 'var(--bg)',
                color: type === t.key ? 'var(--green)' : 'var(--text3)',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {type === 'EMOM' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <HMSField label="Durée par round" seconds={emomRoundSec} onChange={setEmomRoundSec} min={1} />
              <NumberField label="Nombre de rounds" value={emomRounds} onChange={setEmomRounds} step={1} min={1} />
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Durée totale : {fmt(emomRoundSec * emomRounds)}</div>
            </div>
          )}

          {type === 'AMRAP' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <HMSField label="Durée totale" seconds={amrapSec} onChange={setAmrapSec} min={1} />
            </div>
          )}

          {type === 'TABATA' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <HMSField label="Travail" seconds={tabataWork} onChange={setTabataWork} min={1} />
              <HMSField label="Repos" seconds={tabataRest} onChange={setTabataRest} min={1} />
              <NumberField label="Nombre de rounds" value={tabataRounds} onChange={setTabataRounds} step={1} min={1} />
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Durée totale : {fmt((tabataWork + tabataRest) * tabataRounds)}</div>
            </div>
          )}

          {type === 'CUSTOM' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {customPresets.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Mes chronos enregistrés</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {customPresets.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '8px 10px' }}>
                        <button onClick={() => loadCustomPreset(p)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {p.name}
                        </button>
                        <button onClick={() => deleteCustomPreset(p.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Séquence</div>
                {customSteps.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '8px 0' }}>Ajoute un ON pour commencer.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {customSteps.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '6px 8px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '3px 8px', flexShrink: 0,
                          background: s.type === 'ON' ? 'var(--green-light)' : '#EFF6FF',
                          color: s.type === 'ON' ? 'var(--green)' : '#1D4ED8',
                        }}>
                          {s.type === 'ON' ? 'ON' : 'RÉCUP'}
                        </span>
                        <input type="number" value={s.sec} onChange={e => updateCustomStepSec(i, parseInt(e.target.value) || 1)}
                          style={{ width: 60, boxSizing: 'border-box', padding: '6px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }} />
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>sec</span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => removeCustomStep(i)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 15, cursor: 'pointer', padding: '0 2px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => addCustomStep('ON')} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: '1px solid var(--green)', background: 'var(--green-light)', color: 'var(--green)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + ON
                  </button>
                  <button onClick={() => addCustomStep('REST')} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: '1px solid #1D4ED8', background: '#EFF6FF', color: '#1D4ED8', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Récup
                  </button>
                </div>
              </div>

              <NumberField label="Nombre de rounds (répète la séquence)" value={customRounds} onChange={setCustomRounds} step={1} min={1} />
              <HMSField label="Repos entre les rounds" seconds={customRestBetween} onChange={setCustomRestBetween} min={0} />

              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Durée totale : {fmt(customTotal)}</div>

              <button onClick={saveCustomPreset} disabled={!customSteps.length} style={{
                width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border2)', background: 'transparent',
                color: customSteps.length ? 'var(--text)' : '#4B5260', fontSize: 13, fontWeight: 700, cursor: customSteps.length ? 'pointer' : 'default', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <FloppyDisk size={15} /> Enregistrer cette création
              </button>
            </div>
          )}

          <button onClick={start} disabled={type === 'CUSTOM' && !customSteps.length} style={{
            width: '100%', marginTop: 28, border: 'none', borderRadius: 10, padding: 15, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            background: (type === 'CUSTOM' && !customSteps.length) ? 'var(--border2)' : 'var(--green)',
            color: (type === 'CUSTOM' && !customSteps.length) ? 'var(--text3)' : '#fff',
          }}>
            Démarrer →
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 }}>
          <div style={{ fontSize: 13, color: accent, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{hasPreset ? 'CHRONO' : type === 'CUSTOM' ? 'PERSO' : type}</div>
          <div style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600 }}>{state.phaseLabel}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 76, fontWeight: 700, color: accent, margin: '10px 0' }}>
            {fmt(state.remaining)}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, width: '100%', maxWidth: 320 }}>
            {!state.finished && (
              <button onClick={running ? pause : start} style={{
                flex: 1, padding: '14px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                background: 'var(--green)', color: '#fff',
              }}>
                {running ? '⏸ Pause' : '▶ Reprendre'}
              </button>
            )}
            <button onClick={reset} style={{ flex: 1, padding: '14px 10px', borderRadius: 10, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Reset
            </button>
          </div>
          <button onClick={backToSetup} style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Changer de format
          </button>
        </div>
      )}
    </div>
  )
}
