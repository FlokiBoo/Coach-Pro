import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { token } = await params

  const manifest = {
    name: 'OSTRYK',
    short_name: 'Ma séance',
    start_url: `/s/${token}`,
    scope: `/s/${token}`,
    display: 'standalone',
    background_color: '#FBF8F1',
    theme_color: '#6D1A22',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }

  return NextResponse.json(manifest, { headers: { 'Content-Type': 'application/manifest+json' } })
}
