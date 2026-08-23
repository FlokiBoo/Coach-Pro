import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const query = new URL(request.url).searchParams.get('query')?.trim()
  if (!query) return NextResponse.json({ error: 'query requis' }, { status: 400 })

  const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&page_size=8&fields=product_name,nutriments,code`

  let res
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'CoachPro/1.0 (contact via coachpro-app.fr)' } })
  } catch (err) {
    return NextResponse.json({ error: 'Open Food Facts injoignable : ' + err.message }, { status: 502 })
  }
  if (res.status === 429) {
    return NextResponse.json({ error: 'Trop de recherches, réessaie dans une minute.' }, { status: 429 })
  }
  if (!res.ok) {
    return NextResponse.json({ error: `Erreur Open Food Facts (${res.status})` }, { status: 502 })
  }
  let json
  try {
    json = await res.json()
  } catch {
    return NextResponse.json({ error: 'Réponse Open Food Facts invalide, réessaie.' }, { status: 502 })
  }

  const results = (json.products || [])
    .filter(p => p.product_name && p.nutriments)
    .map(p => ({
      id: p.code || p.product_name,
      name: p.product_name,
      protein: Number(p.nutriments['proteins_100g']) || 0,
      fat: Number(p.nutriments['fat_100g']) || 0,
      carbs: Number(p.nutriments['carbohydrates_100g']) || 0,
    }))

  return NextResponse.json({ results })
}
