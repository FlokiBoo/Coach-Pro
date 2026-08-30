import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: coach } = await supabaseAdmin.from('coaches').select('id').eq('id', user.id).single()
  if (!coach) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: athletes } = await supabaseAdmin.from('athletes').select('id, name').eq('coach_id', user.id)
  const athleteIds = (athletes || []).map(a => a.id)
  if (!athleteIds.length) return NextResponse.json({ threads: [] })

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('athlete_id, sender_role, body, attachment_type, created_at, read_by_coach_at')
    .in('athlete_id', athleteIds)
    .order('created_at', { ascending: false })

  const previewFor = (m) => {
    if (!m) return null
    if (m.body) return m.body
    if (m.attachment_type === 'image') return '📷 Photo'
    if (m.attachment_type === 'video') return '🎥 Vidéo'
    return null
  }

  const threads = (athletes || []).map(a => {
    const athleteMessages = (messages || []).filter(m => m.athlete_id === a.id)
    const last = athleteMessages[0]
    const unreadCount = athleteMessages.filter(m => m.sender_role === 'athlete' && !m.read_by_coach_at).length
    return {
      athleteId: a.id,
      athleteName: a.name,
      lastMessage: previewFor(last),
      lastAt: last?.created_at || null,
      unreadCount,
    }
  }).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))

  return NextResponse.json({ threads }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
}
