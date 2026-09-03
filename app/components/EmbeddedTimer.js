'use client'

import { useState, useEffect, useRef } from 'react'
import { beep, unlockAudio } from '@/lib/audioBeep'

function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function buildCustomSegments(steps, rounds, restBetweenSec) {
  const segments = []
  for (let r = 0; r < rounds; r++) {
    steps.forEach(s => segments.push({ type: s.type, sec: s.sec, round: r + 1 }))
    if (r < rounds - 1 && restBetweenSec > 0) segments.push({ type: 'ROUNDREST', sec: restBetweenSec, round: r + 1 })
  }
  return segments
}

// Timer qui se lance automatiquement à partir d'une config déjà décidée par le coach (pas d'écran
// de réglage) — pensé pour être embarqué dans SplitTimerSession, jamais démonté pendant qu'il
// tourne (sinon le chrono perdrait son état), donc pas de position fixed ici : c'est au parent de
// gérer la mise en page.
export default function EmbeddedTimer({ config, label }) {
  const [running, setRunning] = useState(true)
  const [, forceTick] = useState(0)
  const elapsedBaseRef = useRef(0)
  const runStartRef = useRef(null)
  const lastBeepKeyRef = useRef(null)
  const prevPhaseKeyRef = useRef(null)

  useEffect(() => {
    runStartRef.current = Date.now()
    unlockAudio()
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => forceTick(t => t + 1), 100)
    return () => clearInterval(id)
  }, [running])

  const getElapsed = () => elapsedBaseRef.current + (runStartRef.current ? (Date.now() - runStartRef.current) / 1000 : 0)

  const toggle = () => {
    if (running) {
      elapsedBaseRef.current = getElapsed()
      runStartRef.current = null
    } else {
      runStartRef.current = Date.now()
    }
    setRunning(r => !r)
  }

  const reset = () => {
    elapsedBaseRef.current = 0
    runStartRef.current = running ? Date.now() : null
    lastBeepKeyRef.current = null
    prevPhaseKeyRef.current = null
    forceTick(t => t + 1)
  }

  const compute = () => {
    const elapsed = getElapsed()
    if (config.type === 'EMOM') {
      const total = config.roundSec * config.rounds
      if (elapsed >= total) return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
      const roundIndex = Math.floor(elapsed / config.roundSec)
      const remaining = config.roundSec - (elapsed % config.roundSec)
      return { finished: false, remaining, phaseLabel: `Round ${roundIndex + 1}/${config.rounds}`, phaseKey: `r${roundIndex}` }
    }
    if (config.type === 'AMRAP') {
      const remaining = config.totalSec - elapsed
      if (remaining <= 0) return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
      return { finished: false, remaining, phaseLabel: 'AMRAP', phaseKey: 'amrap' }
    }
    if (config.type === 'CUSTOM') {
      const segments = buildCustomSegments(config.steps, config.rounds, config.restBetweenSec)
      const total = segments.reduce((s, seg) => s + seg.sec, 0)
      if (!segments.length || elapsed >= total) return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
      let acc = 0
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (elapsed < acc + seg.sec) {
          const remaining = acc + seg.sec - elapsed
          const lbl = seg.type === 'ON' ? 'ON' : seg.type === 'REST' ? 'RÉCUP' : 'REPOS'
          return { finished: false, remaining, phaseLabel: `${lbl} — Round ${seg.round}/${config.rounds}`, phaseKey: `s${i}`, isWork: seg.type === 'ON' }
        }
        acc += seg.sec
      }
      return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
    }
    // TABATA
    const cycle = config.workSec + config.restSec
    const total = cycle * config.rounds
    if (elapsed >= total) return { finished: true, remaining: 0, phaseLabel: 'Terminé' }
    const roundIndex = Math.floor(elapsed / cycle)
    const pos = elapsed % cycle
    const isWork = pos < config.workSec
    const remaining = isWork ? config.workSec - pos : cycle - pos
    return { finished: false, remaining, phaseLabel: `${isWork ? 'TRAVAIL' : 'REPOS'} — Round ${roundIndex + 1}/${config.rounds}`, phaseKey: `r${roundIndex}-${isWork ? 'w' : 'r'}`, isWork }
  }

  const state = compute()

  useEffect(() => {
    if (!running) return
    if (state.finished) {
      if (lastBeepKeyRef.current !== 'finished') { beep(1200, 0.35); lastBeepKeyRef.current = 'finished'; setRunning(false) }
      return
    }
    const remInt = Math.ceil(state.remaining)
    const key = `${state.phaseKey}-${remInt}`
    if (lastBeepKeyRef.current === key) return
    if (remInt <= 3 && remInt >= 1) { beep(660, 0.08); lastBeepKeyRef.current = key }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.remaining, state.finished, running])

  useEffect(() => {
    if (!running || !state.phaseKey) return
    if (prevPhaseKeyRef.current !== null && prevPhaseKeyRef.current !== state.phaseKey) beep(1000, 0.18)
    prevPhaseKeyRef.current = state.phaseKey
  }, [state.phaseKey, running])

  const accent = (config.type === 'TABATA' || config.type === 'CUSTOM') && state.isWork === false ? '#1D4ED8' : 'var(--green)'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8, background: 'var(--bg2)' }}>
      {label && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>{label}</div>}
      <div style={{ fontSize: 13, color: accent, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{config.type === 'CUSTOM' ? 'PERSO' : config.type}</div>
      <div style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600 }}>{state.phaseLabel}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 56, fontWeight: 700, color: accent, margin: '4px 0' }}>
        {fmt(state.remaining)}
      </div>
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
        {!state.finished && (
          <button onClick={toggle} style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', background: 'var(--green)', color: '#fff' }}>
            {running ? '⏸ Pause' : '▶ Reprendre'}
          </button>
        )}
        <button onClick={reset} style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Reset
        </button>
      </div>
    </div>
  )
}
