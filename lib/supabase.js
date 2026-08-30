import { createBrowserClient } from '@supabase/ssr'

// Instancié au premier appel réel plutôt qu'au chargement du module : createBrowserClient() lève
// une exception dès que NEXT_PUBLIC_SUPABASE_URL est absente, ce qui ferait planter TOUT le build
// (pas juste les pages qui l'utilisent) si la variable n'est pas configurée pour cet environnement
// (ex: build Vercel Preview qui n'hérite pas des secrets de Production).
let client = null
function getClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return client
}

export const supabase = new Proxy({}, {
  get(_target, prop) {
    const value = getClient()[prop]
    return typeof value === 'function' ? value.bind(getClient()) : value
  },
})
