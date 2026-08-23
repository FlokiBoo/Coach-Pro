import { supabaseAdmin } from '@/lib/supabase-admin'
import { stravaAuthorizeUrl } from '@/lib/strava'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data: athlete } = await supabaseAdmin.from('athletes').select('id').eq('token', token).single()
  if (!athlete) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const redirectUri = `${origin}/api/strava/callback`
  return NextResponse.redirect(stravaAuthorizeUrl(redirectUri, token))
}
