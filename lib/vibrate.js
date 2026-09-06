// navigator.vibrate() fonctionne sur Android (natif et web) mais WKWebView (app iOS) ne
// l'implémente pas du tout — il faut passer par le plugin Capacitor Haptics pour avoir une
// vibration sur iOS. On tente les deux : Haptics en priorité sur plateforme native, sinon
// navigator.vibrate en repli (web, Android navigateur).
import { Capacitor } from '@capacitor/core'

let hapticsModule = null
async function getHaptics() {
  if (hapticsModule) return hapticsModule
  try {
    hapticsModule = await import('@capacitor/haptics')
    return hapticsModule
  } catch {
    return null
  }
}

export async function vibrate(intensity = 'light') {
  try {
    if (Capacitor.isNativePlatform()) {
      const mod = await getHaptics()
      if (mod) {
        const style = intensity === 'heavy' ? mod.ImpactStyle.Heavy : intensity === 'medium' ? mod.ImpactStyle.Medium : mod.ImpactStyle.Light
        await mod.Haptics.impact({ style })
        return
      }
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(intensity === 'heavy' ? 90 : intensity === 'medium' ? 50 : 25)
    }
  } catch {}
}
