import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function findNutrient(nutrients, name) {
  return nutrients?.find(n => n.name === name)?.amount ?? null
}

export async function GET(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!process.env.SPOONACULAR_API_KEY) {
    return NextResponse.json({ error: "Clé API Spoonacular manquante côté serveur (SPOONACULAR_API_KEY dans .env.local)." }, { status: 500 })
  }

  const query = new URL(request.url).searchParams.get('query')?.trim()
  if (!query) return NextResponse.json({ error: 'query requis' }, { status: 400 })

  const url = new URL('https://api.spoonacular.com/recipes/complexSearch')
  url.searchParams.set('apiKey', process.env.SPOONACULAR_API_KEY)
  url.searchParams.set('query', query)
  url.searchParams.set('addRecipeNutrition', 'true')
  url.searchParams.set('number', '8')

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `Erreur Spoonacular (${res.status}) : ${body.slice(0, 200)}` }, { status: 502 })
  }
  const json = await res.json()

  const results = (json.results || []).map(r => {
    const nutrients = r.nutrition?.nutrients
    return {
      id: r.id,
      title: r.title,
      image: r.image || null,
      kcal: findNutrient(nutrients, 'Calories'),
      proteines: findNutrient(nutrients, 'Protein'),
      glucides: findNutrient(nutrients, 'Carbohydrates'),
      lipides: findNutrient(nutrients, 'Fat'),
      sourceUrl: r.sourceUrl || null,
    }
  })

  return NextResponse.json({ results })
}
