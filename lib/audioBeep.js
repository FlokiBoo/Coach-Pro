// AudioContext partagé pour tous les timers (TimerModal, EmbeddedTimer). Safari/iOS n'autorise
// la création/reprise d'un AudioContext que de façon synchrone dans un vrai geste utilisateur
// (clic/tap) — un appel fait plus tard dans un useEffect (même déclenché par ce clic) arrive
// après coup et reste muet, silencieusement. D'où unlockAudio(), à appeler directement dans les
// gestionnaires onClick qui lancent un timer à démarrage automatique (pas de bouton "Start"
// intermédiaire) — le composant timer réutilise ensuite ce même contexte déjà débloqué.
let ctx = null

export function unlockAudio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function beep(freq = 880, duration = 0.12) {
  try {
    const c = unlockAudio()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start()
    osc.stop(c.currentTime + duration)
  } catch {}
}
