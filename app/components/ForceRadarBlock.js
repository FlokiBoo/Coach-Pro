'use client'

import { RADAR_GROUPS, computeMuscleScores } from '@/lib/muscleRadar'

const ACCENT = '#2D3A30' // = var(--green) — valeur figée pour permettre le calcul d'opacité hexa ci-dessous

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// Radar (diagramme en araignée) de la force par groupe musculaire, à partir des badges de force
// et de cardio déjà calculés par BadgesBlock : plus le score se rapproche du nom du muscle, plus
// le palier atteint sur les mouvements de ce groupe est élevé.
export default function ForceRadarBlock({ strengthCards, cardioCards }) {
  const cards = [...(strengthCards || []), ...(cardioCards || [])]
  const scores = computeMuscleScores(cards)
  const axes = RADAR_GROUPS
  const values = axes.map(a => scores[a])
  const hasAnyData = values.some(v => v != null)
  if (!hasAnyData) return null

  const size = 240
  const cx = size / 2, cy = size / 2, maxR = 88
  const n = axes.length
  const angleStep = 360 / n

  const ringLevels = [25, 50, 75, 100]
  const dataPoints = axes.map((a, i) => {
    const v = values[i] ?? 0
    return polarPoint(cx, cy, (v / 100) * maxR, i * angleStep)
  })
  const polygonPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  const overall = hasAnyData
    ? Math.round(values.filter(v => v != null).reduce((a, b) => a + b, 0) / values.filter(v => v != null).length)
    : null

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', alignSelf: 'flex-start', marginBottom: 6 }}>💪 Force par muscle</div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {ringLevels.map(lvl => {
          const pts = axes.map((_, i) => polarPoint(cx, cy, (lvl / 100) * maxR, i * angleStep))
          return (
            <polygon key={lvl} points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="var(--border2)" strokeWidth="1" />
          )
        })}
        {axes.map((_, i) => {
          const p = polarPoint(cx, cy, maxR, i * angleStep)
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border2)" strokeWidth="1" />
        })}
        <polygon points={polygonPath} fill={`${ACCENT}26`} stroke={ACCENT} strokeWidth="2" />
        {dataPoints.map((p, i) => values[i] != null && (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={ACCENT} />
        ))}
        {axes.map((a, i) => {
          const labelP = polarPoint(cx, cy, maxR + 22, i * angleStep)
          const dx = labelP.x - cx
          const anchor = Math.abs(dx) < 8 ? 'middle' : (dx > 0 ? 'end' : 'start')
          return (
            <text key={a} x={labelP.x} y={labelP.y} textAnchor={anchor} dominantBaseline="middle"
              fontSize="11" fontWeight="700" fill="var(--text2)">
              {a}
            </text>
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--text)">
          {overall ?? '—'}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--text3)">/100</text>
      </svg>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {axes.map((a, i) => (
          <div key={a} style={{ fontSize: 11, color: 'var(--text3)' }}>
            {a} : <span style={{ fontWeight: 700, color: 'var(--text2)' }}>{values[i] != null ? Math.round(values[i]) : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
