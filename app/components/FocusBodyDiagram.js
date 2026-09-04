'use client'

import { Target } from '@phosphor-icons/react'
import { FRONT_MUSCLES, BACK_MUSCLES, FRONT_VIEWBOX, BACK_VIEWBOX } from '@/app/data/bodyMap'
import { MUSCLE_GROUPS } from './MuscleAnatomyDiagram'

const NEUTRAL = '#E8C9AE'
const STROKE = '#C9A47E'
const HIGHLIGHT = '#EF4444'

function BodySVG({ view, width, groups }) {
  const isFront = view === 'front'
  const list = isFront ? FRONT_MUSCLES : BACK_MUSCLES
  const viewBox = isFront ? FRONT_VIEWBOX : BACK_VIEWBOX

  return (
    <svg viewBox={viewBox} style={{ width, height: 'auto' }}>
      {list.map(m => (
        <path
          key={m.id}
          d={m.path}
          fill={m.group && groups.includes(m.group) ? HIGHLIGHT : NEUTRAL}
          stroke={STROKE}
          strokeWidth="0.15"
          strokeLinejoin="round"
        />
      ))}
      <text x={isFront ? 17.5 : 54.5} y="91.5" textAnchor="middle" fontSize="2.4" fill={STROKE} fontWeight="700" fontFamily="sans-serif" letterSpacing="0.3">
        {isFront ? 'AVANT' : 'ARRIÈRE'}
      </text>
    </svg>
  )
}

export default function FocusBodyDiagram({ groups = [], onClose }) {
  const labels = MUSCLE_GROUPS.filter(g => groups.includes(g.key)).map(g => g.label)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: 20, padding: 20, maxWidth: 380, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '90svh', overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Target size={13} /> Focus</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{labels.join(', ') || '—'}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <BodySVG view="front" width={150} groups={groups} />
          <BodySVG view="back" width={150} groups={groups} />
        </div>

        <button onClick={onClose} style={{
          marginTop: 18, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20,
          padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%',
        }}>
          Fermer
        </button>
      </div>
    </div>
  )
}
