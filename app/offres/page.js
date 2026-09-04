'use client'

import { useState } from 'react'
import { Medal, Circle } from '@phosphor-icons/react'
import { ONE_TIME_OFFERS } from '@/lib/offers'

const cardStyle = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
  padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 280,
}

function ListBlock({ title, items }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <li key={i} className="font-editorial" style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text2)' }}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

function BookingForm({ offerKey, accent }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [paymentPlan, setPaymentPlan] = useState('full')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/offers/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerKey, name, email, paymentPlan }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(json.error || 'Erreur, réessaie.'); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '13px', fontSize: 13, color: 'var(--text2)', textAlign: 'center', marginTop: 4 }}>
        ✓ Demande envoyée — je te recontacte sous 24-48h.
      </div>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        background: accent, color: '#fff', border: 'none', borderRadius: 'var(--r)',
        padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4,
      }}>
        Réserver
      </button>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <input placeholder="Prénom et nom" value={name} onChange={e => setName(e.target.value)} required
        style={{ padding: '11px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
        style={{ padding: '11px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', background: 'var(--bg2)', color: 'var(--text)' }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 10px', fontSize: 13, cursor: 'pointer',
          border: `1.5px solid ${paymentPlan === 'full' ? accent : 'var(--border2)'}`, borderRadius: 'var(--r)',
          background: paymentPlan === 'full' ? 'var(--bg2)' : 'transparent', color: 'var(--text)',
        }}>
          <input type="radio" name={`plan-${offerKey}`} checked={paymentPlan === 'full'} onChange={() => setPaymentPlan('full')} style={{ accentColor: accent }} />
          En 1 fois
        </label>
        <label style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 10px', fontSize: 13, cursor: 'pointer',
          border: `1.5px solid ${paymentPlan === '3x' ? accent : 'var(--border2)'}`, borderRadius: 'var(--r)',
          background: paymentPlan === '3x' ? 'var(--bg2)' : 'transparent', color: 'var(--text)',
        }}>
          <input type="radio" name={`plan-${offerKey}`} checked={paymentPlan === '3x'} onChange={() => setPaymentPlan('3x')} style={{ accentColor: accent }} />
          3x sans frais
        </label>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r)', padding: '8px 10px' }}>{error}</div>
      )}
      <button type="submit" disabled={loading} style={{
        background: accent, color: '#fff', border: 'none', borderRadius: 'var(--r)',
        padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}>
        {loading ? '…' : 'Envoyer ma demande'}
      </button>
    </form>
  )
}

export default function OffresPage() {
  return (
    <div style={{ background: 'var(--bg2)', minHeight: '100svh', padding: '40px 16px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 28, fontWeight: 700 }}>
          Nos offres
        </div>
        <div className="font-editorial" style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 15, marginBottom: 36, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Deux offres, deux besoins différents — le plan seul, ou l&apos;accompagnement complet qui s&apos;ajuste chaque semaine.
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={cardStyle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}><Medal size={14} color="#8A5A2B" weight="fill" /> PROGRAMME SUR-MESURE</div>
              <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 30, fontWeight: 700 }}>300€</div>
              <div className="font-editorial" style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic', marginTop: 2 }}>Le plan, sans l&apos;accompagnement</div>
            </div>

            <p className="font-editorial" style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
              Tu veux un programme construit spécifiquement pour toi — pas un template générique — mais tu es autonome pour l&apos;exécuter.
            </p>

            <ListBlock title="Ce qui est inclus" items={[
              "Questionnaire approfondi (objectifs, historique d'entraînement, restrictions articulaires, douleurs, matériel disponible, contraintes de temps)",
              'Call de cadrage 20-30 min — on valide ensemble que le questionnaire capture bien ta réalité avant que je programme',
              '12 semaines de programmation 100% personnalisée, 3 séances/semaine, adaptée à tes objectifs et restrictions',
              '1 vidéo/semaine possible pour correction technique',
            ]} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Pour qui</div>
              <p className="font-editorial" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>
                Tu sais déjà t&apos;entraîner, tu veux juste un plan structuré et sérieux plutôt que de l&apos;improviser toi-même.
              </p>
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>Ce qui n&apos;est PAS inclus</div>
              <p className="font-editorial" style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, margin: 0 }}>
                Pas d&apos;ajustement hebdomadaire de la programmation, pas d&apos;appel régulier, pas de plan nutritionnel.
              </p>
            </div>

            <BookingForm offerKey="programme_sur_mesure" accent="var(--text)" />
          </div>

          <div style={{ ...cardStyle, border: '1.5px solid var(--green)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}><Circle size={11} weight="fill" /> SUIVI 1:1</div>
              <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 30, fontWeight: 700 }}>1500€ <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>/ 3 mois</span></div>
              <div className="font-editorial" style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic', marginTop: 2 }}>L&apos;accompagnement complet</div>
            </div>

            <p className="font-editorial" style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
              Tu veux un coach qui ajuste ta progression chaque semaine en fonction de tes vraies performances, pas un plan figé sur 12 semaines à l&apos;avance.
            </p>

            <ListBlock title="Ce qui est inclus" items={[
              'Programme 100% personnalisé, jusqu\'à 5 séances/semaine',
              'Programmation évolutive — ajustée chaque semaine selon tes performances réelles, pas un plan statique',
              'Échanges vidéo illimités pour correction technique continue',
              'Call hebdomadaire 15-20 min',
              'Plan nutritionnel : calories cibles + 2-3 journées types + calories réajustées chaque semaine selon ton évolution',
            ]} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Pour qui</div>
              <p className="font-editorial" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>
                Tu veux un vrai suivi de coach, pas juste un programme — quelqu&apos;un qui réagit à comment ton corps répond, semaine après semaine.
              </p>
            </div>

            <div className="font-editorial" style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', lineHeight: 1.5 }}>
              Les conseils nutritionnels fournis sont informatifs et personnalisés à ton activité — ils ne remplacent pas l&apos;avis d&apos;un diététicien ou d&apos;un médecin en cas de pathologie ou de besoin médical spécifique.
            </div>

            <BookingForm offerKey="suivi_1to1" accent="var(--green)" />
          </div>
        </div>
      </div>
    </div>
  )
}
