'use client'

import { useState, useEffect, useRef } from 'react'
import { Ruler, Camera, Prohibit, CheckCircle, DeviceMobile, Warning } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { JOINT_TESTS } from '@/lib/jointTests'
import PhotoAngleCapture from './PhotoAngleCapture'

const ALL_TESTS = JOINT_TESTS.filter(g => !g.qualitative).flatMap(g => g.tests.map(name => ({ joint: g.joint, name })))
const BUCKET = 'joint-test-photos'

function needsIOSPermission() {
  return typeof window !== 'undefined'
    && typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function'
}

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

// Différence angulaire circulaire (utile pour alpha, qui boucle 0-360°)
function angleDiff(a, b) {
  let d = a - b
  d = ((d + 180) % 360 + 360) % 360 - 180
  return d
}

function isSpineRotation(test) {
  return test?.joint === 'Colonne' && /^Rotation\b/.test(test?.name || '')
}

export default function GoniometerView({ athleteId, onClose }) {
  const [permissionState, setPermissionState] = useState(needsIOSPermission() ? 'needed' : 'granted')
  const [mode, setMode] = useState('sensor') // 'sensor' | 'photo'
  const [side, setSide] = useState('D') // 'D' | 'G'
  const [axis, setAxis] = useState('beta') // 'beta' (sagittal) | 'gamma' (frontal) | 'alpha' (rotation colonne)
  const [testIndex, setTestIndex] = useState(0)
  const [liveRaw, setLiveRaw] = useState(0)
  const [zeroOffset, setZeroOffset] = useState(0)
  const [previous, setPrevious] = useState(undefined)
  const [flash, setFlash] = useState(null)
  const [done, setDone] = useState(false)
  const [paused, setPaused] = useState(false)
  const [autoPaused, setAutoPaused] = useState(false)
  const [history, setHistory] = useState([]) // [{ testIndex, testName, joint, side, value, hasPhoto }]
  const [photoAngle, setPhotoAngle] = useState(null)
  const [manualValue, setManualValue] = useState('')
  const [daf, setDaf] = useState('')
  const [dafOui, setDafOui] = useState(false)
  const [saving, setSaving] = useState(false)
  const liveRawRef = useRef(0)
  const pausedRef = useRef(false)
  const photoRef = useRef(null)
  const stableRef = useRef({ value: null, since: null })

  const test = ALL_TESTS[testIndex]

  const resetStability = () => { stableRef.current = { value: null, since: null } }

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { if (!paused) { resetStability(); setAutoPaused(false) } }, [paused])

  useEffect(() => {
    if (permissionState !== 'granted' || mode !== 'sensor') return
    const STABLE_RANGE = 5 // °
    const STABLE_MS = 2000
    const handler = (e) => {
      if (pausedRef.current) return
      const raw = axis === 'beta' ? e.beta : axis === 'gamma' ? e.gamma : e.alpha
      if (raw == null) return
      liveRawRef.current = raw
      setLiveRaw(raw)

      const st = stableRef.current
      if (st.value == null || Math.abs(raw - st.value) > STABLE_RANGE) {
        stableRef.current = { value: raw, since: Date.now() }
      } else if (Date.now() - st.since >= STABLE_MS) {
        setPaused(true)
        setAutoPaused(true)
      }
    }
    window.addEventListener('deviceorientation', handler)
    return () => window.removeEventListener('deviceorientation', handler)
  }, [permissionState, axis, mode])

  useEffect(() => {
    setZeroOffset(liveRawRef.current)
    resetStability()
  }, [axis])

  useEffect(() => {
    if (!test) return
    setAxis(isSpineRotation(test) ? 'alpha' : (a => (a === 'alpha' ? 'beta' : a)))
  }, [test?.name])

  useEffect(() => {
    if (!test) return
    setPrevious(undefined)
    setManualValue('')
    setDaf('')
    setDafOui(false)
    setPaused(false)
    resetStability()
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

  const rawDiff = angleDiff(liveRaw, zeroOffset)
  const displayAngle = Math.abs(rawDiff)
  const clamped = Math.max(-90, Math.min(90, rawDiff))
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

  const canSave = mode === 'sensor' ? true : photoAngle != null

  const save = async () => {
    if (!test || saving) return
    if (mode === 'photo' && photoAngle == null) return
    setSaving(true)

    const value = mode === 'sensor'
      ? (manualValue.trim() !== '' ? Math.round(parseFloat(manualValue) * 10) / 10 : Math.round(displayAngle * 10) / 10)
      : Math.round(photoAngle * 10) / 10
    const field = side === 'D' ? 'value_d' : 'value_g'
    const prevSideVal = previous?.[field]

    let photoPath = null
    if (mode === 'photo') {
      const snapshot = await photoRef.current?.getSnapshot()
      if (snapshot?.blob) {
        const slug = test.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
        photoPath = `${athleteId}/${slug}-${side}-${Date.now()}.jpg`
        await supabase.storage.from(BUCKET).upload(photoPath, snapshot.blob, { contentType: 'image/jpeg' })
      }
    }

    const { data: existingToday } = await supabase.from('joint_test_entries').select('*')
      .eq('athlete_id', athleteId).eq('test_name', test.name).eq('date', today()).maybeSingle()

    const payload = { [field]: value, daf: daf.trim() || null, daf_oui: dafOui, ...(photoPath ? { photo_path: photoPath } : {}) }

    if (existingToday) {
      await supabase.from('joint_test_entries').update(payload).eq('id', existingToday.id)
    } else {
      await supabase.from('joint_test_entries').insert({
        athlete_id: athleteId, test_name: test.name, joint: test.joint, date: today(), ...payload,
      })
    }

    const pct = (prevSideVal != null && prevSideVal !== 0) ? Math.round(((value - prevSideVal) / prevSideVal) * 1000) / 10 : null
    setFlash({ value, pct, dafOui })
    setTimeout(() => setFlash(null), 1400)

    setHistory(prev => {
      const entry = { testIndex, testName: test.name, joint: test.joint, side, value, hasPhoto: !!photoPath, dafOui }
      const others = prev.filter(h => !(h.testIndex === testIndex && h.side === side))
      return [...others, entry]
    })

    photoRef.current?.reset()
    setPhotoAngle(null)
    setManualValue('')
    setDaf('')
    setDafOui(false)
    setPaused(false)
    setSaving(false)

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

  if (permissionState === 'needed' && mode === 'sensor') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', gap: 18, fontFamily: "'Space Grotesk', sans-serif" }}>
        <Ruler size={40} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#EDEFF2', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>Accès aux capteurs de mouvement</h1>
        <p style={{ fontSize: 13, color: '#7C8493', lineHeight: 1.5, margin: 0, maxWidth: 280 }}>
          iOS demande une autorisation explicite pour lire l'accéléromètre, nécessaire pour mesurer l'angle.
        </p>
        <button onClick={requestPermission} style={{ background: '#F2A93B', color: '#1a1400', border: 'none', borderRadius: 10, padding: '14px 32px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Activer les capteurs
        </button>
        <button onClick={() => setMode('photo')} style={{ background: 'none', border: '1px solid #2A3140', color: '#EDEFF2', borderRadius: 10, padding: '12px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Camera size={14} /> Utiliser le mode photo à la place
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7C8493', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Annuler</button>
      </div>
    )
  }

  if (permissionState === 'denied' && mode === 'sensor') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', gap: 14 }}>
        <Prohibit size={32} />
        <div style={{ color: '#EDEFF2', fontWeight: 700 }}>Accès refusé</div>
        <div style={{ color: '#7C8493', fontSize: 13 }}>Autorise les capteurs de mouvement dans les réglages de ton navigateur, ou utilise le mode photo.</div>
        <button onClick={() => setMode('photo')} style={{ background: '#F2A93B', color: '#1a1400', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Camera size={14} /> Mode photo</button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7C8493', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Fermer</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', color: '#EDEFF2', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#EDEFF2', fontSize: 22, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: '#F2A93B' }}>GONIO</span>{mode === 'photo' ? 'PHOTO' : 'MÈTRE'}
        </div>
      </div>

      {done ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30, textAlign: 'center' }}>
          <CheckCircle size={40} color="#3FC1B0" />
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
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, padding: '0 20px 8px' }}>
            {[{ key: 'sensor', label: 'Capteur', Icon: Ruler }, { key: 'photo', label: 'Photo', Icon: Camera }].map(m => (
              <button key={m.key} onClick={() => setMode(m.key)} style={{
                flex: 1, padding: '9px 6px', borderRadius: 8, border: `1px solid ${mode === m.key ? '#3FC1B0' : '#2A3140'}`,
                background: mode === m.key ? 'rgba(63,193,176,0.08)' : '#161B22', color: mode === m.key ? '#3FC1B0' : '#7C8493',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <m.Icon size={13} /> {m.label}
              </button>
            ))}
          </div>

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

          {mode === 'sensor' ? (
            <>
              {isSpineRotation(test) ? (
                <div style={{ margin: '0 20px 6px', padding: '10px 12px', borderRadius: 8, border: '1px solid #2A3140', background: '#161B22' }}>
                  <div style={{ fontSize: 11, color: '#F2A93B', fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}><DeviceMobile size={12} /> Position du téléphone</div>
                  <div style={{ fontSize: 11.5, color: '#7C8493', lineHeight: 1.5 }}>
                    Plaque le bas du téléphone contre ton plexus, à plat, dos vers le sol. Tourne le buste pour mesurer la rotation.
                  </div>
                </div>
              ) : (
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
              )}

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
                  {axis === 'beta' ? 'Plan sagittal — écran face à toi' : axis === 'gamma' ? 'Plan frontal — écran de côté' : 'Rotation colonne — boussole'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, padding: '18px 20px 0' }}>
                <button onClick={calibrateZero} style={{ flex: 1, padding: '13px 10px', borderRadius: 10, border: '1px solid #3FC1B0', background: 'transparent', color: '#3FC1B0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Zéro ici
                </button>
                <button onClick={() => { setZeroOffset(0); setPaused(false); resetStability() }} style={{ flex: 1, padding: '13px 10px', borderRadius: 10, border: '1px solid #2A3140', background: 'transparent', color: '#7C8493', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
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
                {paused && autoPaused && (
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#E5636B', marginTop: 6 }}>
                    Valeur stabilisée — pause automatique
                  </div>
                )}
              </div>

              <div style={{ padding: '14px 20px 0' }}>
                <div style={{ fontSize: 10, color: '#7C8493', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, textAlign: 'center' }}>
                  Ou saisir la valeur manuellement
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" inputMode="decimal" step="0.1" value={manualValue}
                    onChange={e => setManualValue(e.target.value)}
                    placeholder="ex: 34.2"
                    style={{
                      flex: 1, boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1px solid #2A3140',
                      background: '#161B22', color: '#EDEFF2', fontSize: 16, fontWeight: 700, textAlign: 'center',
                      outline: 'none', fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  />
                  <span style={{ color: '#7C8493', fontSize: 14, fontWeight: 700 }}>°</span>
                </div>
              </div>
            </>
          ) : (
            <PhotoAngleCapture ref={photoRef} onAngleChange={setPhotoAngle} />
          )}

          {history.length > 0 && (
            <div style={{ padding: '14px 20px 0', flex: mode === 'sensor' ? 1 : undefined, minHeight: 0, overflowY: 'auto', maxHeight: mode === 'photo' ? 140 : undefined }}>
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
                    {h.hasPhoto && <span style={{ display: 'flex', flexShrink: 0 }}><Camera size={13} /></span>}
                    {h.dafOui && <span style={{ display: 'flex', flexShrink: 0, color: '#F87171' }}><Warning size={13} /></span>}
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

          <div style={{ padding: '0 20px' }}>
            <div style={{ fontSize: 10, color: '#7C8493', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Douleur Angle de Fermeture (DAF)
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" onClick={() => setDafOui(true)} style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: `1px solid ${dafOui ? '#F87171' : '#2A3140'}`,
                background: dafOui ? '#3B1414' : '#161B22', color: dafOui ? '#F87171' : '#7C8493',
              }}>
                Oui
              </button>
              <button type="button" onClick={() => setDafOui(false)} style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: `1px solid ${!dafOui ? '#3FC1B0' : '#2A3140'}`,
                background: !dafOui ? '#0F2A24' : '#161B22', color: !dafOui ? '#3FC1B0' : '#7C8493',
              }}>
                Non
              </button>
            </div>
            <textarea value={daf} onChange={e => setDaf(e.target.value)} rows={2}
              placeholder="Optionnel…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #2A3140',
                background: '#161B22', color: '#EDEFF2', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }} />
          </div>

          <div style={{ padding: '14px 20px 24px', marginTop: mode === 'sensor' ? 'auto' : undefined }}>
            {flash && (
              <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 13, color: flash.dafOui ? '#F87171' : '#3FC1B0', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {flash.dafOui ? <Warning size={13} /> : '✓'} {flash.value}° noté{flash.pct != null ? ` (${flash.pct > 0 ? '+' : ''}${flash.pct}%)` : ''}{flash.dafOui ? ' — DAF présente' : ''}
              </div>
            )}
            <button onClick={save} disabled={!canSave || saving} style={{
              width: '100%', background: (canSave && !saving) ? '#F2A93B' : '#2A3140', color: (canSave && !saving) ? '#1a1400' : '#7C8493',
              border: 'none', borderRadius: 10, padding: '15px', fontSize: 15, fontWeight: 700, cursor: (canSave && !saving) ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>
              {saving ? '…' : 'Noter →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
