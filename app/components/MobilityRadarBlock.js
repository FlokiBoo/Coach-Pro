'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { JOINT_TESTS } from '@/lib/jointTests'
import { scoreJoint, scoreQualitativeJoint, jointTestKey } from '@/lib/jointTestThresholds'
import {
  TORQUE_TESTS, PSYCH_QUESTIONNAIRE,
  verdictLabel, verdictColor,
  questionnaireLabel, questionnaireLean,
  computeSynthesis, computeDiscordance,
} from '@/lib/torqueTests'

const ALL_QUESTIONS = PSYCH_QUESTIONNAIRE.flatMap(b => b.questions)
const ACCENT = '#1F9D6B' // vert accent

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export default function MobilityRadarBlock({ athleteId }) {
  const [joints, setJoints] = useState(null) // { joint: score|null }
  const [torqueVerdict, setTorqueVerdict] = useState(null)
  const [questEntry, setQuestEntry] = useState(null)
  const [discordance, setDiscordance] = useState(null)

  useEffect(() => {
    if (!athleteId) return

    supabase.from('joint_test_entries').select('*').eq('athlete_id', athleteId)
      .then(({ data }) => {
        const byTest = {}
        ;(data || []).forEach(e => {
          const k = jointTestKey(e.joint, e.test_name)
          if (!byTest[k]) byTest[k] = e
        })
        const scores = {}
        JOINT_TESTS.forEach(g => {
          scores[g.joint] = g.qualitative
            ? scoreQualitativeJoint(g.joint, g.tests, byTest)
            : scoreJoint(g.joint, g.tests, byTest)
        })
        setJoints(scores)
      })

    supabase.from('torque_test_entries').select('*').eq('athlete_id', athleteId)
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => { if (!map[e.test_key]) map[e.test_key] = e })
        const verdicts = TORQUE_TESTS.map(t => map[t.key]?.verdict).filter(Boolean)
        const synthesis = computeSynthesis(verdicts)
        const qEntry = map.questionnaire || null
        const qLean = qEntry?.verdict ? questionnaireLean(qEntry.verdict) : null
        setTorqueVerdict(synthesis)
        setQuestEntry(qEntry)
        setDiscordance(computeDiscordance(qLean, synthesis))
      })
  }, [athleteId])

  if (!joints) return null

  const axes = JOINT_TESTS.map(g => g.joint)
  const values = axes.map(a => joints[a])
  const hasAnyData = values.some(v => v != null)
  if (!hasAnyData && !torqueVerdict) return null

  const size = 220
  const cx = size / 2, cy = size / 2, maxR = 82
  const n = axes.length
  const angleStep = 360 / n

  const ringLevels = [25, 50, 75, 100]
  const dataPoints = axes.map((a, i) => {
    const v = values[i] ?? 0
    return polarPoint(cx, cy, (v / 100) * maxR, i * angleStep)
  })
  const polygonPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  const overall = values.some(v => v != null)
    ? Math.round(values.filter(v => v != null).reduce((a, b) => a + b, 0) / values.filter(v => v != null).length)
    : null

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>🎯 Bilan mobilité & profil</div>

      {hasAnyData && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
            {dataPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={ACCENT} />
            ))}
            {axes.map((a, i) => {
              const labelP = polarPoint(cx, cy, maxR + 20, i * angleStep)
              const dx = labelP.x - cx
              // Sur les axes proches de l'horizontale, le texte centré déborde du cadre SVG
              // (ex. "Poignet"/"Genou") : on ancre le texte vers l'intérieur du côté concerné.
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

          {(() => {
            const PRIORITY_THRESHOLD = 70
            const scored = axes.map((a, i) => ({ joint: a, score: values[i] })).filter(x => x.score != null)
            const weakest = scored.filter(x => x.score < PRIORITY_THRESHOLD).sort((a, b) => a.score - b.score)
            if (!weakest.length) return null
            return (
              <div style={{ width: '100%', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--r)', padding: '10px 12px', marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>
                  🔧 À travailler en priorité
                </div>
                <div style={{ fontSize: 12, color: '#92400E' }}>
                  {weakest.map(w => `${w.joint} (${Math.round(w.score)})`).join(' · ')}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {torqueVerdict && (() => {
        const c = verdictColor(torqueVerdict.verdict)
        return (
          <div style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 'var(--r)', padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>
              ⚖️ Profil Torque
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, color: c.color }}>{torqueVerdict.label}</div>
          </div>
        )
      })()}

      {questEntry?.verdict && (() => {
        const c = verdictColor(questionnaireLean(questEntry.verdict))
        return (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Questionnaire psychologique : <span style={{ fontWeight: 700, color: c.color }}>{questionnaireLabel(questEntry.verdict)}</span>
          </div>
        )
      })()}

      {discordance && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>
            ⚠️ Discordance
          </div>
          <div style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.5 }}>{discordance}</div>
        </div>
      )}
    </div>
  )
}
