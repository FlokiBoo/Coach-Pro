import { supabase } from './supabase'

export async function getCoachId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}
