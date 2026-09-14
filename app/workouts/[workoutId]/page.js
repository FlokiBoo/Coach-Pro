'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import SessionBlockEditor from '@/app/components/SessionBlockEditor'

// Un workout est un programme (is_workout) réduit à une seule séance : on retrouve/pose cette
// séance ici puis on délègue tout l'éditeur (exercices, supersets, warmup/cooldown…) à
// SessionBlockEditor, déjà utilisé pour les séances de programme — pas de duplication d'UI.
export default function WorkoutEditorPage({ params }) {
  const { workoutId } = use(params)
  const [sessionId, setSessionId] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.from('program_sessions')
        .select('id').eq('program_id', workoutId).order('order_index').limit(1).maybeSingle()
      if (sess) { setSessionId(sess.id); return }
      const { data: newSess } = await supabase.from('program_sessions')
        .insert({ program_id: workoutId, order_index: 0, title: '' }).select().single()
      setSessionId(newSess?.id || null)
    }
    load()
  }, [workoutId])

  if (!sessionId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--text3)' }}>Chargement…</div>
  )

  return <SessionBlockEditor sessionId={sessionId} backHref="/workouts" />
}
