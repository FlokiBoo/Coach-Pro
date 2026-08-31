import { supabase } from '@/lib/supabase'

// Clone la structure d'un programme "template" (séances + exercices) vers un client, en gardant
// la traçabilité (source_program_id/source_session_id/source_exercise_id) utilisée ailleurs pour
// détecter "déjà assigné" et pour la propagation des modifications ultérieures du template.
// Utilisé à la fois par l'assignation manuelle et par la synchronisation auto groupe -> template.
export async function cloneTemplateToAthlete({ templateProgramId, templateTitle, templateActivityType, athleteId, coachId, groupId = null, batchId = null }) {
  const { data: sessions } = await supabase
    .from('program_sessions')
    .select('*, program_exercises(*)')
    .eq('program_id', templateProgramId)
    .order('order_index')

  const { data: newProg } = await supabase.from('programs')
    .insert({ athlete_id: athleteId, title: templateTitle, coach_id: coachId, source_program_id: templateProgramId, activity_type: templateActivityType, group_id: groupId, group_batch_id: batchId })
    .select().single()
  if (!newProg) return null

  for (const sess of (sessions || [])) {
    const { data: newSess } = await supabase.from('program_sessions')
      .insert({
        program_id: newProg.id, order_index: sess.order_index, title: sess.title || '', source_session_id: sess.id,
        activation: sess.activation || null, coach_notes: sess.coach_notes || null, materiel: sess.materiel || null,
        activation_videos: sess.activation_videos || [], circuits: sess.circuits || [],
        session_type: sess.session_type || null, week_number: sess.week_number,
      })
      .select().single()
    if (!newSess) continue

    const exos = (sess.program_exercises || []).sort((a, b) => a.order_index - b.order_index)
    if (exos.length > 0) {
      await supabase.from('program_exercises').insert(
        exos.map(e => ({
          program_session_id: newSess.id,
          order_index: e.order_index,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          kg: e.kg,
          rest: e.rest,
          note: e.note,
          video_url: e.video_url,
          superset_group: e.superset_group,
          focus_muscles: e.focus_muscles || null,
          pace_base: e.pace_base || null,
          pct_low: e.pct_low,
          pct_high: e.pct_high,
          source_exercise_id: e.id,
        }))
      )
    }
  }
  return newProg
}
