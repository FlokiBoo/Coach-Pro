import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function today() {
  const n = new Date()
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-')
}

// Le programme "en cours" créé directement sur un groupe (currentProgram côté coach) a un réglage
// de visibilité (programs.group_visibility : 'none' | 'leader' | 'everyone') que le coach ajuste
// depuis sa fiche groupe. Le leader peut toujours LANCER la séance (coché via is_leader) ; un
// membre normal ne fait que la voir apparaître si le coach a choisi "everyone" — jamais de bouton
// Lancer pour lui.
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

  const { data: memberRows } = await supabaseAdmin.from('group_members').select('group_id, is_leader').eq('athlete_id', athlete.id)
  if (!memberRows?.length) return NextResponse.json({ groups: [] })
  const isLeaderByGroup = {}
  memberRows.forEach(r => { isLeaderByGroup[r.group_id] = isLeaderByGroup[r.group_id] || !!r.is_leader })
  const groupIds = [...new Set(memberRows.map(r => r.group_id))]

  const { data: groupsData } = await supabaseAdmin.from('groups').select('id, name').in('id', groupIds)

  // Le serveur (Vercel, UTC) et l'appareil (heure locale FR) peuvent désigner des "aujourd'hui"
  // différents près de minuit — on privilégie la date du client si elle est fournie, pour ne pas
  // faire disparaître une séance tout juste lancée à cause d'un décalage de fuseau.
  const runDate = searchParams.get('date') || today()
  const groups = []
  for (const g of (groupsData || [])) {
    const isLeader = isLeaderByGroup[g.id]

    // Tant que la colonne group_visibility n'existe pas encore en base (migration pas encore
    // appliquée), la sélectionner ferait échouer toute la requête — on retombe alors sur l'ancien
    // comportement (réservé au leader) plutôt que de casser l'affichage pour tout le monde.
    const { data: prog, error: progErr } = await supabaseAdmin.from('programs')
      .select('id, group_visibility, program_sessions(id, title, order_index)')
      .eq('group_id', g.id).eq('is_microcycle', false).is('athlete_id', null)
      .order('created_at', { ascending: false }).limit(1)
    let directProgram = prog?.[0]
    if (progErr) {
      const { data: progFallback } = await supabaseAdmin.from('programs')
        .select('id, program_sessions(id, title, order_index)')
        .eq('group_id', g.id).eq('is_microcycle', false).is('athlete_id', null)
        .order('created_at', { ascending: false }).limit(1)
      directProgram = progFallback?.[0]
    }
    const visibility = directProgram?.group_visibility || 'leader'
    const canSeeDirect = !!directProgram && (visibility === 'everyone' || (visibility === 'leader' && isLeader))
    const directSessions = canSeeDirect ? (directProgram.program_sessions || []) : []

    // Programme rattaché via la bibliothèque de templates réutilisables (group_program_templates) —
    // pas de réglage de visibilité par groupe dessus (un même template peut être lié à plusieurs
    // groupes), donc réservé au leader comme avant.
    let linkedSessions = []
    if (isLeader) {
      const { data: links } = await supabaseAdmin.from('group_program_templates')
        .select('programs(program_sessions(id, title, order_index))').eq('group_id', g.id)
      linkedSessions = (links || []).flatMap(l => l.programs?.program_sessions || [])
    }

    const sessions = [...directSessions, ...linkedSessions].sort((a, b) => a.order_index - b.order_index)
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
      id: g.id, name: g.name, canLaunch: isLeader,
      sessions: upcomingSessions.map(s => ({ id: s.id, title: s.title, ranToday: ranToday.has(s.id) })),
    })
  }

  return NextResponse.json({ groups })
}
