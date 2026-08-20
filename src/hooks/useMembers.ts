import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Member } from '../lib/members'

const selectMembers = async (): Promise<Member[]> => {
  const { data, error } = await supabase
    .from('members')
    .select('id, name, email, color, icon, password_set')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Member[]
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: selectMembers,
  })
}

const selectSetupComplete = async (): Promise<boolean> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setup_complete')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data?.setup_complete ?? false
}

export function useIsSetupComplete() {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: selectSetupComplete,
  })
}
