'use client'

import { use } from 'react'
import ProgramEditorPage from '@/app/programs/[athleteId]/[programId]/page'

export default function TemplateProgramPage({ params }) {
  const { programId } = use(params)
  return <ProgramEditorPage params={Promise.resolve({ athleteId: 'templates', programId })} />
}
