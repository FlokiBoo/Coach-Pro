import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

// Pour un leader de groupe (compte athlète, confiné à /s/[token] — il n'a pas accès à l'espace
// coach /groups/...) : le ou les groupes qu'il dirige, avec les séances du programme du groupe
// en cours, pour afficher un bouton "Lancer" directement depuis son onglet Séance.
export async function GET(request, { params }) {
  const { token } = await params
  const { data: athlete } = await supabaseAdmin.from('athletes').select('id, auth_user_id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || athlete.auth_user_id !== user.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: leaderRows } = await supabaseAdmin.from('group_members').select('group_id').eq('athlete_id', athlete.id).eq('is_leader', true)
  const groupIds = [...new Set((leaderRows || []).map(r => r.group_id))]
  if (!groupIds.length) return NextResponse.json({ groups: [] })

  const { data: groupsData } = await supabaseAdmin.from('groups').select('id, name').in('id', groupIds)

  const runDate = today()
  const groups = []
  for (const g of (groupsData || [])) {
    const { data: prog } = await supabaseAdmin.from('programs')
      .select('id, program_sessions(id, title, order_index)')
      .eq('group_id', g.id).eq('is_microcycle', false).is('athlete_id', null)
      .order('created_at', { ascending: false }).limit(1)
    const sessions = (prog?.[0]?.program_sessions || []).sort((a, b) => a.order_index - b.order_index)
    if (!sessions.length) continue

    const { data: runsToday } = await supabaseAdmin.from('group_session_runs')
      .select('source_session_id').eq('group_id', g.id).eq('date', runDate)
    const ranToday = new Set((runsToday || []).map(r => r.source_session_id))

    groups.push({
      id: g.id, name: g.name,
      sessions: sessions.map(s => ({ id: s.id, title: s.title, ranToday: ranToday.has(s.id) })),
    })
  }

  return NextResponse.json({ groups })
}
