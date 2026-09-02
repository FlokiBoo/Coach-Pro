'use client'

import { useRouter } from 'next/navigation'

// Dans le webview natif Capacitor il n'y a ni barre d'adresse ni bouton retour système :
// sans ce bouton, une page ouverte comme les CGU devient un cul-de-sac pour l'utilisateur.
export default function BackButton({ fallbackHref = '/login', label = 'Retour' }) {
  const router = useRouter()

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text3)', fontSize: 13, fontWeight: 600,
        padding: 0, marginBottom: 20,
      }}
    >
      ← {label}
    </button>
  )
}
