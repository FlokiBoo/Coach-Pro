'use client'

import { useState } from 'react'
import { Ruler, ArrowsClockwise } from '@phosphor-icons/react'
import GoniometerView from './GoniometerView'
import JeffersonCurlModal from './JeffersonCurlModal'

// Point d'entrée pour qu'un sportif lance lui-même un nouveau test de mobilité (déclenché en
// touchant le radar de MobilityRadarBlock) : choix entre la batterie goniomètre (Épaule/Hanche/
// Cheville, à degrés) et le Jefferson Curl (qualitatif, pas de goniomètre).
export default function NewMobilityTestModal({ athleteId, onClose }) {
  const [choice, setChoice] = useState(null) // null | 'gonio' | 'jefferson'

  if (choice === 'gonio') return <GoniometerView athleteId={athleteId} onClose={onClose} />
  if (choice === 'jefferson') return <JeffersonCurlModal athleteId={athleteId} onClose={onClose} />

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: 20, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
          Nouveau test de mobilité
        </div>

        <button onClick={() => setChoice('gonio')} style={{
          textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
          padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ display: 'flex', color: 'var(--green)' }}><Ruler size={20} /></span>
          <span>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Goniomètre</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Épaule, Hanche, Cheville — mesure en degrés</div>
          </span>
        </button>

        <button onClick={() => setChoice('jefferson')} style={{
          textAlign: 'left', background: 'var(--green-light)', border: '1px solid #B8EAD8', borderRadius: 'var(--r)',
          padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ display: 'flex', color: 'var(--green)' }}><ArrowsClockwise size={20} /></span>
          <span>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>Jefferson Curl</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Fluidité de la colonne — sans goniomètre</div>
          </span>
        </button>

        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
