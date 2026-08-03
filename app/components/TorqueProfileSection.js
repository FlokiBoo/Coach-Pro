'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TORQUE_TESTS, PSYCH_QUESTIONNAIRE } from '@/lib/torqueTests'

const ALL_QUESTIONS = PSYCH_QUESTIONNAIRE.flatMap(b => b.questions)

function computeQuestionnaireVerdict(answers) {
  const answered = ALL_QUESTIONS.filter(q => answers[q.key])
  if (answered.length === 0) return null
  const countA = answered.filter(q => answers[q.key] === 'A').length
  const countB = answered.length - countA
  if (countA >= 14) return 'TI_pur'
  if (countA >= 10) return 'TI_probable'
  if (countA === 9 && countB === 9) return 'Mix'
  if (countB >= 14) return 'TE_pur'
  if (countB >= 10) return 'TE_probable'
  return 'Mix'
}

function questionnaireLabel(v) {
  if (v === 'TI_pur') return 'TI Dominant pur'
  if (v === 'TI_probable') return 'TI probable'
  if (v === 'TE_probable') return 'TE probable'
  if (v === 'TE_pur') return 'TE Dominant pur'
  if (v === 'Mix') return 'Mix'
  return '—'
}

function questionnaireLean(v) {
  if (v === 'TI_pur' || v === 'TI_probable') return 'TI'
  if (v === 'TE_pur' || v === 'TE_probable') return 'TE'
  if (v === 'Mix') return 'Mix'
  return null
}

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

function computeVerdict(testConfig, answers) {
  let ti = 0, te = 0
  testConfig.criteria.forEach(c => {
    if (!c.decisive) return
    const chosenKey = answers[c.key]
    if (!chosenKey) return
    const opt = c.options.find(o => o.key === chosenKey)
    if (opt?.torque === 'TI') ti++
    else if (opt?.torque === 'TE') te++
  })
  if (ti === 0 && te === 0) return null
  if (ti > te) return 'TI'
  if (te > ti) return 'TE'
  return 'Mix'
}

function verdictLabel(v) {
  if (v === 'TI') return 'TI Dominant'
  if (v === 'TE') return 'TE Dominant'
  if (v === 'Mix') return 'Mix'
  return '—'
}

function verdictColor(v) {
  if (v === 'TI') return { color: '#1D4ED8', bg: '#DBEAFE' }
  if (v === 'TE') return { color: '#C2410C', bg: '#FFF7ED' }
  if (v === 'Mix') return { color: '#6B21A8', bg: '#F3E8FF' }
  return { color: 'var(--text3)', bg: 'var(--bg2)' }
}

export default function TorqueProfileSection({ athleteId }) {
  const [latest, setLatest] = useState({}) // { [test_key]: entry }
  const [expanded, setExpanded] = useState(null)
  const [forms, setForms] = useState({}) // { [test_key]: { [criterion_key]: option_key } }
  const [saving, setSaving] = useState(false)

  const load = () => {
    supabase.from('torque_test_entries').select('*')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => { if (!map[e.test_key]) map[e.test_key] = e })
        setLatest(map)
        const f = {}
        TORQUE_TESTS.forEach(t => { f[t.key] = map[t.key]?.answers || {} })
        f.questionnaire = map.questionnaire?.answers || {}
        setForms(f)
      })
  }

  useEffect(() => { if (athleteId) load() }, [athleteId])

  const pick = (testKey, criterionKey, optionKey) => {
    setForms(prev => ({ ...prev, [testKey]: { ...prev[testKey], [criterionKey]: optionKey } }))
  }

  const saveTest = async (testConfig) => {
    setSaving(true)
    const answers = forms[testConfig.key] || {}
    const verdict = computeVerdict(testConfig, answers)

    const { data: existingToday } = await supabase.from('torque_test_entries').select('id')
      .eq('athlete_id', athleteId).eq('test_key', testConfig.key).eq('date', today()).maybeSingle()

    if (existingToday) {
      await supabase.from('torque_test_entries').update({ answers, verdict }).eq('id', existingToday.id)
    } else {
      await supabase.from('torque_test_entries').insert({
        athlete_id: athleteId, test_key: testConfig.key, date: today(), answers, verdict,
      })
    }
    setSaving(false)
    load()
  }

  const pickAnswer = (questionKey, val) => {
    setForms(prev => ({ ...prev, questionnaire: { ...prev.questionnaire, [questionKey]: val } }))
  }

  const saveQuestionnaire = async () => {
    setSaving(true)
    const answers = forms.questionnaire || {}
    const verdict = computeQuestionnaireVerdict(answers)

    const { data: existingToday } = await supabase.from('torque_test_entries').select('id')
      .eq('athlete_id', athleteId).eq('test_key', 'questionnaire').eq('date', today()).maybeSingle()

    if (existingToday) {
      await supabase.from('torque_test_entries').update({ answers, verdict }).eq('id', existingToday.id)
    } else {
      await supabase.from('torque_test_entries').insert({
        athlete_id: athleteId, test_key: 'questionnaire', date: today(), answers, verdict,
      })
    }
    setSaving(false)
    load()
  }

  const verdicts = TORQUE_TESTS.map(t => latest[t.key]?.verdict).filter(Boolean)
  const synthesis = (() => {
    if (verdicts.length === 0) return null
    const counts = {}
    verdicts.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
    const [topVerdict, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (verdicts.length < 3) {
      return { label: `${topCount}/${verdicts.length} test(s) fait(s) — ${verdictLabel(topVerdict)} pour l'instant`, verdict: topVerdict, partial: true }
    }
    if (topCount === 3) return { label: `Profil clair — ${verdictLabel(topVerdict)}`, verdict: topVerdict }
    if (topCount === 2) return { label: `Profil probable — ${verdictLabel(topVerdict)}`, verdict: topVerdict }
    return { label: 'Mix ou compensation — à approfondir', verdict: 'Mix' }
  })()

  const questionnaireEntry = latest.questionnaire
  const questionnaireLeanVal = questionnaireEntry?.verdict ? questionnaireLean(questionnaireEntry.verdict) : null

  const discordance = (() => {
    if (!questionnaireLeanVal || !synthesis || synthesis.partial) return null
    const physique = synthesis.verdict
    if (questionnaireLeanVal === 'TI' && physique === 'TE') {
      return "Questionnaire TI + Tests physiques TE → TE chronique installé : TI de base mais système nerveux en TE permanent (stress, surcharge). Priorité : récupération SNC avant programmation."
    }
    if (questionnaireLeanVal === 'TE' && physique === 'TI') {
      return "Questionnaire TE + Tests physiques TI → rare : souvent un profil TE qui a développé le TI par l'entraînement (acquis, pas inné). Programmer avec un ratio TI/TE équilibré, pas TI pur."
    }
    return null
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {synthesis && (() => {
        const c = verdictColor(synthesis.verdict)
        return (
          <div style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 'var(--rl)', padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              🎯 Synthèse des tests
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: c.color }}>{synthesis.label}</div>
          </div>
        )
      })()}

      {discordance && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--rl)', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
            ⚠️ Signal d'alerte — discordance
          </div>
          <div style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>{discordance}</div>
        </div>
      )}

      {TORQUE_TESTS.map(t => {
        const isOpen = expanded === t.key
        const entry = latest[t.key]
        const form = forms[t.key] || {}
        const vColor = entry?.verdict ? verdictColor(entry.verdict) : null

        return (
          <div key={t.key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div onClick={() => setExpanded(isOpen ? null : t.key)} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 14 }}>{isOpen ? '▼' : '▶'}</span>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{t.label}</div>
              {entry?.verdict && (
                <span style={{ fontSize: 11, fontWeight: 700, color: vColor.color, background: vColor.bg, borderRadius: 20, padding: '3px 10px' }}>
                  {verdictLabel(entry.verdict)}
                </span>
              )}
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {t.protocol.map(p => (
                    <div key={p.k} style={{ fontSize: 12, color: 'var(--text2)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text3)' }}>{p.k} :</span> {p.v}
                    </div>
                  ))}
                </div>

                {t.criteria.map(c => (
                  <div key={c.key}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>
                      {c.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {c.options.map(o => {
                        const active = form[c.key] === o.key
                        return (
                          <button key={o.key} onClick={() => pick(t.key, c.key, o.key)} title={o.note} style={{
                            background: active ? (o.warn ? '#FEE2E2' : 'var(--green-light)') : 'var(--bg2)',
                            border: `1px solid ${active ? (o.warn ? '#FCA5A5' : '#B8EAD8') : 'var(--border2)'}`,
                            color: active ? (o.warn ? '#991B1B' : 'var(--green)') : 'var(--text2)',
                            borderRadius: 16, padding: '6px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}>
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 5 }}>
                    🗣 Questions à poser
                  </div>
                  {t.questions.map((q, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginTop: i > 0 ? 3 : 0 }}>{q}</div>
                  ))}
                </div>

                <button onClick={() => saveTest(t)} disabled={saving} style={{
                  background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)',
                  padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  {saving ? '…' : '✓ Enregistrer ce test'}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {(() => {
        const isOpen = expanded === 'questionnaire'
        const answers = forms.questionnaire || {}
        const countAnswered = ALL_QUESTIONS.filter(q => answers[q.key]).length
        const qColor = questionnaireEntry?.verdict ? verdictColor(questionnaireLean(questionnaireEntry.verdict)) : null
        return (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div onClick={() => setExpanded(isOpen ? null : 'questionnaire')} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 14 }}>{isOpen ? '▼' : '▶'}</span>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>🧠 Questionnaire psychologique</div>
              {questionnaireEntry?.verdict && (
                <span style={{ fontSize: 11, fontWeight: 700, color: qColor.color, background: qColor.bg, borderRadius: 20, padding: '3px 10px' }}>
                  {questionnaireLabel(questionnaireEntry.verdict)}
                </span>
              )}
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {PSYCH_QUESTIONNAIRE.map(block => (
                  <div key={block.label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>
                      {block.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {block.questions.map(q => (
                        <div key={q.key}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{q.text}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {[{ val: 'A', text: q.a }, { val: 'B', text: q.b }].map(o => {
                              const active = answers[q.key] === o.val
                              return (
                                <button key={o.val} onClick={() => pickAnswer(q.key, o.val)} style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left',
                                  background: active ? 'var(--green-light)' : 'var(--bg2)',
                                  border: `1px solid ${active ? '#B8EAD8' : 'var(--border2)'}`,
                                  color: active ? 'var(--green)' : 'var(--text2)',
                                  borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                }}>
                                  <span style={{ fontWeight: 800, flexShrink: 0 }}>{o.val}</span>
                                  <span>{o.text}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                  {countAnswered}/{ALL_QUESTIONS.length} questions répondues
                </div>

                <button onClick={saveQuestionnaire} disabled={saving} style={{
                  background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)',
                  padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  {saving ? '…' : '✓ Enregistrer le questionnaire'}
                </button>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
