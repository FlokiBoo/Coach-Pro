import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(request) {
  const { athleteIds, sessionTitle } = await request.json()

  if (!Array.isArray(athleteIds) || !athleteIds.length) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 })
  }

  const { data: athletes } = await supabaseAdmin.from('athletes').select('email, name').in('id', athleteIds)

  await Promise.all((athletes || []).filter(a => a.email).map(a => sendEmail({
    to: a.email,
    subject: 'N\'oublie pas de renseigner ta séance !',
    html: `<p>Bonjour ${a.name?.split(' ')[0] || ''},</p>`
      + `<p>Tu étais présent(e) à la séance de groupe${sessionTitle ? ` <strong>${sessionTitle.trim()}</strong>` : ''}.</p>`
      + `<p>Pense à renseigner tes charges, séries et reps, ainsi que ton ressenti, depuis ton espace.</p>`,
  })))

  return NextResponse.json({ success: true })
}
