import { supabaseAdmin } from '@/lib/supabase-admin'
import { exchangeStravaCode } from '@/lib/strava'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token = searchParams.get('state') // token de l'athlète, posé au moment de /api/strava/connect
  const error = searchParams.get('error')

  if (!token) return NextResponse.redirect(`${origin}/`)
  if (error || !code) return NextResponse.redirect(`${origin}/s/${token}?strava=error`)

  try {
    const result = await exchangeStravaCode(code)
    await supabaseAdmin.from('athletes').update({
      strava_athlete_id: result.athlete?.id || null,
      strava_access_token: result.access_token,
      strava_refresh_token: result.refresh_token,
      strava_token_expires_at: result.expires_at,
    }).eq('token', token)
    return NextResponse.redirect(`${origin}/s/${token}?strava=connected`)
  } catch {
    return NextResponse.redirect(`${origin}/s/${token}?strava=error`)
  }
}
