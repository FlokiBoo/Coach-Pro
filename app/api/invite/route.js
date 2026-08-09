import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, athleteId, athleteName, redirectTo } = await request.json()

  if (!email || !athleteId) {
    return NextResponse.json({ error: 'email et athleteId requis' }, { status: 400 })
  }

  // Auth obligatoire : coach uniquement
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: me } = await supabaseAdmin.from('coaches').select('id').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Sauvegarder l'email sur l'athlete
  const { data: athleteRow } = await supabaseAdmin.from('athletes').select('auth_user_id').eq('id', athleteId).single()
  await supabaseAdmin.from('athletes').update({ email }).eq('id', athleteId)

  // Envoyer l'invitation Supabase
  let { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${redirectTo}/auth/callback?athlete_id=${athleteId}`,
    data: { athlete_id: athleteId, athlete_name: athleteName }
  })

  // Déjà invité / déjà inscrit : on retente proprement au lieu de bloquer le coach.
  if (error && /already (been )?registered|already exists/i.test(error.message || '')) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    // Compte jamais réellement finalisé (pas de mot de passe créé, jamais lié au profil sportif) :
    // on repart de zéro proprement plutôt que de renvoyer un lien de réinitialisation inutile.
    const neverCompleted = existing?.app_metadata?.needs_password || !athleteRow?.auth_user_id

    if (existing && neverCompleted) {
      await supabaseAdmin.auth.admin.deleteUser(existing.id)
      ;({ data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${redirectTo}/auth/callback?athlete_id=${athleteId}`,
        data: { athlete_id: athleteId, athlete_name: athleteName }
      }))
    } else if (existing) {
      // A déjà un compte fonctionnel : on lui renvoie un lien de (re)définition de mot de passe.
      const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectTo}/update-password`,
      })
      if (resetErr) {
        console.error('[invite] resetPasswordForEmail error:', resetErr)
        return NextResponse.json({ error: resetErr.message || JSON.stringify(resetErr) || 'Erreur inconnue (reset password)' }, { status: 400 })
      }
      return NextResponse.json({ success: true, resent: true })
    }
  }

  if (error) {
    console.error('[invite] inviteUserByEmail error:', error)
    return NextResponse.json({ error: error.message || JSON.stringify(error) || 'Erreur inconnue (invite)' }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: data.user?.id })
}
