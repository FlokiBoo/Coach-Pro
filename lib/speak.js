// SpeechSynthesis, comme AudioContext, ne parle parfois qu'après un vrai geste utilisateur sur
// Safari/iOS — un premier appel silencieux synchrone dans le clic qui lance le décompte débloque
// la voix pour l'appel automatique suivant ("Go"/"Stop" arrivant après un setInterval, donc hors
// du geste utilisateur direct).
export function unlockSpeech() {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    window.speechSynthesis.speak(u)
  } catch {}
}

export function speak(text, lang = 'en-US') {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 1.1
    window.speechSynthesis.speak(u)
  } catch {}
}
