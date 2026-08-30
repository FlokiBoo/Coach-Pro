import { createClient } from '@supabase/supabase-js'

// Instancié au premier appel réel plutôt qu'au chargement du module : createClient() lève une
// exception dès que NEXT_PUBLIC_SUPABASE_URL est absente, ce qui ferait planter TOUT le build
// (pas juste les routes qui l'utilisent) si la variable n'est pas configurée pour cet
// environnement (ex: build Vercel Preview qui n'hérite pas des secrets de Production).
let client = null
function getClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return client
}

export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    const value = getClient()[prop]
    return typeof value === 'function' ? value.bind(getClient()) : value
  },
})
