import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { isPasswordValid, passwordPolicyMessage } from '@/lib/passwordPolicy'
import { LEGAL_VERSION } from '@/lib/legal'

// Auto-inscription d'un client depuis la page de connexion (sans invitation préalable du coach).
// Le compte est rattaché au coach principal (is_admin) — l'app est utilisée par un seul coach.
export async function POST(request) {
  const { name, email, password, accepted_terms, birth_date, height, weight, target_weight } = await request.json()

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Nom, email et mot de passe requis.' }, { status: 400 })
  }
  if (!isPasswordValid(password)) {
    return NextResponse.json({ error: passwordPolicyMessage() }, { status: 400 })
  }
  // Le consentement est revalidé ici : la case cochée côté client est contournable, or le RGPD
  // (art. 7.1) impose de pouvoir prouver le consentement — d'où l'horodatage + la version stockés
  // dans les métadonnées du compte juste en dessous.
  if (accepted_terms !== true) {
    return NextResponse.json({ error: 'Merci d\'accepter les CGU et la politique de confidentialité.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  const { data: existing } = await supabaseAdmin.from('athletes').select('id').ilike('email', normalizedEmail).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Un compte existe déjà avec cet email. Connecte-toi plutôt.' }, { status: 409 })
  }

  const { data: coach } = await supabaseAdmin.from('coaches').select('id, email').eq('is_admin', true).limit(1).maybeSingle()
  if (!coach) return NextResponse.json({ error: 'Aucun coach disponible pour le moment.' }, { status: 500 })

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name: name.trim(),
      cgu_accepted_at: new Date().toISOString(),
      cgu_version: LEGAL_VERSION,
    },
  })
  if (createErr) {
    const msg = /already.*registered|already exists/i.test(createErr.message || '')
      ? 'Un compte existe déjà avec cet email. Connecte-toi plutôt.'
      : createErr.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { error: insertErr } = await supabaseAdmin.from('athletes').insert({
    name: name.trim(),
    email: normalizedEmail,
    coach_id: coach.id,
    auth_user_id: created.user.id,
    birth_date: birth_date || null,
    height: height ? parseFloat(height) : null,
    weight: weight ? parseFloat(weight) : null,
    target_weight: target_weight ? parseFloat(target_weight) : null,
  })
  if (insertErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: insertErr.message }, { status: 400 })
  }

  if (coach.email) {
    await sendEmail({
      to: coach.email,
      subject: `Nouveau client : ${name.trim()}`,
      html: `<p><strong>${name.trim()}</strong> vient de créer son compte (${normalizedEmail}).</p>`,
    })
  }

  return NextResponse.json({ success: true })
}
