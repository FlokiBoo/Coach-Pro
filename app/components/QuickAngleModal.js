'use client'

import { useState, useRef } from 'react'
import PhotoAngleCapture from './PhotoAngleCapture'
import { supabase } from '@/lib/supabase'
import { getCoachId } from '@/lib/coach'

const BUCKET = 'joint-test-photos'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

// Mesure d'angle ponctuelle (photo d'un client ou d'un réseau social, en direct), qui ne sauvegarde
// rien PAR DÉFAUT — contrairement à GoniometerView qui suit un test articulaire dans le temps pour
// un athlète déjà existant. En sortant avec un angle mesuré, on propose quand même de la garder,
// via la même fiche "test" jetable (is_test) que le flow "Nouveau test" utilise déjà, pour ne pas
// perdre une mesure utile faite dans l'instant.
export default function QuickAngleModal({ onClose }) {
  const photoRef = useRef(null)
  const [angle, setAngle] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleBack = async () => {
    if (angle == null || saving) { onClose(); return }
    if (!window.confirm(`Sauvegarder cette mesure (${angle.toFixed(1)}°) dans une fiche test ?`)) { onClose(); return }
    const name = window.prompt('Nom de cette fiche test (ex: "Cliente Insta — épaule D") ?')
    if (!name || !name.trim()) { onClose(); return }
    const side = window.prompt('Côté mesuré ? Tape D ou G', 'D')
    const sideField = (side || '').trim().toUpperCase() === 'G' ? 'value_g' : 'value_d'

    setSaving(true)
    const [snapshot, coachId] = await Promise.all([photoRef.current?.getSnapshot(), getCoachId()])
    const { data: athlete, error: athErr } = await supabase.from('athletes')
      .insert({ coach_id: coachId, name: name.trim(), is_test: true, token: crypto.randomUUID() })
      .select().single()
    if (athErr) { alert('Erreur : ' + athErr.message); setSaving(false); onClose(); return }

    let photoPath = null
    if (snapshot?.blob) {
      photoPath = `${athlete.id}/mesure-rapide-${Date.now()}.jpg`
      await supabase.storage.from(BUCKET).upload(photoPath, snapshot.blob, { contentType: 'image/jpeg' })
    }
    await supabase.from('joint_test_entries').insert({
      athlete_id: athlete.id, test_name: name.trim(), date: today(),
      [sideField]: Math.round(angle * 10) / 10,
      ...(photoPath ? { photo_path: photoPath } : {}),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0D1117', zIndex: 800, display: 'flex', flexDirection: 'column', color: '#EDEFF2', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleBack} disabled={saving} style={{ background: 'none', border: 'none', color: '#EDEFF2', fontSize: 22, cursor: saving ? 'default' : 'pointer', padding: '2px 4px', lineHeight: 1, opacity: saving ? 0.5 : 1 }}>
          {saving ? '…' : '←'}
        </button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: '#F2A93B' }}>MESURE</span> RAPIDE
        </div>
      </div>
      <div style={{ padding: '0 20px 8px', fontSize: 12, color: '#7C8493' }}>
        Rien n&apos;est enregistré automatiquement — en quittant avec un angle mesuré, on te proposera de le garder dans une fiche test.
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 20 }}>
        <PhotoAngleCapture ref={photoRef} onAngleChange={setAngle} />
      </div>
    </div>
  )
}
