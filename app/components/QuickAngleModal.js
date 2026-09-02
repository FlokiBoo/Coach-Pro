'use client'

import PhotoAngleCapture from './PhotoAngleCapture'

// Mesure d'angle ponctuelle (photo d'un client ou d'un réseau social, en direct) sans aucune
// sauvegarde en base — contrairement à GoniometerView qui suit un test articulaire dans le temps
// pour un athlète donné. Utile pour un contrôle visuel rapide, sans créer de fiche.
export default function QuickAngleModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', color: '#EDEFF2', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#EDEFF2', fontSize: 22, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: '#F2A93B' }}>MESURE</span> RAPIDE
        </div>
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 12, color: '#7C8493' }}>
        Rien n&apos;est enregistré ici — juste une lecture d&apos;angle sur une photo.
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 20 }}>
        <PhotoAngleCapture onAngleChange={() => {}} />
      </div>
    </div>
  )
}
