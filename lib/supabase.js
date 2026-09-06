import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Dans l'app native (Capacitor/WKWebView), une connexion HTTP restée inactive après un
// verrouillage d'écran ou un changement de réseau peut être coupée côté OS sans que
// navigator.onLine ne le détecte : la requête suivante échoue avec `TypeError: Load failed`
// (Safari) / `Failed to fetch` (Chrome) alors que le réseau est bon. On retente une fois avant de
// laisser l'échec remonter — ça suffit à repartir sur une connexion fraîche et ça évite les
// "Erreur : TypeError: Load failed" qui interrompent la validation d'un exercice côté athlète.
const fetchWithRetry = async (...args) => {
  try {
    return await fetch(...args)
  } catch (err) {
    if (!(err instanceof TypeError)) throw err
    await new Promise(r => setTimeout(r, 300))
    return fetch(...args)
  }
}

export const supabase = createBrowserClient(url, key, {
  global: { fetch: fetchWithRetry },
})
