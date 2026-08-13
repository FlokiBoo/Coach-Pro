'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import AthletesSidebar from '@/app/components/AthletesSidebar'
import MuscleAnatomyDiagram from '@/app/components/MuscleAnatomyDiagram'

function emptyForm() {
  return { title: '', content: '', diagram: false }
}

export default function TipsPage() {
  const [tips, setTips] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [showCreate, setShowCreate] = useState(false)
  const [newForm, setNewForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hiddenIds, setHiddenIds] = useState(new Set())
  const titleRef = useRef(null)

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: coach } = await supabase.from('coaches').select('is_admin').eq('id', user.id).single()
    setIsAdmin(!!coach?.is_admin)
  }

  async function loadHidden() {
    const { data } = await supabase.from('coach_hidden_content').select('content_id').eq('content_type', 'tip')
    setHiddenIds(new Set((data || []).map(r => r.content_id)))
  }

  async function toggleHidden(tipId, hidden) {
    if (hidden) {
      await supabase.from('coach_hidden_content').delete().eq('content_type', 'tip').eq('content_id', tipId)
      setHiddenIds(prev => { const next = new Set(prev); next.delete(tipId); return next })
    } else {
      await supabase.from('coach_hidden_content').insert({ coach_id: userId, content_type: 'tip', content_id: tipId })
      setHiddenIds(prev => new Set(prev).add(tipId))
    }
  }

  async function load() {
    const { data } = await supabase.from('tips').select('*').order('order_index')
    setTips(data || [])
  }

  useEffect(() => { Promise.resolve().then(() => { loadUser(); load(); loadHidden() }) }, [])
  useEffect(() => { if (showCreate) titleRef.current?.focus() }, [showCreate])

  async function create() {
    if (!newForm.title.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('tips').insert({
      title: newForm.title.trim(),
      content: newForm.content.trim() || null,
      order_index: tips.length,
      diagram: newForm.diagram ? 'muscle_anatomy' : null,
      coach_id: isAdmin ? null : userId,
    }).select().single()
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    setTips(prev => [...prev, data])
    setNewForm(emptyForm())
    setShowCreate(false)
    setSaving(false)
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditForm({ title: t.title, content: t.content || '', diagram: t.diagram === 'muscle_anatomy' })
  }

  async function saveEdit() {
    if (!editForm.title.trim()) return
    setSaving(true)
    const diagram = editForm.diagram ? 'muscle_anatomy' : null
    const { error } = await supabase.from('tips').update({
      title: editForm.title.trim(),
      content: editForm.content.trim() || null,
      diagram,
    }).eq('id', editingId)
    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    setTips(prev => prev.map(t => t.id === editingId ? { ...t, title: editForm.title.trim(), content: editForm.content.trim() || null, diagram } : t))
    setEditingId(null)
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm('Supprimer ce tip ?')) return
    await supabase.from('tips').delete().eq('id', id)
    setTips(prev => prev.filter(t => t.id !== id))
  }

  function move(idx, dir) {
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= tips.length) return
    const next = [...tips]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setTips(next)
    next.forEach((t, i) => {
      supabase.from('tips').update({ order_index: i }).eq('id', t.id)
    })
  }

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={null} />
      <div className="coach-main">
        <div style={{
          padding: '20px 16px 14px', background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 10
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>💡 Tips</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              Glossaire visible par tes sportifs sur chaque exercice
            </div>
          </div>
          <button onClick={() => setShowCreate(v => !v)} style={{
            background: 'var(--green)', color: '#fff', border: 'none',
            borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>+ Tip</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
          {showCreate && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={titleRef}
                placeholder="Titre (ex: Tempo, Choix de la charge, Respiration…)"
                value={newForm.title}
                onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
                style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)' }}
              />
              <textarea
                placeholder="Explication…"
                value={newForm.content}
                onChange={e => setNewForm(f => ({ ...f, content: e.target.value }))}
                rows={4}
                style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={newForm.diagram} onChange={e => setNewForm(f => ({ ...f, diagram: e.target.checked }))}
                  style={{ accentColor: 'var(--green)', width: 16, height: 16 }} />
                Inclure le schéma musculaire (avant/arrière + légende)
              </label>
              <button onClick={create} disabled={saving} style={{
                background: 'var(--green)', color: '#fff', border: 'none',
                borderRadius: 'var(--r)', padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>{saving ? '…' : 'Créer'}</button>
            </div>
          )}

          {!tips.length && !showCreate ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', border: '1px dashed var(--border2)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💡</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun tip</div>
              <div style={{ fontSize: 13 }}>Clique sur « + Tip » pour commencer</div>
            </div>
          ) : (
            tips.map((t, idx) => (
              <div key={t.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 14 }}>
                {editingId === t.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)' }}
                    />
                    <textarea
                      value={editForm.content}
                      onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                      rows={4}
                      style={{ padding: '10px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editForm.diagram} onChange={e => setEditForm(f => ({ ...f, diagram: e.target.checked }))}
                        style={{ accentColor: 'var(--green)', width: 16, height: 16 }} />
                      Inclure le schéma musculaire (avant/arrière + légende)
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveEdit} disabled={saving} style={{
                        background: 'var(--green)', color: '#fff', border: 'none',
                        borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                      }}>{saving ? '…' : 'Sauvegarder'}</button>
                      <button onClick={() => setEditingId(null)} style={{
                        background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)',
                        borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                      }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => move(idx, -1)} disabled={idx === 0}
                        style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: idx === 0 ? 'var(--border2)' : 'var(--text3)', cursor: idx === 0 ? 'default' : 'pointer' }}>▲</button>
                      <button onClick={() => move(idx, 1)} disabled={idx === tips.length - 1}
                        style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: idx === tips.length - 1 ? 'var(--border2)' : 'var(--text3)', cursor: idx === tips.length - 1 ? 'default' : 'pointer' }}>▼</button>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: (t.content || t.diagram) ? 4 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.title}
                        {t.coach_id === userId && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-light)', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>Perso</span>
                        )}
                        {t.coach_id === null && hiddenIds.has(t.id) && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>Masqué</span>
                        )}
                      </div>
                      {t.content && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: t.diagram ? 10 : 0 }}>{t.content}</div>}
                      {t.diagram === 'muscle_anatomy' && <MuscleAnatomyDiagram />}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {(isAdmin || t.coach_id === userId) ? (
                        <>
                          <button onClick={() => startEdit(t)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>✎</button>
                          <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
                        </>
                      ) : (
                        <button onClick={() => toggleHidden(t.id, hiddenIds.has(t.id))}
                          title={hiddenIds.has(t.id) ? 'Afficher à mes clients' : 'Masquer à mes clients'}
                          style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                          {hiddenIds.has(t.id) ? '🙈' : '👁️'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
