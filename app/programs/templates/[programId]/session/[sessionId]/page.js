'use client'

import { use } from 'react'
import SessionBlockEditor from '@/app/components/SessionBlockEditor'

export default function TemplateSessionEditorPageWrapper({ params }) {
  const { programId, sessionId } = use(params)
  return <SessionBlockEditor sessionId={sessionId} backHref={`/programs/templates/${programId}`} />
}
