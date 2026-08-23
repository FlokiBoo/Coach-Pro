import { getAnthropic } from '@/lib/anthropic'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Tu es l'assistant IA de OSTRYK, une app pour coachs sportifs.
Tu aides le coach à préparer des séances, des programmes, des conseils nutrition et des réponses à ses sportifs.
Réponds en français, de façon concise et concrète, avec des exemples chiffrés (séries/reps/kcal) quand c'est pertinent.`

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé API Anthropic manquante côté serveur (ANTHROPIC_API_KEY dans .env.local)." }, { status: 500 })
  }

  const { messages } = await request.json()
  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: 'messages requis' }, { status: 400 })
  }

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })
    const text = response.content.find(b => b.type === 'text')?.text || ''
    return NextResponse.json({ text })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erreur IA' }, { status: 500 })
  }
}
