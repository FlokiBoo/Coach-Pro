import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import ciqualFoods from '@/lib/data/ciqual.json'

export const dynamic = 'force-dynamic'

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const normalizedNames = ciqualFoods.map(f => norm(f.name))

export async function GET(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const query = new URL(request.url).searchParams.get('query')?.trim()
  if (!query) return NextResponse.json({ error: 'query requis' }, { status: 400 })

  const q = norm(query)
  // Les mots peuvent apparaître dans un ordre différent de celui du libellé CIQUAL
  // (ex. "flocons avoine" doit trouver "Flocons d'avoine") : on exige juste que chaque
  // mot de la recherche apparaisse quelque part, puis on classe par pertinence.
  const tokens = q.split(/\s+/).filter(Boolean)
  const startsWith = [], contains = [], allTokens = []

  for (let i = 0; i < ciqualFoods.length; i++) {
    const n = normalizedNames[i]
    if (n.startsWith(q)) startsWith.push(ciqualFoods[i])
    else if (n.includes(q)) contains.push(ciqualFoods[i])
    else if (tokens.length > 1 && tokens.every(t => n.includes(t))) allTokens.push(ciqualFoods[i])
  }

  const results = [...startsWith, ...contains, ...allTokens]
    .slice(0, 10)
    .map(({ id, name, protein, fat, carbs }) => ({ id, name, protein, fat, carbs }))

  return NextResponse.json({ results })
}
