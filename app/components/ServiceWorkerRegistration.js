'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(err => console.error('SW registration failed:', err))

      // sw.js s'active tout seul dès qu'une nouvelle version est détectée (skipWaiting +
      // clients.claim côté worker), mais l'onglet/WebView déjà ouvert continue de tourner sur le
      // JS chargé en mémoire tant qu'il n'est pas rechargé — retour terrain : sur l'app iOS
      // (WebView persistante), ça pouvait laisser des écrans avec des fonctionnalités à moitié à
      // jour après un déploiement. Un seul reload forcé quand le nouveau worker prend le contrôle.
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      })
    }
  }, [])
  return null
}
