'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AthletesSidebar from '@/app/components/AthletesSidebar'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,'0'), String(n.getDate()).padStart(2,'0')].join('-')
}

export default function AthletePage({ params }) {
  const { athleteId } = use(params)
  const router = useRouter()
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([])
  const [wellness, setWellness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDanger, setShowDanger] = useState(false)

  useEffect(() => {
    async function load() {
      const todayStr = today()
      const [{ data: ath }, { data: progs }, { data: w }] = await Promise.all([
        supabase.from('athletes').select('*').eq('id', athleteId).single(),
        supabase.from('programs')
          .select('*, program_sessions(id)')
          .eq('athlete_id', athleteId)
          .order('created_at', { ascending: false }),
        supabase.from('wellness').select('*').eq('athlete_id', athleteId).eq('date', todayStr).single()
      ])
      setAthlete(ath)
      setPrograms(progs || [])
      setWellness(w)
      setLoading(false)
    }
    load()
  }, [athleteId])

  const generateToken = async () => {
    const token = crypto.randomUUID()
    const { data } = await supabase.from('athletes').update({ token }).eq('id', athleteId).select().single()
    if (data) setAthlete(data)
  }

  const archiveAthlete = async () => {
    if (!confirm(`Archiver ${athlete?.name} ? Il n'apparaîtra plus dans la liste, mais ses données sont conservées.`)) return
    await supabase.from('athletes').update({ archived: true }).eq('id', athleteId)
    router.push('/')
  }

  const deleteAthlete = async () => {
    if (!confirm(`Supprimer définitivement ${athlete?.name} ? Cette action est irréversible.`)) return
    await supabase.from('athletes').delete().eq('id', athleteId)
    router.push('/')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  const METRICS = [
    { key: 'sommeil', emoji: '🌙', label: 'Sommeil', inverse: false },
    { key: 'stress', emoji: '😰', label: 'Stress', inverse: true },
    { key: 'courbatures', emoji: '💪', label: 'Courbatures', inverse: true },
    { key: 'forme', emoji: '⚡', label: 'Forme', inverse: false },
  ]
  function scoreColor(val, inverse) {
    const s = inverse ? (11 - val) : val
    if (s >= 7) return '#22c55e'
    if (s >= 4) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="coach-layout" style={{ background: 'var(--bg2)' }}>
      <AthletesSidebar athleteId={athleteId} date={today()} />
      <div className="coach-main" style={{ paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ fontSize: 22, color: 'var(--text2)', textDecoration: 'none' }}>←</Link>
            <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{athlete?.name}</div>
            <Link href={`/programs/${athleteId}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 12, fontWeight: 600, textDecoration: 'none', color: 'var(--text2)', flexShrink: 0 }}>
              📋 Programmes
            </Link>
            <button onClick={() => setShowDanger(v => !v)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 10px', fontSize: 15, cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, lineHeight: 1 }}>
              ···
            </button>
          </div>
          {showDanger && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={archiveAthlete} style={{ flex: 1, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                📦 Archiver
              </button>
              <button onClick={deleteAthlete} style={{ flex: 1, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🗑 Supprimer
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Lien de partage */}
          {athlete?.token ? (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>🔗 Lien client</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--green)', flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/s/{athlete.token}
                </span>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/s/${athlete.token}`)}
                  style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  Copier
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text3)', flex: 1 }}>Aucun lien de partage</span>
              <button onClick={generateToken} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Générer le lien
              </button>
            </div>
          )}

          {/* Bien-être du jour */}
          {wellness ? (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Bien-être aujourd'hui</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {METRICS.map(m => {
                  const v = wellness[m.key]
                  if (!v) return null
                  return (
                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '6px 12px' }}>
                      <span style={{ fontSize: 15 }}>{m.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(v, m.inverse) }}>{v}/10</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '12px 14px' }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Pas de données bien-être aujourd'hui</div>
            </div>
          )}

          {/* Programmes */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: programs.length ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Programmes</div>
              <Link href={`/programs/${athleteId}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>+ Ajouter</Link>
            </div>
            {programs.length === 0 ? (
              <div style={{ padding: '14px', fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Aucun programme</div>
            ) : programs.map(p => (
              <Link key={p.id} href={`/programs/${athleteId}/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{(p.program_sessions || []).length} séance{(p.program_sessions || []).length !== 1 ? 's' : ''}</div>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 14 }}>›</span>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
