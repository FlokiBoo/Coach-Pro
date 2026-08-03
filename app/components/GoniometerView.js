'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { JOINT_TESTS } from '@/lib/jointTests'

const ALL_TESTS = JOINT_TESTS.flatMap(g => g.tests.map(name => ({ joint: g.joint, name })))

function needsIOSPermission() {
  return typeof window !== 'undefined'
    && typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function'
}

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

export default function GoniometerView({ athleteId, onClose }) {
  const [permissionState, setPermissionState] = useState(needsIOSPermission() ? 'needed' : 'granted')
  const [side, setSide] = useState('D') // 'D' | 'G'
  const [axis, setAxis] = useState('beta') // 'beta' (sagittal) | 'gamma' (frontal)
  const [testIndex, setTestIndex] = useState(0)
  const [liveRaw, setLiveRaw] = useState(0)
  const [zeroOffset, setZeroOffset] = useState(0)
  const [previous, setPrevious] = useState(undefined)
  const [flash, setFlash] = useState(null)
  const [done, setDone] = useState(false)
  const [paused, setPaused] = useState(false)
  const [history, setHistory] = useState([]) // [{ testIndex, testName, joint, side, value }]
  const liveRawRef = useRef(0)
  const pausedRef = useRef(false)

  const test = ALL_TESTS[testIndex]

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    if (permissionState !== 'granted') return
    const handler = (e) => {
      if (pausedRef.current) return
      const raw = axis === 'beta' ? e.beta : e.gamma
      if (raw == null) return
      liveRawRef.current = raw
      setLiveRaw(raw)
    }
    window.addEventListener('deviceorientation', handler)
    return () => window.removeEventListener('deviceorientation', handler)
  }, [permissionState, axis])

  useEffect(() => {
    setZeroOffset(liveRawRef.current)
  }, [axis])

  useEffect(() => {
    if (!test) return
    setPrevious(undefined)
    supabase.from('joint_test_entries').select('*')
      .eq('athlete_id', athleteId).eq('test_name', test.name)
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => setPrevious(data || null))
  }, [test?.name, athleteId])

  const requestPermission = () => {
    DeviceOrientationEvent.requestPermission().then(state => {
      setPermissionState(state === 'granted' ? 'granted' : 'denied')
    }).catch(() => setPermissionState('denied'))
  }

  const displayAngle = Math.abs(liveRaw - zeroOffset)
  const clamped = Math.max(-90, Math.min(90, liveRaw - zeroOffset))
  const rad = (clamped * Math.PI) / 180
  const cx = 150, cy = 170, len = 115
  const needleX = cx + len * Math.sin(rad)
  const needleY = cy - len * Math.cos(rad)

  const ticks = []
  for (let deg = -90; deg <= 90; deg += 10) {
    const isMajor = deg % 30 === 0
    const rOuter = 130, rInner = isMajor ? 112 : 120
    const r2 = (deg * Math.PI) / 180
    ticks.push({
      x1: cx + rOuter * Math.sin(r2), y1: cy - rOuter * Math.cos(r2),
      x2: cx + rInner * Math.sin(r2), y2: cy - rInner * Math.cos(r2),
      isMajor,
    })
  }

  const calibrateZero = () => setZeroOffset(liveRawRef.current)

  const save = async () => {
    if (!test) return
    const value = Math.round(displayAngle * 10) / 10
    const field = side === 'D' ? 'value_d' : 'value_g'
    const prevSideVal = previous?.[field]

    const { data: existingToday } = await supabase.from('joint_test_entries').select('*')
      .eq('athlete_id', athleteId).eq('test_name', test.name).eq('date', today()).maybeSingle()

    if (existingToday) {
      await supabase.from('joint_test_entries').update({ [field]: value }).eq('id', existingToday.id)
    } else {
      await supabase.from('joint_test_entries').insert({
        athlete_id: athleteId, test_name: test.name, joint: test.joint, date: today(), [field]: value,
      })
    }

    const pct = (prevSideVal != null && prevSideVal !== 0) ? Math.round(((value - prevSideVal) / prevSideVal) * 1000) / 10 : null
    setFlash({ value, pct })
    setTimeout(() => setFlash(null), 1400)

    setHistory(prev => {
      const entry = { testIndex, testName: test.name, joint: test.joint, side, value }
      const others = prev.filter(h => !(h.testIndex === testIndex && h.side === side))
      return [...others, entry]
    })

    setPaused(false)
    if (testIndex < ALL_TESTS.length - 1) {
      setTestIndex(i => i + 1)
    } else {
      setDone(true)
    }
  }

  const restart = (newSide) => {
    setSide(newSide)
    setTestIndex(0)
    setDone(false)
    setPaused(false)
  }

  const reopenFromHistory = (entry) => {
    setSide(entry.side)
    setTestIndex(entry.testIndex)
    setDone(false)
    setPaused(false)
  }

  if (permissionState === 'needed') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', gap: 18, fontFamily: "'Space Grotesk', sans-serif" }}>
        <div style={{ fontSize: 40 }}>📐</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#EDEFF2', margin: 0 }}>Accès aux capteurs de mouvement</h1>
        <p style={{ fontSize: 13, color: '#7C8493', lineHeight: 1.5, margin: 0, maxWidth: 280 }}>
          iOS demande une autorisation explicite pour lire l'accéléromètre, nécessaire pour mesurer l'angle.
        </p>
        <button onClick={requestPermission} style={{ background: '#F2A93B', color: '#1a1400', border: 'none', borderRadius: 10, padding: '14px 32px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Activer les capteurs
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7C8493', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Annuler</button>
      </div>
    )
  }

  if (permissionState === 'denied') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', gap: 14 }}>
        <div style={{ fontSize: 32 }}>🚫</div>
        <div style={{ color: '#EDEFF2', fontWeight: 700 }}>Accès refusé</div>
        <div style={{ color: '#7C8493', fontSize: 13 }}>Autorise les capteurs de mouvement dans les réglages de ton navigateur pour utiliser le goniomètre.</div>
        <button onClick={onClose} style={{ background: '#F2A93B', color: '#1a1400', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', color: '#EDEFF2', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#EDEFF2', fontSize: 22, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: '#F2A93B' }}>GONIO</span>MÈTRE
        </div>
      </div>

      {done ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Passage "{side === 'D' ? 'Droite' : 'Gauche'}" terminé</div>
          <div style={{ color: '#7C8493', fontSize: 13 }}>Tous les tests ont été notés pour ce côté.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => restart(side === 'D' ? 'G' : 'D')} style={{ background: '#F2A93B', color: '#1a1400', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Faire le côté {side === 'D' ? 'Gauche' : 'Droite'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid #2A3140', color: '#EDEFF2', borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Terminer
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, padding: '0 20px 10px' }}>
            {['D', 'G'].map(sd => (
              <button key={sd} onClick={() => restart(sd)} style={{
                flex: 1, padding: '9px 6px', borderRadius: 8, border: `1px solid ${side === sd ? '#F2A93B' : '#2A3140'}`,
                background: side === sd ? 'rgba(242,169,59,0.08)' : '#161B22', color: side === sd ? '#F2A93B' : '#7C8493',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Côté {sd === 'D' ? 'Droite' : 'Gauche'}
              </button>
            ))}
          </div>

          <div style={{ padding: '0 20px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#7C8493', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{test.joint} · Test {testIndex + 1}/{ALL_TESTS.length}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{test.name}</div>
            {previous === undefined ? (
              <div style={{ fontSize: 11, color: '#7C8493', marginTop: 4 }}>…</div>
            ) : previous && previous[side === 'D' ? 'value_d' : 'value_g'] != null ? (
              <div style={{ fontSize: 11, color: '#7C8493', marginTop: 4 }}>
                Dernier ({side === 'D' ? 'D' : 'G'}) : {previous[side === 'D' ? 'value_d' : 'value_g']}°
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#7C8493', marginTop: 4, fontStyle: 'italic' }}>Première mesure</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '0 20px 6px' }}>
            {[{ key: 'beta', label: 'Sagittal (flexion/ext)' }, { key: 'gamma', label: 'Frontal (abd/add)' }].map(a => (
              <button key={a.key} onClick={() => setAxis(a.key)} style={{
                flex: 1, padding: '7px 6px', borderRadius: 8, border: `1px solid ${axis === a.key ? '#F2A93B' : '#2A3140'}`,
                background: axis === a.key ? 'rgba(242,169,59,0.08)' : '#161B22', color: axis === a.key ? '#F2A93B' : '#7C8493',
                fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {a.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', margin: '6px auto 4px', width: 'min(78vw, 320px)' }}>
            <svg viewBox="0 0 300 190" style={{ display: 'block', width: '100%', height: 'auto' }}>
              <path d="M 20 170 A 130 130 0 0 1 280 170" fill="none" stroke="#1E2530" strokeWidth="3" />
              {ticks.map((t, i) => (
                <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                  stroke={t.isMajor ? '#7C8493' : '#2A3140'} strokeWidth={t.isMajor ? 2 : 1.5} />
              ))}
              <line x1={cx} y1={cy} x2={cx} y2={cy - 120} stroke="#3FC1B0" strokeWidth="2" strokeDasharray="2 3" />
              <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#F2A93B" strokeWidth="3" strokeLinecap="round" />
              <circle cx={cx} cy={cy} r="7" fill="#F2A93B" />
            </svg>
          </div>

          <div style={{ textAlign: 'center', marginTop: -18 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 56, fontWeight: 600, lineHeight: 1 }}>
              {displayAngle.toFixed(1)}<sup style={{ fontSize: 22, color: '#7C8493', fontWeight: 400 }}>°</sup>
            </div>
            <div style={{ fontSize: 11, color: '#7C8493', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>
              {axis === 'beta' ? 'Plan sagittal — écran face à toi' : 'Plan frontal — écran de côté'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, padding: '18px 20px 0' }}>
            <button onClick={calibrateZero} style={{ flex: 1, padding: '13px 10px', borderRadius: 10, border: '1px solid #3FC1B0', background: 'transparent', color: '#3FC1B0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Zéro ici
            </button>
            <button onClick={() => setZeroOffset(0)} style={{ flex: 1, padding: '13px 10px', borderRadius: 10, border: '1px solid #2A3140', background: 'transparent', color: '#7C8493', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Reset zéro
            </button>
          </div>

          <div style={{ padding: '10px 20px 0' }}>
            <button onClick={() => setPaused(p => !p)} style={{
              width: '100%', padding: '13px 10px', borderRadius: 10, border: `1px solid ${paused ? '#E5636B' : '#2A3140'}`,
              background: paused ? 'rgba(229,99,107,0.1)' : 'transparent', color: paused ? '#E5636B' : '#EDEFF2',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {paused ? '▶ Reprendre' : '⏸ Pause'}
            </button>
          </div>

          {history.length > 0 && (
            <div style={{ padding: '14px 20px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, color: '#7C8493', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Historique de la séance
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...history].reverse().map((h, i) => (
                  <button key={i} onClick={() => reopenFromHistory(h)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    background: '#161B22', border: '1px solid #2A3140', borderRadius: 10, padding: '9px 12px',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#EDEFF2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.testName} <span style={{ color: '#7C8493' }}>({h.side})</span>
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: '#F2A93B', flexShrink: 0 }}>
                      {h.value}°
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: '14px 20px 24px', marginTop: 'auto' }}>
            {flash && (
              <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 13, color: '#3FC1B0', fontWeight: 700 }}>
                ✓ {flash.value}° noté{flash.pct != null ? ` (${flash.pct > 0 ? '+' : ''}${flash.pct}%)` : ''}
              </div>
            )}
            <button onClick={save} style={{ width: '100%', background: '#F2A93B', color: '#1a1400', border: 'none', borderRadius: 10, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Noter →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
