import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Transaction, TransactionType } from '../types/database'

const selectTransactions = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Transaction[]
}

export function useTransactions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: selectTransactions,
    enabled: !!user?.id,
  })
}

export interface TransactionInput {
  account_id: string
  type: TransactionType
  category_id: string | null
  amount: number
  to_account_id: string | null
  note: string
  date: string
  receipt_url: string | null
}

export function useCreateTransaction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('transactions').insert({ ...input, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Omit<Transaction, 'id' | 'user_id'>>) => {
      const { error } = await supabase.from('transactions').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}