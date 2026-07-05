'use client'

import { useState, useEffect, use, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

function emptyExo(order) {
  return { _key: Date.now() + Math.random(), order_index: order, name: '', sets: '', reps: '', kg: '', rest: '', note: '', video_url: '' }
}

function computeLabels(exercises) {
  const labels = {}
  let li = 0, i = 0
  while (i < exercises.length) {
    const g = exercises[i].superset_group
    if (!g) { labels[exercises[i]._key || exercises[i].id] = String.fromCharCode(65 + li); li++; i++ }
    else {
      let j = i
      while (j < exercises.length && exercises[j].superset_group === g) j++
      const l = String.fromCharCode(65 + li)
      for (let k = i; k < j; k++) labels[exercises[k]._key || exercises[k].id] = `${l}${k - i + 1}`
      li++; i = j
    }
  }
  return labels
}

function torqueColor(label) {
  const l = label.toLowerCase()
  if (l.includes('intern')) return '#2563EB'
  if (l.includes('extern')) return '#f59e0b'
  return '#8B5CF6'
}

function SessionSummaryBlock({ exercises }) {
  const [summary, setSummary] = useState(null)

  const names = exercises.map(e => e.name.trim()).filter(Boolean)
  const namesKey = names.join('|')

  useEffect(() => {
    if (names.length === 0) { setSummary(null); return }
    supabase.from('movements').select('name, muscles, torque').in('name', names).then(({ data: movs }) => {
      if (!movs?.length) { setSummary(null); return }

      const seen = new Set()
      const muscles = []
      const torqueCounts = {}

      movs.forEach(m => {
        if (m.muscles) {
          m.muscles.split(',').map(s => s.trim()).filter(Boolean).forEach(muscle => {
            if (!seen.has(muscle)) { seen.add(muscle); muscles.push(muscle) }
          })
        }
        if (m.torque) {
          const t = m.torque.trim()
          torqueCounts[t] = (torqueCounts[t] || 0) + 1
        }
      })

      if (muscles.length === 0 && Object.keys(torqueCounts).length === 0) { setSummary(null); return }
      setSummary({ muscles, torqueCounts })
    })
  }, [namesKey])

  if (!summary) return null
  const totalTorque = Object.values(summary.torqueCounts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Résumé de séance</div>

      {summary.muscles.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }}>Muscles sollicités</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {summary.muscles.map((m, i) => (
              <span key={i} style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {totalTorque > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Répartition torque <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({totalTorque} ex. renseignés)</span></div>
          {Object.entries(summary.torqueCounts).map(([label, count]) => {
            const pct = Math.round((count / totalTorque) * 100)
            const color = torqueColor(label)
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 72 }}>{label}</div>
                <div style={{ flex: 1, background: 'var(--border)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 99, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color, minWidth: 32, textAlign: 'right' }}>{pct}%</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProgramEditorPageWrapper({ params }) {
  return <Suspense><ProgramEditorPage params={params} /></Suspense>
}

function ProgramEditorPage({ params }) {
  const { athleteId, programId } = use(params)
  const searchParams = useSearchParams()
  const openFromUrl = searchParams.get('open')
  const [athlete, setAthlete] = useState(null)
  const [program, setProgram] = useState(null)
  const [sessions, setSessions] = useState([])
  const [openId, setOpenId] = useState(openFromUrl)
  const [suggestions, setSuggestions] = useState({})
  const [videoInputKey, setVideoInputKey] = useState(null)
  const [videoInputVal, setVideoInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const isTemplate = athleteId === 'templates'

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: prog }, { data: sess }] = await Promise.all([
        isTemplate ? Promise.resolve({ data: null }) : supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('programs').select('*').eq('id', programId).single(),
        supabase.from('program_sessions')
          .select('*, program_exercises(*)')
          .eq('program_id', programId)
          .order('order_index')
      ])
      setAthlete(a)
      setProgram(prog)
      const loaded = (sess || []).map(s => ({
        ...s,
        exercises: [...(s.program_exercises || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map(e => ({ ...e, _key: e.id, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '', rest: e.rest ?? '', note: e.note ?? '', video_url: e.video_url || '', superset_group: e.superset_group || null }))
      }))
      setSessions(loaded)
      if (loaded.length === 1) setOpenId(loaded[0].id)
      setLoading(false)
    }
    load()
  }, [athleteId, programId])

  // Helpers pour modifier une session
  const updateSession = (id, field, value) =>
    setSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))

  const updateExo = (sessId, key, field, val) =>
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, exercises: s.exercises.map(e => e._key === key ? { ...e, [field]: val } : e)
    }))

  const addExo = (sessId) =>
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, exercises: [...s.exercises, emptyExo(s.exercises.length)]
    }))

  const removeExo = (sessId, key) =>
    setSessions(prev => prev.map(s => s.id !== sessId ? s : {
      ...s, exercises: s.exercises.filter(e => e._key !== key).length
        ? s.exercises.filter(e => e._key !== key)
        : [emptyExo(0)]
    }))

  const searchMovements = async (key, val) => {
    if (val.trim().length < 2) { setSuggestions(prev => ({ ...prev, [key]: [] })); return }
    const { data } = await supabase.from('movements').select('name').ilike('name', `%${val.trim()}%`).limit(6)
    setSuggestions(prev => ({ ...prev, [key]: (data || []).map(m => m.name) }))
  }

  const pickSuggestion = async (sessId, key, name) => {
    updateExo(sessId, key, 'name', name)
    setSuggestions(prev => ({ ...prev, [key]: [] }))
    const { data: mov } = await supabase.from('movements').select('youtube_url').eq('name', name).single()
    if (mov?.youtube_url) updateExo(sessId, key, 'video_url', mov.youtube_url)
  }

  const toggleSuperset = (sessId, ei) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessId) return s
      const exos = [...s.exercises]
      const a = exos[ei], b = exos[ei + 1]
      if (!a || !b) return s
      if (a.superset_group && a.superset_group === b.superset_group) {
        return { ...s, exercises: exos.map((e, i) => i === ei || i === ei + 1 ? { ...e, superset_group: null } : e) }
      } else {
        const group = a.superset_group || b.superset_group || crypto.randomUUID()
        return { ...s, exercises: exos.map((e, i) => i === ei || i === ei + 1 ? { ...e, superset_group: group } : e) }
      }
    }))
  }

  const saveMovementVideo = async (sessId, exoKey, exoName, url) => {
    const trimmed = url.trim()
    if (!trimmed) { setVideoInputKey(null); return }
    await supabase.from('movements').update({ youtube_url: trimmed }).eq('name', exoName)
    updateExo(sessId, exoKey, 'video_url', trimmed)
    setVideoInputKey(null)
    setVideoInputVal('')
  }

  const addSession = async () => {
    const { data: s } = await supabase.from('program_sessions')
      .insert({ program_id: programId, order_index: sessions.length, title: '' })
      .select().single()
    if (s) {
      const newS = { ...s, exercises: [emptyExo(0)] }
      setSessions(prev => [...prev, newS])
      setOpenId(s.id)
    }
  }

  const deleteSession = async (id) => {
    if (!confirm('Supprimer cette séance ?')) return
    await supabase.from('program_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (openId === id) setOpenId(null)
  }

  const moveSession = (idx, dir) => {
    setSessions(prev => {
      const next = [...prev]
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    if (program) {
      await supabase.from('programs').update({ title: program.title, description: program.description }).eq('id', programId)
    }
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]
      await supabase.from('program_sessions').update({
        order_index: i, title: s.title || '', activation: s.activation || null, coach_notes: s.coach_notes || null
      }).eq('id', s.id)
      await supabase.from('program_exercises').delete().eq('program_session_id', s.id)
      const toInsert = s.exercises.filter(e => e.name.trim()).map((e, j) => ({
        program_session_id: s.id, order_index: j, name: e.name.trim(),
        sets: e.sets !== '' ? parseInt(e.sets) : null,
        reps: e.reps || null,
        kg: e.kg !== '' ? parseFloat(e.kg) : null,
        rest: e.rest || null,
        note: e.note || null,
        video_url: e.video_url || null,
        superset_group: e.superset_group || null,
      }))
      if (toInsert.length) {
        await supabase.from('program_exercises').insert(toInsert)
        await supabase.from('movements').upsert(toInsert.map(e => ({ name: e.name })), { onConflict: 'name', ignoreDuplicates: true })
      }
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp = { border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', width: '100%' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={athleteId} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 60 }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href={isTemplate ? '/programs' : `/programs/${athleteId}`} style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={program?.title || ''}
                onChange={e => setProgram(p => ({ ...p, title: e.target.value }))}
                style={{ fontWeight: 800, fontSize: 16, border: 'none', outline: 'none', background: 'transparent', width: '100%', color: 'var(--text)' }}
                placeholder="Nom du programme"
              />
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {isTemplate ? '📋 Modèle' : athlete?.name} · {sessions.length} séance{sessions.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button onClick={save} disabled={saving} style={{ background: saved ? '#166534' : 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background .3s', flexShrink: 0 }}>
              {saving ? '…' : saved ? '✓ Enregistré' : 'Enregistrer'}
            </button>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {sessions.map((s, idx) => {
            const isOpen = openId === s.id
            const labels = computeLabels(s.exercises)
            return (
              <div key={s.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>

                {/* En-tête séance */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => setOpenId(isOpen ? null : s.id)}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <input
                    value={s.title || ''}
                    onChange={e => { e.stopPropagation(); updateSession(s.id, 'title', e.target.value) }}
                    onClick={e => e.stopPropagation()}
                    placeholder={`Séance ${idx + 1}`}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, color: 'var(--text)', cursor: 'text' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {s.exercises.filter(e => e.name.trim()).length} ex.
                  </span>
                  {idx > 0 && (
                    <button onClick={e => { e.stopPropagation(); moveSession(idx, -1) }}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>↑</button>
                  )}
                  {idx < sessions.length - 1 && (
                    <button onClick={e => { e.stopPropagation(); moveSession(idx, 1) }}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>↓</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                    style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 18, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>×</button>
                  <span style={{ fontSize: 14, color: 'var(--text3)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Contenu de la séance */}
                {isOpen && (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Activation */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Activation</span>
                      </div>
                      <textarea placeholder="Échauffement, mobilité…" value={s.activation || ''}
                        onChange={e => updateSession(s.id, 'activation', e.target.value)}
                        rows={2} style={{ width: '100%', border: 'none', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)' }} />
                    </div>

                    {/* Note */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Note</span>
                      </div>
                      <textarea placeholder="Consignes pour le sportif…" value={s.coach_notes || ''}
                        onChange={e => updateSession(s.id, 'coach_notes', e.target.value)}
                        rows={2} style={{ width: '100%', border: 'none', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', background: 'transparent', fontFamily: 'inherit', color: 'var(--text)' }} />
                    </div>

                    {/* Exercices */}
                    {s.exercises.map((exo, ei) => {
                      const label = labels[exo._key] || String.fromCharCode(65 + ei)
                      return (
                        <div key={exo._key}>
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: videoInputKey === exo._key ? 4 : 6 }}>
                            <div style={{ minWidth: 22, height: 22, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, padding: '0 3px' }}>{label}</div>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <input placeholder="Nom du mouvement" value={exo.name}
                                onChange={e => { updateExo(s.id, exo._key, 'name', e.target.value); searchMovements(exo._key, e.target.value) }}
                                onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, [exo._key]: [] })), 150)}
                                style={{ ...inp, fontWeight: 600 }} />
                              {suggestions[exo._key]?.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                                  {suggestions[exo._key].map((sug, si) => (
                                    <button key={si} onMouseDown={() => pickSuggestion(s.id, exo._key, sug)}
                                      style={{ display: 'block', width: '100%', padding: '8px 10px', textAlign: 'left', background: 'none', border: 'none', borderBottom: si < suggestions[exo._key].length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                                      {sug}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {exo.name.trim() && (
                              exo.video_url ? (
                                <a href={exo.video_url} target="_blank" rel="noreferrer"
                                  style={{ fontSize: 17, textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}
                                  title="Voir la vidéo">🎥</a>
                              ) : (
                                <button onClick={() => { setVideoInputKey(exo._key); setVideoInputVal('') }}
                                  style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1, opacity: 0.25, filter: 'grayscale(1)' }}
                                  title="Ajouter une vidéo">🎥</button>
                              )
                            )}
                            <button onClick={() => removeExo(s.id, exo._key)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, padding: '0 2px', cursor: 'pointer', flexShrink: 0 }}>×</button>
                          </div>
                          {videoInputKey === exo._key && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <input
                                autoFocus
                                placeholder="Lien YouTube…"
                                value={videoInputVal}
                                onChange={e => setVideoInputVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveMovementVideo(s.id, exo._key, exo.name, videoInputVal)
                                  if (e.key === 'Escape') setVideoInputKey(null)
                                }}
                                style={{ ...inp, flex: 1, fontSize: 12 }}
                              />
                              <button onClick={() => saveMovementVideo(s.id, exo._key, exo.name, videoInputVal)}
                                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                              <button onClick={() => setVideoInputKey(null)}
                                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 8px', fontSize: 13, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 5 }}>
                            {[{ f: 'sets', l: 'Séries', t: 'number', ph: '—' }, { f: 'reps', l: 'Reps', t: 'text', ph: '8-12' }, { f: 'kg', l: 'Kg', t: 'number', ph: '—' }, { f: 'rest', l: 'Récup', t: 'text', ph: '90s' }].map(({ f, l, t, ph }) => (
                              <div key={f}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)', marginBottom: 2, textAlign: 'center' }}>{l.toUpperCase()}</div>
                                <input type={t} placeholder={ph} value={exo[f]}
                                  onChange={e => updateExo(s.id, exo._key, f, e.target.value)}
                                  style={{ ...inp, textAlign: 'center', padding: '6px 4px', fontSize: 13 }} min="0" step={f === 'kg' ? '0.5' : '1'} />
                              </div>
                            ))}
                          </div>
                          <textarea placeholder="Consignes (tempo, récup…)" value={exo.note}
                            onChange={e => updateExo(s.id, exo._key, 'note', e.target.value)}
                            rows={2}
                            style={{ ...inp, fontSize: 12, color: 'var(--text2)', resize: 'vertical', lineHeight: 1.5 }} />
                        </div>

                        {/* Bouton superset entre exercices */}
                        {ei < s.exercises.length - 1 && (() => {
                          const next = s.exercises[ei + 1]
                          const isSS = exo.superset_group && exo.superset_group === next?.superset_group
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
                              <div style={{ flex: 1, height: 1, background: isSS ? 'var(--green)' : 'var(--border)' }} />
                              <button
                                onClick={() => toggleSuperset(s.id, ei)}
                                style={{
                                  background: isSS ? 'var(--green)' : 'var(--bg2)',
                                  color: isSS ? '#fff' : 'var(--text3)',
                                  border: `1px solid ${isSS ? 'var(--green)' : 'var(--border2)'}`,
                                  borderRadius: 20, padding: '2px 10px',
                                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                  letterSpacing: '0.3px', whiteSpace: 'nowrap',
                                }}
                              >
                                {isSS ? '✕ Superset' : '+ Superset'}
                              </button>
                              <div style={{ flex: 1, height: 1, background: isSS ? 'var(--green)' : 'var(--border)' }} />
                            </div>
                          )
                        })()}
                        </div>
                      )
                    })}

                    <button onClick={() => addExo(s.id)} style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '8px', fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', width: '100%' }}>
                      + Exercice
                    </button>

                    <SessionSummaryBlock exercises={s.exercises} />
                  </div>
                )}
              </div>
            )
          })}

          <button onClick={addSession} style={{ background: 'var(--bg)', border: '2px dashed var(--border2)', borderRadius: 'var(--rl)', padding: 14, fontSize: 14, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', width: '100%' }}>
            + Ajouter une séance
          </button>
        </div>
      </div>
    </div>
  )
}
