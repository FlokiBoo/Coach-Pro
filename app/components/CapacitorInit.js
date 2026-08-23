'use client'

import { useEffect } from 'react'

// La config capacitor.config.json (plugins.StatusBar) suffit sur iOS, mais Android a besoin
// de l'appel natif au démarrage pour vraiment repousser le contenu sous la barre de statut.
// No-op silencieux sur le web (hors app native) — le plugin n'existe simplement pas dans ce contexte.
export default function CapacitorInit() {
  useEffect(() => {
    import('@capacitor/core').then(async ({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setOverlaysWebView({ overlay: false })
      await StatusBar.setStyle({ style: Style.Light })
      await StatusBar.setBackgroundColor({ color: '#FBF8F1' })
    }).catch(() => {})
  }, [])
  return null
}
