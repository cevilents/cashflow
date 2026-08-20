import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { RecurringTransaction } from '../types/database'

export type RecurringInput = Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at'>

const selectRecurring = async (): Promise<RecurringTransaction[]> => {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .order('next_due_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as RecurringTransaction[]
}

export function useRecurring() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['recurring', user?.id],
    queryFn: selectRecurring,
    enabled: !!user?.id,
  })
}

export function useCreateRecurring() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecurringInput) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('recurring_transactions').insert({ ...input, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Omit<RecurringTransaction, 'id' | 'user_id'>>) => {
      const { error } = await supabase.from('recurring_transactions').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}