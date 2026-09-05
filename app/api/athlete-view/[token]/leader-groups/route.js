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
  const { searchParams } = new URL(request.url)
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

  // Le serveur (Vercel, UTC) et l'appareil du leader (heure locale FR) peuvent désigner des
  // "aujourd'hui" différents près de minuit — on privilégie la date du client si elle est fournie,
  // pour ne pas faire disparaître une séance tout juste lancée à cause d'un décalage de fuseau.
  const runDate = searchParams.get('date') || today()
  const groups = []
  for (const g of (groupsData || [])) {
    const { data: prog } = await supabaseAdmin.from('programs')
      .select('id, program_sessions(id, title, order_index)')
      .eq('group_id', g.id).eq('is_microcycle', false).is('athlete_id', null)
      .order('created_at', { ascending: false }).limit(1)

    // Un programme peut aussi être rattaché au groupe via la bibliothèque de templates réutilisables
    // (group_program_templates) plutôt que créé directement dessus (group_id) — un coach qui a un
    // circuit-type qu'il relance chaque semaine passe par ce chemin. Sans ça, le leader n'a aucune
    // visibilité sur son groupe alors que le coach voit tout normalement sur sa propre fiche.
    const { data: links } = await supabaseAdmin.from('group_program_templates')
      .select('programs(program_sessions(id, title, order_index))').eq('group_id', g.id)
    const linkedSessions = (links || []).flatMap(l => l.programs?.program_sessions || [])

    const sessions = [...(prog?.[0]?.program_sessions || []), ...linkedSessions].sort((a, b) => a.order_index - b.order_index)
    if (!sessions.length) continue

    // On ne veut voir que la ou les séances à faire : une séance déjà lancée un jour passé
    // disparaît de la liste. Celle lancée AUJOURD'HUI reste affichée (avec "Modifier") pour
    // pouvoir corriger la présence dans la foulée, plutôt que de disparaître aussitôt enregistrée.
    const { data: runs } = await supabaseAdmin.from('group_session_runs')
      .select('source_session_id, date').eq('group_id', g.id).in('source_session_id', sessions.map(s => s.id))
    const ranPast = new Set((runs || []).filter(r => r.date < runDate).map(r => r.source_session_id))
    const ranToday = new Set((runs || []).filter(r => r.date === runDate).map(r => r.source_session_id))

    const upcomingSessions = sessions.filter(s => !ranPast.has(s.id))
    if (!upcomingSessions.length) continue

    groups.push({
      id: g.id, name: g.name,
      sessions: upcomingSessions.map(s => ({ id: s.id, title: s.title, ranToday: ranToday.has(s.id) })),
    })
  }

  return NextResponse.json({ groups })
}
