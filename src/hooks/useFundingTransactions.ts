import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { FundingTransaction } from '../types/database'

export type CreateFundingTransactionInput = Pick<FundingTransaction, 'account_id' | 'amount' | 'date' | 'note'>

const selectFundingTransactions = async (): Promise<FundingTransaction[]> => {
  const { data, error } = await supabase
    .from('funding_transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FundingTransaction[]
}

export function useFundingTransactions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['funding-transactions', user?.id],
    queryFn: selectFundingTransactions,
    enabled: !!user?.id,
  })
}

export function useCreateFundingTransaction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateFundingTransactionInput) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('funding_transactions').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funding-transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
