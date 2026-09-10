'use client'

import { use } from 'react'
import SessionBlockEditor from '@/app/components/SessionBlockEditor'

// Même éditeur "blocks" que côté coach (voir app/components/SessionBlockEditor.js) : ouvert quand
// le sportif crée une "Séance libre" (choix Standard/Cardio dans AddActionSheet) au lieu de l'ancien
// formulaire minimal — RLS restreint déjà l'accès à ses propres program_sessions/program_exercises.
export default function AthleteSessionEditorPage({ params }) {
  const { token, sessionId } = use(params)
  return <SessionBlockEditor sessionId={sessionId} backHref={`/s/${token}`} canManageCatalog={false} />
}
