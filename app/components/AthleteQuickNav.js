'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import TrackedMovementsBlock from './TrackedMovementsBlock'
import GoniometerView from './GoniometerView'
import TorqueProfileSection from './TorqueProfileSection'
import { JOINT_TESTS, isBilateralQualitative, isQualitativeJoint, QUALITY_LEVELS, qualityLevel } from '@/lib/jointTests'
import { isADMPJoint, analyzeADMPRisk, analyzeActifPassifGap } from '@/lib/jointTestThresholds'

function calcAge(birthDate) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

const SECTIONS = [
  { key: 'infos', emoji: '👤', label: 'Infos' },
  { key: 'metrics', emoji: '📈', label: 'Metrics' },
  { key: 'mensurations', emoji: '📏', label: 'Mensurations' },
  { key: 'tests', emoji: '🦴', label: 'Tests articulaires' },
  { key: 'torque', emoji: '⚖️', label: 'Test' },
]

function FullscreenSection({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16 }}>
        {children}
      </div>
    </div>
  )
}

function ComingSoon({ label }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
      <div style={{ fontWeight: 600 }}>{label} — bientôt disponible</div>
    </div>
  )
}

function InfosSection({ athlete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: athlete.name || '', email: athlete.email || '',
    birth_date: athlete.birth_date || '', weight: athlete.weight ?? '', height: athlete.height ?? '',
    address: athlete.address || '',
  })
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)',
    borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)',
  }

  const age = calcAge(athlete.birth_date)

  const save = async () => {
    setSaving(true)
    const { data, error } = await supabase.from('athletes').update({
      name: form.name.trim(), email: form.email.trim() || null,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseInt(form.height) : null,
      address: form.address.trim() || null,
    }).eq('id', athlete.id).select().single()
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onUpdate(data)
    setEditing(false)
  }

  const sendInvite = async () => {
    if (!athlete.email) return
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: athlete.email, athleteId: athlete.id, athleteName: athlete.name, redirectTo: window.location.origin }),
    })
    const json = await res.json()
    setInviting(false)
    setInviteMsg(json.error ? 'Erreur : ' + json.error : `✓ Invitation envoyée à ${athlete.email}`)
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Nom" value={athlete.name} />
          <Row label="Email" value={athlete.email || '—'} />
          <Row label="Date de naissance" value={athlete.birth_date ? `${new Date(athlete.birth_date + 'T00:00:00').toLocaleDateString('fr-FR')} (${age} ans)` : '—'} />
          <Row label="Poids" value={athlete.weight ? `${athlete.weight} kg` : '—'} />
          <Row label="Taille" value={athlete.height ? `${athlete.height} cm` : '—'} />
          <Row label="Adresse postale" value={athlete.address || '—'} />
        </div>

        {!athlete.auth_user_id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={sendInvite} disabled={inviting || !athlete.email} style={{
              background: athlete.email ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none',
              borderRadius: 'var(--r)', padding: 12, fontSize: 14, fontWeight: 700, cursor: athlete.email ? 'pointer' : 'default',
            }}>
              {inviting ? '…' : athlete.email ? '✉️ Envoyer le lien d\'invitation' : 'Ajoute un email pour inviter'}
            </button>
            {inviteMsg && <div style={{ fontSize: 12, color: inviteMsg.startsWith('Erreur') ? '#DC2626' : '#166534', fontWeight: 600 }}>{inviteMsg}</div>}
          </div>
        )}

        <button onClick={() => setEditing(true)} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ✏️ Modifier
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label="Nom complet"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></Field>
      <Field label="Date de naissance"><input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} style={inputStyle} /></Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Poids (kg)" style={{ flex: 1 }}><input type="number" step="0.1" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} style={inputStyle} /></Field>
        <Field label="Taille (cm)" style={{ flex: 1 }}><input type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} style={inputStyle} /></Field>
      </div>
      <Field label="Adresse postale"><textarea rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditing(false)} style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'Enregistrer'}</button>
      </div>
    </div>
  )
}

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^&\n?#]+)/)
  return m ? m[1] : null
}

function TestLaunchView({ athleteId, testName, joint, movement, onClose }) {
  const qualitative = isQualitativeJoint(joint)
  const bilateral = qualitative && isBilateralQualitative(testName)
  const [previous, setPrevious] = useState(undefined) // undefined = chargement, null = aucun
  const [d, setD] = useState('')
  const [g, setG] = useState('')
  const [qualityD, setQualityD] = useState(null)
  const [qualityG, setQualityG] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    supabase.from('joint_test_entries').select('*')
      .eq('athlete_id', athleteId).eq('test_name', testName)
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => setPrevious(data || null))
  }, [athleteId, testName])

  const pct = (oldVal, newVal) => {
    if (oldVal == null || oldVal === 0 || newVal == null) return null
    return Math.round(((newVal - oldVal) / oldVal) * 1000) / 10
  }

  const submit = async () => {
    if (qualitative) {
      if (!qualityD && !(bilateral && qualityG)) return
      setSaving(true)
      const { data, error } = await supabase.from('joint_test_entries')
        .insert({ athlete_id: athleteId, test_name: testName, joint, quality_d: qualityD, quality_g: bilateral ? qualityG : null, note: note.trim() || null })
        .select().single()
      setSaving(false)
      if (error) { alert('Erreur : ' + error.message); return }
      setResult({ old: previous, new: data })
      return
    }
    if (!d.trim() && !g.trim()) return
    setSaving(true)
    const valueD = d.trim() ? parseFloat(d) : null
    const valueG = g.trim() ? parseFloat(g) : null
    const { data, error } = await supabase.from('joint_test_entries')
      .insert({ athlete_id: athleteId, test_name: testName, joint, value_d: valueD, value_g: valueG })
      .select().single()
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setResult({
      old: previous,
      new: data,
      pctD: pct(previous?.value_d, valueD),
      pctG: pct(previous?.value_g, valueG),
    })
  }

  const ytId = movement?.youtube_url ? getYouTubeId(movement.youtube_url) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg2)', zIndex: 700, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{testName}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 16 }}>
        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', fontSize: 40, marginBottom: -4 }}>✅</div>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 17 }}>Test validé</div>

            {qualitative ? (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: bilateral ? 'Droite' : null, val: result.new.quality_d },
                  { label: 'Gauche', val: result.new.quality_g },
                ].filter(r => r.val != null).map((r, i) => {
                  const lvl = qualityLevel(r.val)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.label && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{r.label} :</span>}
                      <span style={{ fontSize: 13, fontWeight: 700, color: lvl?.color, background: lvl?.bg, borderRadius: 20, padding: '4px 10px' }}>
                        {lvl?.label}
                      </span>
                    </div>
                  )
                })}
                {result.new.note && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>« {result.new.note} »</div>
                )}
              </div>
            ) : (
              [
                { label: 'Droite', old: result.old?.value_d, val: result.new.value_d, p: result.pctD },
                { label: 'Gauche', old: result.old?.value_g, val: result.new.value_g, p: result.pctG },
              ].filter(r => r.val != null).map(r => (
                <div key={r.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>{r.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ancien</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text3)' }}>{r.old != null ? `${r.old}°` : '—'}</div>
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--text3)' }}>→</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Nouveau</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{r.val}°</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Évolution</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: r.p == null ? 'var(--text3)' : r.p >= 0 ? '#166534' : '#DC2626' }}>
                        {r.p == null ? '—' : `${r.p > 0 ? '+' : ''}${r.p}%`}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            <button onClick={onClose} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Terminé
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ytId && (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--r)', overflow: 'hidden' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {qualitative ? (
              <>
                {previous === undefined ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chargement…</div>
                ) : previous ? (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                    Dernier test ({new Date(previous.date + 'T00:00:00').toLocaleDateString('fr-FR')}) :
                    {previous.quality_d != null && ` ${bilateral ? 'D ' : ''}${qualityLevel(previous.quality_d)?.label}`}
                    {bilateral && previous.quality_g != null && ` · G ${qualityLevel(previous.quality_g)?.label}`}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, fontStyle: 'italic' }}>Aucun test précédent.</div>
                )}

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                    {bilateral ? 'Droite' : 'Évaluation'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {QUALITY_LEVELS.map(l => (
                      <button key={l.key} onClick={() => setQualityD(l.key)} style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                        border: `1px solid ${qualityD === l.key ? l.color : 'var(--border2)'}`,
                        background: qualityD === l.key ? l.bg : 'var(--bg2)',
                        color: qualityD === l.key ? l.color : 'var(--text2)',
                      }}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {bilateral && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                      Gauche
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {QUALITY_LEVELS.map(l => (
                        <button key={l.key} onClick={() => setQualityG(l.key)} style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          border: `1px solid ${qualityG === l.key ? l.color : 'var(--border2)'}`,
                          background: qualityG === l.key ? l.bg : 'var(--bg2)',
                          color: qualityG === l.key ? l.color : 'var(--text2)',
                        }}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Note (zone, douleur…)</div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <button onClick={submit} disabled={saving || (!qualityD && !(bilateral && qualityG))}
                  style={{ background: (qualityD || (bilateral && qualityG)) ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '…' : '✓ Valider le test'}
                </button>
              </>
            ) : (
              <>
                {previous === undefined ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chargement…</div>
                ) : previous ? (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                    Dernier test ({new Date(previous.date + 'T00:00:00').toLocaleDateString('fr-FR')}) :
                    {previous.value_d != null && ` D ${previous.value_d}°`}
                    {previous.value_g != null && ` · G ${previous.value_g}°`}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, fontStyle: 'italic' }}>Aucun test précédent.</div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Actif Droit (°)</div>
                    <input type="number" step="1" value={d} onChange={e => setD(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 18, fontWeight: 700, textAlign: 'center', outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Actif Gauche (°)</div>
                    <input type="number" step="1" value={g} onChange={e => setG(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 18, fontWeight: 700, textAlign: 'center', outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                  </div>
                </div>

                <button onClick={submit} disabled={saving || (!d.trim() && !g.trim())}
                  style={{ background: (d.trim() || g.trim()) ? 'var(--green)' : 'var(--border2)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '…' : '✓ Valider le test'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TestsArticulairesSection({ athleteId }) {
  const [byName, setByName] = useState(null)
  const [editingName, setEditingName] = useState(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [playingName, setPlayingName] = useState(null)
  const [saving, setSaving] = useState(false)
  const [launching, setLaunching] = useState(null) // { name, joint }
  const [showGonio, setShowGonio] = useState(false)
  const [latestByTest, setLatestByTest] = useState({})
  const [editingValue, setEditingValue] = useState(null) // { testName, side }
  const [valueDraft, setValueDraft] = useState('')

  const allTestNames = JOINT_TESTS.flatMap(g => g.tests)

  useEffect(() => {
    async function load() {
      const { data: existing } = await supabase.from('movements').select('id, name, youtube_url')
      const map = {}
      ;(existing || []).forEach(m => { map[m.name.trim().toLowerCase()] = m })

      const missing = allTestNames.filter(n => !map[n.trim().toLowerCase()])
      if (missing.length) {
        const { data: created } = await supabase.from('movements').insert(missing.map(name => ({ name }))).select()
        ;(created || []).forEach(m => { map[m.name.trim().toLowerCase()] = m })
      }

      const byNameResult = {}
      allTestNames.forEach(n => { byNameResult[n] = map[n.trim().toLowerCase()] })
      setByName(byNameResult)
    }
    load()
  }, [])

  const loadLatestValues = () => {
    if (!athleteId) return
    supabase.from('joint_test_entries').select('*')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => { if (!map[e.test_name]) map[e.test_name] = e })
        setLatestByTest(map)
      })
  }

  useEffect(() => { loadLatestValues() }, [athleteId, showGonio, launching])

  const startEditValue = (testName, side, entry) => {
    setEditingValue({ testName, side })
    setValueDraft(side === 'D' ? String(entry.value_d ?? '') : String(entry.value_g ?? ''))
  }

  const saveValue = async () => {
    if (!editingValue) return
    const entry = latestByTest[editingValue.testName]
    if (!entry) return
    const field = editingValue.side === 'D' ? 'value_d' : 'value_g'
    const parsed = valueDraft.trim() ? parseFloat(valueDraft) : null
    await supabase.from('joint_test_entries').update({ [field]: parsed }).eq('id', entry.id)
    setEditingValue(null)
    loadLatestValues()
  }

  const deleteValue = async () => {
    if (!editingValue) return
    const entry = latestByTest[editingValue.testName]
    if (!entry) return
    const field = editingValue.side === 'D' ? 'value_d' : 'value_g'
    await supabase.from('joint_test_entries').update({ [field]: null }).eq('id', entry.id)
    setEditingValue(null)
    loadLatestValues()
  }

  const startEdit = (name) => {
    setEditingName(name)
    setUrlDraft(byName[name]?.youtube_url || '')
  }

  const saveUrl = async () => {
    const movement = byName[editingName]
    if (!movement) return
    setSaving(true)
    const { data } = await supabase.from('movements').update({ youtube_url: urlDraft.trim() || null }).eq('id', movement.id).select().single()
    setSaving(false)
    if (data) setByName(prev => ({ ...prev, [editingName]: data }))
    setEditingName(null)
  }

  if (byName === null) {
    return <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '30px 0' }}>Chargement…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => setShowGonio(true)} style={{
        background: '#0D1117', color: '#F2A93B', border: '1px solid #2A3140', borderRadius: 'var(--rl)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: 20 }}>📐</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14, textAlign: 'left' }}>Lancer le goniomètre</span>
        <span style={{ color: '#7C8493', fontSize: 18 }}>›</span>
      </button>

      {JOINT_TESTS.map(group => (
        <div key={group.joint} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: 14 }}>
            {group.joint}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {group.tests.map((t, i) => {
              const movement = byName[t]
              const hasVideo = !!movement?.youtube_url
              const isEditing = editingName === t
              const entry = latestByTest[t]
              const hasData = group.qualitative
                ? entry && (entry.quality_d != null || entry.quality_g != null)
                : entry && (entry.value_d != null || entry.value_g != null)

              let admpBadge = null
              if (isADMPJoint(group.joint) && entry) {
                const variantMatch = t.match(/ \((Passif|Actif)\)$/)
                const variant = variantMatch?.[1]
                const baseName = variant ? t.slice(0, -variantMatch[0].length) : t
                if (variant === 'Passif') {
                  const rd = analyzeADMPRisk(group.joint, t, entry.value_d)
                  const rg = analyzeADMPRisk(group.joint, t, entry.value_g)
                  const worst = [rd, rg].filter(Boolean).sort((a, b) => b.deficit - a.deficit)[0]
                  if (worst?.atRisk) admpBadge = { label: `⚠️ -${worst.deficit}° vs norme`, color: '#991B1B', bg: '#FEE2E2' }
                  else if (rd || rg) admpBadge = { label: 'OK', color: '#166534', bg: '#DCFCE7' }
                } else if (variant === 'Actif') {
                  const passifEntry = latestByTest[`${baseName} (Passif)`]
                  if (passifEntry) {
                    const gd = analyzeActifPassifGap(group.joint, t, passifEntry.value_d, entry.value_d)
                    const gg = analyzeActifPassifGap(group.joint, t, passifEntry.value_g, entry.value_g)
                    const worst = [gd, gg].filter(Boolean).sort((a, b) => b.gap - a.gap)[0]
                    if (worst?.atRisk) admpBadge = { label: `⚠️ Déficit actif -${worst.gap}°`, color: '#991B1B', bg: '#FEE2E2' }
                  }
                }
              }
              return (
                <div key={t} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--text2)' }}>{t}</div>
                    <button onClick={() => setLaunching({ name: t, joint: group.joint })}
                      style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      ▶ Lancer
                    </button>
                  </div>

                  <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {hasData ? (
                      group.qualitative ? (
                        <>
                          {entry.quality_d != null && (() => {
                            const lvl = qualityLevel(entry.quality_d)
                            return (
                              <span style={{ fontSize: 11, fontWeight: 700, color: lvl?.color || 'var(--text2)', background: lvl?.bg || 'var(--bg2)', borderRadius: 20, padding: '3px 8px' }}>
                                {isBilateralQualitative(t) ? 'D : ' : ''}{lvl?.label || entry.quality_d}
                              </span>
                            )
                          })()}
                          {isBilateralQualitative(t) && entry.quality_g != null && (() => {
                            const lvl = qualityLevel(entry.quality_g)
                            return (
                              <span style={{ fontSize: 11, fontWeight: 700, color: lvl?.color || 'var(--text2)', background: lvl?.bg || 'var(--bg2)', borderRadius: 20, padding: '3px 8px' }}>
                                G : {lvl?.label || entry.quality_g}
                              </span>
                            )
                          })()}
                          {entry.note && (
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>« {entry.note} »</span>
                          )}
                        </>
                      ) : (
                        <>
                          {entry.value_d != null && (
                            <span onClick={() => startEditValue(t, 'D', entry)}
                              style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20, padding: '3px 8px', cursor: 'pointer' }}>
                              D {entry.value_d}° ✏️
                            </span>
                          )}
                          {entry.value_g != null && (
                            <span onClick={() => startEditValue(t, 'G', entry)}
                              style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 20, padding: '3px 8px', cursor: 'pointer' }}>
                              G {entry.value_g}° ✏️
                            </span>
                          )}
                          {admpBadge && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: admpBadge.color, background: admpBadge.bg, borderRadius: 20, padding: '3px 8px' }}>
                              {admpBadge.label}
                            </span>
                          )}
                        </>
                      )
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Aucune donnée</span>
                    )}

                    <div style={{ flex: 1 }} />

                    {hasVideo && (
                      <button onClick={() => setPlayingName(playingName === t ? null : t)}
                        style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        ▶
                      </button>
                    )}
                    <button onClick={() => startEdit(t)}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)', flexShrink: 0 }}>
                      {hasVideo ? '✏️' : '+ Vidéo'}
                    </button>
                  </div>

                  {isEditing && (
                    <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8 }}>
                      <input autoFocus value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
                        placeholder="Lien YouTube…"
                        style={{ flex: 1, boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                      <button onClick={() => setEditingName(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
                      <button onClick={saveUrl} disabled={saving} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'OK'}</button>
                    </div>
                  )}

                  {editingValue?.testName === t && (
                    <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>{editingValue.side} :</span>
                      <input autoFocus type="number" value={valueDraft} onChange={e => setValueDraft(e.target.value)}
                        placeholder="Degrés"
                        style={{ width: 90, boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
                      <button onClick={() => setEditingValue(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>Annuler</button>
                      <button onClick={deleteValue} style={{ background: 'none', border: '1px solid #F1B8B8', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#991B1B' }}>Supprimer</button>
                      <button onClick={saveValue} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Enregistrer</button>
                    </div>
                  )}

                  {playingName === t && hasVideo && (
                    <div style={{ padding: '0 14px 12px' }}>
                      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--r)', overflow: 'hidden' }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${getYouTubeId(movement.youtube_url)}`}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
        Chaque test est aussi ajouté à la bibliothèque de mouvements.
      </div>

      {launching && (
        <TestLaunchView
          athleteId={athleteId}
          testName={launching.name}
          joint={launching.joint}
          movement={byName[launching.name]}
          onClose={() => setLaunching(null)}
        />
      )}

      {showGonio && (
        <GoniometerView athleteId={athleteId} onClose={() => setShowGonio(false)} />
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{value}</div>
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

export default function AthleteQuickNav({ athlete, onUpdate }) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setOpen(s.key)} style={{
            flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <span style={{ fontSize: 18 }}>{s.emoji}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text2)', textAlign: 'center' }}>{s.label}</span>
          </button>
        ))}
      </div>

      {open === 'infos' && (
        <FullscreenSection title="👤 Infos" onClose={() => setOpen(null)}>
          <InfosSection athlete={athlete} onUpdate={a => { onUpdate?.(a); }} />
        </FullscreenSection>
      )}
      {open === 'metrics' && (
        <FullscreenSection title="📈 Metrics" onClose={() => setOpen(null)}>
          <TrackedMovementsBlock athleteId={athlete.id} isCoach />
        </FullscreenSection>
      )}
      {open === 'mensurations' && (
        <FullscreenSection title="📏 Mensurations" onClose={() => setOpen(null)}>
          <ComingSoon label="Mensurations" />
        </FullscreenSection>
      )}
      {open === 'tests' && (
        <FullscreenSection title="🦴 Tests articulaires" onClose={() => setOpen(null)}>
          <TestsArticulairesSection athleteId={athlete.id} />
        </FullscreenSection>
      )}
      {open === 'torque' && (
        <FullscreenSection title="⚖️ Test Torque" onClose={() => setOpen(null)}>
          <TorqueProfileSection athleteId={athlete.id} />
        </FullscreenSection>
      )}
    </>
  )
}
