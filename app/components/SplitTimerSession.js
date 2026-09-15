'use client'

import { useState, useEffect } from 'react'
import EmbeddedTimer from './EmbeddedTimer'

const LAYOUT_CYCLE = ['split', 'timer', 'workout']

// Écran plein viewport, timer en haut / séance en bas (50/50 par défaut). Les deux flèches
// permettent de passer l'une ou l'autre en plein écran puis de revenir au 50/50, en alternance —
// le timer reste toujours monté (jamais démonté) pour ne pas perdre son décompte pendant qu'on
// bascule l'affichage. La touche "N" fait le même cycle split → timer plein écran → séance
// plein écran → split, pour zoomer au clavier sans lâcher la souris/le doigt pendant la séance.
export default function SplitTimerSession({ config, timerLabel, onClose, children }) {
  const [layout, setLayout] = useState('split') // 'split' | 'timer' | 'workout'

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'n' && e.key !== 'N') return
      // Ignore la frappe si elle vient d'un champ texte (ex. note libre sous la séance) — sinon
      // taper "n" dans une note bascule le layout au lieu d'écrire la lettre.
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      setLayout(l => LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(l) + 1) % LAYOUT_CYCLE.length])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const timerHeight = layout === 'workout' ? '0%' : layout === 'timer' ? '100%' : '50%'
  const workoutHeight = layout === 'timer' ? '0%' : layout === 'workout' ? '100%' : '50%'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 950, display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
      {/* containerType: 'size' donne à EmbeddedTimer des unités cqw/cqh/cqmin basées sur la
          taille RÉELLE de ce panneau plutôt que sur le viewport entier — les chiffres du timer
          grossissent donc automatiquement quand ce panneau s'agrandit (plein écran, ou téléphone
          tourné en paysage où le panneau devient beaucoup plus large), sans media query séparée
          à maintenir pour chaque cas. EmbeddedTimer n'est monté que dans ce panneau (jamais seul
          ailleurs dans l'app), donc pas besoin de repli si le contexte de conteneur manquait. */}
      <div style={{ height: timerHeight, overflow: layout === 'workout' ? 'hidden' : 'visible', position: 'relative', flexShrink: 0, transition: 'height .2s ease', borderBottom: layout === 'workout' ? 'none' : '1px solid var(--border)', containerType: 'size' }}>
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', zIndex: 2 }}>
          <button onClick={onClose} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, width: 32, height: 32, fontSize: 15, color: 'var(--text2)', cursor: 'pointer' }} title="Arrêter et fermer">✕</button>
          <button onClick={() => setLayout(l => l === 'timer' ? 'split' : 'timer')} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, width: 32, height: 32, fontSize: 15, color: 'var(--text2)', cursor: 'pointer' }} title={layout === 'timer' ? 'Revenir au 50/50' : 'Timer plein écran'}>
            {layout === 'timer' ? '⤡' : '⤢'}
          </button>
        </div>
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <EmbeddedTimer config={config} label={timerLabel} />
        </div>
      </div>

      <div style={{ height: workoutHeight, overflow: layout === 'timer' ? 'hidden' : 'auto', position: 'relative', flex: layout === 'workout' ? 1 : undefined, minHeight: 0, transition: 'height .2s ease' }}>
        <div style={{ position: 'sticky', top: 8, display: 'flex', justifyContent: 'flex-end', paddingRight: 8, zIndex: 2 }}>
          <button onClick={() => setLayout(l => l === 'workout' ? 'split' : 'workout')} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 20, width: 32, height: 32, fontSize: 15, color: 'var(--text2)', cursor: 'pointer' }} title={layout === 'workout' ? 'Revenir au 50/50' : 'Séance plein écran'}>
            {layout === 'workout' ? '⤡' : '⤢'}
          </button>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
