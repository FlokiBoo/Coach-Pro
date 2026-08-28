import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(request) {
  const { athleteIds, kind, title } = await request.json()

  if (!Array.isArray(athleteIds) || !athleteIds.length || !title?.trim()) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 })
  }

  const { data: athletes } = await supabaseAdmin.from('athletes').select('email, name').in('id', athleteIds)
  const isSession = kind === 'session'

  await Promise.all((athletes || []).filter(a => a.email).map(a => sendEmail({
    to: a.email,
    subject: isSession ? `Nouvelle séance : ${title.trim()}` : `Nouveau programme : ${title.trim()}`,
    html: `<p>Bonjour ${a.name?.split(' ')[0] || ''},</p>`
      + `<p>Ton coach vient de t'ajouter ${isSession ? 'une nouvelle séance' : 'un nouveau programme'} : <strong>${title.trim()}</strong>.</p>`
      + `<p>Connecte-toi à ton espace pour la consulter.</p>`,
  })))

  return NextResponse.json({ success: true })
}
