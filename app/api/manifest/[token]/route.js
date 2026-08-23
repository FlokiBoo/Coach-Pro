import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { token } = await params

  const manifest = {
    name: 'TORVYX',
    short_name: 'Ma séance',
    start_url: `/s/${token}`,
    scope: `/s/${token}`,
    display: 'standalone',
    background_color: '#FBF8F1',
    theme_color: '#6D1A22',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  }

  return NextResponse.json(manifest, { headers: { 'Content-Type': 'application/manifest+json' } })
}
