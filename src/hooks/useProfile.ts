import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Profile } from '../types/database'

export type UpdateProfileInput = Pick<Profile, 'full_name' | 'currency'>

const selectProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data ?? null) as Profile | null
}

export function useProfile() {
  const { user } = useAuth()
  const userId = user?.id
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => (userId ? selectProfile(userId) : null),
    enabled: !!userId,
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('profiles').update(input).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}