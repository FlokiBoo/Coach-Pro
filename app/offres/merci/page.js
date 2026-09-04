import { CheckCircle } from '@phosphor-icons/react/dist/ssr'

export const metadata = { title: 'Merci — OSTRYK' }

export default function MerciPage() {
  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '36px 28px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: '#16A34A', marginBottom: 10 }}><CheckCircle size={40} /></div>
        <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          Paiement confirmé, merci !
        </div>
        <p className="font-editorial" style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
          Je te recontacte par email sous 24-48h pour la suite (questionnaire, call de cadrage).
        </p>
      </div>
    </div>
  )
}
